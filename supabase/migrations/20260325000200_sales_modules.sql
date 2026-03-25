-- Sales modules schema (Leads, Targets/KPIs, Invoices)
-- Note: The app uses the Supabase `anon` key without Supabase Auth sign-in.
-- Policies below are permissive so the app works immediately. See `SUPABASE_SCHEMA.md`
-- for a secure RLS setup.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  company text,
  phone text,
  email text,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost')),
  estimated_value numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists leads_user_id_idx on public.leads (user_id);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  invoice_no text not null,
  client text not null,
  amount numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','void')),
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists invoices_user_id_idx on public.invoices (user_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_created_at_idx on public.invoices (created_at desc);

create table if not exists public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null check (year >= 2000 and year <= 2100),
  leads_target integer not null default 0,
  revenue_target numeric not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists sales_targets_user_month_year_uniq on public.sales_targets (user_id, month, year);
create index if not exists sales_targets_created_at_idx on public.sales_targets (created_at desc);

alter table public.leads enable row level security;
alter table public.invoices enable row level security;
alter table public.sales_targets enable row level security;

drop policy if exists "leads_all_anon" on public.leads;
create policy "leads_all_anon" on public.leads for all to anon using (true) with check (true);

drop policy if exists "invoices_all_anon" on public.invoices;
create policy "invoices_all_anon" on public.invoices for all to anon using (true) with check (true);

drop policy if exists "sales_targets_all_anon" on public.sales_targets;
create policy "sales_targets_all_anon" on public.sales_targets for all to anon using (true) with check (true);

