-- ============================================================
-- LWGSM — Complete Setup & Seed
-- Paste into Supabase SQL Editor and run once.
-- Replaces any previous migration (001_init or 00_initial_setup).
-- ============================================================

-- ── 0. CLEAN SLATE (safe re-run) ─────────────────────────────
drop trigger  if exists on_auth_user_created       on auth.users;
drop function if exists public.handle_new_user()   cascade;
drop function if exists public.is_admin(uuid)      cascade;
drop function if exists public.is_lecturer(uuid)   cascade;

drop table if exists public.contact_messages cascade;
drop table if exists public.applications     cascade;
drop table if exists public.messages         cascade;
drop table if exists public.announcements    cascade;
drop table if exists public.certificates     cascade;
drop table if exists public.payments         cascade;
drop table if exists public.grades           cascade;
drop table if exists public.attendance       cascade;
drop table if exists public.submissions      cascade;
drop table if exists public.assignments      cascade;
drop table if exists public.course_materials cascade;
drop table if exists public.enrollments      cascade;
drop table if exists public.courses          cascade;
drop table if exists public.programs         cascade;
drop table if exists public.profiles         cascade;

drop type if exists user_role         cascade;
drop type if exists program_type      cascade;
drop type if exists material_type     cascade;
drop type if exists enrollment_status cascade;
drop type if exists attendance_status cascade;
drop type if exists payment_type      cascade;
drop type if exists payment_status    cascade;

-- ── 1. HELPER FUNCTIONS (defined first, used in policies) ────
create or replace function public.is_admin(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

create or replace function public.is_lecturer(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = uid and role = 'lecturer');
$$;

-- ── 2. PROFILES ───────────────────────────────────────────────
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           text not null default 'student' check (role in ('student','lecturer','admin')),
  full_name      text not null,
  email          text not null unique,
  phone          text,
  country        text,
  language_pref  text not null default 'en' check (language_pref in ('en','fr')),
  avatar_url     text,
  status         text not null default 'active' check (status in ('active','suspended')),
  created_at     timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own or admin"  on public.profiles for select using (auth.uid() = id or public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()));
create policy "profiles: insert own"          on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own"          on public.profiles for update using (auth.uid() = id);
create policy "profiles: admin manage"        on public.profiles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role','student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 3. PROGRAMS ───────────────────────────────────────────────
create table public.programs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  title_fr        text,
  type            text not null check (type in ('certificate','diploma','advanced')),
  duration        text,
  short_desc      text,
  short_desc_fr   text,
  description     text,
  description_fr  text,
  requirements    text,
  requirements_fr text,
  created_at      timestamptz not null default now()
);
alter table public.programs enable row level security;
create policy "programs: public read"  on public.programs for select using (true);
create policy "programs: admin write"  on public.programs for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── 4. COURSES ────────────────────────────────────────────────
create table public.courses (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid references public.programs(id) on delete set null,
  title           text not null,
  title_fr        text,
  code            text,
  description     text,
  description_fr  text,
  objectives      text,
  lecturer_id     uuid references public.profiles(id) on delete set null,
  lecturer_name   text,
  lecturer_title  text,
  lecturer_email  text,
  duration        text,
  credits         int,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now()
);
create index idx_courses_program  on public.courses(program_id);
create index idx_courses_lecturer on public.courses(lecturer_id);
alter table public.courses enable row level security;
create policy "courses: select"       on public.courses for select using (is_published or lecturer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "courses: write"        on public.courses for all using (lecturer_id = auth.uid() or public.is_admin(auth.uid())) with check (lecturer_id = auth.uid() or public.is_admin(auth.uid()));

-- ── 5. ENROLLMENTS ────────────────────────────────────────────
create table public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  program_id   uuid references public.programs(id) on delete set null,
  course_id    uuid references public.courses(id) on delete set null,
  status       text not null default 'active' check (status in ('active','completed','withdrawn','suspended','pending','rejected')),
  progress_pct int default 0 check (progress_pct between 0 and 100),
  enrolled_at  timestamptz default now(),
  completed_at timestamptz,
  created_at   timestamptz default now()
);
create index idx_enr_student on public.enrollments(student_id);
create index idx_enr_course  on public.enrollments(course_id);
create index idx_enr_program on public.enrollments(program_id);
alter table public.enrollments enable row level security;
create policy "enrollments: read"         on public.enrollments for select using (student_id = auth.uid() or public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));
create policy "enrollments: student ins"  on public.enrollments for insert with check (student_id = auth.uid());
create policy "enrollments: admin manage" on public.enrollments for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── 6. COURSE MATERIALS ───────────────────────────────────────
create table public.course_materials (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title_en    text not null,
  title_fr    text,
  type        text not null check (type in ('note','video','file')),
  url         text not null,
  is_premium  boolean not null default false,
  price       numeric(10,2) default 0,
  created_at  timestamptz not null default now()
);
alter table public.course_materials enable row level security;
create policy "materials: read"  on public.course_materials for select using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()) or exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid()));
create policy "materials: write" on public.course_materials for all using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid())) with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

