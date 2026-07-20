-- ============================================================================
-- 0007 · Notification triggers, realtime publication, storage buckets
-- ============================================================================

-- ===========================================================================
-- Notification fan-out
-- ===========================================================================
-- Notifications are raised by the database, not the client. A browser that
-- crashes between "approve leave" and "insert notification" would otherwise
-- leave the employee never told. In a trigger it is the same transaction.

create or replace function public.notify(
  p_user_id uuid,
  p_title   text,
  p_message text,
  p_type    public.notification_type,
  p_link    text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Never notify someone about their own action; it is noise.
  if p_user_id is null or p_user_id = (select auth.uid()) then
    return;
  end if;

  insert into public.notifications (user_id, title, message, type, link)
  values (p_user_id, p_title, p_message, p_type, p_link);
end;
$$;

-- --- Task assigned ---------------------------------------------------------
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to then
    perform public.notify(
      new.assigned_to,
      'New task assigned',
      new.title,
      'task_assigned',
      '/tasks?highlight=' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger tasks_notify_assigned
  after insert or update of assigned_to on public.tasks
  for each row execute function public.notify_task_assigned();

-- --- Leave requested / decided --------------------------------------------
create or replace function public.notify_leave_requested()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  approver uuid;
begin
  select manager_id into approver from public.profiles where id = new.employee_id;

  perform public.notify(
    approver,
    'Leave request awaiting approval',
    format('%s to %s', new.start_date, new.end_date),
    'leave_requested',
    '/leaves?highlight=' || new.id
  );

  return new;
end;
$$;

create trigger leaves_notify_requested
  after insert on public.leaves
  for each row execute function public.notify_leave_requested();

create or replace function public.notify_leave_decided()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify(
      new.employee_id,
      case when new.status = 'approved' then 'Leave approved' else 'Leave rejected' end,
      format('%s to %s', new.start_date, new.end_date),
      case when new.status = 'approved' then 'leave_approved'::public.notification_type
           else 'leave_rejected'::public.notification_type end,
      '/leaves?highlight=' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger leaves_notify_decided
  after update of status on public.leaves
  for each row execute function public.notify_leave_decided();

-- --- Lead assigned ---------------------------------------------------------
create or replace function public.notify_lead_assigned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(
      new.assigned_to,
      'Lead assigned to you',
      new.company,
      'lead_assigned',
      '/leads/' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger leads_notify_assigned
  after insert or update of assigned_to on public.leads
  for each row execute function public.notify_lead_assigned();

-- --- Work log reviewed -----------------------------------------------------
create or replace function public.notify_work_log_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.reviewed_at is not null and old.reviewed_at is null then
    perform public.notify(
      new.employee_id,
      'Work log reviewed',
      coalesce(new.review_comment, new.project),
      'work_log_reviewed',
      '/work-logs?highlight=' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger work_logs_notify_reviewed
  after update on public.work_logs
  for each row execute function public.notify_work_log_reviewed();

-- --- Announcement published ------------------------------------------------
-- Fans out to every active employee. At the spec's ceiling of 500 staff this is
-- a single set-based insert, not a loop.
create or replace function public.notify_announcement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not new.published then
    return new;
  end if;

  insert into public.notifications (user_id, title, message, type, link)
  select p.id, new.title, left(new.message, 200), 'announcement', '/announcements'
  from public.profiles p
  where p.status = 'active'
    and p.id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end;
$$;

create trigger announcements_notify
  after insert on public.announcements
  for each row execute function public.notify_announcement();

-- ===========================================================================
-- Scheduled reminders
-- ===========================================================================
-- Called by pg_cron or an Edge Function on a schedule. Kept as RPCs so the
-- schedule can change without a migration.

-- Follow-ups due today, for the assignee.
create or replace function public.dispatch_followup_reminders()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg    public.app_settings;
  today  date;
  sent   int;
begin
  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  with due as (
    insert into public.notifications (user_id, title, message, type, link)
    select l.assigned_to,
           'Follow-up due today',
           l.company,
           'followup_due',
           '/leads/' || l.id
    from public.leads l
    where l.next_followup = today
      and l.assigned_to is not null
      and l.status not in ('won', 'lost')
      -- Idempotent: safe to run repeatedly without spamming.
      and not exists (
        select 1 from public.notifications n
        where n.user_id = l.assigned_to
          and n.type = 'followup_due'
          and n.link = '/leads/' || l.id
          and n.created_at >= today::timestamptz
      )
    returning 1
  )
  select count(*)::int into sent from due;

  return sent;
end;
$$;

-- Anyone still clocked in past the configured cutoff.
create or replace function public.dispatch_punch_out_reminders()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg   public.app_settings;
  today date;
  sent  int;
begin
  select * into cfg from public.app_settings where id;
  today := (now() at time zone cfg.timezone)::date;

  with stale as (
    insert into public.notifications (user_id, title, message, type, link)
    select a.employee_id,
           'Don''t forget to punch out',
           format('You have been clocked in since %s',
                  to_char(a.punch_in at time zone cfg.timezone, 'HH12:MI AM')),
           'punch_out_reminder',
           '/attendance/me'
    from public.attendance a
    where a.date = today
      and a.punch_in is not null
      and a.punch_out is null
      and a.punch_in < now() - make_interval(mins => cfg.auto_punch_out_after)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = a.employee_id
          and n.type = 'punch_out_reminder'
          and n.created_at >= today::timestamptz
      )
    returning 1
  )
  select count(*)::int into sent from stale;

  return sent;
end;
$$;

-- ===========================================================================
-- Realtime
-- ===========================================================================
-- Only notifications and attendance are published. Adding every table would
-- stream every employee's row changes to every connected client and let RLS do
-- the filtering after the fact — wasteful, and a wider surface than needed.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.attendance;

-- ===========================================================================
-- Storage
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('attachments', 'attachments', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

-- --- avatars: public read, own-folder write --------------------------------
-- Objects are keyed '<user-id>/<filename>', so the first path segment is the
-- owner. Comparing it to auth.uid() stops anyone overwriting another
-- employee's photo.
create policy avatars_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- --- attachments: private, scoped to owner and their chain -----------------
-- The uuid cast is guarded: an object whose first path segment is not a uuid
-- would otherwise raise 22P02 and fail the entire listing, not just skip
-- that row. Malformed keys are simply invisible instead.
create policy attachments_read_scoped
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_access_employee(((storage.foldername(name))[1])::uuid)
  );

create policy attachments_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy attachments_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
