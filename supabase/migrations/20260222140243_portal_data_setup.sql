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
  updated_at timestamptz not null default now()
);

alter table public.portal_candidates enable row level security;
alter table public.portal_system_config enable row level security;

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

