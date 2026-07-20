-- ============================================================================
-- Attendance calculation tests
-- ============================================================================
--   npm run test:db
--
-- These moved out of the API suite when migration 0015 locked attendance
-- timestamps to the punch RPCs. That lock is correct — an employee must not be
-- able to backdate their own punch_in — but it means the calculation trigger
-- can no longer be exercised by inserting rows over PostgREST.
--
-- A trigger is a database unit, so this is the right home for it. Everything
-- runs inside a transaction that is rolled back, so this is safe to run against
-- a live project and leaves no rows behind.
--
-- Any real failure raises an exception, which aborts the script with a non-zero
-- exit — a silent pass is not possible.

begin;

-- Assertion helper. Created inside the transaction, so the rollback removes it.
create function pg_temp.expect(label text, actual numeric, expected numeric)
returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % — expected %, got %', label, expected, actual;
  end if;
  raise notice 'pass  %', label;
end;
$$;

-- The trigger fires on INSERT, and 0015 gates INSERT behind this flag.
set local app.attendance_rpc = 'on';

do $$
declare
  emp_id uuid;
  cfg    public.app_settings;
  r      public.attendance;
begin
  select * into cfg from public.app_settings where id;
  raise notice 'Config: start=%  standard=%  grace=%  tz=%',
    cfg.work_day_start, cfg.standard_hours, cfg.late_grace_minutes, cfg.timezone;

  -- Any profile will do; the trigger does not branch on who owns the row.
  select id into emp_id from public.profiles order by created_at limit 1;
  if emp_id is null then
    raise exception 'No profiles exist — cannot run calculation tests';
  end if;

  -- --- working_hours ------------------------------------------------------
  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-02',
          timestamptz '2040-01-02 09:00+05:30', timestamptz '2040-01-02 18:00+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('9h day, no break', r.working_hours, 9.00);

  insert into public.attendance (employee_id, date, punch_in, punch_out, break_minutes, status)
  values (emp_id, date '2040-01-03',
          timestamptz '2040-01-03 09:00+05:30', timestamptz '2040-01-03 18:00+05:30', 45, 'completed')
  returning * into r;
  perform pg_temp.expect('45m break deducted', r.working_hours, 8.25);

  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-04',
          timestamptz '2040-01-04 09:47+05:30', timestamptz '2040-01-04 18:04+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('8h17m rounds to 8.28', r.working_hours, 8.28);

  insert into public.attendance (employee_id, date, punch_in, punch_out, break_minutes, status)
  values (emp_id, date '2040-01-05',
          timestamptz '2040-01-05 09:00+05:30', timestamptz '2040-01-05 11:00+05:30', 600, 'completed')
  returning * into r;
  perform pg_temp.expect('break longer than shift clamps to zero', r.working_hours, 0.00);

  -- --- late_minutes -------------------------------------------------------
  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-08',
          timestamptz '2040-01-08 09:44+05:30', timestamptz '2040-01-08 18:00+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('09:44 inside grace window', r.late_minutes, 0);

  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-09',
          timestamptz '2040-01-09 09:45+05:30', timestamptz '2040-01-09 18:00+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('09:45 exactly at boundary, still forgiven', r.late_minutes, 0);

  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-10',
          timestamptz '2040-01-10 10:00+05:30', timestamptz '2040-01-10 18:00+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('late counted from end of grace, not shift start', r.late_minutes, 15);

  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-11',
          timestamptz '2040-01-11 13:15+05:30', timestamptz '2040-01-11 18:00+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('badly late counted in full', r.late_minutes, 210);

  -- --- overtime -----------------------------------------------------------
  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-12',
          timestamptz '2040-01-12 09:00+05:30', timestamptz '2040-01-12 17:00+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('exactly standard hours, no overtime', r.overtime_hours, 0.00);

  insert into public.attendance (employee_id, date, punch_in, punch_out, break_minutes, status)
  values (emp_id, date '2040-01-15',
          timestamptz '2040-01-15 09:00+05:30', timestamptz '2040-01-15 19:00+05:30', 60, 'completed')
  returning * into r;
  perform pg_temp.expect('overtime measured after breaks', r.overtime_hours, 1.00);

  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_id, date '2040-01-16',
          timestamptz '2040-01-16 09:00+05:30', timestamptz '2040-01-16 12:00+05:30', 'completed')
  returning * into r;
  perform pg_temp.expect('short day gives no negative overtime', r.overtime_hours, 0.00);

  -- --- open day -----------------------------------------------------------
  insert into public.attendance (employee_id, date, punch_in, status)
  values (emp_id, date '2040-01-17', timestamptz '2040-01-17 09:00+05:30', 'working')
  returning * into r;

  if r.working_hours is not null or r.overtime_hours is not null then
    raise exception 'FAIL: an open day should leave hours null, got % / %',
      r.working_hours, r.overtime_hours;
  end if;
  raise notice 'pass  open day leaves hours null';

  raise notice '=== all attendance calculation tests passed ===';
end;
$$;

rollback;