-- ── 7. ASSIGNMENTS ────────────────────────────────────────────
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id) on delete cascade,
  type            text not null default 'assignment' check (type in ('assignment','quiz','exam')),
  title_en        text not null,
  title_fr        text,
  description_en  text,
  description_fr  text,
  due_date        timestamptz,
  max_score       numeric(5,2) default 100,
  created_at      timestamptz not null default now()
);
alter table public.assignments enable row level security;
create policy "assignments: read"  on public.assignments for select using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()) or exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid()));
create policy "assignments: write" on public.assignments for all using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid())) with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

-- ── 8. SUBMISSIONS ────────────────────────────────────────────
create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  file_url       text,
  text_content   text,
  submitted_at   timestamptz not null default now(),
  score          numeric(5,2),
  feedback       text
);
alter table public.submissions enable row level security;
create policy "submissions: read"    on public.submissions for select using (student_id = auth.uid() or public.is_admin(auth.uid()) or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id where a.id = assignment_id and c.lecturer_id = auth.uid()));
create policy "submissions: insert"  on public.submissions for insert with check (student_id = auth.uid());
create policy "submissions: grade"   on public.submissions for update using (public.is_admin(auth.uid()) or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id where a.id = assignment_id and c.lecturer_id = auth.uid()));

-- ── 9. ATTENDANCE ─────────────────────────────────────────────
create table public.attendance (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  date       date not null,
  status     text not null default 'present' check (status in ('present','absent','late')),
  notes      text,
  created_at timestamptz not null default now()
);
alter table public.attendance enable row level security;
create policy "attendance: read"  on public.attendance for select using (student_id = auth.uid() or public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));
create policy "attendance: write" on public.attendance for all using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid())) with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

-- ── 10. GRADES ────────────────────────────────────────────────
create table public.grades (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  score        numeric(5,2),
  grade        text,
  remarks      text,
  is_published boolean not null default false,
  graded_at    timestamptz default now(),
  created_at   timestamptz not null default now()
);
alter table public.grades enable row level security;
create policy "grades: read"  on public.grades for select using ((student_id = auth.uid() and is_published) or public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));
create policy "grades: write" on public.grades for all using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid())) with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

-- ── 11. PAYMENTS ──────────────────────────────────────────────
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(12,2) not null,
  currency    text not null default 'XOF',
  type        text not null default 'tuition' check (type in ('registration','tuition','certificate','material')),
  status      text not null default 'pending' check (status in ('pending','success','failed')),
  reference   text unique,
  description text,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "payments: read"         on public.payments for select using (student_id = auth.uid() or public.is_admin(auth.uid()));
create policy "payments: student ins"  on public.payments for insert with check (student_id = auth.uid());
create policy "payments: admin update" on public.payments for update using (public.is_admin(auth.uid()));

-- ── 12. CERTIFICATES ──────────────────────────────────────────
create table public.certificates (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid references public.profiles(id) on delete set null,
  program_id         uuid references public.programs(id) on delete set null,
  certificate_number text not null unique,
  student_name       text,
  is_verified        boolean not null default false,
  issue_date         date,
  completion_date    date,
  qr_code_url        text,
  certificate_url    text,
  created_at         timestamptz default now()
);
create index idx_certs_number  on public.certificates(certificate_number);
create index idx_certs_student on public.certificates(student_id);
alter table public.certificates enable row level security;
create policy "certificates: public read"  on public.certificates for select using (true);
create policy "certificates: admin write"  on public.certificates for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── 13. ANNOUNCEMENTS ─────────────────────────────────────────
create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title_en    text not null,
  title_fr    text,
  body_en     text,
  body_fr     text,
  target_role text check (target_role in ('student','lecturer','admin','public')),
  author_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy "announcements: read"  on public.announcements for select using (target_role is null or target_role='public' or public.is_admin(auth.uid()) or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role::text=target_role));
create policy "announcements: write" on public.announcements for all using (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid())) with check (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()));

-- ── 14. MESSAGES ──────────────────────────────────────────────
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  subject     text,
  body        text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "messages: read"   on public.messages for select using (sender_id=auth.uid() or receiver_id=auth.uid() or public.is_admin(auth.uid()));
create policy "messages: insert" on public.messages for insert with check (sender_id=auth.uid());
create policy "messages: update" on public.messages for update using (receiver_id=auth.uid());

