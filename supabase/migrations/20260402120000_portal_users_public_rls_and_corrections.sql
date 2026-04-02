-- Allow the desktop + web clients (anon key) to keep the portal user directory consistent across machines.
-- NOTE: This is intentionally permissive for this internal portal. Tighten if you later add Supabase Auth.

do $$
begin
  -- Ensure table exists before applying policies.
  if to_regclass('public.portal_users') is null then
    raise notice 'public.portal_users does not exist; skipping';
    return;
  end if;
end $$;

-- If RLS is enabled, these policies allow the public (anon) client to read/write user directory rows.
alter table public.portal_users enable row level security;

do $$
begin
  create policy "portal_users_public_select" on public.portal_users
    for select
    using (true);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "portal_users_public_insert" on public.portal_users
    for insert
    with check (true);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "portal_users_public_update" on public.portal_users
    for update
    using (true)
    with check (true);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "portal_users_public_delete" on public.portal_users
    for delete
    using (true);
exception when duplicate_object then
  null;
end $$;

-- Canonical employee corrections requested (April 2026).
-- These updates make Vercel + desktop match immediately after refresh.

update public.portal_users
set
  role = 'SUPER_ADMIN',
  job_title = 'Head of Department',
  base_salary = 500000,
  phone = '+255650787961'
where lower(email) = 'it@zayagroupltd.com';

update public.portal_users
set
  job_title = 'Receptionist',
  base_salary = 300000
where lower(email) = 'zahra@zayagroupltd.com';

update public.portal_users
set
  job_title = 'Sales Executive',
  base_salary = 200000
where lower(email) in ('fatma.mbarouk.khamis@zaya.local', 'suhaib.abdallah.saleh@zaya.local');

update public.portal_users
set
  name = regexp_replace(name, '^\\s*Abdulhamin\\b', 'Abdulhamid', 'i'),
  job_title = 'Gateman',
  base_salary = 150000
where lower(name) like 'abdulhamin%';

update public.portal_users
set
  job_title = 'Office Cleaner',
  base_salary = 150000
where lower(name) like 'haulat%';

