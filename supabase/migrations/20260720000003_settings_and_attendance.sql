-- ============================================================================
-- 0003 · app_settings and attendance
-- ============================================================================
-- The spec is explicit that working hours, break minutes, late minutes and
-- overtime are computed in Postgres, never in the browser. Client clocks are
-- wrong, adjustable, and in a different timezone than payroll cares about.

-- ---------------------------------------------------------------------------
-- Organisation settings — a single row, enforced
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id                    boolean primary key default true,
  work_day_start        time not null default '09:30',
  work_day_end          time not null default '18:30',
  standard_hours        numeric(4, 2) not null default 8.00
                          check (standard_hours > 0 and standard_hours <= 24),
  late_grace_minutes    int not null default 15 check (late_grace_minutes between 0 and 240),
  half_day_max_hours    numeric(4, 2) not null default 4.00 check (half_day_max_hours > 0),
  timezone              text not null default 'Asia/Kolkata',
  auto_punch_out_after  int not null default 720
                          check (auto_punch_out_after between 60 and 1440),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles (id) on delete set null,

  -- Classic single-row guard: the PK is a boolean pinned to true, so a second
  -- row is a primary-key violation rather than a silent second config.
  constraint app_settings_singleton check (id)
);

comment on table public.app_settings is
  'Exactly one row. Drives attendance calculations and reminder scheduling.';

insert into public.app_settings (id) values (true);

create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
create table public.attendance (
  id             uuid primary key default extensions.gen_random_uuid(),
  employee_id    uuid not null references public.profiles (id) on delete cascade,
  date           date not null default (now() at time zone 'Asia/Kolkata')::date,

  punch_in       timestamptz,
  punch_out      timestamptz,
  break_minutes  int not null default 0 check (break_minutes >= 0 and break_minutes <= 1440),
  break_started_at timestamptz,

  -- Derived by trigger. Never written by the client.
  working_hours  numeric(5, 2) check (working_hours is null or working_hours between 0 and 24),
  late_minutes   int check (late_minutes is null or late_minutes >= 0),
  overtime_hours numeric(5, 2) check (overtime_hours is null or overtime_hours >= 0),

  status         public.attendance_status not null default 'not_started',

  punch_in_lat   numeric(9, 6) check (punch_in_lat is null or punch_in_lat between -90 and 90),
  punch_in_lng   numeric(9, 6) check (punch_in_lng is null or punch_in_lng between -180 and 180),
  punch_out_lat  numeric(9, 6) check (punch_out_lat is null or punch_out_lat between -90 and 90),
  punch_out_lng  numeric(9, 6) check (punch_out_lng is null or punch_out_lng between -180 and 180),

  device         text check (device is null or length(device) <= 120),
  browser        text check (browser is null or length(browser) <= 120),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- The spec's double-punch-in guard. Combined with the upsert in punch_in(),
  -- a duplicate is a no-op instead of a second row for the same day.
  constraint attendance_unique_employee_date unique (employee_id, date),
  constraint attendance_out_after_in check (punch_out is null or punch_in is null or punch_out >= punch_in)
);

comment on column public.attendance.working_hours is
  'Derived in the database on punch out. Never accept this from the client.';

create index attendance_employee_date_idx on public.attendance (employee_id, date desc);
create index attendance_date_idx on public.attendance (date desc);
create index attendance_status_idx on public.attendance (status)
  where status in ('working', 'on_break');

create trigger attendance_touch_updated_at
  before update on public.attendance
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Derived-field calculation
-- ===========================================================================
create or replace function public.calculate_attendance_metrics()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  cfg              public.app_settings;
  gross_minutes    numeric;
  net_minutes      numeric;
  shift_start      timestamptz;
  arrival_delay    numeric;
