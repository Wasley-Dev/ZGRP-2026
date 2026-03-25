-- Zaya Group Portal: mid-day attendance checkout approval requests

create table if not exists public.attendance_checkout_requests (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  user_id text not null,
  date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  token_hash text not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists attendance_checkout_requests_attendance_id_idx on public.attendance_checkout_requests (attendance_id);
create index if not exists attendance_checkout_requests_user_date_idx on public.attendance_checkout_requests (user_id, date desc);
create index if not exists attendance_checkout_requests_requested_at_idx on public.attendance_checkout_requests (requested_at desc);

alter table public.attendance_checkout_requests enable row level security;

drop policy if exists "attendance_checkout_requests_all_anon" on public.attendance_checkout_requests;
create policy "attendance_checkout_requests_all_anon"
  on public.attendance_checkout_requests
  for all
  to anon
  using (true)
  with check (true);

