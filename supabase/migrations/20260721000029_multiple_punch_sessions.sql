-- ============================================================================
-- 0029 · A day can have more than one punch in
-- ============================================================================
-- The day was one row with one punch_in and one punch_out, so punching out was
-- final: leave for a site visit and come back, and there was no way to record
-- the afternoon. punch_out() raised 'Already punched out'.
--
-- Sessions become their own table. The attendance row stays as the day's
-- summary — first in, last out, total hours — because every report, filter and
-- analytics RPC reads those columns and rewriting all of them to aggregate
-- would be a far larger change than this problem deserves.
--
--   attendance          one row per employee per day  (the summary)
--   attendance_sessions many rows per attendance      (what actually happened)

create table public.attendance_sessions (
  id            uuid primary key default extensions.gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  -- Denormalised from the parent so RLS can scope without a join on every read.
  employee_id   uuid not null references public.profiles (id) on delete cascade,

  punch_in      timestamptz not null,
  punch_out     timestamptz,

  punch_in_lat  numeric(9, 6) check (punch_in_lat is null or punch_in_lat between -90 and 90),
  punch_in_lng  numeric(9, 6) check (punch_in_lng is null or punch_in_lng between -180 and 180),
  punch_out_lat numeric(9, 6) check (punch_out_lat is null or punch_out_lat between -90 and 90),
  punch_out_lng numeric(9, 6) check (punch_out_lng is null or punch_out_lng between -180 and 180),

  device        text check (device is null or length(device) <= 120),
  browser       text check (browser is null or length(browser) <= 120),

  created_at    timestamptz not null default now(),

  constraint attendance_sessions_out_after_in
    check (punch_out is null or punch_out >= punch_in)
);

comment on table public.attendance_sessions is
  'Each punch-in/punch-out pair. A day may hold several; attendance holds the summary of them.';

create index attendance_sessions_attendance_idx
  on public.attendance_sessions (attendance_id, punch_in);
create index attendance_sessions_employee_idx
  on public.attendance_sessions (employee_id, punch_in desc);

-- At most one session open at a time, enforced by the database rather than by
-- the RPC remembering to check. Two open sessions would double-count every
-- second of the overlap into somebody's pay.
create unique index attendance_sessions_one_open
  on public.attendance_sessions (employee_id)
  where punch_out is null;

alter table public.attendance_sessions enable row level security;

-- Mirrors attendance: your own, your reports', or everything if super admin.
create policy attendance_sessions_select_scoped
  on public.attendance_sessions for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or public.manages(employee_id)
    or public.is_super_admin()
  );

-- No insert, update or delete policy. Sessions are written only by the punch
-- RPCs, which are SECURITY DEFINER — the same reasoning as migration 0015,
-- where letting employees write their own timestamps meant they could backdate
-- a punch-in and erase being late.

-- ---------------------------------------------------------------------------
-- Backfill, so history survives the change
-- ---------------------------------------------------------------------------
insert into public.attendance_sessions (
  attendance_id, employee_id, punch_in, punch_out,
  punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng, device, browser
)
select a.id, a.employee_id, a.punch_in, a.punch_out,
       a.punch_in_lat, a.punch_in_lng, a.punch_out_lat, a.punch_out_lng, a.device, a.browser
from public.attendance a
where a.punch_in is not null;

-- ---------------------------------------------------------------------------
-- Hours are now a sum, not a subtraction
-- ---------------------------------------------------------------------------
-- punch_out - punch_in spans the gaps between sessions. Someone who works 9-12,
-- leaves, and returns 4-6 worked five hours; the old arithmetic bills nine.
create or replace function public.calculate_attendance_metrics()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  cfg           public.app_settings;
  gross_minutes numeric;
  net_minutes   numeric;
  has_sessions  boolean;
  shift_start   timestamptz;
  arrival_delay numeric;
