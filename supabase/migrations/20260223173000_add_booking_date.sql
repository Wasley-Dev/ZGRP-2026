alter table if exists public.portal_bookings
  add column if not exists date text;

update public.portal_bookings
set date = coalesce(nullif(date, ''), substring(created_at from 1 for 10))
where date is null or date = '';

alter table if exists public.portal_bookings
  alter column date set not null;
