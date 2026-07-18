-- ============================================================
-- Material Progress Tracking
-- Tracks whether a student has actually read/viewed a material
-- and for how long (so just clicking doesn't mark it read)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.material_progress (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id   uuid NOT NULL REFERENCES public.course_materials(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  -- Time spent in seconds (must be >= threshold to count as "read")
  seconds_spent int  NOT NULL DEFAULT 0,
  -- Whether it counts as completed (set by trigger when seconds_spent >= threshold)
  completed     boolean NOT NULL DEFAULT false,
  first_opened  timestamptz DEFAULT NOW(),
  last_updated  timestamptz DEFAULT NOW(),
  UNIQUE(student_id, material_id)
);

-- Index for fast lookups per student/course
CREATE INDEX IF NOT EXISTS idx_mat_progress_student  ON public.material_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_mat_progress_course   ON public.material_progress(student_id, course_id);

-- RLS
ALTER TABLE public.material_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_own" ON public.material_progress;
CREATE POLICY "progress_own"
  ON public.material_progress FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Lecturers and admins can read all progress
DROP POLICY IF EXISTS "progress_lecturer_read" ON public.material_progress;
CREATE POLICY "progress_lecturer_read"
  ON public.material_progress FOR SELECT
  USING (public.is_lecturer(auth.uid()) OR public.is_admin(auth.uid()));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.material_progress TO authenticated;

-- Function to upsert progress and auto-complete when threshold is reached
-- Threshold: 30 seconds for notes/files, 60 seconds for videos
CREATE OR REPLACE FUNCTION public.upsert_material_progress(
  p_student_id  uuid,
  p_material_id uuid,
  p_course_id   uuid,
  p_seconds     int,
  p_type        text DEFAULT 'note'
)
RETURNS TABLE(seconds_spent int, completed boolean)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_threshold int := CASE WHEN p_type = 'video' THEN 60 ELSE 30 END;
  v_completed boolean;
BEGIN
  -- Upsert: add time spent, mark completed if threshold reached
  INSERT INTO public.material_progress(student_id, material_id, course_id, seconds_spent, completed, last_updated)
  VALUES (p_student_id, p_material_id, p_course_id, p_seconds, p_seconds >= v_threshold, NOW())
  ON CONFLICT (student_id, material_id) DO UPDATE SET
    seconds_spent = GREATEST(material_progress.seconds_spent, EXCLUDED.seconds_spent),
    completed     = material_progress.completed OR (EXCLUDED.seconds_spent >= v_threshold),
    last_updated  = NOW();

  -- Return updated row
  RETURN QUERY
    SELECT mp.seconds_spent, mp.completed
    FROM public.material_progress mp
    WHERE mp.student_id = p_student_id AND mp.material_id = p_material_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_material_progress(uuid, uuid, uuid, int, text) TO authenticated;

-- Update enrollment progress based on completed materials
CREATE OR REPLACE FUNCTION public.refresh_course_progress(p_student_id uuid, p_course_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total     int;
  v_completed int;
  v_pct       int;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.course_materials
  WHERE course_id = p_course_id AND is_premium = false;

  IF v_total = 0 THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_completed
  FROM public.material_progress mp
  JOIN public.course_materials cm ON cm.id = mp.material_id
  WHERE mp.student_id = p_student_id
    AND cm.course_id  = p_course_id
    AND mp.completed  = true
    AND cm.is_premium = false;

  v_pct := LEAST(100, ROUND((v_completed::numeric / v_total) * 100));

  UPDATE public.enrollments
  SET progress_pct = v_pct
  WHERE student_id = p_student_id AND course_id = p_course_id;

  RETURN v_pct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_course_progress(uuid, uuid) TO authenticated;

-- Verify
SELECT 'material_progress table created' AS status;
