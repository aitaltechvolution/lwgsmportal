-- Fix course_materials to support typed content and ordering
ALTER TABLE public.course_materials ALTER COLUMN url DROP NOT NULL;
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS content_en text;
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS content_fr text;
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- Refresh grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_materials TO authenticated;
GRANT SELECT ON public.course_materials TO anon;
