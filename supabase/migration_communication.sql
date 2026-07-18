-- ============================================================
-- LWGSM — Communication System Migration
-- Run this after lwsm_setup.sql
-- ============================================================

-- ── Rename brand references (profile language_pref extended) ──
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_language_pref_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_language_pref_check
  CHECK (language_pref IN ('en','fr','es','pt','ar','zh','sw','ha','yo','ig'));

-- ── Add nationality column to profiles ────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nationality text;

-- ── Add scheduled_at to announcements ────────────────────────
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- ── Add conversation_id to messages for threading ─────────────
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id uuid;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.messages(id) ON DELETE CASCADE;

-- Update conversation_id on existing messages (self-reference for initial messages)
UPDATE public.messages SET conversation_id = id WHERE conversation_id IS NULL;

-- ── Notification reads tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id   uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  message_id        uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  read_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, announcement_id),
  UNIQUE(user_id, message_id)
);
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_reads: own" ON public.notification_reads FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Currency / Exchange rate in settings ──────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings: read all" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings: admin write" ON public.site_settings FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Default exchange rate
INSERT INTO public.site_settings (key, value) VALUES
  ('usd_to_ngn', '1600'),
  ('default_currency', 'USD')
ON CONFLICT (key) DO NOTHING;

-- ── Enable realtime on messages ───────────────────────────────
-- Run in Supabase Dashboard → Database → Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

