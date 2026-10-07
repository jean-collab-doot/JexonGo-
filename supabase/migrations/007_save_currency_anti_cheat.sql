-- Coins / EXP anti-cheat for cloud saves.
-- The game writes its own save (data jsonb), so a modified client could send
-- any amount of coins or EXP. Same idea as the leaderboard (migration 006):
-- the database caps how fast these numbers may grow with a reserve that only
-- the database manages (coin_credit / xp_credit, never sent by the game):
--   * coins: reserve of 12000 (largest burst: LEGEND rank 4000 + day-7
--     reward 1000 + chests and level rewards), refills by 2 coins per second;
--   * EXP: reserve of 4000 (largest single reward: 1500 EXP chest), refills
--     by 5 EXP per second, like the leaderboard.
-- A gain above the reserve is refused; the game sends its total again later
-- and the rest is accepted as the reserve refills, so an honest player is
-- never blocked, only slowed in the rare case of a huge burst.
-- Spending (a value going down) is always allowed.
-- First upload: a value that did not exist yet in the save (new account
-- receiving its guest progress) is accepted as is. Once a value exists it
-- can never be removed, or a client could drop it and re-add any amount.
-- Admins (SQL editor, service role) are not limited.

alter table public.saves
  add column if not exists coin_credit numeric not null default 12000,
  add column if not exists xp_credit   numeric not null default 4000,
  add column if not exists credit_at   timestamptz not null default now();

-- A number stored in the save json, or null when absent / not a number.
create or replace function public.save_number(doc jsonb, key text)
returns numeric
language sql
immutable
as $$
  select case when jsonb_typeof(doc -> key) = 'number' then (doc ->> key)::numeric end
$$;

create or replace function public.saves_cap_currency()
returns trigger
language plpgsql
as $$
declare
  coin_max    constant numeric := 12000;
  coin_rate   constant numeric := 2;
  xp_max      constant numeric := 4000;
  xp_rate     constant numeric := 5;
  xp_keys     constant text[]  := array['xp', 'totalXpEarned', 'lifetimeXpEarned', 'multiXpEarned'];
  elapsed     numeric;
  coin_credit numeric;
  xp_credit   numeric;
  old_value   numeric;
  new_value   numeric;
  gain        numeric;
  xp_used     numeric := 0;
  k           text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.coin_credit := coin_max;
    new.xp_credit := xp_max;
    new.credit_at := now();
    return new;
  end if;

  elapsed := greatest(0, extract(epoch from now() - old.credit_at));
  coin_credit := least(coin_max, old.coin_credit + coin_rate * elapsed);
  xp_credit := least(xp_max, old.xp_credit + xp_rate * elapsed);

  -- Coins
  old_value := public.save_number(old.data, 'coins');
  new_value := public.save_number(new.data, 'coins');
  if old_value is not null and new_value is null then
    new.data := jsonb_set(new.data, '{coins}', to_jsonb(old_value));
  elsif old_value is not null and new_value > old_value then
    gain := least(new_value - old_value, floor(coin_credit));
    new.data := jsonb_set(new.data, '{coins}', to_jsonb(old_value + gain));
    coin_credit := coin_credit - gain;
  end if;

  -- EXP counters grow together (one reward raises all of them), so they share
  -- one reserve: each may grow by at most the reserve, and the reserve pays
  -- for the biggest of those gains.
  foreach k in array xp_keys loop
    old_value := public.save_number(old.data, k);
    new_value := public.save_number(new.data, k);
    if old_value is not null and new_value is null then
      new.data := jsonb_set(new.data, array[k], to_jsonb(old_value));
    elsif old_value is not null and new_value > old_value then
      gain := least(new_value - old_value, floor(xp_credit));
      new.data := jsonb_set(new.data, array[k], to_jsonb(old_value + gain));
      xp_used := greatest(xp_used, gain);
    end if;
  end loop;
  xp_credit := xp_credit - xp_used;

  -- The game can never set its own reserve.
  new.coin_credit := coin_credit;
  new.xp_credit := xp_credit;
  new.credit_at := now();
  return new;
end;
$$;

drop trigger if exists saves_cap_currency on public.saves;
create trigger saves_cap_currency
before insert or update on public.saves
for each row execute function public.saves_cap_currency();
