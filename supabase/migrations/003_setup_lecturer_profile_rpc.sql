-- supabase/migrations/003_setup_lecturer_profile_rpc.sql
--
-- Supports the fix for: "Edge function returned a non-2xx status code" on
-- lecturer creation, where the lecturer account (and course assignments)
-- actually existed in the DB but the admin had to manually refresh the page
-- to see it.
--
-- create-lecturer/index.ts previously did the profile upsert and the course
-- assignment as two separate sequential network round trips after already
-- creating the auth user and verifying the caller — five round trips total
-- in one Edge Function invocation. Under a cold start or brief latency
-- spike that's enough to trip the function's response time and return a
-- 5xx/546 even though the DB writes already committed underneath it.
--
-- This RPC folds the profile upsert + course assignment into a single
-- database round trip AND a single transaction, so they either both
-- succeed together or both roll back together — no more partial state,
-- and one fewer network hop for the Edge Function to wait on.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

create or replace function public.setup_lecturer_profile(
  p_id uuid,
  p_full_name text,
  p_title text,
  p_email text,
  p_phone text,
  p_country text,
  p_course_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- handle_new_user's trigger already inserted a bare "student" row for
  -- this id when the auth user was created; upgrade it to the real
  -- lecturer profile here.
  insert into public.profiles (id, full_name, title, email, role, phone, country)
  values (p_id, p_full_name, p_title, p_email, 'lecturer', p_phone, p_country)
  on conflict (id) do update set
    full_name = excluded.full_name,
    title     = excluded.title,
    email     = excluded.email,
    role      = 'lecturer',
    phone     = excluded.phone,
    country   = excluded.country;

  if p_course_ids is not null and array_length(p_course_ids, 1) > 0 then
    update public.courses
    set lecturer_id = p_id
    where id = any(p_course_ids);
  end if;
end;
$$;

-- Only the service role (used exclusively by the create-lecturer Edge
-- Function) may call this — it's a privileged, admin-only operation.
revoke all on function public.setup_lecturer_profile(uuid, text, text, text, text, text, uuid[]) from public;
grant execute on function public.setup_lecturer_profile(uuid, text, text, text, text, text, uuid[]) to service_role;
