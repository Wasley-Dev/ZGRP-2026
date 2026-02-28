alter table if exists public.portal_sessions
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_label text,
  add column if not exists force_logout_reason text,
  add column if not exists forced_out_at timestamptz;
