-- ============================================================
-- LWGSM Certificates Table Migration
-- Run this in your Supabase SQL Editor (after migration_public_pages.sql)
-- ============================================================

-- ─────────────────────────────────────────
-- 1. CERTIFICATES TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Relations
  student_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  program_id         UUID REFERENCES programs(id)   ON DELETE SET NULL,

  -- Core fields
  certificate_number TEXT NOT NULL UNIQUE,   -- e.g. LWSM-2024-0042
  student_name       TEXT,                   -- denormalised fallback if no profile row
  is_verified        BOOLEAN NOT NULL DEFAULT false,

  -- Dates
  issue_date         DATE,
  completion_date    DATE,

  -- Assets
  qr_code_url        TEXT,                   -- URL to the QR code image
  certificate_url    TEXT,                   -- URL to the PDF/image of the certificate

  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_certs_number     ON certificates (certificate_number);
CREATE INDEX IF NOT EXISTS idx_certs_student    ON certificates (student_id);
CREATE INDEX IF NOT EXISTS idx_certs_program    ON certificates (program_id);
CREATE INDEX IF NOT EXISTS idx_certs_verified   ON certificates (is_verified);

-- ─────────────────────────────────────────
-- 2. PROFILES TABLE (student names)
--    If you already have a profiles table, skip this block.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name  TEXT,
  surname    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────

-- Certificates: public read (verification must work without login)
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────

-- Certificates: public read (verification must work without login)
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "certificates_public_read" ON certificates;
CREATE POLICY "certificates_public_read"
  ON certificates FOR SELECT
  USING (true);

-- Profiles: public read (needed for the join in verify page)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read"
  ON profiles FOR SELECT
  USING (true);

-- ─────────────────────────────────────────
-- 4. UPDATED_AT TRIGGER
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_certs_updated_at ON certificates;
CREATE TRIGGER set_certs_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- 5. SAMPLE DATA (optional — remove for production)
-- ─────────────────────────────────────────
-- Insert a sample verified certificate so you can test /verify immediately.
-- Replace the program_id with a real UUID from your programs table.
DO $$
DECLARE
  sample_program_id UUID;
BEGIN
  SELECT id INTO sample_program_id FROM programs LIMIT 1;

  INSERT INTO certificates (
    certificate_number, student_name, program_id,
    is_verified, issue_date, completion_date
  )
  SELECT
    'LWSM-2024-0001',
    'Aminata Diallo',
    sample_program_id,
    true,
    '2024-06-15',
    '2024-06-15'
  WHERE NOT EXISTS (
    SELECT 1 FROM certificates WHERE certificate_number = 'LWSM-2024-0001'
  );
END $$;

-- ─────────────────────────────────────────
-- 6. VERIFICATION QUERY
-- ─────────────────────────────────────────
SELECT 'certificates' AS table_name, COUNT(*) FROM certificates
UNION ALL
SELECT 'profiles',                            COUNT(*) FROM profiles;
