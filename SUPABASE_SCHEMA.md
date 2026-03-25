# Supabase Schema (Zaya Group Portal)

This repo already contains permissive Supabase tables/policies for the portal (`supabase/portal_users.sql`, `supabase/portal_data.sql`) which allow the app to work using the Supabase **anon** key (no Supabase Auth sign-in).

This update adds a new migration for the employee system:

- `supabase/migrations/20260324000100_employee_system.sql`

It creates:

- `reports`
- `attendance` (unique: `user_id + date`)
- `messages`
- `notices`
- `tasks`
- `payroll` (unique: `user_id + month + year`)
- `payslips` (unique: `payroll_id`)
- `leave_requests`

## Apply the migration

Option A (Supabase Dashboard SQL Editor):

1. Open Supabase Dashboard → SQL Editor
2. Paste the contents of `supabase/migrations/20260324000100_employee_system.sql`
3. Run

Option B (Supabase CLI migrations):

1. Ensure Supabase CLI is configured for your project
2. Run migrations in `supabase/migrations/`

## “Live across all devices”

Once these tables exist in your Supabase project and the app is configured with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

…then reports/attendance/chat/notices/tasks/payroll data is shared across all devices using Supabase reads/writes, and the UI subscribes to realtime changes where supported.

## SECURITY + RLS (Important)

The current app **does not** sign users in via Supabase Auth; it uses the local `portal_users` directory.

Because of that, the migration keeps **permissive** RLS policies (role `anon`) so the app works immediately.

If you want true security:

- Users only see their own rows
- Admin sees all

…you must migrate login to Supabase Auth and store `user_id` as the Supabase `auth.uid()` (UUID), then switch policies to `authenticated` and enforce `user_id = auth.uid()`.

If you want, I can implement that next (it’s a bigger change: auth migration + user-id mapping + policy hardening).