-- ── 15. APPLICATIONS ──────────────────────────────────────────
create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references auth.users(id) on delete set null,
  program_id  uuid references public.programs(id) on delete set null,
  full_name   text,
  email       text not null,
  phone       text,
  country     text,
  message     text,
  status      text not null default 'pending' check (status in ('pending','reviewing','accepted','rejected')),
  created_at  timestamptz not null default now()
);
alter table public.applications enable row level security;
create policy "applications: insert"       on public.applications for insert with check (true);
create policy "applications: admin read"   on public.applications for select using (public.is_admin(auth.uid()) or auth.uid()=student_id);
create policy "applications: admin update" on public.applications for update using (public.is_admin(auth.uid()));

-- ── 16. CONTACT MESSAGES ──────────────────────────────────────
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  subject    text,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create policy "contact: insert"     on public.contact_messages for insert with check (true);
create policy "contact: admin read" on public.contact_messages for select using (public.is_admin(auth.uid()));

-- ── 17. STORAGE BUCKETS ───────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('submissions',     'submissions',     false),
       ('course-materials','course-materials', true)
on conflict (id) do nothing;

-- Submissions bucket policies
do $$ begin
  if not exists (select 1 from pg_policies where policyname='submissions bucket: student upload' and tablename='objects') then
    execute 'create policy "submissions bucket: student upload" on storage.objects for insert with check (bucket_id=''submissions'' and (storage.foldername(name))[1]=auth.uid()::text)';
  end if;
  if not exists (select 1 from pg_policies where policyname='submissions bucket: read' and tablename='objects') then
    execute 'create policy "submissions bucket: read" on storage.objects for select using (bucket_id=''submissions'' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin(auth.uid()) or public.is_lecturer(auth.uid())))';
  end if;
  if not exists (select 1 from pg_policies where policyname='course-materials bucket: write' and tablename='objects') then
    execute 'create policy "course-materials bucket: write" on storage.objects for insert with check (bucket_id=''course-materials'' and (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid())))';
  end if;
  if not exists (select 1 from pg_policies where policyname='course-materials bucket: public read' and tablename='objects') then
    execute 'create policy "course-materials bucket: public read" on storage.objects for select using (bucket_id=''course-materials'')';
  end if;
end $$;

-- ============================================================
-- SEED DATA — realistic dummy content for all portals
-- ============================================================

-- ── PROGRAMS ─────────────────────────────────────────────────
insert into public.programs (id, title, title_fr, type, duration, short_desc, short_desc_fr, description, description_fr, requirements, requirements_fr) values
('a0000001-0000-0000-0000-000000000001','Certificate in Business Administration','Certificat en Administration des Affaires','certificate','6 months','Foundational business skills covering accounting, marketing, and organisational behaviour.','Compétences commerciales fondamentales couvrant la comptabilité, le marketing et le comportement organisationnel.','This programme equips students with essential business fundamentals required to operate effectively in today''s competitive environment. Topics include introduction to management, business communication, financial literacy, and customer relations.','Ce programme dote les étudiants des bases essentielles en gestion pour opérer efficacement dans l''environnement concurrentiel actuel.','High school diploma or equivalent. Open to working professionals.','Baccalauréat ou équivalent. Ouvert aux professionnels en activité.'),
('a0000001-0000-0000-0000-000000000002','Certificate in Digital Marketing','Certificat en Marketing Digital','certificate','4 months','Social media strategy, SEO, email campaigns, and analytics for business growth.','Stratégie réseaux sociaux, SEO, campagnes email et analytique pour la croissance.','A practical, hands-on programme covering the full digital marketing toolkit. Students learn to plan, execute, and measure campaigns across Google, Meta, and email platforms.','Programme pratique couvrant l''ensemble des outils du marketing digital.','No prior experience required. Basic computer literacy needed.','Aucune expérience préalable requise. Maîtrise de base de l''informatique nécessaire.'),
('a0000001-0000-0000-0000-000000000003','Diploma in Business Management','Diplôme en Gestion d''Entreprise','diploma','12 months','Comprehensive management: strategy, finance, marketing, operations, and leadership.','Formation complète : stratégie, finance, marketing, opérations et leadership.','Our flagship diploma programme provides a comprehensive foundation in all core management disciplines. Graduates are equipped to take on supervisory and mid-level management positions across industries.','Notre programme phare de diplôme fournit une base complète dans toutes les disciplines essentielles de gestion.','Certificate in Business Administration or 2 years of work experience.','Certificat en Administration des Affaires ou 2 ans d''expérience professionnelle.'),
('a0000001-0000-0000-0000-000000000004','Diploma in Accounting & Finance','Diplôme en Comptabilité et Finance','diploma','12 months','Professional accounting, financial reporting, budgeting, and ACCA Foundation preparation.','Comptabilité professionnelle, reporting financier, budgétisation et préparation ACCA.','A rigorous accounting and finance programme aligned with ACCA Foundation standards. Students gain deep competency in financial reporting, cost accounting, taxation, and treasury management.','Programme rigoureux en comptabilité et finance aligné sur les normes ACCA Foundation.','Strong numeracy skills. Certificate-level qualification preferred.','Solides compétences en numératie. Qualification de niveau certificat préférée.'),
('a0000001-0000-0000-0000-000000000005','Advanced Diploma in Business Administration','Diplôme Avancé en Administration des Affaires','advanced','18 months','Flagship: strategic management, corporate governance, entrepreneurship, and MBA preparation.','Programme phare : management stratégique, gouvernance d''entreprise, entrepreneuriat et préparation au MBA.','Our most comprehensive programme, the Advanced Diploma prepares students for senior leadership roles and MBA entry. Combines rigorous academic content with practical business simulations and an applied capstone project.','Notre programme le plus complet, le Diplôme Avancé prépare les étudiants aux rôles de leadership senior et à l''entrée en MBA.','Diploma-level qualification or minimum 3 years of management experience.','Qualification de niveau diplôme ou minimum 3 ans d''expérience en management.'),
('a0000001-0000-0000-0000-000000000006','Advanced Diploma in Financial Management','Diplôme Avancé en Gestion Financière','advanced','18 months','Corporate finance, investment analysis, risk management, and treasury operations.','Finance d''entreprise, analyse des investissements, gestion des risques et opérations de trésorerie.','A specialist advanced programme for finance professionals seeking to move into senior roles. Covers corporate valuation, derivatives, financial modelling, and strategic financial planning.','Programme avancé spécialisé pour les professionnels de la finance cherchant à évoluer vers des rôles seniors.','Diploma in Accounting & Finance or equivalent professional qualification.','Diplôme en Comptabilité et Finance ou qualification professionnelle équivalente.')
on conflict (id) do nothing;

