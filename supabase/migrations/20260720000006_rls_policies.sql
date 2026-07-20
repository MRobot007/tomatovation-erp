-- ============================================================================
-- 0006 · Row Level Security
-- ============================================================================
-- RLS is the real authorisation boundary; the React route guards are
-- convenience only. Every table below gets RLS enabled AND explicit policies —
-- enabling RLS without policies denies everything, which fails closed but
-- looks like a broken app.
--
-- Visibility rules, from the spec:
--   employee    -> own rows only (plus leads assigned to them)
--   manager     -> own rows + rows of anyone with manager_id = auth.uid()
--   super_admin -> everything
--
-- All three collapse into public.can_access_employee(uuid) from migration 0002,
-- which is SECURITY DEFINER to avoid the recursive policy lookup that would
-- otherwise raise 42P17.
--
-- Note on `(select auth.uid())`: wrapping it in a subselect lets Postgres treat
-- it as a one-time initplan rather than re-evaluating per row. On a large
-- attendance scan that is the difference between an index lookup and a seq scan.

alter table public.profiles       enable row level security;
alter table public.app_settings   enable row level security;
alter table public.attendance     enable row level security;
alter table public.work_logs      enable row level security;
alter table public.tasks          enable row level security;
alter table public.leaves         enable row level security;
alter table public.leads          enable row level security;
alter table public.lead_activities enable row level security;
alter table public.announcements  enable row level security;
alter table public.notifications  enable row level security;
alter table public.audit_logs     enable row level security;

-- ===========================================================================
-- profiles
-- ===========================================================================
-- Everyone can read the directory. An ERP where you cannot see who your
-- colleagues are is unusable — assignee pickers, org charts and mention
-- autocomplete all need it. Sensitive fields are not on this table.
create policy profiles_select_all
  on public.profiles for select
  to authenticated
  using (true);

-- Self-service editing. The profiles_guard_privileges trigger from 0002 blocks
-- role, manager_id, status and email changes here; without it this policy would
-- be a free path to super_admin.
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (public.is_super_admin());

-- No delete policy: profiles are deactivated via status, never removed.
-- Deleting one would orphan attendance history and audit trails.

-- ===========================================================================
-- app_settings
-- ===========================================================================
create policy app_settings_select_all
  on public.app_settings for select
  to authenticated
  using (true);

create policy app_settings_update_admin
  on public.app_settings for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ===========================================================================
-- attendance
-- ===========================================================================
create policy attendance_select_scoped
  on public.attendance for select
  to authenticated
  using (public.can_access_employee(employee_id));

-- Writes are restricted to the row's owner. Everything that matters
-- (timestamps, hours, late minutes) is set by the punch RPCs and the
-- calculation trigger, so a hand-crafted insert cannot forge a workday.
create policy attendance_insert_self
  on public.attendance for insert
  to authenticated
  with check (employee_id = (select auth.uid()));

create policy attendance_update_self
  on public.attendance for update
  to authenticated
  using (employee_id = (select auth.uid()))
  with check (employee_id = (select auth.uid()));

-- Corrections: someone forgets to punch out and the record needs fixing.
create policy attendance_update_admin
  on public.attendance for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ===========================================================================
-- work_logs
-- ===========================================================================
create policy work_logs_select_scoped
  on public.work_logs for select
  to authenticated
  using (public.can_access_employee(employee_id));

create policy work_logs_insert_self
  on public.work_logs for insert
  to authenticated
  with check (employee_id = (select auth.uid()));

-- Once reviewed, the author can no longer edit: a manager's review must apply
-- to the text they actually read.
create policy work_logs_update_self
  on public.work_logs for update
  to authenticated
  using (employee_id = (select auth.uid()) and reviewed_at is null)
  with check (employee_id = (select auth.uid()));

-- Reviewers can update any log they can see. Which fields they may touch is
-- constrained by the trigger below, not by this policy.
create policy work_logs_update_reviewer
  on public.work_logs for update
  to authenticated
  using (public.is_manager() and public.can_access_employee(employee_id))
  with check (public.is_manager() and public.can_access_employee(employee_id));

create policy work_logs_delete_self
  on public.work_logs for delete
  to authenticated
  using (employee_id = (select auth.uid()) and reviewed_at is null);

-- A reviewer must not silently rewrite the log's content while reviewing it.
-- Policies cannot compare OLD to NEW, so this is a trigger.
create or replace function public.guard_work_log_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.employee_id = (select auth.uid()) or public.is_super_admin() then
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

create trigger work_logs_guard_review
  before update on public.work_logs
  for each row execute function public.guard_work_log_review();

-- ===========================================================================
-- tasks
-- ===========================================================================
create policy tasks_select_scoped
  on public.tasks for select
  to authenticated
  using (
    public.can_access_employee(assigned_to)
    or assigned_by = (select auth.uid())
  );

create policy tasks_insert_manager
  on public.tasks for insert
  to authenticated
  with check (
    -- Managers assign to their reports; anyone may create a task for themselves.
    assigned_by = (select auth.uid())
    and (assigned_to = (select auth.uid()) or public.can_access_employee(assigned_to))
  );

