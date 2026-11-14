-- 010 — Security audit fixes. Run once in the Supabase SQL Editor after 009.
--
-- 1) Saves belong to an account id only (no longer "or same e-mail").
--    Matching by e-mail let anyone holding a token with that e-mail (an
--    unconfirmed e-mail account, for example) read, change or delete the save,
--    and let a player stamp another player's id on their own row.
-- 2) Pilot names are also checked by the database (TOP 20 and reserved
--    names), with the same word list as src/utils/pilot-name.js, so a modified
--    game can no longer show an offensive name to every child.

-- ── 1) Saves: owner only ────────────────────────────────────────────────────

-- Old rows created before user_id existed get their account id first, so no
-- player loses access to their save.
update public.saves s
set user_id = u.id
from auth.users u
where s.user_id is null
  and lower(s.email) = lower(u.email);

alter table public.saves enable row level security;

drop policy if exists "users can read own save" on public.saves;
create policy "users can read own save"
on public.saves for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can insert own save" on public.saves;
create policy "users can insert own save"
on public.saves for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
);

drop policy if exists "users can update own save" on public.saves;
create policy "users can update own save"
on public.saves for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own save" on public.saves;
create policy "users can delete own save"
on public.saves for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ── 2) Pilot names checked by the database ─────────────────────────────────

create or replace function public.pilot_name_has_blocked(p_clean text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  blocked_words constant text[] := array[
    'ass','arse','cum','fag','fags','tit','tits','nazi','sex','sexy',
    'porn','porno','rape','kkk','hoe','hoes','wtf','stfu','fu','fck',
    'dick','negro',
    'con','cons','conne','pd','nique','fdp','ntm','tg','bite','zob',
    'cul','pute','putes','caca','crisse','calice','osti','ostie'];
  blocked_parts constant text[] := array[
    'fuck','shit','bitch','cunt','pussy','penis','vagina','nigger',
    'nigga','faggot','whore','slut','bastard','asshole','motherf',
    'retard','hitler','porn','rapist','jizz','boob',
    'connard','conard','connasse','salope','putain','encule','batard',
    'merde','niquer','niquez','pedale','tapette','bougnoul','bicot',
    'couille','branle','tabarnak','tabarnac','ciboire','sacrament',
    'pedophile'];
  words text[];
  squashed text;
  part text;
begin
  words := array_remove(regexp_split_to_array(p_clean, '[^a-z]+'), '');
  if words && blocked_words then
    return true;
  end if;
  squashed := regexp_replace(p_clean, '[^a-z]', '', 'g');
  -- Spelled-out letters (C U L) form one word once joined.
  if coalesce(array_length(words, 1), 0) > 1
     and not exists (select 1 from unnest(words) w where char_length(w) <> 1)
     and squashed = any (blocked_words) then
    return true;
  end if;
  foreach part in array blocked_parts loop
    if strpos(squashed, part) > 0 then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- Same tricks undone as in the game: accents, digits/symbols used for
-- letters, stretched letters (FUUUCK).
create or replace function public.pilot_name_allowed(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with n as (
    select translate(
             translate(lower(coalesce(p_name, '')),
                       'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ',
                       'aaaaaaceeeeiiiinooooouuuuyy'),
             '0@41!|35$7', 'oaaiiiesst') as clean
  )
  select not public.pilot_name_has_blocked(clean)
     and not public.pilot_name_has_blocked(regexp_replace(clean, '(.)\1+', '\1', 'g'))
  from n;
$$;

-- TOP 20: an offensive name is replaced by PILOTE (the score is kept).
create or replace function public.leaderboard_name_filter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.pilot_name_allowed(new.name) then
    new.name := 'PILOTE';
  end if;
  return new;
end;
$$;

drop trigger if exists leaderboard_name_filter on public.leaderboard;
create trigger leaderboard_name_filter
before insert or update of name on public.leaderboard
for each row execute function public.leaderboard_name_filter();

-- Names already on the TOP 20.
update public.leaderboard
set name = 'PILOTE'
where not public.pilot_name_allowed(name);

-- Reserved names: refused by the database (new and renamed ones; names
-- already taken are released below).
delete from public.player_names
where not public.pilot_name_allowed(name);

alter table public.player_names drop constraint if exists player_names_allowed_check;
alter table public.player_names
  add constraint player_names_allowed_check check (public.pilot_name_allowed(name));

-- claim_player_name answers 'invalid' instead of failing on a blocked name.
create or replace function public.claim_player_name(p_name text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := public.player_name_clean(p_name);
begin
  if v_uid is null then
    return 'no_session';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 20
     or not public.pilot_name_allowed(v_name) then
    return 'invalid';
  end if;
  if exists (
    select 1 from public.player_names
    where name_key = lower(v_name) and user_id <> v_uid
  ) then
    return 'taken';
  end if;
  insert into public.player_names (user_id, name)
  values (v_uid, v_name)
  on conflict (user_id) do update set name = excluded.name, updated_at = now();
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;

revoke all on function public.claim_player_name(text) from public, anon;
grant execute on function public.claim_player_name(text) to authenticated;
