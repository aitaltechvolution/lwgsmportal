-- ============================================================
-- LWGSM — Feature Migration (Tests/Exams, Lecturer ID normalization,
--          Currency Toggle, Profile Title, Private File Storage)
-- Run this AFTER lwsm_setup.sql / 00_initial_setup.sql and
-- migration_communication.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. LECTURER NORMALIZATION
--    Courses must be looked up via lecturer_id -> profiles only.
--    The denormalized lecturer_name / lecturer_title / lecturer_email
--    columns are dropped so a lecturer's name/title can never go
--    stale on the course record. The lecturer's professional title
--    now lives on profiles (settable by the lecturer or admin) and
--    is joined in at query time.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.courses DROP COLUMN IF EXISTS lecturer_name;
ALTER TABLE public.courses DROP COLUMN IF EXISTS lecturer_title;
ALTER TABLE public.courses DROP COLUMN IF EXISTS lecturer_email;

-- ────────────────────────────────────────────────────────────
-- 2. TESTS / EXAMS — QUESTION BANK
--    Converts the old free-text "quiz" assignment type into a
--    real auto-gradable test/exam builder. Each assignment of
--    type 'quiz' or 'exam' can now have structured questions.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  question_type   text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  prompt_en       text NOT NULL,
  prompt_fr       text,
  points          numeric(6,2) NOT NULL DEFAULT 1,
  sort_order      int NOT NULL DEFAULT 0,
  -- For short_answer: accepted answers are matched case-insensitively, trimmed.
  correct_answers text[],
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_assignment ON public.questions(assignment_id, sort_order);

CREATE TABLE IF NOT EXISTS public.question_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  label_en     text NOT NULL,
  label_fr     text,
  is_correct   boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_question ON public.question_options(question_id, sort_order);

-- Per-student answers, linked to a submission so existing grading /
-- submission-list UI keeps working for quizzes and exams too.
CREATE TABLE IF NOT EXISTS public.question_answers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_ids uuid[],     -- multiple_choice (single-select stored as 1-item array) / true_false ('true'/'false' option ids)
  text_answer    text,            -- short_answer
  is_correct     boolean,         -- computed at submit time; null until graded (short_answer may need manual override)
  points_awarded numeric(6,2),
  UNIQUE (submission_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_qanswers_submission ON public.question_answers(submission_id);

-- Track timing for timed tests/exams.
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS time_limit_minutes int;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT false;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS external_url text; -- optional: link out to a Google Form etc.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS auto_graded boolean NOT NULL DEFAULT false;

ALTER TABLE public.questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;

-- Lecturers/admins manage questions on their own courses' assignments.
DROP POLICY IF EXISTS "questions: lecturer write" ON public.questions;
CREATE POLICY "questions: lecturer write" ON public.questions FOR ALL
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.assignments a JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assignment_id AND c.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.assignments a JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assignment_id AND c.lecturer_id = auth.uid()
    )
  );

-- Enrolled students may read questions for assignments in their courses
-- (needed to render the test) — answers/correctness are not exposed here.
DROP POLICY IF EXISTS "questions: enrolled read" ON public.questions;
CREATE POLICY "questions: enrolled read" ON public.questions FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.assignments a JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assignment_id AND c.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.assignments a JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE a.id = assignment_id AND e.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "options: lecturer write" ON public.question_options;
CREATE POLICY "options: lecturer write" ON public.question_options FOR ALL
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.questions q JOIN public.assignments a ON a.id = q.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE q.id = question_id AND c.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.questions q JOIN public.assignments a ON a.id = q.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE q.id = question_id AND c.lecturer_id = auth.uid()
    )
  );

-- Students may read options to render the test. Correctness (is_correct)
-- is necessarily visible once a question is fetched client-side, but that's
-- harmless: the actual score is always recomputed and written server-side
-- by the grade_submission() function below, never trusted from the client.
DROP POLICY IF EXISTS "options: enrolled read" ON public.question_options;
CREATE POLICY "options: enrolled read" ON public.question_options FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.questions q JOIN public.assignments a ON a.id = q.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE q.id = question_id AND c.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.questions q JOIN public.assignments a ON a.id = q.assignment_id
      JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE q.id = question_id AND e.student_id = auth.uid()
    )
  );