-- The assignee can move a task along its status track.
create policy tasks_update_assignee
  on public.tasks for update
  to authenticated
  using (assigned_to = (select auth.uid()))
  with check (assigned_to = (select auth.uid()));

create policy tasks_update_assigner
  on public.tasks for update
  to authenticated
  using (assigned_by = (select auth.uid()) or public.is_super_admin())
  with check (assigned_by = (select auth.uid()) or public.is_super_admin());

create policy tasks_delete_assigner
  on public.tasks for delete
  to authenticated
  using (assigned_by = (select auth.uid()) or public.is_super_admin());

-- An assignee may progress their task but must not reassign it or rewrite the
-- brief.
create or replace function public.guard_task_assignee_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.assigned_by = (select auth.uid()) or public.is_super_admin() then
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

create trigger tasks_guard_assignee_edit
  before update on public.tasks
  for each row execute function public.guard_task_assignee_edit();

-- ===========================================================================
-- leaves
-- ===========================================================================
create policy leaves_select_scoped
  on public.leaves for select
  to authenticated
  using (public.can_access_employee(employee_id));

create policy leaves_insert_self
  on public.leaves for insert
  to authenticated
  with check (
    employee_id = (select auth.uid())
    -- A request cannot be born approved.
    and status = 'pending'
  );

-- The requester may edit or withdraw only while it is still pending.
create policy leaves_update_self
  on public.leaves for update
  to authenticated
  using (employee_id = (select auth.uid()) and status = 'pending')
  with check (employee_id = (select auth.uid()) and status in ('pending', 'cancelled'));

create policy leaves_update_approver
  on public.leaves for update
  to authenticated
  using (public.is_manager() and public.can_access_employee(employee_id))
  with check (public.is_manager() and public.can_access_employee(employee_id));

create policy leaves_delete_self
  on public.leaves for delete
  to authenticated
  using (employee_id = (select auth.uid()) and status = 'pending');

-- Nobody approves their own leave, including managers and super admins.
-- This is the one rule that must hold regardless of role.
create or replace function public.guard_leave_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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

    -- Stamp the decision here so the client cannot claim someone else made it.
    new.approved_by := (select auth.uid());
    new.approved_at := now();
  end if;

  return new;
end;
$$;

create trigger leaves_guard_decision
  before update on public.leaves
  for each row execute function public.guard_leave_decision();

-- ===========================================================================
-- leads
-- ===========================================================================
-- Marketing is collaborative: everyone sees the pipeline, which matches the
-- spec giving every role a Leads entry. Write access is where it tightens.
create policy leads_select_all
  on public.leads for select
  to authenticated
  using (true);

create policy leads_insert_authenticated
  on public.leads for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy leads_update_assignee
  on public.leads for update
  to authenticated
  using (
    assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
    or public.is_manager()
  )
  with check (
    assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
    or public.is_manager()
  );

create policy leads_delete_admin
  on public.leads for delete
  to authenticated
  using (public.is_super_admin());

-- ===========================================================================
-- lead_activities
-- ===========================================================================
create policy lead_activities_select_all
  on public.lead_activities for select
  to authenticated
  using (true);

create policy lead_activities_insert_authenticated
  on public.lead_activities for insert
  to authenticated
  with check (employee_id = (select auth.uid()));

-- No update or delete: a timeline that can be edited after the fact is not a
-- timeline. Corrections are appended as new entries.

-- ===========================================================================
-- announcements
-- ===========================================================================
create policy announcements_select_published
  on public.announcements for select
  to authenticated
  using (published or created_by = (select auth.uid()) or public.is_super_admin());

create policy announcements_insert_manager
  on public.announcements for insert
  to authenticated
  with check (public.is_manager() and created_by = (select auth.uid()));

create policy announcements_update_author
  on public.announcements for update
  to authenticated
  using (created_by = (select auth.uid()) or public.is_super_admin())
  with check (created_by = (select auth.uid()) or public.is_super_admin());

create policy announcements_delete_author
  on public.announcements for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.is_super_admin());

-- ===========================================================================
-- notifications
-- ===========================================================================
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Marking read is the only update anyone performs. The guard trigger below
-- stops that policy from also allowing title or message rewrites.
create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete_own
  on public.notifications for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Notifications are created by triggers and Edge Functions running as definer,
-- not by clients. Managers may still notify their reports directly.
create policy notifications_insert_manager
  on public.notifications for insert
  to authenticated
  with check (public.is_manager() and public.can_access_employee(user_id));

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
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

create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ===========================================================================
-- audit_logs
-- ===========================================================================
-- The spec: insert-only for everyone, select for super_admin only.
create policy audit_logs_select_admin
  on public.audit_logs for select
  to authenticated
  using (public.is_super_admin());

create policy audit_logs_insert_authenticated
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- Deliberately no update and no delete policy, for any role. An audit trail
-- that a super admin can rewrite does not evidence anything.
