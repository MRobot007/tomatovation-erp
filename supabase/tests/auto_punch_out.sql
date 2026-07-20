-- ============================================================================
-- Auto punch-out tests
-- ============================================================================
--   npm run test:autopunch
--
-- Runs inside a transaction that is rolled back, so it is safe against a live
-- project and leaves no rows behind. Any failure raises, which aborts with a
-- non-zero exit — a silent pass is not possible.
--
-- The assertion that matters most is the negative one: a day that has NOT
-- ended must be left alone. Closing someone who is still at their desk would
-- be worse than never closing anything.

begin;

create function pg_temp.expect(label text, actual text, expected text)
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

do $$
declare
  cfg      public.app_settings;
  today    date;
  emp_open uuid;   -- forgot to punch out two days ago
  emp_now  uuid;   -- at their desk right now
  emp_done uuid;   -- closed their own day properly
  r        public.attendance;
  closed   int;
begin
  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  select id into emp_open from public.profiles order by created_at limit 1;
  select id into emp_now  from public.profiles order by created_at offset 1 limit 1;
  select id into emp_done from public.profiles order by created_at offset 2 limit 1;

  if emp_done is null then
    raise exception 'Need at least three profiles to run these tests';
  end if;

  perform set_config('app.attendance_rpc', 'on', true);

  -- Clear anything that would collide with the fixtures below.
  delete from public.attendance
  where employee_id in (emp_open, emp_now, emp_done)
    and date in (today, today - 2);

  -- A day that ended with the punch-in still open.
  insert into public.attendance (employee_id, date, punch_in, status)
  values (emp_open, today - 2,
          ((today - 2)::timestamp + time '09:12') at time zone cfg.timezone, 'working');

  -- Someone currently working. Must survive untouched.
  insert into public.attendance (employee_id, date, punch_in, status)
  values (emp_now, today, now() - interval '2 hours', 'working');

  -- A day the employee closed themselves. Must not be re-flagged.
  insert into public.attendance (employee_id, date, punch_in, punch_out, status)
  values (emp_done, today - 2,
          ((today - 2)::timestamp + time '09:00') at time zone cfg.timezone,
          ((today - 2)::timestamp + time '17:30') at time zone cfg.timezone,
          'completed');

  closed := public.auto_punch_out_stale_days();
  perform pg_temp.expect('closes exactly the one stale open day', closed::text, '1');

  -- --- the stale day -------------------------------------------------------
  select * into r from public.attendance where employee_id = emp_open and date = today - 2;
  perform pg_temp.expect('stale day is completed', r.status::text, 'completed');
  perform pg_temp.expect('stale day is flagged as automatic', r.auto_punched_out::text, 'true');
  perform pg_temp.expect(
    'punch_out is the configured end of day, not midnight',
    to_char(r.punch_out at time zone cfg.timezone, 'HH24:MI'),
    to_char(cfg.work_day_end, 'HH24:MI'));

  if r.working_hours is null then
    raise exception 'FAIL: hours were not computed for the closed day';
  end if;
  raise notice 'pass  hours computed (%)', r.working_hours;

  -- --- someone still working ----------------------------------------------
  select * into r from public.attendance where employee_id = emp_now and date = today;
  perform pg_temp.expect('today is NOT closed', r.status::text, 'working');
  perform pg_temp.expect('today has no punch_out', coalesce(r.punch_out::text, 'null'), 'null');
  perform pg_temp.expect('today is not flagged', r.auto_punched_out::text, 'false');

  -- --- a day the employee closed themselves -------------------------------
  select * into r from public.attendance where employee_id = emp_done and date = today - 2;
  perform pg_temp.expect('a self-closed day keeps its own punch_out',
    to_char(r.punch_out at time zone cfg.timezone, 'HH24:MI'), '17:30');
  perform pg_temp.expect('a self-closed day is not flagged as automatic',
    r.auto_punched_out::text, 'false');

  -- --- idempotence ---------------------------------------------------------
  closed := public.auto_punch_out_stale_days();
  perform pg_temp.expect('running again closes nothing', closed::text, '0');

  raise notice '=== all auto punch-out tests passed ===';
end;
$$;

rollback;
