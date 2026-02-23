create table if not exists public.portal_users (
  id text primary key,
  name text not null,
  email text not null unique,
  phone text,
  password text not null,
  has_completed_orientation boolean not null default false,
  role text not null,
  department text not null,
  avatar text,
  last_login text not null default 'Never',
  status text not null default 'ACTIVE',
  updated_at timestamptz not null default now()
);

alter table public.portal_users enable row level security;

drop policy if exists "portal_users_select" on public.portal_users;
create policy "portal_users_select" on public.portal_users
for select
to anon
using (true);

drop policy if exists "portal_users_insert" on public.portal_users;
create policy "portal_users_insert" on public.portal_users
for insert
to anon
with check (true);

drop policy if exists "portal_users_update" on public.portal_users;
create policy "portal_users_update" on public.portal_users
for update
to anon
using (true)
with check (true);

drop policy if exists "portal_users_delete" on public.portal_users;
create policy "portal_users_delete" on public.portal_users
for delete
to anon
using (true);

