create table if not exists public.saves (
  email text primary key,
  password_hash text,
  auth_type text,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null
);

alter table public.saves enable row level security;

drop policy if exists "allow save reads" on public.saves;
create policy "allow save reads"
on public.saves
for select
to anon
using (true);

drop policy if exists "allow save inserts" on public.saves;
create policy "allow save inserts"
on public.saves
for insert
to anon
with check (true);

drop policy if exists "allow save updates" on public.saves;
create policy "allow save updates"
on public.saves
for update
to anon
using (true)
with check (true);
