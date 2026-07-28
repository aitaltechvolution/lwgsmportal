-- supabase/migrations/008_email_already_registered_rpc.sql
--
-- Supports blocking application submissions from existing accounts before
-- they ever reach approval — see Admissions.tsx.
--
-- Root cause of the original issue: an unauthenticated visitor could
-- submit an application using an email that already belongs to an
-- existing student account. That only ever surfaced much later, at
-- approval time, when process-application-decision tried to create a new
-- auth user for that email and Supabase Auth rejected it with "A user
-- with this email address has already been registered" — by which point
-- the admin has already clicked Approve and gets a confusing failure.
--
-- The public admissions form runs as the `anon` role and can't query
-- `profiles` directly (RLS only allows reading your own row or being an
-- admin — see "profiles: read own"), so this is a narrow, security-definer
-- RPC that answers ONLY "does this email already exist?" as a plain
-- boolean, without exposing any other profile data.
--
-- Run this once in the Supabase SQL editor.

create or replace function public.email_already_registered(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_already_registered(text) from public;
grant execute on function public.email_already_registered(text) to anon, authenticated;
