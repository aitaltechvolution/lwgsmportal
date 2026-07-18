-- Fix announcements: ensure students can read announcements targeted to them
-- The issue: target_role check might be excluding null (everyone) announcements

DROP POLICY IF EXISTS "announcements_read" ON public.announcements;
CREATE POLICY "announcements_read"
  ON public.announcements FOR SELECT
  USING (
    is_published = true
    AND (
      target_role IS NULL
      OR target_role = 'public'
      OR (auth.uid() IS NOT NULL AND target_role = (
        SELECT role::text FROM public.profiles WHERE id = auth.uid()
      ))
    )
  );

GRANT SELECT ON public.announcements TO authenticated, anon;

-- Fix messages: ensure profiles can be searched
GRANT SELECT ON public.profiles TO authenticated;

-- Also grant messages table properly
DROP POLICY IF EXISTS "messages_own" ON public.messages;
CREATE POLICY "messages_own"
  ON public.messages FOR ALL
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id);

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

-- Fix material_progress if not already created
CREATE TABLE IF NOT EXISTS public.material_progress (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id   uuid NOT NULL REFERENCES public.course_materials(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  seconds_spent int  NOT NULL DEFAULT 0,
  completed     boolean NOT NULL DEFAULT false,
  first_opened  timestamptz DEFAULT NOW(),
  last_updated  timestamptz DEFAULT NOW(),
  UNIQUE(student_id, material_id)
);

ALTER TABLE public.material_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progress_own" ON public.material_progress;
CREATE POLICY "progress_own" ON public.material_progress FOR ALL
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.material_progress TO authenticated;
