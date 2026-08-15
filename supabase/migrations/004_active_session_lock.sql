-- Single-active-session lock: a second device signing into an account that
-- already has a live session elsewhere gets refused instead of taking over.
alter table public.saves
add column if not exists active_session_id text;

alter table public.saves
add column if not exists active_session_at bigint;
