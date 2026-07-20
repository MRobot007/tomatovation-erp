-- ============================================================================
-- 0019 · Task status changes notify the people accountable for the work
-- ============================================================================
-- Assignment already notified the assignee. Nothing fired in the other
-- direction, so when someone finished a task — or got blocked on one — the
-- person who assigned it found out only by going and looking.
--
-- Blocked matters as much as done. A blocked task is the one case where the
-- assignee cannot proceed alone and someone else has to act.
--
-- Recipients, deduplicated:
--   * whoever assigned the task
--   * the assignee's manager, if different
--   * every super admin
--
-- Deliberately NOT every status change. Moving todo -> in_progress is the
-- assignee getting on with their work; notifying on it would train everyone to
-- ignore the bell, which costs more than the information is worth.

create or replace function public.notify_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor        uuid := (select auth.uid());
  assignee     text;
  headline     text;
  recipient    uuid;
  line_manager uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Only the transitions that need someone else to know.
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

  -- A temp table rather than repeated inserts: it makes the dedupe explicit,
  -- so nobody who is both the assigner and a super admin gets it twice.
  create temp table if not exists _task_notify_targets (id uuid primary key) on commit drop;
  delete from _task_notify_targets;

  if new.assigned_by is not null then
    insert into _task_notify_targets (id) values (new.assigned_by) on conflict do nothing;
  end if;

  if line_manager is not null then
    insert into _task_notify_targets (id) values (line_manager) on conflict do nothing;
  end if;

  insert into _task_notify_targets (id)
  select id from public.profiles where role = 'super_admin' and status = 'active'
  on conflict do nothing;

  -- Never notify the person who made the change. If a manager marks their own
  -- assigned task done, they do not need telling.
  delete from _task_notify_targets where id = actor or id = new.assigned_to;

  for recipient in select id from _task_notify_targets loop
    insert into public.notifications (user_id, title, message, type, link)
    values (
      recipient,
      headline,
      new.title,
      'task_status_changed',
      '/tasks?highlight=' || new.id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists tasks_notify_status_change on public.tasks;
create trigger tasks_notify_status_change
  after update of status on public.tasks
  for each row execute function public.notify_task_status_change();

-- ---------------------------------------------------------------------------
-- Supporting query for the dashboard
-- ---------------------------------------------------------------------------
-- What the people above should be looking at. RLS scopes it: a manager sees
-- their reports, a super admin sees everyone.
create or replace function public.tasks_needing_attention(p_limit int default 20)
returns table (
  id            uuid,
  title         text,
  status        public.task_status,
  priority      public.task_priority,
  deadline      timestamptz,
  completed_at  timestamptz,
  assignee_id   uuid,
  assignee_name text,
  updated_at    timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    t.id, t.title, t.status, t.priority, t.deadline, t.completed_at,
    p.id, p.name, t.updated_at
  from public.tasks t
  join public.profiles p on p.id = t.assigned_to
  where t.assigned_by is distinct from t.assigned_to
    and (
      t.status = 'blocked'
      -- Recently completed: still worth a glance, but not forever.
      or (t.status = 'done' and t.completed_at > now() - interval '7 days')
    )
  order by
    -- Blocked first: it is the state that needs someone to act.
    case when t.status = 'blocked' then 0 else 1 end,
    t.updated_at desc
  limit p_limit;
$$;