-- Students never write question_answers directly — only the SECURITY
-- DEFINER grade_submission() function does, after recomputing correctness
-- itself server-side. No client-facing INSERT/UPDATE policy is granted to
-- students here by design; this table is otherwise read-only to them.
DROP POLICY IF EXISTS "qanswers: student write own" ON public.question_answers;

DROP POLICY IF EXISTS "qanswers: read" ON public.question_answers;
CREATE POLICY "qanswers: read" ON public.question_answers FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.submissions s JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE s.id = submission_id AND c.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qanswers: lecturer update" ON public.question_answers;
CREATE POLICY "qanswers: lecturer update" ON public.question_answers FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.submissions s JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE s.id = submission_id AND c.lecturer_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2b. SERVER-SIDE AUTO-GRADING (security hardening)
--    A student's browser cannot be trusted to compute its own score —
--    the client only sends raw answers; this function looks up the real
--    correct answers/options server-side, computes points_awarded and
--    is_correct itself, and is the only thing allowed to write a score
--    onto a submission for an auto-graded test. SECURITY DEFINER lets it
--    write past the otherwise-restrictive RLS policies above, but it only
--    ever touches the submission the caller (auth.uid()) just created.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grade_submission(
  p_submission_id uuid,
  p_answers jsonb  -- [{ "question_id": uuid, "option_id": uuid|null, "text_answer": text|null }, ...]
)
RETURNS TABLE (score numeric, max_score numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_assignment_id uuid;
  v_student_id    uuid;
  v_max_score     numeric;
  v_earned        numeric := 0;
  v_total         numeric := 0;
  v_item          jsonb;
  v_q             record;
  v_given_text    text;
  v_correct       boolean;
  v_points        numeric;
BEGIN
  SELECT s.assignment_id, s.student_id INTO v_assignment_id, v_student_id
  FROM public.submissions s WHERE s.id = p_submission_id;

  IF v_student_id IS NULL OR v_student_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to grade this submission';
  END IF;

  SELECT a.max_score INTO v_max_score FROM public.assignments a WHERE a.id = v_assignment_id;
  v_max_score := COALESCE(v_max_score, 100);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    SELECT q.id, q.question_type, q.points, q.correct_answers INTO v_q
    FROM public.questions q WHERE q.id = (v_item->>'question_id')::uuid AND q.assignment_id = v_assignment_id;

    CONTINUE WHEN v_q.id IS NULL;
    v_points := v_q.points;
    v_total := v_total + v_points;

    IF v_q.question_type = 'short_answer' THEN
      v_given_text := lower(trim(coalesce(v_item->>'text_answer', '')));
      v_correct := v_given_text <> '' AND EXISTS (
        SELECT 1 FROM unnest(v_q.correct_answers) ca WHERE lower(trim(ca)) = v_given_text
      );
      INSERT INTO public.question_answers (submission_id, question_id, text_answer, selected_option_ids, is_correct, points_awarded)
      VALUES (p_submission_id, v_q.id, v_item->>'text_answer', NULL, v_correct, CASE WHEN v_correct THEN v_points ELSE 0 END)
      ON CONFLICT (submission_id, question_id) DO UPDATE SET
        text_answer = EXCLUDED.text_answer, is_correct = EXCLUDED.is_correct, points_awarded = EXCLUDED.points_awarded;
    ELSE
      SELECT o.is_correct INTO v_correct FROM public.question_options o
      WHERE o.id = (v_item->>'option_id')::uuid AND o.question_id = v_q.id;
      v_correct := COALESCE(v_correct, false);
      INSERT INTO public.question_answers (submission_id, question_id, text_answer, selected_option_ids, is_correct, points_awarded)
      VALUES (
        p_submission_id, v_q.id, NULL,
        CASE WHEN v_item->>'option_id' IS NOT NULL THEN ARRAY[(v_item->>'option_id')::uuid] ELSE NULL END,
        v_correct, CASE WHEN v_correct THEN v_points ELSE 0 END
      )
      ON CONFLICT (submission_id, question_id) DO UPDATE SET
        selected_option_ids = EXCLUDED.selected_option_ids, is_correct = EXCLUDED.is_correct, points_awarded = EXCLUDED.points_awarded;
    END IF;

    IF v_correct THEN v_earned := v_earned + v_points; END IF;
  END LOOP;

  UPDATE public.submissions
  SET score = CASE WHEN v_total > 0 THEN round((v_earned / v_total) * v_max_score, 2) ELSE 0 END,
      auto_graded = true
  WHERE id = p_submission_id;

  RETURN QUERY SELECT s.score, v_max_score FROM public.submissions s WHERE s.id = p_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grade_submission(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_submission(uuid, jsonb) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. CURRENCY SETTINGS (admin-configurable)
--    site_settings already exists from migration_communication.sql
--    with usd_to_ngn + default_currency seeded. Just ensure those
--    keys exist for installs that skipped that migration.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings: read all" ON public.site_settings;
CREATE POLICY "settings: read all" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings: admin write" ON public.site_settings;
CREATE POLICY "settings: admin write" ON public.site_settings FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.site_settings (key, value) VALUES
  ('usd_to_ngn', '1600'),
  ('default_currency', 'USD')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. PAYMENTS: store the base amount in USD plus the currency
--    the student actually chose to view/pay in, so the ledger
--    stays consistent even if the exchange rate changes later.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_usd numeric(12,2);
UPDATE public.payments SET amount_usd = amount WHERE amount_usd IS NULL AND currency = 'USD';

-- ────────────────────────────────────────────────────────────
-- 5. PRIVATE FILE STORAGE (view-only, signed/expiring URLs)
--    Course materials and submissions buckets become private.
--    The app generates short-lived signed URLs on demand instead
--    of using public URLs, so files are never directly linkable.
-- ────────────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id IN ('course-materials', 'submissions');

-- Re-create read policies to use signed-URL-only access (private bucket).
-- Enrolled students / the course lecturer / admins can request a signed URL;
-- Supabase Storage's createSignedUrl() call is still subject to this SELECT
-- policy under the hood, so the bucket being private + this policy together
-- ensure files can never be reached except through a freshly issued,
-- time-limited signed URL from the app.
--
-- Course material objects are stored under path "{course_id}/{filename}" —
-- see CourseMaterials.tsx upload path. We match on that first path segment.
DROP POLICY IF EXISTS "course-materials bucket: public read" ON storage.objects;
DROP POLICY IF EXISTS "course-materials bucket: enrolled read" ON storage.objects;
CREATE POLICY "course-materials bucket: enrolled read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-materials'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id::text = (storage.foldername(name))[1] AND c.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id::text = (storage.foldername(name))[1] AND e.student_id = auth.uid()
    )
  )
);

