-- LWGSM Database Schema
-- Run this in the Supabase SQL editor.

-- ENUMS
create type user_role as enum ('student', 'lecturer', 'admin');
create type program_type as enum ('certificate', 'diploma', 'advanced_diploma');
create type material_type as enum ('note', 'video', 'file');
create type enrollment_status as enum ('pending', 'active', 'completed');
create type attendance_status as enum ('present', 'absent', 'late');
create type payment_type as enum ('registration', 'tuition', 'certificate', 'material');
create type payment_status as enum ('pending', 'success', 'failed');

-- 1. PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  full_name text not null,
  email text not null unique,
  phone text,
  country text,
  language_pref text not null default 'en' check (language_pref in ('en','fr')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. PROGRAMS
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_fr text not null,
  type program_type not null,
  duration text,
  description_en text,
  description_fr text,
  requirements_en text,
  requirements_fr text,
  created_at timestamptz not null default now()
);

-- 3. COURSES
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete cascade,
  title_en text not null,
  title_fr text not null,
  description_en text,
  description_fr text,
  lecturer_id uuid references public.profiles(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4. ENROLLMENTS
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status enrollment_status not null default 'pending',
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

-- 5. COURSE MATERIALS
create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title_en text not null,
  title_fr text not null,
  type material_type not null,
  url text not null,
  is_premium boolean not null default false,
  price numeric(10,2) default 0,
  created_at timestamptz not null default now()
);

-- 6. ASSIGNMENTS
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title_en text not null,
  title_fr text not null,
  description_en text,
  description_fr text,
  due_date timestamptz,
  max_score numeric(5,2) default 100,
  created_at timestamptz not null default now()
);

-- 7. SUBMISSIONS
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_url text,
  text_content text,
  submitted_at timestamptz not null default now(),
  score numeric(5,2),
  feedback text
);

-- 8. ATTENDANCE
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  status attendance_status not null
);

-- 9. GRADES
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(5,2) not null,
  grade_letter text,
  published_at timestamptz not null default now()
);

-- 10. PAYMENTS
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  type payment_type not null,
  amount numeric(10,2) not null,
  status payment_status not null default 'pending',
  reference text,
  paid_at timestamptz
);

-- 11. CERTIFICATES
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  cert_number text not null unique,
  issued_at timestamptz not null default now(),
  is_verified boolean not null default true,
  qr_code_url text
);

-- 12. ANNOUNCEMENTS
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  title_en text not null,
  title_fr text not null,
  body_en text,
  body_fr text,
  target_role user_role,
  created_at timestamptz not null default now()
);

-- 13. MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HELPERS
-- ============================================================
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin');
$$;

create or replace function public.is_lecturer(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = uid and role = 'lecturer');
$$;

create or replace function public.teaches_course(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.courses where id = cid and lecturer_id = uid);
$$;

-- ============================================================
-- ENABLE RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.course_materials enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.attendance enable row level security;
alter table public.grades enable row level security;
alter table public.payments enable row level security;
alter table public.certificates enable row level security;
alter table public.announcements enable row level security;
alter table public.messages enable row level security;

-- ============================================================
-- POLICIES
-- ============================================================

-- profiles
create policy "profiles self read" on public.profiles for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles self update" on public.profiles for update using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles admin delete" on public.profiles for delete using (public.is_admin(auth.uid()));

-- programs (public read, admin write)
create policy "programs read all" on public.programs for select using (true);
create policy "programs admin write" on public.programs for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- courses
create policy "courses read published" on public.courses for select
  using (is_published or lecturer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "courses lecturer/admin write" on public.courses for all
  using (lecturer_id = auth.uid() or public.is_admin(auth.uid()))
  with check (lecturer_id = auth.uid() or public.is_admin(auth.uid()));

-- enrollments
create policy "enrollments student read own" on public.enrollments for select
  using (student_id = auth.uid() or public.is_admin(auth.uid())
         or exists (select 1 from public.courses c where c.id = course_id and c.lecturer_id = auth.uid()));
create policy "enrollments student insert" on public.enrollments for insert
  with check (student_id = auth.uid());
create policy "enrollments admin update" on public.enrollments for update
  using (public.is_admin(auth.uid()));

-- course_materials
create policy "materials enrolled read" on public.course_materials for select
  using (
    public.is_admin(auth.uid())
    or public.teaches_course(auth.uid(), course_id)
    or exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
  );
create policy "materials lecturer write" on public.course_materials for all
  using (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()))
  with check (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()));

-- assignments
create policy "assignments course read" on public.assignments for select
  using (
    public.is_admin(auth.uid())
    or public.teaches_course(auth.uid(), course_id)
    or exists (select 1 from public.enrollments e where e.course_id = course_id and e.student_id = auth.uid())
  );
create policy "assignments lecturer write" on public.assignments for all
  using (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()))
  with check (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()));

-- submissions
create policy "submissions student read own" on public.submissions for select
  using (
    student_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id
               where a.id = assignment_id and c.lecturer_id = auth.uid())
  );
create policy "submissions student insert" on public.submissions for insert
  with check (student_id = auth.uid());
create policy "submissions lecturer grade" on public.submissions for update
  using (
    public.is_admin(auth.uid())
    or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id
               where a.id = assignment_id and c.lecturer_id = auth.uid())
  );

-- attendance
create policy "attendance read own" on public.attendance for select
  using (student_id = auth.uid() or public.is_admin(auth.uid()) or public.teaches_course(auth.uid(), course_id));
create policy "attendance lecturer write" on public.attendance for all
  using (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()))
  with check (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()));

-- grades
create policy "grades read own" on public.grades for select
  using (student_id = auth.uid() or public.is_admin(auth.uid()) or public.teaches_course(auth.uid(), course_id));
create policy "grades lecturer write" on public.grades for all
  using (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()))
  with check (public.teaches_course(auth.uid(), course_id) or public.is_admin(auth.uid()));

-- payments
create policy "payments student read own" on public.payments for select
  using (student_id = auth.uid() or public.is_admin(auth.uid()));
create policy "payments student insert" on public.payments for insert
  with check (student_id = auth.uid());
create policy "payments admin update" on public.payments for update using (public.is_admin(auth.uid()));

-- certificates
create policy "certificates read own" on public.certificates for select
  using (student_id = auth.uid() or public.is_admin(auth.uid()));
create policy "certificates admin write" on public.certificates for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- announcements
create policy "announcements read by role" on public.announcements for select
  using (
    target_role is null
    or public.is_admin(auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = target_role)
  );
create policy "announcements admin/lecturer write" on public.announcements for all
  using (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()))
  with check (public.is_admin(auth.uid()) or public.is_lecturer(auth.uid()));

-- messages
create policy "messages participants read" on public.messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin(auth.uid()));
create policy "messages sender insert" on public.messages for insert
  with check (sender_id = auth.uid());
create policy "messages recipient update read" on public.messages for update
  using (receiver_id = auth.uid());
