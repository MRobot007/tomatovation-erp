-- ============================================================================
-- 0015 · Attendance timestamps are writable only through the punch RPCs
-- ============================================================================
-- The RPCs were built so the database clock, not the client, decides when a
-- punch happened. But `attendance_update_self` allowed a direct UPDATE of any
-- column on your own row, and calculate_attendance_metrics recomputes from
-- whatever timestamps it is handed.
--
-- So an employee could PATCH their own attendance row with an earlier punch_in
-- and the trigger would dutifully recompute late_minutes as zero. Every hour
-- and late-arrival figure the payroll and reports depend on was self-editable.
-- The RPCs were the intended path, never the only one.
--
-- This closes it with a session flag the RPCs set and nothing else can:
-- PostgREST offers no way for a client to run set_config, so a plain API caller
-- cannot fake it.

-- The RPCs must now run as definer: the UPDATE policy no longer permits the
-- writes they perform, and the flag has to be set inside the same transaction.
-- Each already validates auth.uid() and scopes strictly to the caller's row.
create or replace function public.punch_in(
  p_lat     numeric default null,
  p_lng     numeric default null,
  p_device  text default null,
  p_browser text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg    public.app_settings;
  today  date;
  result public.attendance;
  actor  uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.attendance_rpc', 'on', true);

  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  insert into public.attendance as a (
    employee_id, date, punch_in, status, punch_in_lat, punch_in_lng, device, browser
  )
  values (actor, today, now(), 'working', p_lat, p_lng, p_device, p_browser)
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
security definer
set search_path = public, pg_temp
as $$
declare
  cfg     public.app_settings;
  today   date;
  current public.attendance;
  result  public.attendance;
  actor   uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.attendance_rpc', 'on', true);

  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  select * into current from public.attendance
  where employee_id = actor and date = today;

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
security definer
set search_path = public, pg_temp
as $$
declare
  cfg     public.app_settings;
  today   date;
  current public.attendance;
  result  public.attendance;
  actor   uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.attendance_rpc', 'on', true);

  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  select * into current from public.attendance
  where employee_id = actor and date = today;

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

-- ---------------------------------------------------------------------------
-- The lock
-- ---------------------------------------------------------------------------
create or replace function public.guard_attendance_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Inside a punch RPC, or a direct operator session, or a super admin making
  -- a correction (someone forgot to punch out and it has to be fixed).
  if coalesce(current_setting('app.attendance_rpc', true), '') = 'on'
     or public.acting_outside_postgrest()
     or public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A hand-rolled INSERT could otherwise fabricate an entire past workday.
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

create trigger attendance_guard_timestamps
  before insert or update on public.attendance
  for each row execute function public.guard_attendance_timestamps();

-- ---------------------------------------------------------------------------
-- Correction path
-- ---------------------------------------------------------------------------
-- With direct writes locked, a super admin needs a way to remove a record
-- created in error. Employees deliberately get no delete: erasing a late
-- arrival must not be self-service.
create policy attendance_delete_admin
  on public.attendance for delete
  to authenticated
  using (public.is_super_admin());
