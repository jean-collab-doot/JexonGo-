-- TEST (run by hand in the Supabase SQL editor, or on a copy / branch of the
-- database, AFTER 011_endless_leaderboard.sql). It checks the order of the
-- Endless leaderboard on a tie, then removes everything it created.
--   A: 50 correct, 2 errors, finished at 10:00
--   B: 50 correct, 2 errors, finished at 10:05
--   C: 50 correct, 1 error,  finished at 10:10
-- Expected order: C (fewer errors), A (same score as B, reached first), B.
-- The three test players are fake auth users created and deleted here.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'endless-test-a@example.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'endless-test-b@example.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'endless-test-c@example.invalid');

insert into public.endless_runs (user_id, aircraft, hearts, started_at, finished_at, correct, errors, best_streak, exercises, status) values
  ('00000000-0000-0000-0000-00000000000a', 't6', 3, '2026-11-25 09:50', '2026-11-25 10:00', 50, 2, 20, '+ −', 'finished'),
  ('00000000-0000-0000-0000-00000000000b', 't6', 3, '2026-11-25 09:55', '2026-11-25 10:05', 50, 2, 20, '+ −', 'finished'),
  ('00000000-0000-0000-0000-00000000000c', 't6', 3, '2026-11-25 10:00', '2026-11-25 10:10', 50, 1, 20, '+ −', 'finished');

-- The three test players, in leaderboard order: should read c, a, b.
select rank, user_id, correct, errors, finished_at
  from public.get_endless_leaderboard(100)
 where user_id::text like '00000000-0000-0000-0000-00000000000%'
 order by rank;

rollback;   -- nothing is kept
