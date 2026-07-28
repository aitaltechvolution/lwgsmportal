-- supabase/migrations/005_fix_matric_grants_for_authenticated.sql
--
-- FIX: "permission denied for table student_matric_numbers" (42501) when
-- an admin issues a certificate from the browser.
--
-- Root cause: same underlying issue as migrations 004 (student_matric_numbers)
-- and the matric_counters grant — but this time the insert into
-- certificates happens directly from the client as the `authenticated`
-- role (Certificates.tsx calls supabase.from("certificates").insert(...)
-- directly, not through an edge function), which fires the
-- `handle_certificate_matric` trigger -> assign_matric_number() ->
-- reads/writes student_matric_numbers and matric_counters. `service_role`
-- was granted access earlier, but `authenticated` never was.
--
-- Run this once in the Supabase SQL editor.

grant select, insert, update on public.student_matric_numbers to authenticated;
grant select, insert, update on public.matric_counters to authenticated;
