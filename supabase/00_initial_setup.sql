-- ============================================================
  -- LWGSM — Initial Supabase Setup
  -- Run this FIRST in your Supabase SQL Editor
  -- ============================================================

  -- ── ENUMS ────────────────────────────────────────────────────
  do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('student', 'lecturer', 'admin');
  end if;
end $$;
  do $$ begin
  if not exists (select 1 from pg_type where typname = 'program_type') then
    create type program_type as enum ('certificate', 'diploma', 'advanced');
  end if;
end $$;
  do $$ begin
  if not exists (select 1 from pg_type where typname = 'material_type') then
    create type material_type as enum ('note', 'video', 'file');
  end if;
end $$;
  do $$ begin
  if not exists (select 1 from pg_type where typname = 'enrollment_status') then
    create type enrollment_status as enum ('pending', 'active', 'completed', 'withdrawn');
  end if;
end $$;
  do $$ begin
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type attendance_status as enum ('present', 'absent', 'late');
  end if;
end $$;
  do $$ begin
  if not exists (select 1 from pg_type where typname = 'payment_type') then
    create type payment_type as enum ('registration', 'tuition', 'certificate', 'material');
  end if;
end $$;
  do $$ begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'success', 'failed');
  end if;
end $$;

  -- ── 1. PROFILES ───────────────────────────────────────────────
  create table if not exists public.profiles (
    id             uuid primary key references auth.users(id) on delete cascade,
    role           user_role not null default 'student',
    full_name      text not null,
    email          text not null unique,
    phone          text,
    country        text,
    language_pref  text not null default 'en' check (language_pref in ('en','fr')),
    avatar_url     text,
    created_at     timestamptz not null default now()
  );
  alter table public.profiles enable row level security;

  create policy "profiles: read own" on public.profiles for select using (auth.uid() = id or public.is_admin(auth.uid()));
  create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
  create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

  -- ── 2. PROGRAMS ───────────────────────────────────────────────
  create table if not exists public.programs (
    id             uuid primary key default gen_random_uuid(),
    title          text not null,
    title_fr       text,
    type           text not null check (type in ('certificate', 'diploma', 'advanced')),
    duration       text,
    short_desc     text,
    short_desc_fr  text,
    description    text,
    description_fr text,
    created_at     timestamptz not null default now()
  );
  alter table public.programs enable row level security;
  create policy "programs: public read" on public.programs for select using (true);
  create policy "programs: admin write" on public.programs for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

  -- Seed programs
  insert into public.programs (title, title_fr, type, duration, short_desc, short_desc_fr)
  select * from (values
    ('Certificate in Business Administration','Certificat en Administration des Affaires','certificate','6 months','Foundational business skills covering accounting, marketing, and organisational behaviour.','Compétences commerciales fondamentales.'),
    ('Certificate in Human Resource Management','Certificat en Gestion des Ressources Humaines','certificate','6 months','Practical HR skills: recruitment, payroll, labour law, and employee relations.','Compétences RH pratiques : recrutement, paie, droit du travail.'),
    ('Certificate in Digital Marketing','Certificat en Marketing Digital','certificate','4 months','Social media strategy, SEO, email campaigns, and analytics for business growth.','Stratégie médias sociaux, SEO, campagnes email et analytique.'),
    ('Diploma in Business Management','Diplôme en Gestion d''Entreprise','diploma','12 months','Comprehensive management: strategy, finance, marketing, operations, and leadership.','Formation complète : stratégie, finance, marketing et leadership.'),
    ('Diploma in Accounting & Finance','Diplôme en Comptabilité et Finance','diploma','12 months','Professional accounting, financial reporting, budgeting, and ACCA Foundation preparation.','Comptabilité professionnelle et préparation ACCA.'),
    ('Diploma in Project Management','Diplôme en Gestion de Projets','diploma','12 months','PMI-aligned methodology, Agile, stakeholder management, and risk assessment.','Méthodologie PMI, Agile, gestion des parties prenantes.'),
    ('Diploma in Supply Chain & Logistics','Diplôme en Chaîne d''Approvisionnement','diploma','12 months','End-to-end supply chain management, procurement, and logistics in African markets.','Gestion de la chaîne d''approvisionnement et logistique africaine.'),
    ('Advanced Diploma in Business Administration','Diplôme Avancé en Administration des Affaires','advanced','18 months','Flagship: strategic management, corporate governance, entrepreneurship, and MBA preparation.','Programme phare : management stratégique, gouvernance, entrepreneuriat.'),
    ('Advanced Diploma in Financial Management','Diplôme Avancé en Gestion Financière','advanced','18 months','Corporate finance, investment analysis, risk management, and treasury operations.','Finance d''entreprise, analyse des investissements, gestion des risques.'),
    ('Advanced Diploma in Entrepreneurship & Innovation','Diplôme Avancé en Entrepreneuriat et Innovation','advanced','18 months','Venture creation, business model innovation, and funding strategies in emerging markets.','Création d''entreprise, innovation de modèle d''affaires.')
  ) as v(title, title_fr, type, duration, short_desc, short_desc_fr)
  where not exists (select 1 from public.programs limit 1);

  -- ── 3. COURSES ────────────────────────────────────────────────
  create table if not exists public.courses (
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
  create index if not exists idx_courses_program    on public.courses(program_id);
  create index if not exists idx_courses_lecturer   on public.courses(lecturer_id);
  alter table public.courses enable row level security;
  create policy "courses: read published or own" on public.courses for select
    using (is_published or lecturer_id = auth.uid() or public.is_admin(auth.uid()));
  create policy "courses: lecturer/admin write" on public.courses for all
    using (lecturer_id = auth.uid() or public.is_admin(auth.uid()))
    with check (lecturer_id = auth.uid() or public.is_admin(auth.uid()));

  -- ── 4. ENROLLMENTS ────────────────────────────────────────────
  create table if not exists public.enrollments (
    id           uuid primary key default gen_random_uuid(),
    student_id   uuid not null references public.profiles(id) on delete cascade,
    program_id   uuid references public.programs(id) on delete set null,
    course_id    uuid references public.courses(id) on delete set null,
    status       text not null default 'active'
                check (status in ('active','completed','withdrawn','suspended','pending')),
    progress_pct int default 0 check (progress_pct between 0 and 100),
    enrolled_at  timestamptz default now(),
    completed_at timestamptz,
    created_at   timestamptz default now()
  );
  create index if not exists idx_enr_student  on public.enrollments(student_id);
  create index if not exists idx_enr_course   on public.enrollments(course_id);
  create index if not exists idx_enr_program  on public.enrollments(program_id);
  alter table public.enrollments enable row level security;
  create policy "enrollments: student read own" on public.enrollments for select
    using (student_id = auth.uid() or public.is_admin(auth.uid())
          or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));
  create policy "enrollments: student insert" on public.enrollments for insert with check (student_id = auth.uid());
  create policy "enrollments: admin update" on public.enrollments for update using (public.is_admin(auth.uid()));

  -- ── 5. COURSE MATERIALS ───────────────────────────────────────
  create table if not exists public.course_materials (
    id          uuid primary key default gen_random_uuid(),
    course_id   uuid not null references public.courses(id) on delete cascade,
    title_en    text not null,
    title_fr    text,
    type        material_type not null,
    url         text not null,
    is_premium  boolean not null default false,
    price       numeric(10,2) default 0,
    created_at  timestamptz not null default now()
  );
  alter table public.course_materials enable row level security;
  create policy "materials: enrolled read" on public.course_materials for select
    using (
      public.is_admin(auth.uid())
      or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid())
      or exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
    );
  create policy "materials: lecturer write" on public.course_materials for all
    using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()))
    with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

  -- ── 6. ASSIGNMENTS ────────────────────────────────────────────
  create table if not exists public.assignments (
    id              uuid primary key default gen_random_uuid(),
    course_id       uuid not null references public.courses(id) on delete cascade,
    title_en        text not null,
    title_fr        text,
    description_en  text,
    description_fr  text,
    due_date        timestamptz,
    max_score       numeric(5,2) default 100,
    created_at      timestamptz not null default now()
  );
  alter table public.assignments enable row level security;
  create policy "assignments: enrolled read" on public.assignments for select
    using (
      public.is_admin(auth.uid())
      or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid())
      or exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
    );
  create policy "assignments: lecturer write" on public.assignments for all
    using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()))
    with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

  -- ── 7. SUBMISSIONS ────────────────────────────────────────────
  create table if not exists public.submissions (
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
  create policy "submissions: student read own" on public.submissions for select
    using (student_id = auth.uid() or public.is_admin(auth.uid())
      or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id
                where a.id = assignment_id and c.lecturer_id = auth.uid()));
  create policy "submissions: student insert" on public.submissions for insert with check (student_id = auth.uid());
  create policy "submissions: lecturer grade" on public.submissions for update
    using (public.is_admin(auth.uid())
      or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id
                where a.id = assignment_id and c.lecturer_id = auth.uid()));

  -- ── 8. ATTENDANCE ─────────────────────────────────────────────
  create table if not exists public.attendance (
    id         uuid primary key default gen_random_uuid(),
    course_id  uuid not null references public.courses(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    date       date not null,
    status     attendance_status not null default 'present',
    notes      text,
    created_at timestamptz not null default now()
  );
  alter table public.attendance enable row level security;
  create policy "attendance: read" on public.attendance for select
    using (student_id = auth.uid() or public.is_admin(auth.uid())
      or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));
  create policy "attendance: write" on public.attendance for all
    using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()))
    with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

  -- ── 9. GRADES ─────────────────────────────────────────────────
  create table if not exists public.grades (
    id          uuid primary key default gen_random_uuid(),
    course_id   uuid not null references public.courses(id) on delete cascade,
    student_id  uuid not null references public.profiles(id) on delete cascade,
    score       numeric(5,2),
    grade       text,
    remarks     text,
    graded_at   timestamptz default now(),
    created_at  timestamptz not null default now()
  );
  alter table public.grades enable row level security;
  create policy "grades: read" on public.grades for select
    using (student_id = auth.uid() or public.is_admin(auth.uid())
      or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));
  create policy "grades: write" on public.grades for all
    using (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()))
    with check (public.is_admin(auth.uid()) or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));

  -- ── 10. PAYMENTS ──────────────────────────────────────────────
  create table if not exists public.payments (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references public.profiles(id) on delete cascade,
    amount          numeric(12,2) not null,
    currency        text not null default 'XOF',
    type            payment_type not null default 'tuition',
    status          payment_status not null default 'pending',
    reference       text unique,
    description     text,
    paid_at         timestamptz,
    created_at      timestamptz not null default now()
  );
  alter table public.payments enable row level security;
  create policy "payments: student read own" on public.payments for select using (student_id = auth.uid() or public.is_admin(auth.uid()));
  create policy "payments: student insert" on public.payments for insert with check (student_id = auth.uid());
  create policy "payments: admin update" on public.payments for update using (public.is_admin(auth.uid()));

  -- ── 11. CERTIFICATES ──────────────────────────────────────────
  create table if not exists public.certificates (
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
    created_at         timestamptz default now(),
    updated_at         timestamptz default now()
  );
  create index if not exists idx_certs_number   on public.certificates(certificate_number);
  create index if not exists idx_certs_student  on public.certificates(student_id);
  create index if not exists idx_certs_verified on public.certificates(is_verified);
  alter table public.certificates enable row level security;
  create policy "certificates: public verify" on public.certificates for select using (true);
  create policy "certificates: admin write" on public.certificates for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

  -- ── 12. ANNOUNCEMENTS ─────────────────────────────────────────
  create table if not exists public.announcements (
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
  create policy "announcements: read by role" on public.announcements for select
    using (
      target_role is null
      or target_role = 'public'
      or public.is_admin(auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = target_role)
    );
  create policy "announcements: admin/lecturer write" on public.announcements for all
    using (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()))
    with check (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()));

  -- ── 13. MESSAGES ──────────────────────────────────────────────
  create table if not exists public.messages (
    id          uuid primary key default gen_random_uuid(),
    sender_id   uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade,
    subject     text,
    body        text not null,
    is_read     boolean not null default false,
    created_at  timestamptz not null default now()
  );
  alter table public.messages enable row level security;
  create policy "messages: participants read" on public.messages for select
    using (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin(auth.uid()));
  create policy "messages: sender insert" on public.messages for insert with check (sender_id = auth.uid());
  create policy "messages: recipient update" on public.messages for update using (receiver_id = auth.uid());

  -- ── 14. APPLICATIONS ──────────────────────────────────────────
  create table if not exists public.applications (
    id          uuid primary key default gen_random_uuid(),
    student_id  uuid references auth.users(id) on delete set null,
    program_id  uuid references public.programs(id) on delete set null,
    full_name   text,
    first_name  text,
    last_name   text,
    email       text not null,
    phone       text,
    country     text,
    message     text,
    status      text not null default 'pending' check (status in ('pending','reviewing','accepted','rejected')),
    created_at  timestamptz not null default now()
  );
  alter table public.applications enable row level security;
  create policy "applications: public insert" on public.applications for insert with check (true);
  create policy "applications: admin read" on public.applications for select using (public.is_admin(auth.uid()) or auth.uid() = student_id);
  create policy "applications: admin update" on public.applications for update using (public.is_admin(auth.uid()));

  -- ── 15. CONTACT MESSAGES ──────────────────────────────────────
  create table if not exists public.contact_messages (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    email      text not null,
    subject    text,
    message    text not null,
    is_read    boolean not null default false,
    created_at timestamptz not null default now()
  );
  alter table public.contact_messages enable row level security;
  create policy "contact: public insert" on public.contact_messages for insert with check (true);
  create policy "contact: admin read" on public.contact_messages for select using (public.is_admin(auth.uid()));

  -- ── HELPER FUNCTIONS ──────────────────────────────────────────
  create or replace function public.is_admin(uid uuid)
  returns boolean language sql security definer as $$
    select exists (select 1 from public.profiles where id = uid and role = 'admin');
  $$;

  create or replace function public.is_lecturer(uid uuid)
  returns boolean language sql security definer as $$
    select exists (select 1 from public.profiles where id = uid and role = 'lecturer');
  $$;

  -- Auto-create profile on signup
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer as $$
  begin
    insert into public.profiles (id, full_name, email, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      'student'
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;

  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

  -- ── 16. ASSIGNMENT TYPE + STORAGE (added for Assessments module) ──
  do $$
  begin
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'assignments' and column_name = 'type'
    ) then
      alter table public.assignments
        add column type text not null default 'assignment'
        check (type in ('assignment','quiz','exam'));
    end if;
  end $$;

  -- Storage bucket for submission uploads
  insert into storage.buckets (id, name, public)
  values ('submissions', 'submissions', false)
  on conflict (id) do nothing;

  -- Students can upload to their own folder: submissions/{student_id}/...
  create policy "submissions bucket: student upload"
  on storage.objects for insert
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  -- Students can read their own files; lecturers/admins can read all
  create policy "submissions bucket: read"
  on storage.objects for select
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
      or public.is_lecturer(auth.uid())
    )
  );

  -- ── 17. GRADES: published flag (added for Lecturer Gradebook) ────
  do $$
  begin
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'grades' and column_name = 'is_published'
    ) then
      alter table public.grades
        add column is_published boolean not null default false;
    end if;
  end $$;

  -- Students should only see grades once published (admins/lecturers always see all)
  drop policy if exists "grades: read" on public.grades;
  create policy "grades: read" on public.grades for select
    using (
      (student_id = auth.uid() and is_published)
      or public.is_admin(auth.uid())
      or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid())
    );

  -- ── 18. COURSE MATERIALS STORAGE BUCKET (lecturer uploads) ────────
  insert into storage.buckets (id, name, public)
  values ('course-materials', 'course-materials', true)
  on conflict (id) do nothing;

  -- Lecturers (for their own courses) and admins can upload/manage
  create policy "course-materials bucket: lecturer write"
  on storage.objects for insert
  with check (
    bucket_id = 'course-materials'
    and (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()))
  );

  create policy "course-materials bucket: lecturer update"
  on storage.objects for update
  using (
    bucket_id = 'course-materials'
    and (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()))
  );

  create policy "course-materials bucket: lecturer delete"
  on storage.objects for delete
  using (
    bucket_id = 'course-materials'
    and (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()))
  );

  -- Public read (bucket is public, but explicit policy for clarity)
  create policy "course-materials bucket: public read"
  on storage.objects for select
  using (bucket_id = 'course-materials');

  -- ── 19. PROFILES: account status (added for Admin Portal) ────────
  do $$
  begin
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'status'
    ) then
      alter table public.profiles
        add column status text not null default 'active'
        check (status in ('active','suspended'));
    end if;
  end $$;

  -- ── 20. PROGRAMS: requirements fields (added for Admin Portal) ───
  do $$
  begin
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'programs' and column_name = 'requirements'
    ) then
      alter table public.programs add column requirements text;
      alter table public.programs add column requirements_fr text;
    end if;
  end $$;

  -- ── 21. ADMIN: full profile management ────────────────────────────
  drop policy if exists "profiles: admin manage" on public.profiles;
  create policy "profiles: admin manage" on public.profiles for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

  -- ── 22. ADMIN: manual enrollments + status updates ─────────────────
  drop policy if exists "enrollments: admin manage" on public.enrollments;
  create policy "enrollments: admin manage" on public.enrollments for all
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

  -- ── 23. ADMIN: courses/programs already covered by is_admin() in
  --       existing policies (courses: lecturer/admin write, programs: admin write)

  -- ── 24. ADMIN: applications update (approve/reject pending enrollments
  --       sourced from applications, plus payments/certificates already
  --       covered by is_admin() in existing policies)