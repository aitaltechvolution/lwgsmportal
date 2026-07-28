-- supabase/migrations/007_reseed_matric_counters.sql
--
-- FIX: "duplicate key value violates unique constraint
-- student_matric_numbers_matric_number_key" — Key (matric_number)=
-- (LWGSM-NG-CC-2026-0001) already exists, on every single approval.
--
-- Root cause: rows were manually deleted from `matric_counters`, but the
-- already-issued matric numbers in `student_matric_numbers` (and
-- `profiles.matric_number`, used by the certificate-fee flow — see
-- assign_matric_number(uuid, uuid, text)) were NOT deleted. Both draw
-- their numbers from the same `matric_counters` table, keyed by
-- (level, year, country_code).
--
-- So the counter restarted from scratch and generated "0001" again for
-- the first new approval — which collided with the real "0001" already
-- sitting in student_matric_numbers from before the deletion. Because
-- that collision happens inside the same transaction as the counter's
-- own increment, the failed transaction rolled the increment back too,
-- leaving matric_counters empty again — so *every subsequent* approval
-- repeats the exact same "0001" collision. This is why it now blocks
-- every user, not just one.
--
-- This migration reseeds `matric_counters` with the highest sequence
-- number already in use for each (level, year, country_code) group, so
-- the very next call correctly resumes from there instead of restarting.
--
-- Run this once in the Supabase SQL editor.

insert into public.matric_counters (level, year, country_code, next_seq)
select level, year, country_code, max(seq) as next_seq
from (
  select
    split_part(matric_number, '-', 3)      as level,
    split_part(matric_number, '-', 4)      as year,
    split_part(matric_number, '-', 2)      as country_code,
    split_part(matric_number, '-', 5)::int as seq
  from public.student_matric_numbers
  where matric_number ~ '^LWGSM-[A-Z]{2}-[A-Z]+-[0-9]{4}-[0-9]+$'

  union all

  select
    split_part(matric_number, '-', 3)      as level,
    split_part(matric_number, '-', 4)      as year,
    split_part(matric_number, '-', 2)      as country_code,
    split_part(matric_number, '-', 5)::int as seq
  from public.profiles
  where matric_number is not null
    and matric_number ~ '^LWGSM-[A-Z]{2}-[A-Z]+-[0-9]{4}-[0-9]+$'
) all_issued_numbers
group by level, year, country_code
on conflict (level, year, country_code)
do update set next_seq = greatest(public.matric_counters.next_seq, excluded.next_seq);
