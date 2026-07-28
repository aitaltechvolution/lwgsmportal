-- supabase/migrations/010_program_delivery_and_pricing.sql
--
-- Schema foundation for:
--   #1  External registration gate (e.g. Google Form) per programme type
--   #2  Certificate fee that varies by programme type, in NGN
--   #8  Programme delivery mode: online / onsite / self_paced
--   #9  Surfacing a student's delivery mode ("type") on the eligibility view
--  #10  Sorting/filtering students by delivery mode
--  #11  Online programmes wait for a certificate deadline; self-paced does not
--  #12  Separate self-paced pricing for Diploma/Certificate (Pastoral excluded —
--       Pastoral cannot be self-paced at all, enforced by the CHECK constraint
--       combined with the trigger below)
--
-- Everything here is additive and idempotent — safe to run once, and safe
-- to re-run if something fails partway through.

-- ── 1. Programme delivery mode (#8) ──────────────────────────────────────
alter table public.programs add column if not exists delivery_mode text not null default 'online';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'programs_delivery_mode_check'
  ) then
    alter table public.programs
      add constraint programs_delivery_mode_check check (delivery_mode in ('online', 'onsite', 'self_paced'));
  end if;
end $$;

-- Pastoral programmes can never be self-paced (confirmed decision).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'programs_pastoral_not_self_paced_check'
  ) then
    alter table public.programs
      add constraint programs_pastoral_not_self_paced_check
      check (not (type = 'pastoral' and delivery_mode = 'self_paced'));
  end if;
end $$;

-- ── 2. Online-only certificate deadline (#11) ────────────────────────────
-- Only meaningful when delivery_mode = 'online' — a student who finishes
-- early still waits until this date to actually receive the certificate.
-- Self-paced and onsite ignore this entirely.
alter table public.programs add column if not exists certificate_deadline date;

-- ── 3. Courses: self-paced programmes never require attendance (#8) ─────
-- requires_attendance_for_certificate already exists on public.courses
-- (see gradebook_certificate_overhaul.sql). This trigger forces it to
-- false whenever the course's programme is self-paced, regardless of what
-- the admin UI sends — the UI should also disable/greÿ the toggle itself,
-- but this is the actual guarantee.
create or replace function public.enforce_no_attendance_for_self_paced()
returns trigger
language plpgsql
as $$
declare
  v_delivery_mode text;
begin
  if NEW.program_id is not null then
    select delivery_mode into v_delivery_mode from public.programs where id = NEW.program_id;
    if v_delivery_mode = 'self_paced' then
      NEW.requires_attendance_for_certificate := false;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists courses_enforce_no_attendance_self_paced on public.courses;
create trigger courses_enforce_no_attendance_self_paced
  before insert or update on public.courses
  for each row
  execute function public.enforce_no_attendance_for_self_paced();

-- One-off backfill: apply the same rule to any existing self-paced programme's courses.
update public.courses c
set requires_attendance_for_certificate = false
from public.programs p
where c.program_id = p.id
  and p.delivery_mode = 'self_paced'
  and c.requires_attendance_for_certificate = true;

-- ── 4. External registration gate, per programme TYPE (#1) ──────────────
-- Admin configures, once per type (certificate / diploma / pastoral),
-- whether an external registration (e.g. a Google Form) is required and
-- what its link is. Stored in site_settings using the same key/value
-- pattern already used for fee_reg_certificate etc.
insert into public.site_settings (key, value) values
  ('external_reg_required_certificate', 'false'),
  ('external_reg_url_certificate', ''),
  ('external_reg_required_diploma', 'false'),
  ('external_reg_url_diploma', ''),
  ('external_reg_required_pastoral', 'false'),
  ('external_reg_url_pastoral', '')
on conflict (key) do nothing;

-- Whether THIS student has been manually confirmed by an admin as having
-- completed the external registration. A single blanket flag per student
-- (not per programme) — reviewed on the Applications page before/at
-- approval, and editable afterwards from the Students page.
alter table public.profiles add column if not exists external_registration_confirmed boolean not null default false;

-- ── 5. Certificate + registration fees, per programme TYPE, in NGN (#2, #12) ──
-- fee_reg_certificate / fee_reg_diploma / fee_reg_pastoral already exist
-- (registration fees). This adds the equivalent for certificates, plus
-- self-paced variants for both — Diploma and Certificate only, since
-- Pastoral can never be self-paced.
insert into public.site_settings (key, value) values
  ('fee_cert_certificate', '0'),
  ('fee_cert_diploma', '0'),
  ('fee_cert_pastoral', '0'),
  ('fee_cert_certificate_selfpaced', '0'),
  ('fee_cert_diploma_selfpaced', '0'),
  ('fee_reg_certificate_selfpaced', '0'),
  ('fee_reg_diploma_selfpaced', '0')
on conflict (key) do nothing;

-- ── 6. Payments: link a payment to a programme, not just a course (#6/#7) ──
-- Needed so registration/certificate fees can be charged and checked once
-- per programme rather than once per course. Additive — existing
-- course_id-based payments are untouched.
alter table public.payments add column if not exists program_id uuid references public.programs(id) on delete set null;

-- ── 7. Admission letter message (#4 groundwork) ──────────────────────────
-- Admin-editable main message; everything else on the letter (logo,
-- student name, matric number, date, programme) is fixed and generated,
-- not stored here.
insert into public.site_settings (key, value) values
  ('admission_letter_message', 'Congratulations on your admission to Living Waters Global School of Ministry. We are delighted to welcome you into this programme and look forward to walking this journey of learning and formation with you.')
on conflict (key) do nothing;
