-- supabase/migrations/009_fix_certificate_eligibility_course_programs.sql
--
-- FIX: certificate_eligibility only considered a course "under a program"
-- via the primary `courses.program_id` column:
--
--   program_courses AS (
--     SELECT program_id, id AS course_id FROM public.courses WHERE program_id IS NOT NULL
--   )
--
-- It never checked the `course_programs` join table (used for courses
-- linked to a program as a secondary/additional link — the same gap just
-- fixed in Admissions.tsx and process-application-decision). Any course
-- linked to a program *only* that way was invisible to this view — it
-- wouldn't count toward `total_courses`/`passing_courses` at all, so a
-- student could finish it and it simply wouldn't factor into their
-- eligibility, and it wouldn't show up as a missing/incomplete course
-- either.
--
-- This recreates the view identically except `program_courses` now
-- unions both sources (UNION, not UNION ALL, so a course linked to the
-- same program both ways isn't double-counted).
--
-- Run this once in the Supabase SQL editor.

CREATE OR REPLACE VIEW public.certificate_eligibility AS
WITH program_courses AS (
  SELECT program_id, id AS course_id FROM public.courses WHERE program_id IS NOT NULL
  UNION
  SELECT program_id, course_id FROM public.course_programs
),
student_programs AS (
  SELECT DISTINCT student_id, program_id
  FROM public.enrollments
  WHERE program_id IS NOT NULL AND status IN ('active', 'completed')
),
course_material_counts AS (
  SELECT course_id, count(*) AS total_materials
  FROM public.course_materials
  GROUP BY course_id
),
course_assessment AS (
  SELECT
    e.student_id, a.course_id,
    count(a.id) AS total_assignments,
    count(s.id) FILTER (WHERE s.score IS NOT NULL) AS graded_assignments,
    round(avg((s.score / NULLIF(a.max_score, 0)) * 100) FILTER (WHERE s.score IS NOT NULL)) AS assessment_pct
  FROM public.enrollments e
  JOIN public.assignments a ON a.course_id = e.course_id
  LEFT JOIN public.submissions s ON s.assignment_id = a.id AND s.student_id = e.student_id
  WHERE e.status IN ('active', 'completed')
  GROUP BY e.student_id, a.course_id
),
settings AS (
  SELECT
    COALESCE((SELECT value FROM public.site_settings WHERE key = 'min_attendance_pct'), '75')::numeric AS min_att_pct,
    COALESCE((SELECT value FROM public.site_settings WHERE key = 'min_pass_pct'), '50')::numeric AS min_pass_pct
),
course_status AS (
  SELECT
    sp.student_id,
    sp.program_id,
    pc.course_id,
    (e.id IS NOT NULL) AS is_enrolled,
    c.grades_published,
    c.requires_attendance_for_certificate,
    COALESCE(e.progress_pct, 0) AS materials_pct,
    (COALESCE(cmc.total_materials, 0) = 0 OR COALESCE(e.progress_pct, 0) = 100) AS materials_ok,
    ca.assessment_pct,
    (COALESCE(ca.total_assignments, 0) = 0 OR COALESCE(ca.assessment_pct, 0) >= settings.min_pass_pct) AS assessment_ok,
    catt.attendance_pct,
    (
      NOT c.requires_attendance_for_certificate
      OR catt.attendance_pct IS NULL
      OR catt.attendance_pct >= settings.min_att_pct
    ) AS attendance_ok
  FROM student_programs sp
  JOIN program_courses pc ON pc.program_id = sp.program_id
  JOIN public.courses c ON c.id = pc.course_id
  LEFT JOIN public.enrollments e
    ON e.course_id = pc.course_id AND e.student_id = sp.student_id AND e.status IN ('active', 'completed')
  LEFT JOIN course_material_counts cmc ON cmc.course_id = pc.course_id
  LEFT JOIN course_assessment ca ON ca.course_id = pc.course_id AND ca.student_id = sp.student_id
  LEFT JOIN public.course_attendance_summary catt ON catt.course_id = pc.course_id AND catt.student_id = sp.student_id
  CROSS JOIN settings
),
per_student_program AS (
  SELECT
    student_id, program_id,
    count(course_id) AS total_courses,
    count(course_id) FILTER (WHERE is_enrolled) AS enrolled_courses,
    count(course_id) FILTER (WHERE grades_published) AS published_courses,
    count(course_id) FILTER (WHERE is_enrolled AND grades_published AND materials_ok AND assessment_ok AND attendance_ok) AS passing_courses,
    round(avg(materials_pct)) AS avg_materials_pct,
    round(avg(assessment_pct) FILTER (WHERE assessment_pct IS NOT NULL)) AS avg_assessment_pct,
    round(avg(attendance_pct) FILTER (WHERE attendance_pct IS NOT NULL)) AS avg_attendance_pct,
    bool_or(requires_attendance_for_certificate) AS requires_attendance
  FROM course_status
  GROUP BY student_id, program_id
)
SELECT
  psp.student_id,
  psp.program_id,
  psp.total_courses,
  psp.enrolled_courses,
  psp.published_courses,
  CASE WHEN psp.total_courses > 0 THEN round(100.0 * psp.published_courses / psp.total_courses) ELSE 0 END AS pct_published,
  (psp.total_courses > 0 AND psp.passing_courses = psp.total_courses) AS is_eligible,
  EXISTS (
    SELECT 1 FROM public.certificates cert WHERE cert.student_id = psp.student_id AND cert.program_id = psp.program_id
  ) AS already_issued,
  psp.avg_attendance_pct AS attendance_pct,
  psp.avg_materials_pct  AS materials_pct,
  psp.avg_assessment_pct AS assessment_pct,
  psp.requires_attendance AS requires_attendance
FROM per_student_program psp;

ALTER VIEW public.certificate_eligibility SET (security_invoker = true);
GRANT SELECT ON public.certificate_eligibility TO authenticated;
