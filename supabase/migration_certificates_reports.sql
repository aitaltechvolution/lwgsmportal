-- ============================================================
-- LWGSM — Certificates, Reports & Settings Migration
-- Run this AFTER migration_payments.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. COURSE COMPLETION / GRADES-PUBLISHED FLAG
--    Certificate eligibility is course-level, not per-grade:
--    a course's grades count as "published" once its lecturer (or
--    an admin) flips this flag — typically once every student's
--    score for that course is finalized. This replaces an existing
--    but never-deployed `grades.is_published` column referenced by
--    the lecturer Gradebook UI (that column only existed in an
--    old draft migration, never in the schema actually shipped).
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS grades_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS grades_published_at timestamptz;

-- ────────────────────────────────────────────────────────────
-- 2. CERTIFICATE ELIGIBILITY
--    A student is eligible for a program's certificate once:
--      a) they are actively/completed-enrolled in every course of
--         that program, AND
--      b) every one of those courses has grades_published = true.
--    This is a read-only helper view, not a table — it always
--    reflects live data rather than something that can go stale.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.certificate_eligibility AS
WITH program_courses AS (
  SELECT program_id, id AS course_id FROM public.courses WHERE program_id IS NOT NULL
),
student_programs AS (
  SELECT DISTINCT student_id, program_id
  FROM public.enrollments
  WHERE program_id IS NOT NULL AND status IN ('active', 'completed')
),
per_student_program AS (
  SELECT
    sp.student_id,
    sp.program_id,
    count(pc.course_id) AS total_courses,
    count(pc.course_id) FILTER (WHERE e.id IS NOT NULL) AS enrolled_courses,
    count(pc.course_id) FILTER (WHERE c.grades_published) AS published_courses
  FROM student_programs sp
  JOIN program_courses pc ON pc.program_id = sp.program_id
  JOIN public.courses c ON c.id = pc.course_id
  LEFT JOIN public.enrollments e
    ON e.course_id = pc.course_id AND e.student_id = sp.student_id AND e.status IN ('active', 'completed')
  GROUP BY sp.student_id, sp.program_id
)
SELECT
  psp.student_id,
  psp.program_id,
  psp.total_courses,
  psp.enrolled_courses,
  psp.published_courses,
  CASE WHEN psp.total_courses > 0 THEN round(100.0 * psp.published_courses / psp.total_courses) ELSE 0 END AS pct_published,
  (psp.total_courses > 0 AND psp.enrolled_courses = psp.total_courses AND psp.published_courses = psp.total_courses) AS is_eligible,
  EXISTS (
    SELECT 1 FROM public.certificates cert WHERE cert.student_id = psp.student_id AND cert.program_id = psp.program_id
  ) AS already_issued
FROM per_student_program psp;

-- Views inherit RLS from their underlying tables when queried through
-- PostgREST under security_invoker; make that explicit so this view
-- can never be used to bypass the enrollments/courses RLS policies.
ALTER VIEW public.certificate_eligibility SET (security_invoker = true);

-- ────────────────────────────────────────────────────────────
-- 3. CERTIFICATE COMPLETION DATE
--    completion_date should default to "now" when an admin issues a
--    certificate, unless they override it. No schema change needed
--    (column already exists) — handled at insert time by the app.
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 4. SCHOOL INFO + NOTIFICATION SETTINGS (admin-configurable)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.site_settings (key, value) VALUES
  ('school_name_en', 'Living Waters Global School of Ministry'),
  ('school_name_fr', 'École Mondiale du Ministère des Eaux Vives'),
  ('school_tagline_en', 'Equipping leaders for global ministry impact.'),
  ('school_tagline_fr', 'Former des leaders pour un impact ministériel mondial.'),
  ('notify_new_enrollment', 'true'),
  ('notify_payment_received', 'true'),
  ('notify_certificate_issued', 'true'),
  ('notify_sms_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
