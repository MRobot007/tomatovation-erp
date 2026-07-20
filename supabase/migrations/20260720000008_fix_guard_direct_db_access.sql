-- ============================================================================
-- 0008 · Let direct database access through the privilege guards
-- ============================================================================
-- Bug from 0002/0006: the guards gate on public.is_super_admin(), which reads
-- auth.uid(). Over PostgREST that is the caller's JWT subject, which is what we
-- want. But in the SQL Editor, a migration, or a psql session there is no JWT,
-- so auth.uid() is NULL, is_super_admin() returns false, and the guard rejects
-- the write.
--
-- The practical effect was that creating the very first super_admin was
-- impossible: the app cannot do it (handle_new_user hardcodes 'employee', on
-- purpose) and the database rejected it too. Routine DBA data repair was
-- blocked for the same reason.
--
-- Fix: treat the connecting database role as the signal. Over PostgREST the
-- role is 'anon' or 'authenticated' and the guards apply in full. A direct
-- connection arrives as 'postgres' / 'supabase_admin', which already owns every
-- table — a guard cannot meaningfully constrain someone who can simply drop it.
-- Enforcing there bought no security and only blocked legitimate operations.
--
-- 'anon' is deliberately NOT in the allow list. It reaches this trigger with a
-- NULL auth.uid() too, and is exactly who the guard exists to stop.

create or replace function public.acting_outside_postgrest()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  -- service_role is included: it is the backend key, which already bypasses RLS
  -- entirely. Withholding it here would be theatre.
  select current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role');
$$;

comment on function public.acting_outside_postgrest() is
  'True when the session is a direct database connection rather than an API request. Used by the privilege guards to exempt operators who already own the schema.';

-- ---------------------------------------------------------------------------
-- profiles: role / manager / status / email changes
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.acting_outside_postgrest() or public.is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only a super admin may change a role'
      using errcode = 'insufficient_privilege';
  end if;

  if new.manager_id is distinct from old.manager_id then
    raise exception 'Only a super admin may change a reporting line'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Only a super admin may change employment status'
      using errcode = 'insufficient_privilege';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Email is managed by authentication and cannot be edited here'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- work_logs: reviewer must not rewrite the content being reviewed
-- ---------------------------------------------------------------------------
create or replace function public.guard_work_log_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.acting_outside_postgrest()
     or new.employee_id = (select auth.uid())
     or public.is_super_admin() then
    return new;
  end if;

  if new.project is distinct from old.project
     or new.task is distinct from old.task
     or new.description is distinct from old.description
     or new.hours is distinct from old.hours
     or new.achievement is distinct from old.achievement
     or new.tomorrow_plan is distinct from old.tomorrow_plan
     or new.log_date is distinct from old.log_date then
    raise exception 'A reviewer may set review fields only, not the log content'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tasks: assignee may progress status, not rewrite the brief
-- ---------------------------------------------------------------------------
create or replace function public.guard_task_assignee_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.acting_outside_postgrest()
     or old.assigned_by = (select auth.uid())
     or public.is_super_admin() then
    return new;
  end if;

  if new.assigned_to is distinct from old.assigned_to
     or new.assigned_by is distinct from old.assigned_by
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.deadline is distinct from old.deadline
     or new.priority is distinct from old.priority then
    raise exception 'An assignee may change task status only'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- leaves: nobody decides their own request
-- ---------------------------------------------------------------------------
-- The self-approval rule is NOT relaxed for direct access. An operator can
-- still correct a stuck record, but auth.uid() is NULL on a direct connection,
-- so the self-approval branch cannot be reached there anyway. The stamping
-- below is skipped for direct access so a repair does not overwrite approved_by
-- with NULL.
create or replace function public.guard_leave_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.acting_outside_postgrest() then
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then

    if new.employee_id = (select auth.uid()) then
      raise exception 'You cannot decide your own leave request'
        using errcode = 'insufficient_privilege';
    end if;

    if not public.is_manager() then
      raise exception 'Only a manager or super admin may decide a leave request'
        using errcode = 'insufficient_privilege';
    end if;

    new.approved_by := (select auth.uid());
    new.approved_at := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- notifications: only the read flag is user-editable
-- ---------------------------------------------------------------------------
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.acting_outside_postgrest() then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.message is distinct from old.message
     or new.type is distinct from old.type
     or new.link is distinct from old.link
     or new.user_id is distinct from old.user_id then
    raise exception 'Only the read flag may be changed on a notification'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- First-admin bootstrap
-- ===========================================================================
-- Promotes a user to super_admin, but only while no super_admin exists. That
-- makes it self-disarming: usable exactly once, to solve the chicken-and-egg
-- problem, and inert forever after. Callable from the SQL Editor.
create or replace function public.bootstrap_first_super_admin(p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.profiles;
begin
  if exists (select 1 from public.profiles where role = 'super_admin') then
    raise exception 'A super admin already exists. Promote further admins from the app.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set role = 'super_admin'
  where email = lower(btrim(p_email))
  returning * into result;

  if result.id is null then
    raise exception 'No profile found for %. Sign up in the app first.', p_email
      using errcode = 'no_data_found';
  end if;

  return result;
end;
$$;

-- Not granted to anon or authenticated: this is an operator tool, run from the
-- SQL Editor. Exposing it over the API would let any signed-in user claim
-- super_admin on a fresh deployment.
revoke all on function public.bootstrap_first_super_admin(text) from public, anon, authenticated;
