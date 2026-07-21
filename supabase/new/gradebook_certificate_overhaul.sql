-- ============================================================
-- LWGSM — Gradebook / Materials / Attendance / Certificate Overhaul
-- Run this AFTER supabase/new/live_attendance_v2.sql
-- ============================================================

-- ── 1. Materials: mark done the instant a student opens/downloads it ──
-- Previously required a minimum time-on-page before "completed" flipped
-- true. Now any view/download instantly counts as done — no timers, no
-- waiting. seconds_spent is kept (defaults to 0) purely as a legacy/
-- informational column; it no longer gates completion.
CREATE OR REPLACE FUNCTION public.upsert_material_progress(
  p_student_id  uuid,
  p_material_id uuid,
  p_course_id   uuid,
  p_seconds     int DEFAULT 0,
  p_type        text DEFAULT 'note'
)
RETURNS TABLE(seconds_spent int, completed boolean)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.material_progress(student_id, material_id, course_id, seconds_spent, completed, last_updated)
  VALUES (p_student_id, p_material_id, p_course_id, GREATEST(p_seconds, 0), true, NOW())
  ON CONFLICT (student_id, material_id) DO UPDATE SET
    seconds_spent = GREATEST(material_progress.seconds_spent, EXCLUDED.seconds_spent),
    completed     = true,
    last_updated  = NOW();

  RETURN QUERY
    SELECT mp.seconds_spent, mp.completed
    FROM public.material_progress mp
    WHERE mp.student_id = p_student_id AND mp.material_id = p_material_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_material_progress(uuid, uuid, uuid, int, text) TO authenticated;

-- ── 2. Materials: premium content now counts toward completion too ──
-- Previously excluded is_premium materials from both the denominator and
-- numerator of course progress. Premium materials are course content the
-- student has purchased/unlocked, so they belong in the completion count
-- like any other material.
CREATE OR REPLACE FUNCTION public.refresh_course_progress(p_student_id uuid, p_course_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total     int;
  v_completed int;
  v_pct       int;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.course_materials
  WHERE course_id = p_course_id;

  IF v_total = 0 THEN
    UPDATE public.enrollments SET progress_pct = 100
    WHERE student_id = p_student_id AND course_id = p_course_id;
    RETURN 100;
  END IF;

  SELECT COUNT(*) INTO v_completed
  FROM public.material_progress mp
  JOIN public.course_materials cm ON cm.id = mp.material_id
  WHERE mp.student_id = p_student_id
    AND cm.course_id  = p_course_id
    AND mp.completed  = true;

  v_pct := LEAST(100, ROUND((v_completed::numeric / v_total) * 100));

  UPDATE public.enrollments
  SET progress_pct = v_pct
  WHERE student_id = p_student_id AND course_id = p_course_id;

  RETURN v_pct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_course_progress(uuid, uuid) TO authenticated;

-- ── 3. Attendance: fix duplicate-key crash on "Mark Present" ──────────
-- A lecturer marking a student present directly (onsite roll call) used
-- a plain INSERT, which violates UNIQUE(session_id, student_id) whenever
-- a log for that student+session already exists (e.g. the student had
-- already self-checked-in, or a duplicate click/race). Replace with an
-- upsert RPC so re-marking a student simply updates the existing row.
CREATE OR REPLACE FUNCTION public.mark_attendance_onsite(
  p_session_id  uuid,
  p_student_id  uuid,
  p_course_id   uuid,
  p_marked_by   uuid
)
RETURNS public.attendance_logs
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row public.attendance_logs;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = p_session_id AND (s.lecturer_id = p_marked_by OR public.is_admin(p_marked_by))
  ) THEN
    RAISE EXCEPTION 'Not authorized to mark attendance for this session';
  END IF;

  INSERT INTO public.attendance_logs(session_id, student_id, course_id, status, method, marked_by, confirmed_by, confirmed_at)
  VALUES (p_session_id, p_student_id, p_course_id, 'approved', 'lecturer', p_marked_by, p_marked_by, NOW())
  ON CONFLICT (session_id, student_id) DO UPDATE SET
    status        = 'approved',
    method        = 'lecturer',
    marked_by     = p_marked_by,
    confirmed_by  = p_marked_by,
    confirmed_at  = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_attendance_onsite(uuid, uuid, uuid, uuid) TO authenticated;

