# Supabase Schema (Zaya Group Portal)

This repo already contains permissive Supabase tables/policies for the portal (`supabase/portal_users.sql`, `supabase/portal_data.sql`) which allow the app to work using the Supabase **anon** key (no Supabase Auth sign-in).

This update adds a new migration for the employee system:

- `supabase/migrations/20260324000100_employee_system.sql`
- `supabase/migrations/20260324000200_attendance_segments.sql` (adds `segments` to `attendance` for mid-day out/in)
- `supabase/migrations/20260325000100_attendance_checkout_requests.sql` (GM approval requests)
- `supabase/migrations/20260325000200_sales_modules.sql` (Leads, Invoices, Sales Targets/KPIs)
- `supabase/migrations/20260325000300_messages_channel.sql` (adds `channel` to `messages` for Sales chat)

It creates:

- `reports`
- `attendance` (unique: `user_id + date`)
- `attendance_checkout_requests` (GM approval requests)
- `messages` (optionally includes `channel`)
- `notices`
- `tasks`
- `payroll` (unique: `user_id + month + year`)
- `payslips` (unique: `payroll_id`)
- `leave_requests`
- `leads`
- `invoices`
- `sales_targets` (unique: `user_id + month + year`)

## Apply the migration

Option A (Supabase Dashboard SQL Editor):

1. Open Supabase Dashboard → SQL Editor
2. Paste/run each migration in order:
   - `supabase/migrations/20260324000100_employee_system.sql`
   - `supabase/migrations/20260324000200_attendance_segments.sql`
   - `supabase/migrations/20260325000100_attendance_checkout_requests.sql`
   - `supabase/migrations/20260325000200_sales_modules.sql`
   - `supabase/migrations/20260325000300_messages_channel.sql`
   - Important: do not run `20260324000200_attendance_segments.sql` before `20260324000100_employee_system.sql` or you will get `relation "public.attendance" does not exist`.
3. If you still see “schema cache” errors, wait ~60 seconds then refresh, or run this in SQL Editor:
   - `notify pgrst, 'reload schema';`

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
