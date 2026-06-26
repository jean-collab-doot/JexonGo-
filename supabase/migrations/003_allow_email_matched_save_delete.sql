alter table public.saves enable row level security;

drop policy if exists "users can read own save" on public.saves;
create policy "users can read own save"
on public.saves
for select
to authenticated
using (
  auth.uid() = user_id
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "users can update own save" on public.saves;
create policy "users can update own save"
on public.saves
for update
to authenticated
using (
  auth.uid() = user_id
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  auth.uid() = user_id
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "users can delete own save" on public.saves;
create policy "users can delete own save"
on public.saves
for delete
to authenticated
using (
  auth.uid() = user_id
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
