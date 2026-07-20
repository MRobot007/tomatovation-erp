-- ============================================================================
-- 0020 · Task status notifications failed for real users
-- ============================================================================
-- The trigger from 0019 worked when run as postgres and failed for every
-- ordinary user with:
--
--   DELETE requires a WHERE clause
--
-- Supabase enables pg_safeupdate for the `authenticated` role, which rejects
-- any DELETE or UPDATE without a WHERE. The trigger cleared its scratch table
-- with a bare `delete from _task_notify_targets;`. That is session-scoped, so
-- it applies inside SECURITY DEFINER triggers too — and it does not apply to
-- postgres, which is precisely why testing the trigger with direct SQL showed
-- it passing while the app was broken.
--
-- The failure surfaced as the whole UPDATE being rejected, so marking a task
-- done did nothing at all: no status change, no notification.
--
-- Rewritten without the scratch table. Recipients are gathered in one CTE and
-- inserted in a single statement, which is both simpler and has nothing for
-- safeupdate to object to.

create or replace function public.notify_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor        uuid := (select auth.uid());
  assignee     text;
  line_manager uuid;
  headline     text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Only transitions that need someone else to act or to know. Routine
  -- progress (todo -> in_progress) stays quiet: notifying on it would train
  -- everyone to ignore the bell.
  if new.status not in ('done', 'blocked', 'cancelled') then
    return new;
  end if;

  select name, manager_id into assignee, line_manager
  from public.profiles
  where id = new.assigned_to;

  headline := case new.status
    when 'done'      then format('%s completed a task', coalesce(assignee, 'Someone'))
    when 'blocked'   then format('%s is blocked on a task', coalesce(assignee, 'Someone'))
    when 'cancelled' then format('%s cancelled a task', coalesce(assignee, 'Someone'))
  end;

  insert into public.notifications (user_id, title, message, type, link)
  select
    recipients.id,
    headline,
    new.title,
    'task_status_changed',
    '/tasks?highlight=' || new.id
  from (
    -- Whoever assigned the work.
    select new.assigned_by as id where new.assigned_by is not null
    union
    -- The assignee's own manager, if that is someone else.
    select line_manager where line_manager is not null
    union
    -- Everyone with company-wide responsibility.
    select p.id from public.profiles p where p.role = 'super_admin' and p.status = 'active'
  ) as recipients
  -- UNION already removed duplicates, so nobody who is both the assigner and a
  -- super admin is told twice. These exclude the two people who already know.
  where recipients.id is distinct from actor
    and recipients.id is distinct from new.assigned_to;

  return new;
end;
$$;
