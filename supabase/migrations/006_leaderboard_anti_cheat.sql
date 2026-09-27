-- TOP 20 anti-cheat: a player writes their own leaderboard row from the game,
-- so a modified client could send any EXP. The database now caps how fast a
-- score may grow with a reserve ("xp_credit", managed here, never by the game):
--   * the reserve holds at most 3000 EXP (the biggest single reward is a
--     1500 EXP chest) and refills by 5 EXP per second (a level gives at most
--     ~300 EXP and lasts more than a minute),
--   * each EXP gain is taken from the reserve; what exceeds it is refused.
-- The cap only delays an honest player: the game sends its full total again
-- on the next EXP gain and the rest is accepted as the reserve refills.
-- A score may go down (save reset). multi_xp is part of xp: it grows at most
-- as much as xp and never exceeds it. updated_at is set by the server.
-- Admins (SQL editor) are not limited.
alter table public.leaderboard
  add column if not exists xp_credit numeric not null default 3000;

create or replace function public.leaderboard_cap_growth()
returns trigger
language plpgsql
as $$
declare
  max_credit constant numeric := 3000;
  per_second constant numeric := 5;
  credit numeric;
  gain bigint;
begin
  if current_user not in ('anon', 'authenticated') then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.xp := least(new.xp, max_credit::bigint);
    new.multi_xp := least(new.multi_xp, new.xp);
    new.xp_credit := max_credit - new.xp;
  else
    new.user_id := old.user_id;
    credit := least(max_credit,
      old.xp_credit + per_second * greatest(0, extract(epoch from now() - old.updated_at)));
    gain := least(greatest(new.xp - old.xp, 0), floor(credit)::bigint);
    if new.xp > old.xp then
      new.xp := old.xp + gain;
    end if;
    new.multi_xp := least(new.multi_xp, old.multi_xp + gain, new.xp);
    new.xp_credit := credit - gain;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leaderboard_cap_growth on public.leaderboard;
create trigger leaderboard_cap_growth
before insert or update on public.leaderboard
for each row execute function public.leaderboard_cap_growth();
