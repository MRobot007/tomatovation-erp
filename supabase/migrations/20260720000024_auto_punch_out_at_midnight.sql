-- ============================================================================
-- 0024 · Close forgotten punch-ins automatically at midnight
-- ============================================================================
-- Someone who forgets to punch out currently stays "Working" indefinitely: the
-- day never closes, working_hours stays null, and they appear on the live board
-- as still at their desk days later.
--
-- WHAT TIME IS RECORDED
--
-- Not midnight. Stamping 00:00 would turn a 09:00 punch-in into a ~15 hour day
-- and inflate payroll for what was actually a forgotten button press. The
-- system does not know when they left, so it records the configured end of the
-- working day — a conservative, reviewable guess — and flags the row.
--
-- The flag is the important part. An auto-closed day is a record nobody
-- verified, and it must not be indistinguishable from one the employee closed
-- themselves. Both the employee and their manager are notified so it can be
-- corrected while the day is still fresh in memory.

alter table public.attendance
  add column if not exists auto_punched_out boolean not null default false;

comment on column public.attendance.auto_punched_out is
  'True when the day was closed by the midnight job rather than by the employee. The punch_out time is a fallback, not an observation — treat the hours as unverified.';

-- Cheap to maintain and the reports that matter filter on it.
create index if not exists attendance_auto_punched_out_idx
  on public.attendance (date desc)
  where auto_punched_out;

-- ---------------------------------------------------------------------------
-- The job
-- ---------------------------------------------------------------------------
create or replace function public.auto_punch_out_stale_days()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg     public.app_settings;
  today   date;
  row_rec record;
  closed  int := 0;
  shift_end timestamptz;
  manager_id uuid;
begin
  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  -- Only days that have already ended. Today's open punch-ins are people who
  -- are still at work — closing those would be actively wrong.
  for row_rec in
    select a.id, a.employee_id, a.date, a.punch_in, a.break_started_at, a.break_minutes
    from public.attendance a
    where a.date < today
      and a.punch_in is not null
      and a.punch_out is null
  loop
    shift_end := (row_rec.date + cfg.work_day_end) at time zone cfg.timezone;

    -- A punch-in after the configured end of day (a late or night shift) would
    -- otherwise violate the punch_out >= punch_in constraint. Falling back to
    -- punch_in records a zero-hour day, which reads as "unknown" rather than
    -- inventing a duration.
    if shift_end < row_rec.punch_in then
      shift_end := row_rec.punch_in;
    end if;

    -- The RPC guard from 0015 blocks direct timestamp writes. This IS the
    -- system acting, so it sets the same flag the punch RPCs do.
    perform set_config('app.attendance_rpc', 'on', true);

    update public.attendance
    set punch_out = shift_end,
        status = 'completed',
        auto_punched_out = true,
        -- An open break is closed at the same instant, or its minutes would
        -- never be counted and the row would keep a dangling break_started_at.
        break_minutes = break_minutes + case
          when break_started_at is not null
          then greatest(0, least(
            floor(extract(epoch from (shift_end - break_started_at)) / 60.0)::int,
            floor(extract(epoch from (shift_end - punch_in)) / 60.0)::int
          ))
          else 0
        end,
        break_started_at = null
    where id = row_rec.id;

    perform set_config('app.attendance_rpc', '', true);

    closed := closed + 1;

    -- Tell the employee, and their manager, that the record needs a look.
    perform public.notify(
      row_rec.employee_id,
      'Your day was closed automatically',
      format('You did not punch out on %s. It was closed at %s — ask a super admin to correct it if that is wrong.',
             to_char(row_rec.date, 'DD Mon'),
             to_char(shift_end at time zone cfg.timezone, 'HH12:MI AM')),
      'auto_punched_out',
      '/attendance/me'
    );

    select p.manager_id into manager_id from public.profiles p where p.id = row_rec.employee_id;

    if manager_id is not null then
      perform public.notify(
        manager_id,
        'A day was closed automatically',
        format('%s did not punch out on %s. The recorded hours are an estimate.',
               (select name from public.profiles where id = row_rec.employee_id),
               to_char(row_rec.date, 'DD Mon')),
        'auto_punched_out',
        '/attendance'
      );
    end if;
  end loop;

  return closed;
end;
$$;

comment on function public.auto_punch_out_stale_days() is
  'Closes punch-ins left open past their day. Idempotent — a row already having punch_out is not matched, so extra runs do nothing.';

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------
-- pg_cron schedules in UTC, and the organisation's midnight is not midnight
-- UTC. This derives the right UTC time from the configured timezone, so the
-- job actually fires at 00:00 locally rather than 00:00 in another country.
--
-- Re-run it after changing app_settings.timezone; the schedule does not follow
-- the setting on its own.
create or replace function public.reschedule_auto_punch_out()
returns text
language plpgsql
security definer
set search_path = public, pg_temp, cron
as $$
declare
  cfg      public.app_settings;
  utc_time timestamptz;
  expr     text;
begin
  select * into cfg from public.app_settings where id;

  -- Midnight tomorrow, in the org's timezone, expressed in UTC.
  utc_time := ((now() at time zone cfg.timezone)::date + 1) at time zone cfg.timezone;
  expr := format('%s %s * * *',
                 extract(minute from utc_time at time zone 'UTC')::int,
                 extract(hour from utc_time at time zone 'UTC')::int);

  begin
    perform cron.unschedule('erp-auto-punch-out');
  exception when others then null;
  end;

  perform cron.schedule('erp-auto-punch-out', expr, $job$select public.auto_punch_out_stale_days()$job$);

  raise notice 'auto punch-out scheduled at % UTC (00:00 %)', expr, cfg.timezone;
  return expr;
end;
$$;

select public.reschedule_auto_punch_out();

-- A safety net an hour later. If the midnight run is missed — a restart, a
-- deploy, a paused project — the day still closes rather than staying open
-- until someone notices. Idempotent, so on a normal night it closes nothing.
do $$
begin
  perform cron.unschedule('erp-auto-punch-out-catchup');
exception when others then null;
end;
$$;

select cron.schedule(
  'erp-auto-punch-out-catchup',
  '17 * * * *',
  $job$select public.auto_punch_out_stale_days()$job$
);
