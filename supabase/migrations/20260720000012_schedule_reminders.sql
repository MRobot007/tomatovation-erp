-- ============================================================================
-- 0012 · Schedule the reminder jobs
-- ============================================================================
-- dispatch_followup_reminders() and dispatch_punch_out_reminders() have existed
-- since migration 0007 but nothing ever called them, so two features the spec
-- asked for — follow-up reminders and the punch-out nudge — were inert.
--
-- Both RPCs are idempotent: each checks for an existing notification of the
-- same type for the same target today before inserting. That is what makes a
-- schedule safe. A retry, an overlapping run, or a manual invocation cannot
-- produce duplicates.
--
-- Cron times are UTC. The organisation runs on Asia/Kolkata (UTC+5:30), so the
-- expressions below are offset accordingly rather than written in local time
-- and quietly firing five and a half hours early.

create extension if not exists pg_cron with schema pg_catalog;

-- Unschedule first so re-running this migration does not stack duplicate jobs.
do $$
begin
  perform cron.unschedule('erp-followup-reminders');
exception
  when others then null; -- not scheduled yet
end;
$$;

do $$
begin
  perform cron.unschedule('erp-punch-out-reminders');
exception
  when others then null;
end;
$$;

-- --- Follow-ups ------------------------------------------------------------
-- 09:30 IST = 04:00 UTC. Fires once, at the start of the working day, so the
-- owner sees the day's follow-ups before making other plans.
select cron.schedule(
  'erp-followup-reminders',
  '0 4 * * 1-5',
  $$select public.dispatch_followup_reminders()$$
);

-- --- Punch-out nudge -------------------------------------------------------
-- Hourly. The RPC itself decides who is overdue, using
-- app_settings.auto_punch_out_after, so the cadence here only controls how
-- promptly the nudge arrives — not the threshold.
select cron.schedule(
  'erp-punch-out-reminders',
  '0 * * * *',
  $$select public.dispatch_punch_out_reminders()$$
);

do $$
declare
  jobs text;
begin
  select string_agg(jobname || ' (' || schedule || ')', ', ' order by jobname)
  into jobs
  from cron.job
  where jobname like 'erp-%';

  raise notice 'Scheduled: %', coalesce(jobs, '(none)');
end;
$$;
