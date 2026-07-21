-- ============================================================
-- LWGSM — Live Attendance System v2
-- Run this AFTER supabase/new/master_fixes.sql (which creates
-- public.attendance_sessions and public.attendance_logs).
-- ============================================================

-- ── 1. New columns on attendance_logs ───────────────────────
-- method:      'self'     -> student checked themselves in
--              'lecturer' -> lecturer marked them present/absent
--                            directly (roll call for onsite/offline
--                            students who have no device or didn't
--                            self check-in)
-- marked_by:   who created the log row
-- confirmed_by/confirmed_at: who approved/rejected it and when
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS method       text NOT NULL DEFAULT 'self' CHECK (method IN ('self','lecturer')),
  ADD COLUMN IF NOT EXISTS marked_by    uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_att_logs_session ON public.attendance_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_att_logs_student ON public.attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_course ON public.attendance_sessions(course_id);

-- ── 2. Fix session read policy for students ─────────────────
-- The original policy only let a student see a session while it was
-- still open, so closed/past sessions vanished from their history
-- and could never be counted correctly. Enrolled students should be
-- able to read every session (open or closed) for their own courses.
DROP POLICY IF EXISTS "att_sessions_student_read" ON public.attendance_sessions;
CREATE POLICY "att_sessions_student_read" ON public.attendance_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = attendance_sessions.course_id AND e.student_id = auth.uid()
      AND e.status IN ('active','completed')
  ));

-- ── 3. Tighten + extend attendance_logs policies ────────────
-- Old policy let ANY lecturer (not just the course's lecturer) read
-- or write every attendance log. Replace with per-course scoping and
-- split out insert/update/delete so lecturers can also mark logs
-- directly (onsite roll call) instead of only approving self-checked
-- entries.
DROP POLICY IF EXISTS "att_logs_own" ON public.attendance_logs;

CREATE POLICY "att_logs_select" ON public.attendance_logs FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_logs.session_id AND s.lecturer_id = auth.uid())
  );

CREATE POLICY "att_logs_insert" ON public.attendance_logs FOR INSERT
  WITH CHECK (
    (student_id = auth.uid() AND method = 'self')
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_logs.session_id AND s.lecturer_id = auth.uid())
  );

CREATE POLICY "att_logs_update" ON public.attendance_logs FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_logs.session_id AND s.lecturer_id = auth.uid())
  );

CREATE POLICY "att_logs_delete" ON public.attendance_logs FOR DELETE
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_logs.session_id AND s.lecturer_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_logs TO authenticated;

-- ── 4. Per-student / per-course attendance summary ──────────
-- Rate is computed against every session ever opened for the course
-- (not just the ones a student happened to log), so a student who
-- misses a session without logging in still counts as absent.
CREATE OR REPLACE VIEW public.attendance_student_summary AS
SELECT
  e.student_id,
  e.course_id,
  COALESCE(ses.total_sessions, 0)  AS total_sessions,
  COALESCE(lg.present_count, 0)    AS present_count,
  COALESCE(lg.rejected_count, 0)   AS rejected_count,
  COALESCE(lg.pending_count, 0)    AS pending_count,
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
    count(*) FILTER (WHERE al.status = 'approved') AS present_count,
    count(*) FILTER (WHERE al.status = 'rejected') AS rejected_count,
    count(*) FILTER (WHERE al.status = 'pending')  AS pending_count
  FROM public.attendance_logs al
  JOIN public.attendance_sessions s ON s.id = al.session_id
  GROUP BY s.course_id, al.student_id
) lg ON lg.course_id = e.course_id AND lg.student_id = e.student_id
WHERE e.status IN ('active', 'completed');

ALTER VIEW public.attendance_student_summary SET (security_invoker = true);
GRANT SELECT ON public.attendance_student_summary TO authenticated;

-- ── 5. Attendance policy settings (off by default) ──────────
-- min_attendance_pct: minimum % of sessions a student must be marked
--   present for, per programme, to be certificate-eligible.
-- require_attendance_for_certificate: master on/off switch. Left
--   'false' by default so existing certificate flows are unaffected
--   until an admin explicitly turns this on.
INSERT INTO public.site_settings (key, value) VALUES
  ('min_attendance_pct', '75'),
  ('require_attendance_for_certificate', 'false')
ON CONFLICT (key) DO NOTHING;

-- ── 6. Certificate eligibility now surfaces attendance ───────
-- Adds attendance_pct to every row (always visible to admins) and,
-- only when require_attendance_for_certificate = true, folds it into
-- is_eligible alongside the existing enrollment/grades checks.
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
),
att AS (
  SELECT
    e.student_id,
    c.program_id,
    COALESCE(SUM(ses.total_sessions), 0) AS total_sessions,
    COALESCE(SUM(lg.present_count), 0)   AS present_count
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id AND c.program_id IS NOT NULL
  LEFT JOIN (SELECT course_id, count(*) AS total_sessions FROM public.attendance_sessions GROUP BY course_id) ses
    ON ses.course_id = e.course_id
  LEFT JOIN (
    SELECT s.course_id, al.student_id, count(*) FILTER (WHERE al.status = 'approved') AS present_count
    FROM public.attendance_logs al JOIN public.attendance_sessions s ON s.id = al.session_id
    GROUP BY s.course_id, al.student_id
  ) lg ON lg.course_id = e.course_id AND lg.student_id = e.student_id
  WHERE e.status IN ('active', 'completed')
  GROUP BY e.student_id, c.program_id
),
settings AS (
  SELECT
    COALESCE((SELECT value FROM public.site_settings WHERE key = 'min_attendance_pct'), '0')::numeric AS min_pct,
    COALESCE((SELECT value FROM public.site_settings WHERE key = 'require_attendance_for_certificate'), 'false')::boolean AS enforce
)
SELECT
  psp.student_id,
  psp.program_id,
  psp.total_courses,
  psp.enrolled_courses,
  psp.published_courses,
  CASE WHEN psp.total_courses > 0 THEN round(100.0 * psp.published_courses / psp.total_courses) ELSE 0 END AS pct_published,
  (
    psp.total_courses > 0
    AND psp.enrolled_courses = psp.total_courses
    AND psp.published_courses = psp.total_courses
    AND (
      NOT settings.enforce
      OR COALESCE(att.total_sessions, 0) = 0
      OR (100.0 * att.present_count / NULLIF(att.total_sessions, 0)) >= settings.min_pct
    )
  ) AS is_eligible,
  EXISTS (
    SELECT 1 FROM public.certificates cert WHERE cert.student_id = psp.student_id AND cert.program_id = psp.program_id
  ) AS already_issued,
  CASE WHEN att.total_sessions > 0 THEN round(100.0 * att.present_count / att.total_sessions) ELSE NULL END AS attendance_pct
FROM per_student_program psp
LEFT JOIN att ON att.student_id = psp.student_id AND att.program_id = psp.program_id
CROSS JOIN settings;

ALTER VIEW public.certificate_eligibility SET (security_invoker = true);

SELECT 'Live attendance system v2 applied successfully' AS status;