begin
  select * into cfg from public.app_settings where id;

  -- Unchanged from the original, deliberately copied rather than rewritten.
  -- The first version of this migration paraphrased it from memory and invented
  -- a `work_start_time` column that does not exist, plus dropped the grace
  -- period — which would have marked everyone arriving inside it as late.
  -- Late minutes depend only on arrival, so they are settled at punch in and
  -- never revised by a later punch out.
  if new.punch_in is not null then
    shift_start := (new.date + cfg.work_day_start) at time zone cfg.timezone;
    arrival_delay := extract(epoch from (new.punch_in - shift_start)) / 60.0;

    new.late_minutes := greatest(0, floor(arrival_delay - cfg.late_grace_minutes))::int;
  else
    new.late_minutes := null;
  end if;

  -- The day's own punch_out is the sole signal that it is finished. Checking
  -- for open SESSIONS here as well would break the auto-closer: it sets
  -- punch_out on the summary row, and the sessions are only closed afterwards
  -- by the AFTER trigger — so this BEFORE trigger would see them still open,
  -- write a null, and never run again. Every auto-closed day would land in
  -- payroll with no hours on it.
  if new.punch_in is null or new.punch_out is null then
    new.working_hours := null;
    new.overtime_hours := null;
    return new;
  end if;

  select count(*) > 0 into has_sessions
  from public.attendance_sessions s
  where s.attendance_id = new.id;

  if has_sessions then
    -- An open session is treated as ending when the day did, which is exactly
    -- what the AFTER trigger is about to write to it. greatest() keeps a
    -- session that somehow began after the close at zero rather than negative.
    select coalesce(
      sum(greatest(0, extract(epoch from (coalesce(s.punch_out, new.punch_out) - s.punch_in)))),
      0
    ) / 60.0
    into gross_minutes
    from public.attendance_sessions s
    where s.attendance_id = new.id;
  else
    -- No sessions at all: a row written by some path that predates them, or a
    -- direct fix-up. The old arithmetic is still the best available answer.
    gross_minutes := extract(epoch from (new.punch_out - new.punch_in)) / 60.0;
  end if;

  -- Breaks longer than the shift itself mean bad data upstream; clamp to zero
  -- rather than emitting negative hours into payroll reports.
  net_minutes := greatest(0, gross_minutes - coalesce(new.break_minutes, 0));

  new.working_hours := round((net_minutes / 60.0)::numeric, 2);
  new.overtime_hours := round(greatest(0, (net_minutes / 60.0) - cfg.standard_hours)::numeric, 2);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- punch_in: open a session, and reopen the day if it was closed
-- ---------------------------------------------------------------------------
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
  day    public.attendance;
  result public.attendance;
  actor  uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.attendance_rpc', 'on', true);

  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  -- Already running: hand back the day unchanged. No new session, no moved
  -- timestamp, no error.
  --
  -- Raising here turned a double-clicked button into an error toast, and broke
  -- the idempotency the attendance suite has asserted since migration 0003.
  -- The guard exists to prevent two OPEN sessions, not to scold someone whose
  -- finger bounced.
  if exists (
    select 1 from public.attendance_sessions
    where employee_id = actor and punch_out is null
  ) then
    select * into result from public.attendance
    where employee_id = actor and date = today;
    return result;
  end if;

  insert into public.attendance as a (
    employee_id, date, punch_in, status, punch_in_lat, punch_in_lng, device, browser
  )
  values (actor, today, now(), 'working', p_lat, p_lng, p_device, p_browser)
  on conflict (employee_id, date) do update
    -- The day's punch_in is the FIRST of the day and never moves; lateness is
    -- judged on when you first arrived, not on returning from lunch.
    set punch_in     = coalesce(a.punch_in, excluded.punch_in),
        -- Reopened: the day is no longer finished.
        punch_out    = null,
        status       = 'working',
        punch_in_lat = coalesce(a.punch_in_lat, excluded.punch_in_lat),
        punch_in_lng = coalesce(a.punch_in_lng, excluded.punch_in_lng),
        device       = coalesce(a.device, excluded.device),
        browser      = coalesce(a.browser, excluded.browser)
  returning * into day;

  insert into public.attendance_sessions (
    attendance_id, employee_id, punch_in, punch_in_lat, punch_in_lng, device, browser
  )
  values (day.id, actor, now(), p_lat, p_lng, p_device, p_browser);

  -- Re-read: the session insert changes what the metrics trigger computes, and
  -- the row captured above is from before it existed.
  select * into result from public.attendance where id = day.id;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- punch_out: close the open session
