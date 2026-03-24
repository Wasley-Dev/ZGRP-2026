-- Employee Reporting & Performance Management System schema
-- This migration creates the requested tables and indexes.
-- Note: The current app uses the Supabase `anon` key without Supabase Auth sign-in.
-- For that reason, policies below are permissive (like the existing portal_* tables)
-- so the app works immediately. See `SUPABASE_SCHEMA.md` for a secure RLS setup.

create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_user_id_idx on public.reports (user_id);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  check_in timestamptz not null,
  check_out timestamptz,
  date date not null
);

create unique index if not exists attendance_user_date_uniq on public.attendance (user_id, date);
create index if not exists attendance_user_id_idx on public.attendance (user_id);
create index if not exists attendance_date_idx on public.attendance (date desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at asc);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists notices_created_at_idx on public.notices (created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  description text not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_created_at_idx on public.tasks (created_at desc);

create table if not exists public.payroll (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null check (year >= 2000 and year <= 2100),
  basic_salary numeric not null default 0,
  allowances_total numeric not null default 0,
  deductions_total numeric not null default 0,
  net_salary numeric not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists payroll_user_month_year_uniq on public.payroll (user_id, month, year);
create index if not exists payroll_created_at_idx on public.payroll (created_at desc);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payroll (id) on delete cascade,
  breakdown_json jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists payslips_payroll_id_uniq on public.payslips (payroll_id);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null default 'leave' check (type in ('leave','sick')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists leave_requests_user_id_idx on public.leave_requests (user_id);
create index if not exists leave_requests_created_at_idx on public.leave_requests (created_at desc);

-- RLS (permissive, matches existing portal_* style)
alter table public.reports enable row level security;
alter table public.attendance enable row level security;
alter table public.messages enable row level security;
alter table public.notices enable row level security;
alter table public.tasks enable row level security;
alter table public.payroll enable row level security;
alter table public.payslips enable row level security;
alter table public.leave_requests enable row level security;

drop policy if exists "reports_all_anon" on public.reports;
create policy "reports_all_anon" on public.reports for all to anon using (true) with check (true);

drop policy if exists "attendance_all_anon" on public.attendance;
create policy "attendance_all_anon" on public.attendance for all to anon using (true) with check (true);

drop policy if exists "messages_all_anon" on public.messages;
create policy "messages_all_anon" on public.messages for all to anon using (true) with check (true);

drop policy if exists "notices_all_anon" on public.notices;
create policy "notices_all_anon" on public.notices for all to anon using (true) with check (true);

drop policy if exists "tasks_all_anon" on public.tasks;
create policy "tasks_all_anon" on public.tasks for all to anon using (true) with check (true);

drop policy if exists "payroll_all_anon" on public.payroll;
create policy "payroll_all_anon" on public.payroll for all to anon using (true) with check (true);

drop policy if exists "payslips_all_anon" on public.payslips;
create policy "payslips_all_anon" on public.payslips for all to anon using (true) with check (true);

drop policy if exists "leave_requests_all_anon" on public.leave_requests;
create policy "leave_requests_all_anon" on public.leave_requests for all to anon using (true) with check (true);