-- ── SEED PROFILES (fake auth entries workaround: insert directly) ─
-- NOTE: In production, accounts are created via auth.signUp().
-- For demo/seed purposes, we insert profile rows directly.
-- These profiles won't be able to log in unless you also create
-- matching auth.users rows via the Supabase Dashboard > Authentication.
-- Create these accounts in Auth first, then this seed links the profiles.

-- Demo accounts to create in Supabase Auth dashboard:
--   admin@lwsm.edu       / Admin2025!
--   lecturer1@lwsm.edu   / Lecturer2025!
--   lecturer2@lwsm.edu   / Lecturer2025!
--   student1@lwsm.edu    / Student2025!
--   student2@lwsm.edu    / Student2025!
--   student3@lwsm.edu    / Student2025!
--   student4@lwsm.edu    / Student2025!
--   student5@lwsm.edu    / Student2025!

-- After creating those accounts in the Auth dashboard, Supabase will
-- fire the trigger and insert profiles automatically. Then run this
-- UPDATE block to set roles, names, and extra fields:

-- UPDATE BLOCK: run this after creating auth users above
-- (Safe to run multiple times — uses ON CONFLICT DO UPDATE)

-- ── SEED COURSES (linked to real programs; no lecturer_id initially) ─
insert into public.courses (id, program_id, title, title_fr, code, description, description_fr, objectives, is_published, duration, credits) values
('c0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','Introduction to Business Management','Introduction à la Gestion d''Entreprise','BUS101','A foundational overview of business management concepts including planning, organising, leading, and controlling.','Vue d''ensemble des concepts fondamentaux de la gestion d''entreprise.','Understand core management functions\nApply planning frameworks\nAnalyse organisational structures',true,'8 weeks',3),
('c0000001-0000-0000-0000-000000000002','a0000001-0000-0000-0000-000000000001','Business Communication','Communication d''Entreprise','BUS102','Develop professional written and oral communication skills for the workplace.','Développer des compétences professionnelles de communication écrite et orale.','Write effective business documents\nDeliver professional presentations\nCommunicate across cultures',true,'6 weeks',2),
('c0000001-0000-0000-0000-000000000003','a0000001-0000-0000-0000-000000000002','Social Media Marketing','Marketing des Médias Sociaux','MKT101','Strategy, content creation, community management, and analytics across major social platforms.','Stratégie, création de contenu, gestion de communauté et analytique.','Build a brand social media strategy\nCreate engaging content calendars\nMeasure campaign ROI',true,'6 weeks',2),
('c0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000002','Search Engine Optimisation','Optimisation pour les Moteurs de Recherche','MKT102','Technical and content SEO strategies to improve organic search visibility.','Stratégies SEO techniques et de contenu pour améliorer la visibilité organique.','Conduct keyword research\nOptimise on-page and technical SEO\nBuild link acquisition strategies',true,'5 weeks',2),
('c0000001-0000-0000-0000-000000000005','a0000001-0000-0000-0000-000000000003','Strategic Management','Management Stratégique','MGT201','Frameworks for competitive analysis, strategy formulation, and implementation.','Cadres pour l''analyse concurrentielle, la formulation et la mise en œuvre de stratégies.','Apply Porter''s Five Forces and SWOT\nFormulate competitive strategies\nManage strategic change',true,'10 weeks',4),
('c0000001-0000-0000-0000-000000000006','a0000001-0000-0000-0000-000000000003','Financial Management','Gestion Financière','FIN201','Corporate finance fundamentals: capital structure, investment appraisal, and working capital.','Fondamentaux de la finance d''entreprise : structure du capital, évaluation des investissements.','Calculate NPV and IRR\nAnalyse financial statements\nManage working capital efficiently',true,'10 weeks',4),
('c0000001-0000-0000-0000-000000000007','a0000001-0000-0000-0000-000000000004','Financial Reporting','Reporting Financier','ACC201','IFRS-aligned financial reporting: preparation and interpretation of financial statements.','Reporting financier aligné IFRS : préparation et interprétation des états financiers.','Prepare income statements and balance sheets\nApply IFRS standards\nInterpret financial ratios',true,'10 weeks',4),
('c0000001-0000-0000-0000-000000000008','a0000001-0000-0000-0000-000000000005','Corporate Governance & Ethics','Gouvernance d''Entreprise et Éthique','MGT301','Board structures, stakeholder theory, ESG reporting, and ethical decision-making frameworks.','Structures des conseils, théorie des parties prenantes, reporting ESG.','Evaluate governance frameworks\nApply ethical decision-making models\nPrepare ESG disclosure summaries',true,'8 weeks',3),
('c0000001-0000-0000-0000-000000000009','a0000001-0000-0000-0000-000000000005','Entrepreneurship & Innovation','Entrepreneuriat et Innovation','ENT301','Business model canvas, lean startup methodology, fundraising, and venture scaling.','Business model canvas, méthodologie lean startup, levée de fonds et croissance.','Design a validated business model\nPitch to investors\nBuild a go-to-market plan',true,'10 weeks',4),
('c0000001-0000-0000-0000-000000000010','a0000001-0000-0000-0000-000000000006','Corporate Finance & Valuation','Finance d''Entreprise et Évaluation','FIN301','DCF modelling, comparable company analysis, LBO fundamentals, and M&A deal structures.','Modélisation DCF, analyse de sociétés comparables, fondamentaux LBO et structures M&A.',true,'12 weeks',5)
on conflict (id) do nothing;

