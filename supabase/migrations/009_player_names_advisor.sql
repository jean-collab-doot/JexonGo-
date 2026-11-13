-- Player names (008) as the Supabase security advisor wants them:
--  - every function has a fixed search_path (and names its schemas)
--  - no SECURITY DEFINER: the functions run with the caller's own rights.
--    Names are public (read policy of 008) and a signed-in player may write
--    only their own row (policies below), so nothing changes for the game:
--    is_player_name_available() still works without an account,
--    claim_player_name() still reserves a name for the signed-in account.
-- Same results as 008; run it once in the SQL Editor after 008.

create or replace function public.player_name_clean(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
$$;

drop policy if exists "players reserve own name" on public.player_names;
create policy "players reserve own name"
on public.player_names for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "players rename own name" on public.player_names;
create policy "players rename own name"
on public.player_names for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.is_player_name_available(p_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (
    select 1 from public.player_names
    where name_key = lower(public.player_name_clean(p_name))
      and user_id is distinct from (select auth.uid())
  );
$$;

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