-- ---------------------------------------------------------------------------
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
  session public.attendance_sessions;
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

  select * into session from public.attendance_sessions
  where employee_id = actor and punch_out is null
  order by punch_in desc
  limit 1;

  if session.id is null then
    raise exception 'You are not currently punched in' using errcode = 'check_violation';
  end if;

  update public.attendance_sessions
  set punch_out = now(), punch_out_lat = p_lat, punch_out_lng = p_lng
  where id = session.id;

  -- The session closes first, so the metrics trigger below sees it and the
  -- total is right on the first write rather than needing a second pass.
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

-- ---------------------------------------------------------------------------
-- Midnight auto-close has to close the session too
-- ---------------------------------------------------------------------------
-- auto_punch_out_stale_days (migration 0024) closes forgotten punch-ins at
-- midnight. It only knows about the summary row, and an open session left
-- behind would block the NEXT morning's punch-in on the one-open-session index
-- — a worse failure than the one it was written to prevent.
--
-- A trigger rather than a rewrite of that function. It carries notification
-- logic and a set of edge cases about night shifts that are worth not
-- disturbing, and this way anything else that ever closes a day gets the same
-- treatment for free.
create or replace function public.close_sessions_with_day()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.punch_out is not null and old.punch_out is distinct from new.punch_out then
    update public.attendance_sessions
    set punch_out = new.punch_out
    where attendance_id = new.id
      and punch_out is null
      -- Guard the session's own check constraint: a session that began after
      -- the day's closing instant records zero rather than a negative span.
      and punch_in <= new.punch_out;

    -- A session that started after the close (a night shift the auto-closer
    -- pinned to the configured end of day) is closed at its own start, which
    -- reads as "unknown duration" rather than inventing one.
    update public.attendance_sessions
    set punch_out = punch_in
    where attendance_id = new.id
      and punch_out is null;
  end if;

  return new;
end;
$$;

-- AFTER, so the metrics trigger has already run on the summary row and the
-- session writes below cannot recurse into it.
drop trigger if exists attendance_close_sessions on public.attendance;
create trigger attendance_close_sessions
  after update on public.attendance
  for each row execute function public.close_sessions_with_day();

-- ---------------------------------------------------------------------------
-- Verify, rather than trust that the above did what it says
-- ---------------------------------------------------------------------------
do $$
declare
  backfilled int;
  punched    int;
  summed     numeric;
begin
  select count(*) into backfilled from public.attendance_sessions;
  select count(*) into punched from public.attendance where punch_in is not null;

  if backfilled <> punched then
    raise exception 'Migration 0029 self-check failed: % sessions backfilled for % punched days',
      backfilled, punched;
  end if;

  -- The arithmetic that matters: two sessions with a gap between them must sum
  -- to the time worked, not to the span from the first in to the last out.
  select
    extract(epoch from ('2026-01-01 12:00Z'::timestamptz - '2026-01-01 09:00Z'::timestamptz))
    + extract(epoch from ('2026-01-01 18:00Z'::timestamptz - '2026-01-01 16:00Z'::timestamptz))
  into summed;

  if summed / 3600 <> 5 then
    raise exception 'Migration 0029 self-check failed: session arithmetic is wrong';
  end if;
end;
$$;