-- ── ANNOUNCEMENTS (visible to all students) ───────────────────
insert into public.announcements (title_en, title_fr, body_en, body_fr, target_role) values
('Semester 2 Timetables Now Available','Les emplois du temps du Semestre 2 sont disponibles','All Semester 2 timetables have been uploaded to your course pages. Please log in and check your course schedule before the start of classes on January 13th.','Tous les emplois du temps du Semestre 2 ont été téléversés. Connectez-vous et consultez votre emploi du temps avant le début des cours le 13 janvier.','student'),
('Library Access Extended','Accès à la Bibliothèque Prolongé','The online library access hours have been extended to 24/7. Students can now access all course materials, journals, and research databases at any time.','L''accès à la bibliothèque en ligne a été étendu à 24h/24 et 7j/7. Les étudiants peuvent désormais accéder à tous les supports de cours à tout moment.','student'),
('Applications Open for January 2026 Intake','Candidatures ouvertes pour la promotion de janvier 2026','We are now accepting applications for our January 2026 intake. Early applications receive priority consideration. Apply through the Admissions page.','Nous acceptons maintenant les candidatures pour la promotion de janvier 2026. Les candidatures anticipées reçoivent une considération prioritaire.','public'),
('Staff Development Day — No Classes Feb 7','Journée de développement du personnel — Pas de cours le 7 février','There will be no classes on Friday, February 7th due to the annual Staff Development Day. All online resources will remain accessible.','Il n''y aura pas de cours le vendredi 7 février en raison de la Journée annuelle de développement du personnel.','student'),
('New Course Materials Uploaded — FIN301','Nouveaux supports de cours téléversés — FIN301','Dr. Fatou Diallo has uploaded the Week 3 lecture notes and the DCF modelling template to the FIN301 course page.','La Dr Fatou Diallo a téléversé les notes du cours de la Semaine 3 et le modèle DCF sur la page du cours FIN301.','student')
on conflict do nothing;

