-- Unique player names: the name shown in the game, the multiplayer and the
-- TOP 20 belongs to one account (whatever the capitals: MAX = max).
-- The game reserves it after sign-in (src/systems/player-names.js):
--   claim_player_name(name)        takes a name for the signed-in account
--                                  ('ok', 'taken', 'invalid', 'no_session')
--   is_player_name_available(name) for the sign-up form (no account yet)
-- Names chosen before this table existed are reserved when their player
-- signs in again: the first one keeps the name.
create table if not exists public.player_names (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 20),
  name_key text generated always as (lower(name)) stored,
  updated_at timestamptz not null default now()
);

create unique index if not exists player_names_name_key_idx on public.player_names (name_key);

alter table public.player_names enable row level security;

-- Names are public (they are on the TOP 20). No insert / update policy:
-- writes only go through claim_player_name().
drop policy if exists "player names are public" on public.player_names;
create policy "player names are public"
on public.player_names for select
to anon, authenticated
using (true);

-- Same spacing as the game: no spaces around, one space between words.
create or replace function public.player_name_clean(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
$$;

create or replace function public.is_player_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.player_names
    where name_key = lower(public.player_name_clean(p_name))
      and user_id is distinct from auth.uid()
  );
$$;

create or replace function public.claim_player_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := public.player_name_clean(p_name);
begin
  if v_uid is null then
    return 'no_session';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 20 then
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
grant execute on function public.is_player_name_available(text) to anon, authenticated;

-- TOP 20 names up to 20 characters (they were cut at 16).
alter table public.leaderboard drop constraint if exists leaderboard_name_check;
alter table public.leaderboard
  add constraint leaderboard_name_check check (char_length(name) between 1 and 20);
