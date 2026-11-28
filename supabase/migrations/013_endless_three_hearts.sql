-- Endless mode: every plane now starts with 3 hearts (the game,
-- src/data/endless.js). Only this function of the Endless mode changes; the
-- TOP 20 and the multiplayer board are untouched.
create or replace function public.endless_hearts(p_aircraft text)
returns int
language sql
immutable
set search_path = public
as $$
  select 3;
$$;