-- ── APPLICATIONS (pending, for admin portal demo) ─────────────
insert into public.applications (full_name, email, phone, country, message, status, program_id) values
('Kouame Assi','kouame.assi@email.com','+225 07 12 34 56','Côte d''Ivoire','I have 3 years of experience in retail management and want to formalise my knowledge with a diploma.','pending','a0000001-0000-0000-0000-000000000003'),
('Aminata Traoré','aminata.traore@email.com','+225 05 98 76 54','Côte d''Ivoire','I am a recent graduate looking to specialise in digital marketing for the African market.','pending','a0000001-0000-0000-0000-000000000002'),
('Emeka Obi','emeka.obi@email.com','+234 80 1234 5678','Nigeria','Finance professional with 5 years in banking. Looking for an advanced qualification to move into corporate finance.','reviewing','a0000001-0000-0000-0000-000000000006'),
('Fatou Ndiaye','fatou.ndiaye@email.com','+221 77 654 3210','Senegal','Currently working as an accountant. Want to prepare for ACCA and need structured training.','pending','a0000001-0000-0000-0000-000000000004'),
('Kofi Mensah','kofi.mensah@email.com','+233 24 765 4321','Ghana','Entrepreneur looking to formalise my business knowledge and scale my SME.','pending','a0000001-0000-0000-0000-000000000005')
on conflict do nothing;

-- ── CONTACT MESSAGES ──────────────────────────────────────────
insert into public.contact_messages (name, email, subject, message, is_read) values
('Abiodun Salawu','abiodun.s@email.com','Accreditation query','Is the Advanced Diploma in Business Administration internationally recognised? I am planning to use it as MBA preparation.', false),
('Céleste Kouadio','celeste.k@email.com','Payment methods','What payment methods do you accept? Can fees be paid in instalments?', false),
('Marcus Njoku','marcus.n@email.com','Corporate training','We are a company of 40 staff and would like to enquire about bespoke corporate training packages.', true)
on conflict do nothing;

-- ============================================================
-- HOW TO COMPLETE THE SEED:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Create these users manually (Add user button):
--    admin@lwsm.edu      — then run: update profiles set role='admin', full_name='Dr. Laurent Nkemdirim' where email='admin@lwsm.edu';
--    lecturer1@lwsm.edu  — then run: update profiles set role='lecturer', full_name='Dr. Amina Ouédraogo', lecturer_title='Associate Professor', country='Côte d''Ivoire' where email='lecturer1@lwsm.edu';
--    lecturer2@lwsm.edu  — then run: update profiles set role='lecturer', full_name='Mr. Jean-Baptiste Kouassi', lecturer_title='Senior Lecturer', country='Côte d''Ivoire' where email='lecturer2@lwsm.edu';
--    student1@lwsm.edu   — created automatically as student role
--    student2@lwsm.edu   — created automatically as student role
--    student3@lwsm.edu   — etc.
--    student4@lwsm.edu
--    student5@lwsm.edu
--
-- 3. After creating auth users, run the PROFILE UPDATE block below.
-- ============================================================

-- ── PROFILE UPDATES (run after creating auth users) ───────────
-- Copy and run this block in SQL Editor after creating the auth users above:

