alter table if exists public.portal_system_config
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists maintenance_message text,
  add column if not exists maintenance_updated_by text,
  add column if not exists maintenance_updated_at timestamptz,
  add column if not exists backup_hour integer not null default 15;

create table if not exists public.portal_bookings (
  id text primary key,
  booker text not null,
  time text not null,
  purpose text not null,
  remarks text not null,
  created_at text not null,
  created_by_user_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_sessions (
  id text primary key,
  user_id text not null,
  user_name text not null,
  email text not null,
  machine_name text not null,
  os text not null,
  ip text not null,
  last_seen_at timestamptz not null default now(),
  is_online boolean not null default true,
  status text not null default 'ACTIVE'
);

alter table public.portal_bookings enable row level security;
alter table public.portal_sessions enable row level security;

drop policy if exists "portal_bookings_select" on public.portal_bookings;
create policy "portal_bookings_select" on public.portal_bookings
for select to anon using (true);

drop policy if exists "portal_bookings_write" on public.portal_bookings;
create policy "portal_bookings_write" on public.portal_bookings
for all to anon using (true) with check (true);

drop policy if exists "portal_sessions_select" on public.portal_sessions;
create policy "portal_sessions_select" on public.portal_sessions
for select to anon using (true);

drop policy if exists "portal_sessions_write" on public.portal_sessions;
create policy "portal_sessions_write" on public.portal_sessions
for all to anon using (true) with check (true);
