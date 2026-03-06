alter table public.portal_system_config add column if not exists login_hero_image text;
alter table public.portal_system_config add column if not exists login_hero_images jsonb;
alter table public.portal_system_config add column if not exists login_showcase_title text;
alter table public.portal_system_config add column if not exists login_showcase_summary text;
alter table public.portal_system_config add column if not exists login_quote text;
alter table public.portal_system_config add column if not exists login_quote_author text;
alter table public.portal_system_config add column if not exists login_facts jsonb;
