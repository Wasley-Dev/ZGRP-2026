-- Extend sales leads with follow-up + reminder tracking
-- This supports: follow-up reminders and consistent syncing across machines.

alter table if exists public.leads
  add column if not exists follow_up_at date,
  add column if not exists follow_up_notes text,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists leads_follow_up_at_idx on public.leads (follow_up_at);
create index if not exists leads_reminder_sent_at_idx on public.leads (reminder_sent_at);