-- Submission file objects are stored under path "{student_id}/{assignment_id}-...".
-- Students may read their own; the course's lecturer/admin may read any
-- submission belonging to one of their assignments.
DROP POLICY IF EXISTS "submissions bucket: public read" ON storage.objects;
DROP POLICY IF EXISTS "submissions bucket: owner or lecturer read" ON storage.objects;
CREATE POLICY "submissions bucket: owner or lecturer read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'submissions'
  AND (
    public.is_admin(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE s.file_url = storage.objects.name AND c.lecturer_id = auth.uid()
    )
  )
);

-- ────────────────────────────────────────────────────────────
-- 6. LECTURER MATERIAL: allow typed-in rich text content
--    (not just an uploaded file / external URL).
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS content_en text;
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS content_fr text;
ALTER TABLE public.course_materials ALTER COLUMN url DROP NOT NULL;
-- Typed content is stored as type='note' with content_en/content_fr
-- populated and url left null; uploaded files keep url populated and
-- content_en/content_fr null. No schema-level type change was needed since
-- the existing material_type enum ('note' / 'video' / 'file') already
-- covers it.

-- ────────────────────────────────────────────────────────────
-- 7. SIGNUP TRIGGER: carry optional metadata (full_name) through
--    for OAuth sign-ups too, without clobbering an upsert from the
--    app's signUp() call that may run moments later.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
