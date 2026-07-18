-- ============================================================
-- LWGSM — Usage Events Migration (for System Usage report)
-- Run this AFTER migration_certificates_reports.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- USAGE EVENTS
--    Lightweight, append-only event log. Starts empty — populated
--    going forward as people use the app (material views, logins).
--    Deliberately generic (event_type + optional course_id) so new
--    event kinds can be added later without a schema change.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN ('login', 'material_view', 'submission_created')),
  course_id   uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.course_materials(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_type    ON public.usage_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user     ON public.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_course    ON public.usage_events(course_id);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can log their own events (write-only from the
-- client's perspective — they can't see others' activity this way).
DROP POLICY IF EXISTS "usage_events: insert own" ON public.usage_events;
CREATE POLICY "usage_events: insert own" ON public.usage_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only admins read the aggregate log (for the System Usage report).
-- Lecturers can see events tied to their own courses.
DROP POLICY IF EXISTS "usage_events: read" ON public.usage_events;
CREATE POLICY "usage_events: read" ON public.usage_events FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
