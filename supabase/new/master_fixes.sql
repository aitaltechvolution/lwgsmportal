-- ============================================================
-- LWGSM Master Fixes SQL
-- ============================================================

-- ── #12: Add EUR to currencies ──────────────────────────────
INSERT INTO public.site_settings (key, value) VALUES
  ('usd_to_eur',       '0.92'),
  ('usd_to_ngn',       '1600'),
  ('default_currency', 'USD'),
  ('eur_price_mode',   'exchange_rate'),  -- or 'fixed'
  ('ngn_price_mode',   'exchange_rate')   -- or 'fixed'
ON CONFLICT (key) DO NOTHING;

-- ── #4: Attendance sessions table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Attendance',
  opens_at    timestamptz NOT NULL DEFAULT NOW(),
  closes_at   timestamptz,          -- null = manually closed
  is_open     boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  logged_at     timestamptz NOT NULL DEFAULT NOW(),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "att_sessions_lecturer" ON public.attendance_sessions;
CREATE POLICY "att_sessions_lecturer" ON public.attendance_sessions FOR ALL
  USING (lecturer_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "att_sessions_student_read" ON public.attendance_sessions;
CREATE POLICY "att_sessions_student_read" ON public.attendance_sessions FOR SELECT
  USING (is_open = true AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = attendance_sessions.course_id AND e.student_id = auth.uid()
  ));

DROP POLICY IF EXISTS "att_logs_own" ON public.attendance_logs;
CREATE POLICY "att_logs_own" ON public.attendance_logs FOR ALL
  USING (student_id = auth.uid() OR public.is_lecturer(auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (student_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attendance_logs TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ── #21: Admin can read contact messages ─────────────────────
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_insert_public" ON public.contact_messages;
CREATE POLICY "contact_insert_public" ON public.contact_messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "contact_admin_read" ON public.contact_messages;
CREATE POLICY "contact_admin_read" ON public.contact_messages FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "contact_admin_update" ON public.contact_messages;
CREATE POLICY "contact_admin_update" ON public.contact_messages FOR UPDATE
  USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT ON public.contact_messages TO anon, authenticated;
GRANT UPDATE ON public.contact_messages TO authenticated;

-- ── #1: Fix material_progress function ───────────────────────
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
BEGIN
  INSERT INTO public.material_progress(student_id, material_id, course_id, seconds_spent, completed, last_updated)
  VALUES (p_student_id, p_material_id, p_course_id, p_seconds, p_seconds >= v_threshold, NOW())
  ON CONFLICT (student_id, material_id) DO UPDATE SET
    seconds_spent = GREATEST(material_progress.seconds_spent, EXCLUDED.seconds_spent),
    completed     = material_progress.completed OR (EXCLUDED.seconds_spent >= v_threshold),
    last_updated  = NOW();

  RETURN QUERY
    SELECT mp.seconds_spent, mp.completed
    FROM public.material_progress mp
    WHERE mp.student_id = p_student_id AND mp.material_id = p_material_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_course_progress(p_student_id uuid, p_course_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total int; v_completed int; v_pct int;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.course_materials
  WHERE course_id = p_course_id AND is_premium = false;
  IF v_total = 0 THEN RETURN 0; END IF;
  SELECT COUNT(*) INTO v_completed
  FROM public.material_progress mp
  JOIN public.course_materials cm ON cm.id = mp.material_id
  WHERE mp.student_id = p_student_id AND cm.course_id = p_course_id
    AND mp.completed = true AND cm.is_premium = false;
  v_pct := LEAST(100, ROUND((v_completed::numeric / v_total) * 100));
  UPDATE public.enrollments SET progress_pct = v_pct
  WHERE student_id = p_student_id AND course_id = p_course_id;
  RETURN v_pct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_material_progress(uuid,uuid,uuid,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_course_progress(uuid,uuid) TO authenticated;

-- ── #13: Payments - add manual_confirmed column ──────────────
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS manual_confirmed boolean DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transfer_reference text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transfer_proof_url text;

-- ── Remove messaging routes (keep table for contact) ─────────
-- No DB changes needed, handled in frontend

SELECT 'All fixes applied successfully' AS status;
