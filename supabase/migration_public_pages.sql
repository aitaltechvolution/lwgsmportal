-- ============================================================
-- LWGSM Public Pages — Database Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- 1. PROGRAMS TABLE (if not already exists)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  title_fr      TEXT,
  type          TEXT NOT NULL CHECK (type IN ('certificate', 'diploma', 'advanced')),
  duration      TEXT,
  short_desc    TEXT,
  short_desc_fr TEXT,
  description   TEXT,
  description_fr TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed sample programs if table is empty
INSERT INTO programs (title, title_fr, type, duration, short_desc, short_desc_fr)
SELECT * FROM (VALUES
  ('Certificate in Business Administration',           'Certificat en Administration des Affaires',       'certificate', '6 months / 6 mois',  'Foundational business skills covering accounting, marketing, and organisational behaviour.',   'Compétences commerciales fondamentales couvrant la comptabilité, le marketing et le comportement organisationnel.'),
  ('Certificate in Human Resource Management',        'Certificat en Gestion des Ressources Humaines',  'certificate', '6 months / 6 mois',  'Practical HR skills: recruitment, payroll, labour law, and employee relations.',              'Compétences RH pratiques : recrutement, paie, droit du travail et relations employés.'),
  ('Certificate in Digital Marketing',                'Certificat en Marketing Digital',                 'certificate', '4 months / 4 mois',  'Social media strategy, SEO, email campaigns, and analytics for business growth.',             'Stratégie médias sociaux, SEO, campagnes email et analytique.'),
  ('Diploma in Business Management',                  'Diplôme en Gestion d''Entreprise',                'diploma',     '12 months / 12 mois','Comprehensive management education: strategy, finance, marketing, operations, and leadership.','Formation complète couvrant stratégie, finance, marketing, opérations et leadership.'),
  ('Diploma in Accounting & Finance',                 'Diplôme en Comptabilité et Finance',              'diploma',     '12 months / 12 mois','Professional accounting, financial reporting, budgeting, and ACCA Foundation preparation.',    'Comptabilité professionnelle, reporting financier, budgétisation et préparation ACCA.'),
  ('Diploma in Project Management',                   'Diplôme en Gestion de Projets',                   'diploma',     '12 months / 12 mois','PMI-aligned project methodology, Agile, stakeholder management, and risk assessment.',        'Méthodologie PMI, Agile, gestion des parties prenantes et évaluation des risques.'),
  ('Diploma in Supply Chain & Logistics',             'Diplôme en Chaîne d''Approvisionnement',          'diploma',     '12 months / 12 mois','End-to-end supply chain management, procurement, and logistics in African markets.',           'Gestion de la chaîne d''approvisionnement et logistique sur les marchés africains.'),
  ('Advanced Diploma in Business Administration',     'Diplôme Avancé en Administration des Affaires',  'advanced',    '18 months / 18 mois','Flagship programme: strategic management, corporate governance, entrepreneurship, MBA prep.',   'Programme phare : management stratégique, gouvernance d''entreprise, entrepreneuriat.'),
  ('Advanced Diploma in Financial Management',        'Diplôme Avancé en Gestion Financière',            'advanced',    '18 months / 18 mois','Corporate finance, investment analysis, risk management, and treasury operations.',            'Finance d''entreprise, analyse des investissements, gestion des risques et trésorerie.'),
  ('Advanced Diploma in Entrepreneurship & Innovation','Diplôme Avancé en Entrepreneuriat et Innovation','advanced',    '18 months / 18 mois','Venture creation, business model innovation, funding strategies in emerging markets.',          'Création d''entreprise, innovation de modèle d''affaires et stratégies de financement.')
) AS v(title, title_fr, type, duration, short_desc, short_desc_fr)
WHERE NOT EXISTS (SELECT 1 FROM programs LIMIT 1);

-- Enable RLS
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "programs_public_read" ON programs;
CREATE POLICY "programs_public_read"
  ON programs FOR SELECT USING (true);


-- ─────────────────────────────────────────
-- 2. APPLICATIONS TABLE
-- Drop and recreate to ensure all columns exist cleanly
-- ─────────────────────────────────────────
DROP TABLE IF EXISTS applications;
CREATE TABLE applications (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  program_id         UUID REFERENCES programs(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Applicant details (stored at submission time)
  applicant_name     TEXT NOT NULL,
  applicant_email    TEXT NOT NULL,
  phone              TEXT,
  dob                DATE,
  nationality        TEXT,
  address            TEXT,
  prev_qualification TEXT,
  work_experience    TEXT,

  -- Metadata
  reviewed_at        TIMESTAMPTZ,
  reviewer_notes     TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_email    ON applications (applicant_email);
CREATE INDEX IF NOT EXISTS idx_applications_student  ON applications (student_id);
CREATE INDEX IF NOT EXISTS idx_applications_program  ON applications (program_id);
CREATE INDEX IF NOT EXISTS idx_applications_status   ON applications (status);

-- RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_insert_public" ON applications;
CREATE POLICY "applications_insert_public"
  ON applications FOR INSERT
  WITH CHECK (true);  -- Public form submission

DROP POLICY IF EXISTS "applications_select_own" ON applications;
CREATE POLICY "applications_select_own"
  ON applications FOR SELECT
  USING (student_id = auth.uid());

-- Admin (service role) can do everything — handled via service key in admin panel


-- ─────────────────────────────────────────
-- 3. INQUIRIES TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'read', 'replied', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ,
  notes      TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_inquiries_email  ON inquiries (email);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries (status);

-- RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry
DROP POLICY IF EXISTS "inquiries_insert_public" ON inquiries;
CREATE POLICY "inquiries_insert_public"
  ON inquiries FOR INSERT
  WITH CHECK (true);

-- Only service role / admin can read
-- (Add your admin panel policy here if using Supabase Dashboard)


-- ─────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────
SELECT 'programs'     AS table_name, COUNT(*) FROM programs
UNION ALL
SELECT 'applications' AS table_name, COUNT(*) FROM applications
UNION ALL
SELECT 'inquiries'    AS table_name, COUNT(*) FROM inquiries;