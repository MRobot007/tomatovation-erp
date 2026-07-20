-- ============================================================================
-- 0009 · CRITICAL FIX — acting_outside_postgrest() disabled every guard
-- ============================================================================
-- Migration 0008 introduced:
--
--   select current_user in ('postgres', 'supabase_admin', ...)
--
-- inside a function called from SECURITY DEFINER triggers. Inside a SECURITY
-- DEFINER function current_user is the function OWNER, not the caller. These
-- functions are owned by postgres, so the check returned true for every caller,
-- and every privilege guard became a no-op for ordinary API users.
--
-- Caught by the RLS integration suite, which observed an employee successfully
-- promote themselves to super_admin and rewrite their own reporting line.
--
-- session_user is the correct function: it reports the role the session
-- actually authenticated as and is NOT rewritten by SECURITY DEFINER or by
-- SET ROLE. PostgREST connects as 'authenticator' and then SET ROLE's to
-- 'authenticated' or 'anon', so session_user stays 'authenticator' for every
-- API request. A psql or SQL-Editor session is 'postgres'.
--
-- The allowlist is also tightened: 'service_role' and 'supabase_auth_admin' are
-- removed. Neither ever appears as session_user over the API, so listing them
-- bought nothing and widened the surface for no reason.

create or replace function public.acting_outside_postgrest()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  -- session_user, NOT current_user. See the header: current_user here is the
  -- SECURITY DEFINER owner and would make this true for every caller.
  select session_user in ('postgres', 'supabase_admin');
$$;

comment on function public.acting_outside_postgrest() is
  'True only for a direct database session (psql / SQL Editor). Uses session_user because current_user is rewritten to the owner inside SECURITY DEFINER functions.';

-- ===========================================================================
-- Repair: undo what the unguarded window allowed
-- ===========================================================================
-- While 0008 was live, any authenticated user could set their own role and
-- reporting line. Nothing in the app offers that, and the only sessions in this
-- project so far are the operator account and disposable test accounts — but
-- the correct response to "the guard was open" is to verify, not to assume.

-- Test and diagnostic accounts created by the RLS suite. Removing the auth user
-- cascades to profiles, attendance, work_logs and leaves.
delete from auth.users
where email like 'rls-test-%@example.com'
   or email like 'diag-%@example.com';

-- Any reporting line pointing at a now-deleted profile is already NULL via
-- ON DELETE SET NULL. This clears self-referential damage that the cycle guard
-- would have rejected under normal operation.
update public.profiles
set manager_id = null
where manager_id = id;

-- Surface any remaining super_admin so the operator can confirm the list is
-- exactly who they expect. Raised as a notice, visible in the CLI push output.
do $$
declare
  admins text;
begin
  select string_agg(email::text, ', ' order by email) into admins
  from public.profiles
  where role = 'super_admin';

  raise notice 'super_admin accounts after repair: %', coalesce(admins, '(none)');
end;
$$;
