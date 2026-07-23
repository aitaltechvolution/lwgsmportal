# LWGSM Supabase Setup

## How to set up

Run these **in order** in your Supabase dashboard → **SQL Editor**:

### Step 1 — Core schema

```
supabase/00_initial_setup.sql
```

Creates all core tables, enums, RLS policies, helper functions, triggers, and seeds the 10 programmes.

### Step 2 — Communications

```
supabase/migration_communication.sql
```

Adds `messages`, `announcements`, `notifications`, extended profile fields
(nationality, expanded `language_pref`), and the `site_settings` table
(used for the USD→NGN exchange rate). **Required** — `NotificationBell.tsx`,
`MessagesPane.tsx`, and the currency toggle all depend on this.

### Step 3 — Student portal, certificates, public pages

```
supabase/migration_student_portal.sql
supabase/migration_certificates.sql
supabase/migration_public_pages.sql
```

### Step 4 — Feature batches (run in this order)

```
supabase/migration_features_2026.sql
supabase/migration_payments.sql
supabase/migration_certificates_reports.sql
supabase/migration_usage_events.sql
supabase/migration_avatars.sql
```

Lecturer `lecturer_id`-only normalization, the tests/exams question bank +
server-side auto-grading RPC, USD currency ledger columns, private storage
bucket policies, lecturer-typed material content, the full payment system
(Paystack + bank transfer + receipts), certificate eligibility +
`grades_published`, the `usage_events` log for the System Usage report, and
the public `avatars` storage bucket. See the top-level `README.md` for
details and the going-live checklist (Edge Function deploy, Google OAuth,
Paystack key, bank accounts, exchange rate).

### Step 4b — Fixes + live attendance system

```
supabase/new/master_fixes.sql
supabase/new/live_attendance_v2.sql
```

`master_fixes.sql` creates `attendance_sessions` / `attendance_logs` (the
live, session-based attendance system used by the lecturer and student
"Attendance" pages) plus a batch of other fixes. `live_attendance_v2.sql`
**must run after it** and adds: onsite/lecturer-marked check-ins, tightened
per-course RLS, the `attendance_student_summary` reporting view, and
attendance-aware certificate eligibility (off by default — see
`min_attendance_pct` / `require_attendance_for_certificate` in
`site_settings`).

### Step 4c — Link materials + per-course video toggle

```
supabase/new/materials_link_type_and_video_toggle.sql
```

Adds `'link'` to the `material_type` enum (materials can now be File,
Video, or Link — typed "note" text is no longer offered for new
materials, though old note materials keep working), adds
`courses.allow_videos` (default `true`) so an admin can disable video
materials for a specific course, and adds a trigger that enforces that
setting server-side.

### Step 5 — Environment variables

Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 6 — Create your first admin

After running the SQL and creating an account through the UI, update the role manually:

```sql
update public.profiles set role = 'admin' where email = 'mail.livingwatersglobalministry@gmail.com';
```

## Other files in this directory (superseded)

- `lwsm_setup.sql` — an older draft of the initial setup; not used, kept for reference only.
- `migrations/001_init.sql` — original base schema, superseded by `00_initial_setup.sql`.