/*
update public.profiles set
  role='admin', full_name='Dr. Laurent Nkemdirim', phone='+225 27 22 44 55 66', country='Côte d''Ivoire', status='active'
  where email='admin@lwsm.edu';

update public.profiles set
  role='lecturer', full_name='Dr. Amina Ouédraogo', phone='+225 05 11 22 33', country='Côte d''Ivoire', status='active'
  where email='lecturer1@lwsm.edu';

update public.profiles set
  role='lecturer', full_name='Mr. Jean-Baptiste Kouassi', phone='+225 07 44 55 66', country='Côte d''Ivoire', status='active'
  where email='lecturer2@lwsm.edu';

update public.profiles set full_name='Aïcha Koné', phone='+225 07 12 34 56', country='Côte d''Ivoire' where email='student1@lwsm.edu';
update public.profiles set full_name='Emmanuel Adeyemi', phone='+234 80 9876 5432', country='Nigeria' where email='student2@lwsm.edu';
update public.profiles set full_name='Fatou Diop', phone='+221 77 123 4567', country='Senegal' where email='student3@lwsm.edu';
update public.profiles set full_name='Kwame Asante', phone='+233 24 987 6543', country='Ghana' where email='student4@lwsm.edu';
update public.profiles set full_name='Marie-Claire Gbagbo', phone='+225 01 23 45 67', country='Côte d''Ivoire' where email='student5@lwsm.edu';

-- Assign lecturers to courses
update public.courses set lecturer_id=(select id from public.profiles where email='lecturer1@lwsm.edu' limit 1), lecturer_name='Dr. Amina Ouédraogo', lecturer_email='lecturer1@lwsm.edu'
  where id in ('c0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000007','c0000001-0000-0000-0000-000000000009');

update public.courses set lecturer_id=(select id from public.profiles where email='lecturer2@lwsm.edu' limit 1), lecturer_name='Mr. Jean-Baptiste Kouassi', lecturer_email='lecturer2@lwsm.edu'
  where id in ('c0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000006','c0000001-0000-0000-0000-000000000008','c0000001-0000-0000-0000-000000000010');

-- Enrol students in courses
insert into public.enrollments (student_id, program_id, course_id, status, progress_pct, enrolled_at) values
((select id from public.profiles where email='student1@lwsm.edu'),'a0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000001','active',65,now()-interval'45 days'),
((select id from public.profiles where email='student1@lwsm.edu'),'a0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000002','active',40,now()-interval'45 days'),
((select id from public.profiles where email='student1@lwsm.edu'),'a0000001-0000-0000-0000-000000000003','c0000001-0000-0000-0000-000000000005','active',20,now()-interval'45 days'),
((select id from public.profiles where email='student2@lwsm.edu'),'a0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000007','active',75,now()-interval'60 days'),
((select id from public.profiles where email='student2@lwsm.edu'),'a0000001-0000-0000-0000-000000000004','c0000001-0000-0000-0000-000000000006','active',55,now()-interval'60 days'),
((select id from public.profiles where email='student3@lwsm.edu'),'a0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000003','active',90,now()-interval'30 days'),
((select id from public.profiles where email='student3@lwsm.edu'),'a0000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000004','active',70,now()-interval'30 days'),
((select id from public.profiles where email='student4@lwsm.edu'),'a0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000008','active',30,now()-interval'20 days'),
((select id from public.profiles where email='student4@lwsm.edu'),'a0000001-0000-0000-0000-000000000005','c0000001-0000-0000-0000-000000000009','active',15,now()-interval'20 days'),
((select id from public.profiles where email='student5@lwsm.edu'),'a0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','active',85,now()-interval'70 days'),
((select id from public.profiles where email='student5@lwsm.edu'),'a0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000002','completed',100,now()-interval'70 days')
on conflict do nothing;

-- Assignments
insert into public.assignments (course_id, type, title_en, title_fr, description_en, description_fr, due_date, max_score) values
('c0000001-0000-0000-0000-000000000001','assignment','Management Functions Essay','Dissertation sur les Fonctions de Management','Write a 1,500-word essay analysing the four core management functions (POLC) using a real company example.','Rédigez une dissertation de 1 500 mots analysant les quatre fonctions de management en utilisant un exemple d''entreprise réelle.',now()+interval'7 days',100),
('c0000001-0000-0000-0000-000000000001','quiz','Chapter 1 Quiz','Quiz Chapitre 1','Multiple-choice quiz covering Chapter 1: Introduction to Management.','Quiz à choix multiples couvrant le Chapitre 1.',now()-interval'5 days',50),
('c0000001-0000-0000-0000-000000000005','assignment','SWOT Analysis Report','Rapport d''Analyse SWOT','Conduct a full SWOT and Porter''s Five Forces analysis for a West African company of your choice.','Effectuez une analyse SWOT complète et une analyse des cinq forces de Porter pour une entreprise d''Afrique de l''Ouest.',now()+interval'14 days',100),
('c0000001-0000-0000-0000-000000000007','exam','Mid-Semester Financial Reporting Exam','Examen de Mi-Semestre en Reporting Financier','Prepare a full set of financial statements from the trial balance provided. Time allowed: 2.5 hours.','Préparez un ensemble complet d''états financiers à partir de la balance fournie. Durée : 2h30.',now()+interval'21 days',100)
on conflict do nothing;

-- Attendance (student1 across 3 courses, last 30 days)
insert into public.attendance (course_id, student_id, date, status)
select
  c.course_id,
  (select id from public.profiles where email='student1@lwsm.edu'),
  gs.d,
  case when random()<0.8 then 'present' when random()<0.5 then 'late' else 'absent' end
from (values
  ('c0000001-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000002')
) as c(course_id)
cross join generate_series(now()::date - interval '30 days', now()::date - interval '1 day', '7 days') as gs(d)
where exists (select 1 from public.profiles where email='student1@lwsm.edu')
on conflict do nothing;

-- Payments
insert into public.payments (student_id, amount, currency, type, status, reference, description, paid_at)
select id, 350000, 'XOF', 'registration', 'success', 'REG-2025-001', 'Registration Fee — Diploma in Business Management', now()-interval'45 days' from public.profiles where email='student1@lwsm.edu'
on conflict do nothing;
insert into public.payments (student_id, amount, currency, type, status, reference, description, paid_at)
select id, 750000, 'XOF', 'tuition', 'success', 'TUI-2025-001', 'Tuition Fee — Semester 1', now()-interval'44 days' from public.profiles where email='student1@lwsm.edu'
on conflict do nothing;
insert into public.payments (student_id, amount, currency, type, status, reference, description)
select id, 750000, 'XOF', 'tuition', 'pending', 'TUI-2025-002', 'Tuition Fee — Semester 2' from public.profiles where email='student1@lwsm.edu'
on conflict do nothing;
insert into public.payments (student_id, amount, currency, type, status, reference, description, paid_at)
select id, 350000, 'XOF', 'registration', 'success', 'REG-2025-002', 'Registration Fee — Diploma in Accounting', now()-interval'60 days' from public.profiles where email='student2@lwsm.edu'
on conflict do nothing;
insert into public.payments (student_id, amount, currency, type, status, reference, description, paid_at)
select id, 750000, 'XOF', 'tuition', 'success', 'TUI-2025-003', 'Tuition Fee — Semester 1', now()-interval'59 days' from public.profiles where email='student2@lwsm.edu'
on conflict do nothing;
insert into public.payments (student_id, amount, currency, type, status, reference, description, paid_at)
select id, 350000, 'XOF', 'registration', 'success', 'REG-2025-003', 'Registration Fee — Certificate in Digital Marketing', now()-interval'30 days' from public.profiles where email='student3@lwsm.edu'
on conflict do nothing;

-- Grades (student2: graded assignments)
insert into public.grades (course_id, student_id, score, grade, remarks, is_published, graded_at)
select 'c0000001-0000-0000-0000-000000000007', id, 78, 'B+', 'Solid understanding of IFRS principles. Revenue recognition section particularly well done.', true, now()-interval'10 days'
from public.profiles where email='student2@lwsm.edu'
on conflict do nothing;

insert into public.grades (course_id, student_id, score, grade, remarks, is_published, graded_at)
select 'c0000001-0000-0000-0000-000000000006', id, 82, 'A-', 'Excellent NPV analysis. Minor errors in WACC calculation.', true, now()-interval'5 days'
from public.profiles where email='student2@lwsm.edu'
on conflict do nothing;

-- Course materials
insert into public.course_materials (course_id, title_en, title_fr, type, url, is_premium) values
('c0000001-0000-0000-0000-000000000001','Week 1 Lecture Notes: Introduction to Management','Notes Cours Semaine 1 : Introduction au Management','note','https://example.com/materials/bus101-w1.pdf',false),
('c0000001-0000-0000-0000-000000000001','Management Functions Overview Video','Vidéo : Vue d''ensemble des Fonctions de Management','video','https://www.youtube.com/watch?v=example1',false),
('c0000001-0000-0000-0000-000000000001','Case Study: Unilever Africa Strategy','Étude de Cas : Stratégie Unilever Afrique','file','https://example.com/materials/unilever-case.pdf',false),
('c0000001-0000-0000-0000-000000000005','Strategic Management Textbook (Ch. 1–5)','Manuel de Management Stratégique (Ch. 1–5)','note','https://example.com/materials/mgt201-textbook.pdf',true),
('c0000001-0000-0000-0000-000000000007','IFRS Standards Summary Sheet','Résumé des Normes IFRS','note','https://example.com/materials/ifrs-summary.pdf',false),
('c0000001-0000-0000-0000-000000000007','Financial Statement Preparation Tutorial','Tutoriel : Préparation des États Financiers','video','https://www.youtube.com/watch?v=example2',false)
on conflict do nothing;

-- Certificates
insert into public.certificates (certificate_number, student_name, is_verified, issue_date, completion_date, program_id)
select 'LWSM-2024-0042', 'Fatou Diop', true, '2024-12-15', '2024-12-01', 'a0000001-0000-0000-0000-000000000002'
where not exists (select 1 from public.certificates where certificate_number='LWSM-2024-0042');

insert into public.certificates (certificate_number, student_name, is_verified, issue_date, completion_date, program_id)
select 'LWSM-2024-0031', 'Kwame Asante', true, '2024-11-20', '2024-11-05', 'a0000001-0000-0000-0000-000000000001'
where not exists (select 1 from public.certificates where certificate_number='LWSM-2024-0031');

insert into public.certificates (certificate_number, student_name, is_verified, issue_date, completion_date, program_id)
select 'LWSM-2025-0003', 'Aïcha Koné', false, '2025-01-10', '2024-12-30', 'a0000001-0000-0000-0000-000000000003'
where not exists (select 1 from public.certificates where certificate_number='LWSM-2025-0003');
*/

-- ============================================================
-- END OF SETUP
-- ============================================================