begin
  select * into cfg from public.app_settings where id;

  -- Late minutes depend only on arrival, so they are settled at punch in and
  -- never revised by a later punch out.
  if new.punch_in is not null then
    shift_start := (new.date + cfg.work_day_start) at time zone cfg.timezone;
    arrival_delay := extract(epoch from (new.punch_in - shift_start)) / 60.0;

    new.late_minutes := greatest(0, floor(arrival_delay - cfg.late_grace_minutes))::int;
  else
    new.late_minutes := null;
  end if;

  if new.punch_in is null or new.punch_out is null then
    new.working_hours := null;
    new.overtime_hours := null;
    return new;
  end if;

  gross_minutes := extract(epoch from (new.punch_out - new.punch_in)) / 60.0;

  -- Breaks longer than the shift itself mean bad data upstream; clamp to zero
  -- rather than emitting negative hours into payroll reports.
  net_minutes := greatest(0, gross_minutes - coalesce(new.break_minutes, 0));

  new.working_hours := round((net_minutes / 60.0)::numeric, 2);
  new.overtime_hours := round(greatest(0, (net_minutes / 60.0) - cfg.standard_hours)::numeric, 2);

  return new;
end;
$$;

create trigger attendance_calculate_metrics
  before insert or update of punch_in, punch_out, break_minutes, date
  on public.attendance
  for each row execute function public.calculate_attendance_metrics();

-- ===========================================================================
-- Punch RPCs
-- ===========================================================================
-- Exposed as RPCs rather than table writes so the client cannot choose its own
-- timestamps. now() is the database's clock, which is the only one payroll
-- should trust.

create or replace function public.punch_in(
  p_lat     numeric default null,
  p_lng     numeric default null,
  p_device  text default null,
  p_browser text default null
)
returns public.attendance
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  cfg    public.app_settings;
  today  date;
  result public.attendance;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  insert into public.attendance as a (
    employee_id, date, punch_in, status,
    punch_in_lat, punch_in_lng, device, browser
  )
  values (
    (select auth.uid()), today, now(), 'working',
    p_lat, p_lng, p_device, p_browser
  )
  -- Idempotent: a double tap, or a second tab, returns the existing row
  -- rather than raising or overwriting the original punch-in time.
  on conflict (employee_id, date) do update
    set punch_in     = coalesce(a.punch_in, excluded.punch_in),
        status       = case when a.punch_in is null then 'working' else a.status end,
        punch_in_lat = coalesce(a.punch_in_lat, excluded.punch_in_lat),
        punch_in_lng = coalesce(a.punch_in_lng, excluded.punch_in_lng),
        device       = coalesce(a.device, excluded.device),
        browser      = coalesce(a.browser, excluded.browser)
  returning * into result;

  return result;
end;
$$;

create or replace function public.punch_out(
  p_lat numeric default null,
  p_lng numeric default null
)
returns public.attendance
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  cfg     public.app_settings;
  today   date;
  current public.attendance;
  result  public.attendance;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  select * into current
  from public.attendance
  where employee_id = (select auth.uid()) and date = today;

  if current.id is null or current.punch_in is null then
    raise exception 'Cannot punch out before punching in' using errcode = 'check_violation';
  end if;

  if current.punch_out is not null then
    raise exception 'Already punched out at %', current.punch_out using errcode = 'check_violation';
  end if;

  update public.attendance
  set punch_out = now(),
      status = 'completed',
      punch_out_lat = p_lat,
      punch_out_lng = p_lng,
      -- An open break is closed by the punch out; otherwise its minutes would
      -- silently never be counted.
      break_minutes = break_minutes + case
        when break_started_at is not null
        then greatest(0, floor(extract(epoch from (now() - break_started_at)) / 60.0))::int
        else 0
      end,
      break_started_at = null
  where id = current.id
  returning * into result;

  return result;
end;
$$;

create or replace function public.toggle_break()
returns public.attendance
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  cfg     public.app_settings;
  today   date;
  current public.attendance;
  result  public.attendance;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  select * into current
  from public.attendance
  where employee_id = (select auth.uid()) and date = today;

  if current.id is null or current.punch_in is null then
    raise exception 'Cannot take a break before punching in' using errcode = 'check_violation';
  end if;

  if current.punch_out is not null then
    raise exception 'The day is already closed' using errcode = 'check_violation';
  end if;

  if current.break_started_at is null then
    update public.attendance
    set break_started_at = now(), status = 'on_break'
    where id = current.id
    returning * into result;
  else
    update public.attendance
    set break_minutes = break_minutes
          + greatest(0, floor(extract(epoch from (now() - break_started_at)) / 60.0))::int,
        break_started_at = null,
        status = 'working'
    where id = current.id
    returning * into result;
  end if;

  return result;
end;
$$;
