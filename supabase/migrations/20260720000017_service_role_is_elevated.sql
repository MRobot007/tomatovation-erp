-- ============================================================================
-- 0017 · service_role counts as elevated in the privilege guards
-- ============================================================================
-- Creating an employee WITH a reporting line failed:
--
--   Could not set up the profile: Only a super admin may change a reporting line
--
-- The create-employee Edge Function authorises the caller as a super admin,
-- then writes the profile with the service_role key. But guard_profile_privileges
-- could not see that as privileged:
--
--   * acting_outside_postgrest() is session_user based, and PostgREST connects
--     as 'authenticator' whichever key is used — so false.
--   * is_super_admin() reads auth.uid() from the JWT, and a service_role key
--     carries no user — so false.
--
-- Creating an employee with no manager worked, because manager_id never
-- changed and the guard was never reached. That is why this survived testing.
--
-- Allowing service_role costs nothing: that key already bypasses RLS entirely,
-- so a guard blocking it protected nothing while breaking a legitimate path.
-- The real check is in the Edge Function, which verifies the caller is a super
-- admin against the database before it ever touches the service key.
--
-- The role is read from the JWT claims GUC rather than current_user, because
-- current_user inside a SECURITY DEFINER function is the function owner — the
-- exact trap that made migration 0008 disable every guard.

create or replace function public.acting_as_service_role()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims text;
begin
  claims := current_setting('request.jwt.claims', true);
  if claims is null or claims = '' then
    return false;
  end if;

  return (claims::jsonb ->> 'role') = 'service_role';
exception
  -- Claims that are not valid JSON must not take down the write.
  when others then
    return false;
end;
$$;

comment on function public.acting_as_service_role() is
  'True when the request presents the service_role key. Reads the JWT claims GUC, not current_user, which is rewritten to the owner inside SECURITY DEFINER functions.';

/** Any context that legitimately outranks the per-user guards. */
create or replace function public.acting_elevated()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.acting_outside_postgrest() or public.acting_as_service_role();
$$;

-- ---------------------------------------------------------------------------
-- Guards updated to recognise it
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.acting_elevated() or public.is_super_admin() then
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

-- The remaining guards get the same treatment so a future backend path does
-- not hit the identical wall one table at a time.
create or replace function public.guard_work_log_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.acting_elevated()
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

create or replace function public.guard_task_assignee_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.acting_elevated()
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

create or replace function public.guard_attendance_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('app.attendance_rpc', true), '') = 'on'
     or public.acting_elevated()
     or public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Attendance is recorded by punching in, not by direct insert'
      using errcode = 'insufficient_privilege';
  end if;

  if new.punch_in is distinct from old.punch_in
     or new.punch_out is distinct from old.punch_out
     or new.break_minutes is distinct from old.break_minutes
     or new.break_started_at is distinct from old.break_started_at
     or new.date is distinct from old.date
     or new.employee_id is distinct from old.employee_id then
    raise exception 'Attendance times can only be changed by punching in or out'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- guard_leave_decision is deliberately NOT relaxed for service_role. Nobody
-- approving their own leave is the one rule that holds for every actor, and no
-- backend path needs to break it.
