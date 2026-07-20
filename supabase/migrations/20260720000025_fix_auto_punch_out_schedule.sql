-- ============================================================================
-- 0025 · Fix the auto punch-out schedule offset
-- ============================================================================
-- 0024 scheduled the job at 05:30 UTC, which is 11:00 in Asia/Kolkata — the
-- middle of the working day, not midnight.
--
-- The cause is operator resolution. In
--
--   ((now() at time zone tz)::date + 1) at time zone tz
--
-- the `date` is implicitly cast to `timestamptz`, not `timestamp`. `at time
-- zone` then reads it as "convert this instant INTO that zone" rather than
-- "interpret this wall-clock time AS being in that zone", so the offset is
-- applied in the wrong direction: +05:30 instead of -05:30.
--
-- The fix is an explicit ::timestamp. The two casts differ by eleven hours here
-- and by nothing at all in UTC, so this would have looked correct in any
-- UTC-based test.

create or replace function public.reschedule_auto_punch_out()
returns text
language plpgsql
security definer
set search_path = public, pg_temp, cron
as $$
declare
  cfg       public.app_settings;
  local_midnight timestamp;
  utc_time  timestamptz;
  expr      text;
begin
  select * into cfg from public.app_settings where id;

  -- Explicitly a `timestamp`: a wall-clock reading with no zone attached.
  local_midnight := ((now() at time zone cfg.timezone)::date + 1)::timestamp;

  -- Now interpreted AS being in the org's zone, giving the real instant.
  utc_time := local_midnight at time zone cfg.timezone;

  expr := format('%s %s * * *',
                 extract(minute from utc_time at time zone 'UTC')::int,
                 extract(hour from utc_time at time zone 'UTC')::int);

  begin
    perform cron.unschedule('erp-auto-punch-out');
  exception when others then null;
  end;

  perform cron.schedule('erp-auto-punch-out', expr, $job$select public.auto_punch_out_stale_days()$job$);

  raise notice 'auto punch-out scheduled at "% " UTC = 00:00 %', expr, cfg.timezone;
  return expr;
end;
$$;

select public.reschedule_auto_punch_out();

-- Prove the arithmetic rather than trusting it: the scheduled UTC time must
-- convert back to exactly 00:00 in the configured zone.
do $$
declare
  cfg   public.app_settings;
  expr  text;
  hh    int;
  mm    int;
  check_local time;
begin
  select * into cfg from public.app_settings where id;
  select schedule into expr from cron.job where jobname = 'erp-auto-punch-out';

  mm := split_part(expr, ' ', 1)::int;
  hh := split_part(expr, ' ', 2)::int;

  check_local := ((current_date + make_time(hh, mm, 0)) at time zone 'UTC' at time zone cfg.timezone)::time;

  if check_local <> time '00:00' then
    raise exception 'Schedule is wrong: % UTC is %, not midnight in %', expr, check_local, cfg.timezone;
  end if;

  raise notice 'verified: % UTC is midnight in %', expr, cfg.timezone;
end;
$$;
