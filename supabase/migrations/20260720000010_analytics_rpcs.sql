-- ============================================================================
-- 0010 · Analytics aggregation
-- ============================================================================
-- The spec is explicit: aggregate in Postgres, never fetch raw rows and reduce
-- in JavaScript. At 500 employees a year of attendance is ~130k rows — shipping
-- that to a browser to compute an average is the difference between a 40 ms
-- response and a frozen tab.
--
-- All of these are SECURITY INVOKER, so RLS still applies: a manager calling
-- them aggregates over their reports, a super admin over everyone. The numbers
-- are scoped by the same boundary as the tables.

-- ---------------------------------------------------------------------------
-- Attendance summary over a window
-- ---------------------------------------------------------------------------
create or replace function public.analytics_attendance_summary(
  p_from date,
  p_to date
)
returns table (
  day                date,
  present_count      int,
  late_count         int,
  total_hours        numeric,
  avg_hours          numeric,
  overtime_hours     numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    a.date as day,
    count(*) filter (where a.punch_in is not null)::int as present_count,
    count(*) filter (where coalesce(a.late_minutes, 0) > 0)::int as late_count,
    coalesce(sum(a.working_hours), 0)::numeric as total_hours,
    coalesce(round(avg(a.working_hours) filter (where a.working_hours is not null), 2), 0)::numeric
      as avg_hours,
    coalesce(sum(a.overtime_hours), 0)::numeric as overtime_hours
  from public.attendance a
  where a.date between p_from and p_to
  group by a.date
  order by a.date;
$$;

-- ---------------------------------------------------------------------------
-- Per-employee performance over a window
-- ---------------------------------------------------------------------------
create or replace function public.analytics_employee_performance(
  p_from date,
  p_to date
)
returns table (
  employee_id     uuid,
  employee_name   text,
  department      text,
  days_present    int,
  days_late       int,
  total_hours     numeric,
  avg_hours       numeric,
  overtime_hours  numeric,
  work_log_count  int,
  logged_hours    numeric,
  tasks_completed int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- Each metric is aggregated in its own CTE before joining. Joining the raw
  -- tables first would multiply rows across attendance x work_logs x tasks and
  -- inflate every sum.
  with attendance_stats as (
    select
      a.employee_id,
      count(*) filter (where a.punch_in is not null)::int as days_present,
      count(*) filter (where coalesce(a.late_minutes, 0) > 0)::int as days_late,
      coalesce(sum(a.working_hours), 0)::numeric as total_hours,
      coalesce(round(avg(a.working_hours) filter (where a.working_hours is not null), 2), 0)::numeric
        as avg_hours,
      coalesce(sum(a.overtime_hours), 0)::numeric as overtime_hours
    from public.attendance a
    where a.date between p_from and p_to
    group by a.employee_id
  ),
  log_stats as (
    select
      w.employee_id,
      count(*)::int as work_log_count,
      coalesce(sum(w.hours), 0)::numeric as logged_hours
    from public.work_logs w
    where w.log_date between p_from and p_to
    group by w.employee_id
  ),
  task_stats as (
    select
      t.assigned_to as employee_id,
      count(*)::int as tasks_completed
    from public.tasks t
    where t.status = 'done'
      and t.completed_at::date between p_from and p_to
    group by t.assigned_to
  )
  select
    p.id,
    p.name,
    p.department,
    coalesce(a.days_present, 0),
    coalesce(a.days_late, 0),
    coalesce(a.total_hours, 0),
    coalesce(a.avg_hours, 0),
    coalesce(a.overtime_hours, 0),
    coalesce(l.work_log_count, 0),
    coalesce(l.logged_hours, 0),
    coalesce(t.tasks_completed, 0)
  from public.profiles p
  left join attendance_stats a on a.employee_id = p.id
  left join log_stats l on l.employee_id = p.id
  left join task_stats t on t.employee_id = p.id
  where p.status = 'active'
  order by coalesce(a.total_hours, 0) desc, p.name;
$$;

-- ---------------------------------------------------------------------------
-- Lead conversion funnel
-- ---------------------------------------------------------------------------
create or replace function public.analytics_lead_funnel(
  p_from date default null,
  p_to date default null
)
returns table (
  status      public.lead_status,
  lead_count  int,
  total_value numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- Left-joined against the enum so empty stages appear as zero rather than
  -- vanishing from the funnel, which would misrepresent the shape.
  select
    s.status,
    coalesce(count(l.id), 0)::int as lead_count,
    coalesce(sum(l.value_estimate), 0)::numeric as total_value
  from unnest(enum_range(null::public.lead_status)) as s(status)
  left join public.leads l
    on l.status = s.status
    and (p_from is null or l.created_at >= p_from::timestamptz)
    and (p_to is null or l.created_at < (p_to + 1)::timestamptz)
  group by s.status
  order by array_position(enum_range(null::public.lead_status), s.status);
$$;

-- ---------------------------------------------------------------------------
-- Leads created per day
-- ---------------------------------------------------------------------------
create or replace function public.analytics_daily_leads(
  p_from date,
  p_to date
)
returns table (
  day        date,
  created    int,
  won        int,
  lost       int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- generate_series supplies every day in the window so a chart shows a gap as
  -- zero rather than skipping the date entirely and distorting the trend line.
  select
    d.day::date,
    coalesce(count(l.id) filter (where l.created_at::date = d.day), 0)::int as created,
    coalesce(count(w.id) filter (where w.closed_at::date = d.day and w.status = 'won'), 0)::int as won,
    coalesce(count(w.id) filter (where w.closed_at::date = d.day and w.status = 'lost'), 0)::int as lost
  from generate_series(p_from, p_to, interval '1 day') as d(day)
  left join public.leads l on l.created_at::date = d.day
  left join public.leads w on w.closed_at::date = d.day
  group by d.day
  order by d.day;
$$;

-- ---------------------------------------------------------------------------
-- Leave statistics
-- ---------------------------------------------------------------------------
create or replace function public.analytics_leave_stats(
  p_from date,
  p_to date
)
returns table (
  leave_type    public.leave_type,
  request_count int,
  approved      int,
  rejected      int,
  pending       int,
  total_days    int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    l.leave_type,
    count(*)::int,
    count(*) filter (where l.status = 'approved')::int,
    count(*) filter (where l.status = 'rejected')::int,
    count(*) filter (where l.status = 'pending')::int,
    coalesce(sum((l.end_date - l.start_date) + 1), 0)::int
  from public.leaves l
  where l.start_date <= p_to and l.end_date >= p_from
  group by l.leave_type
  order by count(*) desc;
$$;

-- ---------------------------------------------------------------------------
-- Headline numbers for the dashboard
-- ---------------------------------------------------------------------------
create or replace function public.analytics_dashboard_stats(p_date date)
returns table (
  active_employees   int,
  present_today      int,
  working_now        int,
  late_today         int,
  on_leave_today     int,
  pending_leaves     int,
  open_tasks         int,
  overdue_tasks      int,
  open_leads         int,
  followups_due      int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.profiles where status = 'active')::int,
    (select count(*) from public.attendance where date = p_date and punch_in is not null)::int,
    (select count(*) from public.attendance where date = p_date and status in ('working', 'on_break'))::int,
    (select count(*) from public.attendance where date = p_date and coalesce(late_minutes, 0) > 0)::int,
    (select count(*) from public.leaves
      where status = 'approved' and p_date between start_date and end_date)::int,
    (select count(*) from public.leaves where status = 'pending')::int,
    (select count(*) from public.tasks where status not in ('done', 'cancelled'))::int,
    (select count(*) from public.tasks
      where status not in ('done', 'cancelled') and deadline is not null and deadline < now())::int,
    (select count(*) from public.leads where status not in ('won', 'lost'))::int,
    (select count(*) from public.leads
      where next_followup <= p_date and status not in ('won', 'lost'))::int;
$$;
