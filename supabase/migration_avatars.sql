-- ============================================================
-- LWGSM — Avatars Storage Bucket Migration
-- Run this AFTER migration_usage_events.sql
-- ============================================================

-- Avatars are intentionally public (unlike course-materials/submissions):
-- they're shown to other users throughout the app (messages, course
-- lecturer cards, admin tables) and contain no sensitive content.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Each user manages only their own avatar file, stored under a path
-- prefixed with their own user id (e.g. "{user_id}/avatar.jpg").
DROP POLICY IF EXISTS "avatars bucket: owner write" ON storage.objects;
CREATE POLICY "avatars bucket: owner write"
ON storage.objects FOR ALL
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars bucket: public read" ON storage.objects;
CREATE POLICY "avatars bucket: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
