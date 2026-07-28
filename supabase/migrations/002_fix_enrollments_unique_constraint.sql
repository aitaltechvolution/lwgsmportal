-- supabase/migrations/002_fix_enrollments_unique_constraint.sql
--
-- FIX: "Application was approved, but enrolling the student in the course
-- failed."
--
-- Root cause: supabase/functions/process-application-decision/index.ts does
--
--   admin.from("enrollments").upsert(
--     { student_id, course_id, program_id, status: "active" },
--     { onConflict: "student_id,course_id" }
--   )
--
-- `onConflict` only works if there is an actual UNIQUE constraint/index on
-- exactly those columns. 00_initial_setup.sql (the schema this project
-- actually runs, per supabase/README.md) only ever created plain, separate
-- indexes on student_id and course_id — never a composite unique constraint:
--
--   create index idx_enr_student on public.enrollments(student_id);
--   create index idx_enr_course  on public.enrollments(course_id);
--
-- Without it, every upsert throws Postgres error 42P10 ("there is no unique
-- or exclusion constraint matching the ON CONFLICT specification"), which
-- surfaces to the admin as the enrollment failure — on every single
-- approval, not intermittently.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

-- 1. Defensive cleanup: if any duplicate (student_id, course_id) rows
--    already exist (e.g. from retried approvals or manual inserts before
--    this fix), keep the oldest one so the unique constraint below can be
--    added without erroring.
delete from public.enrollments a
using public.enrollments b
where a.id < b.id
  and a.student_id = b.student_id
  and a.course_id = b.course_id;

-- 2. The actual fix: add the composite unique constraint the upsert relies on.
alter table public.enrollments
  add constraint enrollments_student_course_unique unique (student_id, course_id);
