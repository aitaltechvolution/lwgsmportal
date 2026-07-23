-- ============================================================
-- Materials: add "link" type, remove reliance on typed "note"
-- text going forward, and let admins allow/disallow video
-- materials per course.
--
-- Run this AFTER 00_initial_setup.sql and the other migrations
-- in supabase/README.md / supabase/new/master_fixes.sql.
-- Safe to re-run.
-- ============================================================

-- 1. Add 'link' to the material_type enum.
--    NOTE: ALTER TYPE ... ADD VALUE cannot run inside a DO block or
--    function body, so this must stay a bare top-level statement.
--    "IF NOT EXISTS" (supported since Postgres 12) makes it re-runnable.
ALTER TYPE material_type ADD VALUE IF NOT EXISTS 'link';

-- 2. Per-course toggle: does this course allow video materials at all?
--    Defaults to true so every existing course keeps working exactly as
--    before. When an admin turns this off, the lecturer/admin materials
--    forms hide the "Video" option and only allow File / Link, and the
--    trigger below blocks it server-side too (not just in the UI).
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS allow_videos boolean NOT NULL DEFAULT true;

-- 3. Server-side guard: reject inserting/updating a material as type
--    'video' when the parent course has video materials disabled. This
--    is deliberately enforced in the database (not just hidden in the
--    UI) since course-level settings are set per course, not globally,
--    and a stale client or direct API call should not be able to bypass it.
CREATE OR REPLACE FUNCTION public.check_material_video_allowed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_allow boolean;
BEGIN
  IF NEW.type = 'video' THEN
    SELECT allow_videos INTO v_allow FROM public.courses WHERE id = NEW.course_id;
    IF v_allow IS FALSE THEN
      RAISE EXCEPTION 'Video materials are disabled for this course.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_material_video_allowed ON public.course_materials;
CREATE TRIGGER trg_check_material_video_allowed
  BEFORE INSERT OR UPDATE ON public.course_materials
  FOR EACH ROW EXECUTE FUNCTION public.check_material_video_allowed();

-- Notes:
-- * Existing 'note' (typed text) materials are left exactly as they are —
--   nothing here deletes or converts them. The lecturer/admin UI simply no
--   longer offers "note" as a choice for NEW materials; only File, Video,
--   and Link are offered now. Old note materials still display and work
--   for students exactly as before.
-- * A material's `url` column is reused for both an uploaded file's
--   storage path AND a pasted external link/URL. The two are told apart
--   by whether the value starts with http(s):// — see isExternalUrl() in
--   src/lib/storage.ts. No new column was needed for this.
