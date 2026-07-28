-- supabase/migrations/011_external_registration_on_applications.sql
--
-- Supports #1: the external registration gate (e.g. a Google Form),
-- required per programme type (Diploma/Certificate/Pastoral), admin-set.
--
-- migration 010 already added profiles.external_registration_confirmed —
-- the flag that actually gates a student's course access. But a brand
-- new applicant has no profiles row yet until their application is
-- approved, so admin needs somewhere to record "yes, I confirmed they
-- filled the form" at REVIEW time, before that profile exists. This adds
-- the same flag to applications; process-application-decision copies it
-- onto the profile at approval time.
--
-- Run this once in the Supabase SQL editor.

alter table public.applications add column if not exists external_registration_confirmed boolean not null default false;
