# Living Waters Global School of Ministry (LWGSM)

Full-stack School Management + LMS. React + Vite + TypeScript + Tailwind + Supabase + React Router v6 + i18next.

## Setup

```bash
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
npm run dev
```

## Supabase

Run these migrations **in order** in the Supabase SQL editor (or via the CLI):

1. `supabase/00_initial_setup.sql` — core schema: profiles, programs, courses,
   enrollments, assignments, submissions, attendance, payments, RLS policies.
2. `supabase/migration_communication.sql` — messaging, announcements,
   notifications, extended nationality/language fields, `site_settings`
   table (used for the currency exchange rate).
3. `supabase/migration_student_portal.sql` — student portal additions.
4. `supabase/migration_certificates.sql` — certificate generation/verification.
5. `supabase/migration_public_pages.sql` — public marketing pages content.
6. `supabase/migration_features_2026.sql` — **latest batch**: lecturer_id
   normalization (drops denormalized lecturer_name/title/email from
   `courses`), the tests/exams question bank (`questions`,
   `question_options`, `question_answers`) with a server-side
   `grade_submission()` RPC for tamper-proof auto-grading, USD-based
   currency settings, private `course-materials`/`submissions` storage
   buckets with signed-URL-only access, and support for lecturer-typed
   (non-file) course material content.
7. `supabase/migration_payments.sql` — full payment system: adds the
   "Other Charges" payment type, `method`/`receipt_number` columns,
   auto-generated sequential receipt numbers, hardened RLS so a student
   can only ever insert a `pending` payment row (never `success` directly —
   see Edge Function below), the `bank_accounts` table (admin-editable,
   shown to students on the Bank Transfer screen), and fixed-fee settings
   (`fee_registration`, `fee_certificate`, `paystack_public_key`).
8. `supabase/migration_certificates_reports.sql` — adds `courses.grades_published`
   (the lecturer-controlled flag that drives certificate eligibility), the
   `certificate_eligibility` view, and school-info/notification site_settings.
9. `supabase/migration_usage_events.sql` — `usage_events` table for the
   System Usage report (logins, material views) — starts empty, fills in
   as people use the app going forward.
10. `supabase/migration_avatars.sql` — the public `avatars` storage bucket
    used by the profile-photo upload on all three roles.

### Edge Function — Paystack verification

`supabase/functions/verify-paystack-payment/` is the **only** code path
allowed to mark a payment `success`. The client never trusts its own
Paystack popup callback — it calls this function, which re-verifies the
transaction directly with Paystack's API using your secret key (server-side
only) before writing the result.

