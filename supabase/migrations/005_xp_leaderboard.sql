-- TOP 20 MONDIAL (lobby): one public row per real player account with its
-- pilot name and scores — nothing else (no email, no save data).
--   xp        EXP earned since the player started (save "lifetimeXpEarned")
--   multi_xp  EXP earned in multiplayer games with a real teammate
-- Everyone may read the table (the leaderboard); a signed-in player may only
-- write their own row. It is published to Supabase Realtime so the lobby
-- leaderboard updates live.
drop function if exists public.xp_leaderboard(int);

create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'PILOTE' check (char_length(name) between 1 and 16),
  xp bigint not null default 0 check (xp >= 0),
  multi_xp bigint not null default 0 check (multi_xp >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_xp_idx on public.leaderboard (xp desc);
create index if not exists leaderboard_multi_xp_idx on public.leaderboard (multi_xp desc);

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard is public" on public.leaderboard;
create policy "leaderboard is public"
on public.leaderboard for select
to anon, authenticated
using (true);

drop policy if exists "players insert own score" on public.leaderboard;
create policy "players insert own score"
on public.leaderboard for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "players update own score" on public.leaderboard;
create policy "players update own score"
on public.leaderboard for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Live updates for the lobby leaderboard.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leaderboard'
  ) then
    alter publication supabase_realtime add table public.leaderboard;
  end if;
end $$;

-- Players who already have a cloud save start with their current EXP.
insert into public.leaderboard (user_id, name, xp, multi_xp)
select
  s.user_id,
  left(coalesce(nullif(trim(s.data->>'playerName'), ''), 'PILOTE'), 16),
  case when (s.data->>'lifetimeXpEarned') ~ '^[0-9]+(\.[0-9]+)?$'
       then floor((s.data->>'lifetimeXpEarned')::numeric)::bigint else 0 end,
  case when (s.data->>'multiXpEarned') ~ '^[0-9]+(\.[0-9]+)?$'
       then floor((s.data->>'multiXpEarned')::numeric)::bigint else 0 end
from public.saves s
where s.user_id is not null
on conflict (user_id) do nothing;
