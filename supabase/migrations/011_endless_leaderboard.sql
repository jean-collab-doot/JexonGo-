-- ENDLESS MODE leaderboard ("Mode Infini" / "Endless Mode"): a NEW table and
-- its functions only. Nothing here reads or changes the TOP 20 (EXP) or the
-- multiplayer leaderboard (public.leaderboard); player names are only read
-- from public.player_names.
--
-- One row per endless game of a signed-in player. Writes only go through the
-- two functions below (no insert / update policy):
--   start_endless_run(aircraft)                      at the start of a game,
--       the server notes the time; returns the run id
--   finish_endless_run(run, correct, errors, best_streak, exercises)
--       at the end; refuses impossible scores; returns 'ok' or a reason
-- Reading: get_endless_leaderboard(limit) and get_endless_my_best().
-- Order: most correct answers, then fewest errors, then whoever reached that
-- result first. One line per player: their best game.

create table if not exists public.endless_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aircraft text not null,
  hearts int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  correct int,
  errors int,
  best_streak int,
  exercises text,
  status text not null default 'started' check (status in ('started', 'finished', 'refused'))
);

create index if not exists endless_runs_best_idx
  on public.endless_runs (user_id, correct desc, errors asc, finished_at asc)
  where status = 'finished';

alter table public.endless_runs enable row level security;
-- No direct access: the functions below are security definer.
drop policy if exists "endless runs: no direct read" on public.endless_runs;

-- Starting hearts of each plane in Endless mode (same table as the game,
-- src/data/endless.js). Unknown plane: 3.
create or replace function public.endless_hearts(p_aircraft text)
returns int
language sql
immutable
as $$
  select case p_aircraft
    when 'c130' then 4 when 'a10' then 4 when 'b2' then 4
    when 'sr71' then 2 when 'f117' then 2
    else 3 end;
$$;

create or replace function public.start_endless_run(p_aircraft text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'no_session';
  end if;
  -- A game left open (closed tab, quit) never counts.
  update public.endless_runs set status = 'refused'
   where user_id = v_user and status = 'started';
  insert into public.endless_runs (user_id, aircraft, hearts)
  values (v_user, left(coalesce(p_aircraft, 't6'), 12), public.endless_hearts(p_aircraft))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_endless_run(
  p_run uuid, p_correct int, p_errors int, p_best_streak int, p_exercises text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_run public.endless_runs%rowtype;
  v_seconds numeric;
begin
  if v_user is null then return 'no_session'; end if;
  select * into v_run from public.endless_runs where id = p_run for update;
  if not found or v_run.user_id <> v_user then return 'unknown_run'; end if;
  if v_run.status <> 'started' then return 'already_finished'; end if;
  v_seconds := extract(epoch from (now() - v_run.started_at));
  -- Impossible scores are refused (kept as 'refused', never shown):
  --  * negative numbers, a streak longer than the correct answers;
  --  * more than one correct answer every 1.2 s since the server start;
  --  * more errors than hearts allow (a heart can come back: plane regen,
  --    crates, refuel... so a generous margin);
  --  * absurd totals.
  if p_correct is null or p_errors is null or p_best_streak is null
     or p_correct < 0 or p_errors < 0 or p_best_streak < 0
     or p_best_streak > p_correct
     or p_correct > 5000
     or p_correct > floor(v_seconds / 1.2)
     or p_errors > v_run.hearts + 30 + floor(p_correct / 5) then
    update public.endless_runs set status = 'refused', finished_at = now(),
      correct = p_correct, errors = p_errors, best_streak = p_best_streak
     where id = p_run;
    return 'refused';
  end if;
  update public.endless_runs
     set status = 'finished', finished_at = now(), correct = p_correct, errors = p_errors,
         best_streak = p_best_streak, exercises = left(coalesce(p_exercises, ''), 60)
   where id = p_run;
  return 'ok';
end;
$$;

-- Best game of each player, ranked.
create or replace function public.get_endless_leaderboard(p_limit int default 20)
returns table (rank bigint, user_id uuid, name text, aircraft text, exercises text,
               correct int, errors int, finished_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.aircraft, r.exercises, r.correct, r.errors, r.finished_at
      from public.endless_runs r
     where r.status = 'finished'
     order by r.user_id, r.correct desc, r.errors asc, r.finished_at asc
  )
  select row_number() over (order by b.correct desc, b.errors asc, b.finished_at asc) as rank,
         b.user_id, coalesce(n.name, 'PILOTE') as name, b.aircraft, b.exercises,
         b.correct, b.errors, b.finished_at
    from best b
    left join public.player_names n on n.user_id = b.user_id
   order by b.correct desc, b.errors asc, b.finished_at asc
   limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- The signed-in player's own best game and rank (also outside the top).
create or replace function public.get_endless_my_best()
returns table (rank bigint, correct int, errors int, finished_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.correct, r.errors, r.finished_at
      from public.endless_runs r
     where r.status = 'finished'
     order by r.user_id, r.correct desc, r.errors asc, r.finished_at asc
  ), ranked as (
    select b.*, row_number() over (order by b.correct desc, b.errors asc, b.finished_at asc) as rank
      from best b
  )
  select rank, correct, errors, finished_at from ranked where user_id = auth.uid();
$$;

revoke all on function public.start_endless_run(text) from public, anon;
revoke all on function public.finish_endless_run(uuid, int, int, int, text) from public, anon;
grant execute on function public.start_endless_run(text) to authenticated;
grant execute on function public.finish_endless_run(uuid, int, int, int, text) to authenticated;
grant execute on function public.get_endless_leaderboard(int) to anon, authenticated;
grant execute on function public.get_endless_my_best() to authenticated;
