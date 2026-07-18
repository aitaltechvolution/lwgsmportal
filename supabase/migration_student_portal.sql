-- ============================================================
-- LWGSM Student Portal — Database Migration (fixed)
-- All tables already exist from 00_initial_setup.sql.
-- This file only adds missing indexes, RLS policies, and the
-- seed announcement. Column names match the actual schema.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. COURSES — extra indexes + student read policy
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_program   ON public.courses(program_id);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer  ON public.courses(lecturer_id);

DROP POLICY IF EXISTS "courses_student_read" ON public.courses;
CREATE POLICY "courses_student_read"
  ON public.courses FOR SELECT
  USING (is_published = true OR public.is_admin(auth.uid()) OR lecturer_id = auth.uid());

-- ─────────────────────────────────────────
-- 2. ENROLLMENTS — extra indexes + student read policy
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_enrollments_student  ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course   ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program  ON public.enrollments(program_id);

DROP POLICY IF EXISTS "enrollments_own" ON public.enrollments;
CREATE POLICY "enrollments_own"
  ON public.enrollments FOR SELECT
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()));

-- ─────────────────────────────────────────
-- 3. COURSE MATERIALS — index + enrolled-read policy
--    (title column is title_en in actual schema)
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_materials_course ON public.course_materials(course_id);

DROP POLICY IF EXISTS "materials_enrolled_read" ON public.course_materials;
CREATE POLICY "materials_enrolled_read"
  ON public.course_materials FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = course_materials.course_id
        AND e.student_id = auth.uid()
        AND e.status IN ('active', 'completed')
    )
  );

-- ─────────────────────────────────────────
-- 4. ASSIGNMENTS — indexes + enrolled-read policy
--    (no student_id on assignments in actual schema — it's course-level)
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments(course_id);

DROP POLICY IF EXISTS "assignments_own" ON public.assignments;
CREATE POLICY "assignments_own"
  ON public.assignments FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_id AND e.student_id = auth.uid())
  );

-- ─────────────────────────────────────────
-- 5. GRADES — indexes + student read policy
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_grades_student ON public.grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_course  ON public.grades(course_id);

DROP POLICY IF EXISTS "grades_own" ON public.grades;
CREATE POLICY "grades_own"
  ON public.grades FOR SELECT
  USING (
    (student_id = auth.uid() AND is_published = true)
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid())
  );

-- ─────────────────────────────────────────
-- 6. ANNOUNCEMENTS — index + student read policy
--    (columns are title_en, body_en, target_role in actual schema)
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_announcements_role ON public.announcements(target_role);

DROP POLICY IF EXISTS "announcements_student_read" ON public.announcements;
CREATE POLICY "announcements_student_read"
  ON public.announcements FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (target_role IS NULL OR target_role IN ('public', 'student'))
    OR public.is_admin(auth.uid())
  );

-- Seed sample announcement (uses actual column names)
INSERT INTO public.announcements (title_en, title_fr, body_en, body_fr, target_role)
SELECT
  'Welcome to the LWSM Student Portal',
  'Bienvenue sur le portail étudiant LWSM',
  'We are excited to launch the new student portal. Here you will find your courses, materials, grades, and more.',
  'Nous sommes ravis de lancer le nouveau portail étudiant. Vous y trouverez vos cours, matériaux, notes et plus encore.',
  'student'
WHERE NOT EXISTS (SELECT 1 FROM public.announcements LIMIT 1);

-- ─────────────────────────────────────────
-- 7. MESSAGES — index + participant read policy
--    (column is receiver_id not recipient_id in actual schema)
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);

DROP POLICY IF EXISTS "messages_own_read" ON public.messages;
CREATE POLICY "messages_own_read"
  ON public.messages FOR SELECT
  USING (receiver_id = auth.uid() OR sender_id = auth.uid() OR public.is_admin(auth.uid()));

-- ─────────────────────────────────────────
-- 8. PAYMENTS — index + student read policy
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);

DROP POLICY IF EXISTS "payments_own" ON public.payments;
CREATE POLICY "payments_own"
  ON public.payments FOR SELECT
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()));

-- ─────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────
SELECT table_name, COUNT(*) AS rows FROM (
  SELECT 'courses'          AS table_name FROM public.courses          UNION ALL
  SELECT 'enrollments'      AS table_name FROM public.enrollments      UNION ALL
  SELECT 'course_materials' AS table_name FROM public.course_materials UNION ALL
  SELECT 'assignments'      AS table_name FROM public.assignments      UNION ALL
  SELECT 'grades'           AS table_name FROM public.grades           UNION ALL
  SELECT 'announcements'    AS table_name FROM public.announcements    UNION ALL
  SELECT 'messages'         AS table_name FROM public.messages         UNION ALL
  SELECT 'payments'         AS table_name FROM public.payments
) t GROUP BY table_name ORDER BY table_name;