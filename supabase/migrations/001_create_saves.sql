create table if not exists public.saves (
  email text primary key,
  user_id uuid references auth.users(id),
  password_hash text,
  auth_type text,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null
);

alter table public.saves
add column if not exists user_id uuid references auth.users(id);

create unique index if not exists saves_user_id_key
on public.saves(user_id)
where user_id is not null;

update public.saves s
set user_id = u.id
from auth.users u
where s.user_id is null
  and lower(s.email) = lower(u.email);

alter table public.saves enable row level security;

drop policy if exists "allow save reads" on public.saves;
drop policy if exists "allow save inserts" on public.saves;
drop policy if exists "allow save updates" on public.saves;

drop policy if exists "users can read own save" on public.saves;
create policy "users can read own save"
on public.saves
for select
to authenticated
using (
  auth.uid() = user_id
  or lower(auth.jwt() ->> 'email') = lower(email)
);

drop policy if exists "users can insert own save" on public.saves;
create policy "users can insert own save"
on public.saves
for insert
to authenticated
with check (
  auth.uid() = user_id
  and lower(auth.jwt() ->> 'email') = lower(email)
);

drop policy if exists "users can update own save" on public.saves;
create policy "users can update own save"
on public.saves
for update
to authenticated
using (
  auth.uid() = user_id
  or lower(auth.jwt() ->> 'email') = lower(email)
)
with check (
  auth.uid() = user_id
  and lower(auth.jwt() ->> 'email') = lower(email)
);
