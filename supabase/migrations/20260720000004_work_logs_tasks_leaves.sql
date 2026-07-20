-- ============================================================================
-- 0004 · work_logs, tasks, leaves
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Daily work log
-- ---------------------------------------------------------------------------
create table public.work_logs (
  id             uuid primary key default extensions.gen_random_uuid(),
  employee_id    uuid not null references public.profiles (id) on delete cascade,
  log_date       date not null default (now() at time zone 'Asia/Kolkata')::date,

  project        text not null check (length(btrim(project)) between 1 and 120),
  task           text not null check (length(btrim(task)) between 1 and 200),
  description    text check (description is null or length(description) <= 4000),
  hours          numeric(4, 2) not null check (hours > 0 and hours <= 24),

  status         public.work_log_status not null default 'draft',
  attachment     text,

  achievement    text check (achievement is null or length(achievement) <= 2000),
  tomorrow_plan  text check (tomorrow_plan is null or length(tomorrow_plan) <= 2000),

  -- Manager review
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  review_comment text check (review_comment is null or length(review_comment) <= 2000),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A review must carry both its author and its timestamp, or neither.
  constraint work_logs_review_complete check (
    (reviewed_by is null and reviewed_at is null)
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index work_logs_employee_id_idx on public.work_logs (employee_id);
create index work_logs_employee_date_idx on public.work_logs (employee_id, log_date desc);
create index work_logs_log_date_idx on public.work_logs (log_date desc);
create index work_logs_status_idx on public.work_logs (status);
create index work_logs_reviewed_by_idx on public.work_logs (reviewed_by);

create trigger work_logs_touch_updated_at
  before update on public.work_logs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default extensions.gen_random_uuid(),
  title        text not null check (length(btrim(title)) between 1 and 200),
  description  text check (description is null or length(description) <= 4000),

  assigned_to  uuid not null references public.profiles (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,

  priority     public.task_priority not null default 'medium',
  status       public.task_status not null default 'todo',
  deadline     timestamptz,
  completed_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tasks_completed_consistency check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  )
);

create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_assigned_by_idx on public.tasks (assigned_by);
create index tasks_status_idx on public.tasks (status);
create index tasks_deadline_idx on public.tasks (deadline)
  where status not in ('done', 'cancelled');
create index tasks_assigned_status_idx on public.tasks (assigned_to, status);

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Keeps completed_at in step with status so the check constraint above can
-- never be violated by a caller that updates only one of the two.
create or replace function public.sync_task_completion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_completion
  before insert or update of status on public.tasks
  for each row execute function public.sync_task_completion();

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------
create table public.leaves (
  id           uuid primary key default extensions.gen_random_uuid(),
  employee_id  uuid not null references public.profiles (id) on delete cascade,

  leave_type   public.leave_type not null,
  reason       text not null check (length(btrim(reason)) between 3 and 2000),
  start_date   date not null,
  end_date     date not null,

  status       public.leave_status not null default 'pending',
  approved_by  uuid references public.profiles (id) on delete set null,
  approved_at  timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 2000),

  attachment   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint leaves_date_order check (end_date >= start_date),
  constraint leaves_decision_complete check (
    (status in ('pending', 'cancelled') and approved_by is null and approved_at is null)
    or (status in ('approved', 'rejected') and approved_by is not null and approved_at is not null)
  )
);

create index leaves_employee_id_idx on public.leaves (employee_id);
create index leaves_status_idx on public.leaves (status);
create index leaves_approved_by_idx on public.leaves (approved_by);
create index leaves_range_idx on public.leaves (employee_id, start_date, end_date);

create trigger leaves_touch_updated_at
  before update on public.leaves
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Overlap validation
-- ===========================================================================
-- A daterange EXCLUDE constraint would be the tidier tool, but it cannot be
-- made conditional on status — a rejected request must not block a corrected
-- resubmission for the same dates. Hence a trigger.
create or replace function public.prevent_overlapping_leave()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  clash record;
begin
  if new.status not in ('pending', 'approved') then
    return new;
  end if;

  select l.start_date, l.end_date, l.status into clash
  from public.leaves l
  where l.employee_id = new.employee_id
    and l.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and l.status in ('pending', 'approved')
    -- Inclusive on both ends: a leave ending the 5th and one starting the 5th
    -- are the same day off, requested twice.
    and daterange(l.start_date, l.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  limit 1;

  if clash is not null then
    raise exception 'Overlaps an existing % leave from % to %',
      clash.status, clash.start_date, clash.end_date
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

create trigger leaves_prevent_overlap
  before insert or update of start_date, end_date, status, employee_id
  on public.leaves
  for each row execute function public.prevent_overlapping_leave();

-- Working days between two dates, inclusive, excluding Saturday and Sunday.
-- Used by the leave UI and the reports in Phase 12.
create or replace function public.leave_working_days(p_start date, p_end date)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from generate_series(p_start, p_end, interval '1 day') as day
  where extract(isodow from day) < 6;
$$;
