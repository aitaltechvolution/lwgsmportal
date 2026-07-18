-- ============================================================
-- Replace existing courses with Ministry & Leadership courses
-- Linked to your existing programs and lecturer
-- ============================================================

-- Clear existing courses (cascades to materials, assignments if FK set)
DELETE FROM public.course_materials WHERE course_id IN (SELECT id FROM public.courses);
DELETE FROM public.question_answers WHERE submission_id IN (
  SELECT s.id FROM public.submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  JOIN public.courses c ON c.id = a.course_id
);
DELETE FROM public.submissions WHERE assignment_id IN (
  SELECT id FROM public.assignments WHERE course_id IN (SELECT id FROM public.courses)
);
DELETE FROM public.assignments WHERE course_id IN (SELECT id FROM public.courses);
DELETE FROM public.enrollments;
DELETE FROM public.courses;

-- ──────────────────────────────────────────────────────────────
-- INSERT MINISTRY & LEADERSHIP COURSES
-- Lecturer: d32c7873-6477-450c-a71c-495d8fc245e0 (Adeniran Precious)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.courses (
  id, program_id, title, title_fr, code, description, description_fr,
  objectives, lecturer_id, lecturer_name, is_published
) VALUES

-- ── Certificate in Business Administration (3 courses) ──
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000001',
  'Foundations of Kingdom Business',
  'Fondements de l''Entreprise du Royaume',
  'CBA-101',
  'Explores the biblical foundations of business and entrepreneurship, examining how faith, purpose and ethical conduct form the bedrock of sustainable enterprise. Students learn to integrate Christian values with sound business principles.',
  'Explore les fondements bibliques des affaires, examinant comment la foi et la conduite éthique forment la base d''une entreprise durable.',
  'Understand the biblical mandate for work and commerce
Apply kingdom principles to everyday business decisions
Identify the role of purpose-driven leadership in an organisation
Develop a personal statement of business ethics grounded in faith',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000001',
  'Stewardship and Financial Integrity',
  'Intendance et Intégrité Financière',
  'CBA-102',
  'A study of financial stewardship rooted in biblical principles. Topics include budgeting, accountability, generosity, debt management, and the spiritual dimensions of money, with practical application to personal and organisational finance.',
  'Une étude de la gestion financière ancrée dans les principes bibliques, incluant la budgétisation, la comptabilité et la générosité.',
  'Define biblical stewardship and its implications for money management
Apply sound budgeting principles to personal and ministry finances
Identify signs of financial mismanagement and develop corrective plans
Demonstrate transparent financial reporting practices',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000001',
  'Communication for Ministry and Marketplace',
  'Communication pour le Ministère et le Marché',
  'CBA-103',
  'Develops professional and ministerial communication skills. Covers public speaking, written communication, cross-cultural engagement, digital media, and how to communicate vision compellingly in both church and business contexts.',
  'Développe des compétences en communication professionnelle et ministérielle, couvrant la prise de parole en public et les médias numériques.',
  'Craft persuasive and purpose-aligned messages for diverse audiences
Deliver confident oral presentations in professional and ministry settings
Write clearly for reports, proposals, and church communications
Navigate cross-cultural and multilingual communication challenges',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),

-- ── Diploma in Business Management (3 courses) ──
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000004',
  'Servant Leadership and Organisational Strategy',
  'Leadership Serviteur et Stratégie Organisationnelle',
  'DBM-201',
  'Examines servant leadership models drawn from Scripture and applied to modern management. Topics include strategic planning, vision-casting, team building, conflict resolution, and leading with humility in complex organisations.',
  'Examine les modèles de leadership serviteur tirés des Écritures et appliqués au management moderne.',
  'Define and model servant leadership principles in an organisational context
Develop a strategic plan aligned with vision, values and resources
Build and sustain high-performing, purpose-driven teams
Resolve conflict constructively using biblical principles',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000004',
  'Operations and Administration in Ministry Organisations',
  'Opérations et Administration dans les Organisations Ministérielles',
  'DBM-202',
  'Provides practical frameworks for managing the operational aspects of churches, NGOs and faith-based enterprises. Covers governance structures, human resources, volunteer management, event planning and compliance.',
  'Fournit des cadres pratiques pour gérer les aspects opérationnels des églises, ONG et entreprises confessionnelles.',
  'Design governance structures appropriate to ministry and non-profit contexts
