-- Multiple punch-in sessions in one day.
--
--   npx supabase db query --linked --file supabase/tests/multiple_sessions.sql
--
-- Runs entirely inside a transaction that is rolled back, so it can be pointed
-- at the live project without leaving anything behind.
--
-- The arithmetic is the point: punch_out - punch_in spans the gaps BETWEEN
-- sessions. Someone who works 09:00-12:00, leaves, and returns 16:00-18:00 has
-- worked five hours, and the old formula bills nine.

begin;

do $$
declare
  cfg      public.app_settings;
  emp      uuid;
  day_id   uuid;
  the_day  date := '2026-03-04';
  hours    numeric;
  sessions int;
  first_in timestamptz;
  last_out timestamptz;
begin
  select * into cfg from public.app_settings where id;

  -- Any real employee; the row is rolled back either way.
  select id into emp from public.profiles limit 1;
  if emp is null then
    raise exception 'No profiles to test against';
  end if;

  perform set_config('app.attendance_rpc', 'on', true);

  insert into public.attendance (employee_id, date, punch_in, status)
  values (emp, the_day, (the_day + time '09:00') at time zone cfg.timezone, 'working')
  returning id into day_id;

  -- Morning: 09:00 to 12:00.
  insert into public.attendance_sessions (attendance_id, employee_id, punch_in, punch_out)
  values (
    day_id, emp,
    (the_day + time '09:00') at time zone cfg.timezone,
    (the_day + time '12:00') at time zone cfg.timezone
  );

  -- Afternoon, after a four-hour gap: 16:00 to 18:00.
  insert into public.attendance_sessions (attendance_id, employee_id, punch_in, punch_out)
  values (
    day_id, emp,
    (the_day + time '16:00') at time zone cfg.timezone,
    (the_day + time '18:00') at time zone cfg.timezone
  );

  -- Close the day, which fires the metrics trigger.
  update public.attendance
  set punch_out = (the_day + time '18:00') at time zone cfg.timezone,
      status = 'completed'
  where id = day_id;

  select working_hours, punch_in, punch_out
  into hours, first_in, last_out
  from public.attendance where id = day_id;

  select count(*) into sessions
  from public.attendance_sessions where attendance_id = day_id;

  -- 3h + 2h = 5. NOT the nine hours between first in and last out.
  if hours is distinct from 5.00 then
    raise exception 'FAIL: expected 5.00 worked hours across two sessions, got %', hours;
  end if;

  if sessions <> 2 then
    raise exception 'FAIL: expected 2 sessions, got %', sessions;
  end if;

  -- The summary still reads as the bookends of the day.
  if first_in <> (the_day + time '09:00') at time zone cfg.timezone then
    raise exception 'FAIL: the day should still open at the FIRST punch in, got %', first_in;
  end if;

  if last_out <> (the_day + time '18:00') at time zone cfg.timezone then
    raise exception 'FAIL: the day should close at the LAST punch out, got %', last_out;
  end if;

  raise notice 'PASS  two sessions with a gap sum to % hours (not the 9h span)', hours;

  -- ---------------------------------------------------------------------
  -- Breaks come off the total, not off one session
  -- ---------------------------------------------------------------------
  update public.attendance set break_minutes = 30 where id = day_id;
  select working_hours into hours from public.attendance where id = day_id;

  if hours is distinct from 4.50 then
    raise exception 'FAIL: a 30m break should leave 4.50 of 5.00, got %', hours;
  end if;

  raise notice 'PASS  a 30m break leaves % hours', hours;

  -- ---------------------------------------------------------------------
  -- An open session, closed by the day closing (what the auto-closer does)
  -- ---------------------------------------------------------------------
  update public.attendance set break_minutes = 0, punch_out = null, status = 'working'
  where id = day_id;

  insert into public.attendance_sessions (attendance_id, employee_id, punch_in)
  values (day_id, emp, (the_day + time '20:00') at time zone cfg.timezone);

  select working_hours into hours from public.attendance where id = day_id;
  if hours is not null then
    raise exception 'FAIL: a running day should have no hours yet, got %', hours;
  end if;

  update public.attendance
  set punch_out = (the_day + time '21:00') at time zone cfg.timezone,
      status = 'completed'
  where id = day_id;

  select working_hours into hours from public.attendance where id = day_id;

  -- 3h + 2h + 1h. The open session is counted to the moment the day closed,
  -- which is the case that would silently produce NULL hours if the metrics
  -- trigger waited for the sessions to be closed first.
  if hours is distinct from 6.00 then
    raise exception 'FAIL: expected 6.00 with the trailing session closed at 21:00, got %', hours;
  end if;

  -- And the session row itself was closed, not just counted.
  if exists (
    select 1 from public.attendance_sessions
    where attendance_id = day_id and punch_out is null
  ) then
    raise exception 'FAIL: closing the day left an open session behind, which blocks tomorrow';
  end if;

  raise notice 'PASS  closing the day counts AND closes the open session (% hours)', hours;
end;
$$;

rollback;