```bash
supabase functions deploy verify-paystack-payment
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by
the platform — you don't need to set those yourself.

In **Admin → Settings → Payment Settings**, paste your Paystack **public**
key (never the secret key — that only ever lives in the Edge Function's
environment).

Then:
- Copy your Project URL and `anon` public key into `.env`.
- In **Authentication → Providers**, enable Google OAuth and set the
  redirect URL to `{your-site-url}/student` (see `AuthContext.tsx`).
- In **Storage**, confirm the `course-materials` and `submissions` buckets
  exist and are marked private (the migration above also enforces this).

The schema has full RLS policies throughout (students see their own data,
lecturers see their courses, admins see everything).

## Key features

- **Tests & Exams** — lecturers build multiple-choice, true/false, and
  short-answer questions per assignment (`/lecturer/assessments/:id/questions`).
  Students get a timed, auto-graded test-taking UI; grading happens
  server-side so a tampered client can't write its own score. Lecturers can
  alternatively link out to an externally-hosted test (e.g. Google Forms)
  and enter scores manually.
- **Certificates** — a student becomes eligible for a programme's
  certificate once they're enrolled in every course of that programme and
  each course's lecturer has published grades for it
  (`courses.grades_published`, toggled from the Gradebook). Admins issue
  certificates with one click (auto-generates a `LWGSM-YYYY-NNNNN` number
  and a QR code linking to `/verify`), preview/print/download them as a
  styled PDF, and can verify/revoke. Students see a live eligibility
  tracker and can request physical collection (creates a pending payment).
- **Reports & Analytics** (`/admin/reports`) — five bilingual tabs
  (Enrollment, Student Performance, Attendance, Revenue, System Usage)
  with recharts visualizations, date/course filters, CSV export, and print
  support. System Usage is powered by a lightweight `usage_events` log
  (logins, material views) that starts empty and fills in with real
  activity. Attendance falls back to submission timestamps as an
  approximate signal for courses with no attendance records yet.
- **Payment system** — students pay Registration, Tuition, Certificate,
  Premium Material, or Other Charges fees via Paystack (instant, verified
  server-side) or bank transfer (pending admin confirmation). Every
  successful payment gets a sequential receipt number and a printable
  receipt. Admins get a revenue dashboard (by-type and monthly-trend
  charts), full transaction search/filtering, one-click transfer
  confirmation, and CSV export.
- **Currency toggle** — all amounts are stored in USD; a USD/Naira toggle
  (`CurrencyToggle`) lets anyone view amounts in either currency, using an
  exchange rate admins set in **Admin → Settings**.
- **Lecturer data via `lecturer_id` only** — course lecturer name/title/email
  are always joined live from `profiles`, never duplicated onto `courses`,
  so editing a lecturer's name or title updates everywhere instantly.
- **Private, view-only course materials** — files live in a private bucket;
  the app always requests a short-lived signed URL right before rendering
  in-page (`SecureFileViewer`), so materials are never directly downloadable
  or linkable. Lecturers can also type material content directly instead of
  uploading a file.
- **Site-wide copy protection** — text and files can't be selected, copied,
  or right-clicked out of the app; pasting into forms still works normally.
- **Google sign-in & expanded registration** — students can register with
  email/password or Google; the registration form collects nationality and
  a preferred language from 10 options (English, French, Spanish,
  Portuguese, Arabic, Swahili, Hausa, Yoruba, Igbo, Chinese).
- **Profile management** — all three roles can upload an avatar
  (click-to-upload, stored in the public `avatars` bucket), edit their
  details, and change their password (re-verifies the current password
  via a real sign-in check first, not just the active session).
- **Admin settings** — school name/tagline (EN+FR), fee amounts, Paystack
  key, bank accounts, currency exchange rate, and notification toggles are
  all editable from `/admin/settings`, backed by `site_settings`.
- **Error boundaries** — a top-level boundary catches anything that
  escapes routing; a route-level one resets automatically on navigation so
  one broken page doesn't take down the whole app.

## Design system

- Background: `rgba(0,0,24,1)` (navy)
- Text/accent: `rgba(200,200,250,1)` (lavender)
- Brand: `#f97316` (orange)
- Font: Inter
- Cards: navy bg + orange left border
- Buttons: `.btn-primary` (orange fill) / `.btn-outline` (orange outline)

## i18n

- English + French are the only fully-translated UI languages, via `i18next`.
- All 10 languages used elsewhere in the app (registration, profile
  preference) are registered in `i18n/config.ts` so `i18n.changeLanguage()`
  always succeeds; any code other than `en`/`fr` falls back to the English
  bundle gracefully rather than warning or no-op'ing.
- A user's saved `language_pref` is applied automatically the moment their
  profile loads (login, refresh) — not just when they re-save their
  Profile page — via `AuthContext`.
- Language toggle in navbar persists to `localStorage` under `lwgsm_lang`.
- Most portal pages use an inline `lang === "en" ? X : Y` pattern rather
  than `t()` keys (the public marketing site and auth pages use real
  i18next keys in `i18n/en.json` / `i18n/fr.json`). Both patterns
  degrade to English for any language code besides French.

## Going-live checklist

After running every migration in order:

1. **Google OAuth** — enable the Google provider in Authentication →
   Providers, redirect URL `{your-site}/student`.
2. **Paystack Edge Function** — `supabase functions deploy verify-paystack-payment`,
   then `supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...`.
3. **Paystack public key** — paste it in Admin → Settings → Payment Settings.
4. **Bank accounts** — edit the seeded FCMB/UBA/Wema placeholders with real
   account numbers in Admin → Settings → Bank Accounts, then activate them.
5. **Exchange rate** — set the USD→NGN rate in Admin → Settings → Currency
   Settings.
6. **First admin** — `update public.profiles set role = 'admin' where email = '...'`
   after creating an account through the UI.
7. **Storage buckets** — confirm `course-materials` and `submissions` are
   private, and `avatars` is public (the migrations enforce this, but it's
   worth a glance in the Storage dashboard).

## Roles & routing

- `/` `/programs` `/about` `/contact` — public
- `/login` `/register` `/forgot-password` `/reset-password` — auth
- `/student/*` — students only
- `/lecturer/*` — lecturers only
- `/admin/*` — admins only

`ProtectedRoute` redirects unauthenticated users to `/login` and wrong-role users to their portal.
"# lwgsmportal" 