Manage paid staff and volunteers effectively
Plan and execute large-scale ministry events and programmes
Ensure legal and regulatory compliance for faith-based organisations',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000004',
  'Fundraising, Donor Relations and Resource Mobilisation',
  'Collecte de Fonds, Relations avec les Donateurs et Mobilisation des Ressources',
  'DBM-203',
  'Equips leaders to identify, cultivate and manage funding relationships for ministry and social impact organisations. Topics include grant writing, donor stewardship, crowdfunding, endowments and faith-based giving campaigns.',
  'Équipe les leaders pour identifier et gérer les relations de financement pour les organisations à impact social.',
  'Develop a diversified funding strategy for a ministry or non-profit
Write compelling grant proposals and donor appeals
Design a donor stewardship programme that builds long-term relationships
Evaluate the effectiveness of fundraising campaigns using key metrics',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),

-- ── Advanced Diploma in Business Administration (3 courses) ──
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000008',
  'Global Ministry Expansion and Church Planting Strategy',
  'Expansion Ministérielle Mondiale et Stratégie de Plantation d''Église',
  'ABA-301',
  'Explores strategic frameworks for expanding ministry impact across borders. Topics include church planting models, cross-cultural mission strategy, partnership development, diaspora ministry, and sustaining movement growth.',
  'Explore les cadres stratégiques pour étendre l''impact ministériel au-delà des frontières, incluant la plantation d''église et la mission interculturelle.',
  'Analyse successful church planting and ministry expansion models globally
Develop a contextualised cross-cultural ministry strategy
Build strategic partnerships with international bodies and organisations
Create a sustainability plan for a new ministry or church plant',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000008',
  'Ethics, Governance and Accountability in Christian Organisations',
  'Éthique, Gouvernance et Responsabilité dans les Organisations Chrétiennes',
  'ABA-302',
  'A deep examination of ethical frameworks and governance structures for faith-based organisations. Covers board accountability, transparency, anti-corruption, whistleblower policies, and handling financial and moral crises in ministry.',
  'Un examen approfondi des cadres éthiques et des structures de gouvernance pour les organisations confessionnelles.',
  'Apply biblical and professional ethical frameworks to organisational decisions
Design governance policies that ensure accountability and transparency
Manage reputational and financial crises in a ministry setting
Implement effective whistleblower and safeguarding policies',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
),
(
  gen_random_uuid(),
  '11111111-0000-0000-0000-000000000008',
  'Raising Next-Generation Leaders: Mentorship and Succession',
  'Former les Leaders de la Prochaine Génération : Mentorat et Succession',
  'ABA-303',
  'Prepares seasoned leaders to intentionally develop the next generation. Topics include mentorship models, leadership pipelines, succession planning, coaching frameworks, and creating cultures of empowerment and accountability.',
  'Prépare les leaders expérimentés à développer intentionnellement la prochaine génération à travers le mentorat et la planification de la succession.',
  'Design and implement a structured mentorship programme
Build a leadership pipeline appropriate to church or organisational context
Develop a succession plan that ensures continuity and mission alignment
Coach emerging leaders using evidence-based frameworks',
  'd32c7873-6477-450c-a71c-495d8fc245e0', 'Adeniran Precious', true
);

-- ──────────────────────────────────────────────────────────────
-- Re-enroll the student in 3 courses (CBA-101, CBA-102, DBM-201)
-- Student: 04ffa6b0-a096-4f49-98bb-8766095fc9a7
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.enrollments (student_id, course_id, status, enrolled_at, progress_pct)
SELECT
  '04ffa6b0-a096-4f49-98bb-8766095fc9a7',
  id,
  'active',
  now(),
  0
FROM public.courses
WHERE code IN ('CBA-101', 'CBA-102', 'DBM-201')
ON CONFLICT DO NOTHING;

-- ── Verify ──
SELECT code, title, is_published FROM public.courses ORDER BY code;
SELECT COUNT(*) AS enrollments FROM public.enrollments;
