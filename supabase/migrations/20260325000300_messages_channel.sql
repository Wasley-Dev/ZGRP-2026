-- Add channels to Team Chat messages (supports Sales-only chat view)

alter table public.messages
  add column if not exists channel text not null default 'general';

create index if not exists messages_channel_created_at_idx on public.messages (channel, created_at asc);