-- ── 4. Attendance requirement moves from a single global switch to a ──
-- per-course setting: each course decides for itself whether attendance
-- counts toward certificate eligibility. min_attendance_pct (the bar a
-- student must clear once attendance IS required) stays a global setting.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS requires_attendance_for_certificate boolean NOT NULL DEFAULT false;

-- The old global on/off switch is superseded by the per-course column
-- above. Leave the site_settings row in place (harmless / unused) so we
-- don't break anything that might still read it, but stop relying on it.

-- ── 5. Minimum pass mark for assessments/exams to count toward ────────
-- certificate eligibility (materials + assessments/exams + attendance).
INSERT INTO public.site_settings (key, value) VALUES
  ('min_pass_pct', '50')
ON CONFLICT (key) DO NOTHING;

-- ── 6. Per-course attendance summary (used by Gradebook + eligibility) ─
CREATE OR REPLACE VIEW public.course_attendance_summary AS
SELECT
  e.student_id,
  e.course_id,
  COALESCE(ses.total_sessions, 0) AS total_sessions,
  COALESCE(lg.present_count, 0)   AS present_count,
  CASE WHEN COALESCE(ses.total_sessions, 0) > 0
    THEN round(100.0 * COALESCE(lg.present_count, 0) / ses.total_sessions)
    ELSE NULL END AS attendance_pct
FROM public.enrollments e
LEFT JOIN (
  SELECT course_id, count(*) AS total_sessions
  FROM public.attendance_sessions
  GROUP BY course_id
) ses ON ses.course_id = e.course_id
LEFT JOIN (
  SELECT s.course_id, al.student_id,
    count(*) FILTER (WHERE al.status = 'approved') AS present_count
  FROM public.attendance_logs al
  JOIN public.attendance_sessions s ON s.id = al.session_id
  GROUP BY s.course_id, al.student_id
) lg ON lg.course_id = e.course_id AND lg.student_id = e.student_id
WHERE e.status IN ('active', 'completed');

ALTER VIEW public.course_attendance_summary SET (security_invoker = true);
GRANT SELECT ON public.course_attendance_summary TO authenticated;

-- ── 7. Certificate eligibility, rebuilt around 3 course-level pillars ──
-- A course counts toward certificate eligibility once:
--   a) Materials  — 100% of the course's materials completed (premium
--      materials included — see #2 above).
--   b) Assessments/Exams — average score across graded submissions is
--      >= min_pass_pct (courses with no assignments are not blocked).
--   c) Attendance — only checked when the course itself has
--      requires_attendance_for_certificate = true; then the student's
--      attendance_pct must be >= min_attendance_pct.
-- ...AND the lecturer has published grades for the course.
-- This view lists EVERY student/program pair (not just fully-eligible
-- ones) with a per-pillar breakdown, so admins can review students who
-- fall short (e.g. a low overall score) and decide manually whether to
-- issue a certificate anyway — see AdminCertificates "All Candidates" tab.
CREATE OR REPLACE VIEW public.certificate_eligibility AS
WITH program_courses AS (
  SELECT program_id, id AS course_id FROM public.courses WHERE program_id IS NOT NULL
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

-- ── 8. Admin override trail for manually-issued certificates ──────────
-- Records when an admin issues a certificate to a student who did not
-- meet the automatic pillars above, and why — so it's auditable rather
-- than silently bypassed.
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS issued_via_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS overridden_by uuid REFERENCES auth.users(id);

SELECT 'Gradebook / certificate overhaul applied successfully' AS status;
