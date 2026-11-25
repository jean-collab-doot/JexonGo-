-- Endless leaderboard: two notes of the Supabase security advisor after 011.
-- Only the Endless functions are changed (TOP 20 / multiplayer untouched).
--  1. endless_hearts: a fixed search_path (like the other functions).
--  2. get_endless_my_best: only for signed-in players (a guest has no best
--     game; anon could call it, it just returned nothing).
-- The other notes are expected: the Endless table has no policy on purpose
-- (no direct read / write, only through these functions), and its functions
-- are SECURITY DEFINER on purpose (they check the player themselves).

create or replace function public.endless_hearts(p_aircraft text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_aircraft
    when 'c130' then 4 when 'a10' then 4 when 'b2' then 4
    when 'sr71' then 2 when 'f117' then 2
    else 3 end;
$$;

revoke execute on function public.get_endless_my_best() from public, anon;
grant execute on function public.get_endless_my_best() to authenticated;
