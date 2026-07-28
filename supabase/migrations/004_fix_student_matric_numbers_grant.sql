-- supabase/migrations/004_fix_student_matric_numbers_grant.sql
--
-- FIX: "permission denied for table student_matric_numbers" (42501) when
-- approving a student application.
--
-- Root cause: something fires on enrollment (most likely a trigger on
-- public.enrollments that auto-assigns a matric number) that reads/writes
-- public.student_matric_numbers. The edge function runs as `service_role`,
-- and that role was never granted privileges on this table, so the
-- enrollment insert/upsert fails with a permission error the moment that
-- trigger runs.
--
-- Run this once in the Supabase SQL editor.

grant select, insert, update on public.student_matric_numbers to service_role;

-- If matric numbers are generated from a sequence (e.g. a serial/identity
-- column or nextval() call inside the trigger), service_role also needs
-- USAGE on it, or the same 42501 error will just move to the sequence.
-- Uncomment and fill in the sequence name if that's the case — find it with:
--   select pg_get_serial_sequence('public.student_matric_numbers', 'id');
-- (swap 'id' for whichever column is auto-generated)

-- grant usage, select on sequence public.student_matric_numbers_id_seq to service_role;
