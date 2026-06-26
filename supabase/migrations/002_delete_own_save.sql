alter table public.saves enable row level security;

drop policy if exists "users can delete own save" on public.saves;

create policy "users can delete own save"
on public.saves
for delete
to authenticated
using (auth.uid() = user_id);
