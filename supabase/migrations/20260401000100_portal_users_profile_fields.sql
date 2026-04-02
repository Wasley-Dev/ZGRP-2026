-- Add optional HR/profile fields to the portal user directory.
-- This enables job titles, base salary, and manual performance scoring to persist in Supabase.

alter table if exists public.portal_users
  add column if not exists job_title text,
  add column if not exists base_salary numeric,
  add column if not exists performance_score numeric;

