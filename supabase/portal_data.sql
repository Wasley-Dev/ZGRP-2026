create table if not exists public.portal_candidates (
  id text primary key,
  full_name text not null,
  gender text not null,
  phone text not null,
  email text not null,
  dob text not null,
  age integer not null,
  address text not null,
  occupation text not null,
  experience_years integer not null,
  position_applied text not null,
  status text not null,
  documents jsonb not null,
  skills jsonb,
  photo_url text,
  created_at text not null,
  notes text,
  source text,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_system_config (
  id text primary key,
  system_name text not null,
  logo_icon text not null,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  maintenance_updated_by text,
  maintenance_updated_at timestamptz,
  backup_hour integer not null default 15,
  updated_at timestamptz not null default now()
);

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

alter table public.portal_candidates enable row level security;
alter table public.portal_system_config enable row level security;
alter table public.portal_bookings enable row level security;
alter table public.portal_sessions enable row level security;

drop policy if exists "portal_candidates_select" on public.portal_candidates;
create policy "portal_candidates_select" on public.portal_candidates
for select to anon using (true);

drop policy if exists "portal_candidates_write" on public.portal_candidates;
create policy "portal_candidates_write" on public.portal_candidates
for all to anon using (true) with check (true);

drop policy if exists "portal_system_config_select" on public.portal_system_config;
create policy "portal_system_config_select" on public.portal_system_config
for select to anon using (true);

drop policy if exists "portal_system_config_write" on public.portal_system_config;
create policy "portal_system_config_write" on public.portal_system_config
for all to anon using (true) with check (true);

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
