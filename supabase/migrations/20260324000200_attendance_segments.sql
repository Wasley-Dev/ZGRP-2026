-- Add segmented attendance support (mid-day checkout + return clock-in)
-- This keeps 1 row per user per day (unique user_id+date) while allowing multiple in/out segments.

alter table public.attendance
add column if not exists segments jsonb not null default '[]'::jsonb;

