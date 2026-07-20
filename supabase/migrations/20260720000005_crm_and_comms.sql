-- ============================================================================
-- 0005 · leads, lead_activities, announcements, notifications, audit_logs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id            uuid primary key default extensions.gen_random_uuid(),
  company       text not null check (length(btrim(company)) between 1 and 160),
  contact_name  text check (contact_name is null or length(btrim(contact_name)) between 1 and 120),
  phone         text check (phone is null or phone ~ '^[0-9+\-\s()]{6,20}$'),
  email         extensions.citext check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  source        public.lead_source not null default 'other',
  assigned_to   uuid references public.profiles (id) on delete set null,
  status        public.lead_status not null default 'new',
  priority      public.lead_priority not null default 'medium',

  value_estimate numeric(12, 2) check (value_estimate is null or value_estimate >= 0),
  remarks       text check (remarks is null or length(remarks) <= 4000),
  next_followup date,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz,

  constraint leads_closed_consistency check (
    (status in ('won', 'lost') and closed_at is not null)
    or (status not in ('won', 'lost') and closed_at is null)
  )
);

create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_status_idx on public.leads (status);
create index leads_priority_idx on public.leads (priority);
create index leads_source_idx on public.leads (source);
create index leads_created_at_idx on public.leads (created_at desc);
-- Drives the "Follow-ups due today" widget, which is the hottest CRM query.
create index leads_assigned_followup_idx on public.leads (assigned_to, next_followup)
  where status not in ('won', 'lost');

create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

create or replace function public.sync_lead_closure()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('won', 'lost') and new.closed_at is null then
    new.closed_at := now();
  elsif new.status not in ('won', 'lost') then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger leads_sync_closure
  before insert or update of status on public.leads
  for each row execute function public.sync_lead_closure();

-- ---------------------------------------------------------------------------
-- Lead activity timeline
-- ---------------------------------------------------------------------------
create table public.lead_activities (
  id          uuid primary key default extensions.gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  employee_id uuid references public.profiles (id) on delete set null,

  activity    public.lead_activity_kind not null default 'note',
  remarks     text check (remarks is null or length(remarks) <= 4000),

  -- Populated by the status-change trigger so the timeline can render
  -- "Qualified -> Proposal" without joining back to an audit table.
  from_status public.lead_status,
  to_status   public.lead_status,

  created_at  timestamptz not null default now()
);

-- Timeline renders newest first, always scoped to one lead.
create index lead_activities_lead_created_idx
  on public.lead_activities (lead_id, created_at desc);
create index lead_activities_employee_id_idx on public.lead_activities (employee_id);

-- Status transitions write their own timeline entry. Leaving this to the client
-- means the history silently loses any change made outside the detail page.
create or replace function public.log_lead_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_activities (lead_id, employee_id, activity, from_status, to_status, remarks)
    values (
      new.id, (select auth.uid()), 'status_change', old.status, new.status,
      format('Status changed from %s to %s', old.status, new.status)
    );
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_activities (lead_id, employee_id, activity, remarks)
    values (new.id, (select auth.uid()), 'assignment', 'Lead reassigned');
  end if;

  return new;
end;
$$;

create trigger leads_log_status_change
  after update on public.leads
  for each row execute function public.log_lead_status_change();

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table public.announcements (
  id         uuid primary key default extensions.gen_random_uuid(),
  title      text not null check (length(btrim(title)) between 1 and 200),
  message    text not null check (length(btrim(message)) between 1 and 8000),
  created_by uuid references public.profiles (id) on delete set null,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_created_at_idx on public.announcements (created_at desc);
create index announcements_created_by_idx on public.announcements (created_by);

create trigger announcements_touch_updated_at
  before update on public.announcements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null check (length(btrim(title)) between 1 and 200),
  message    text check (message is null or length(message) <= 2000),
  type       public.notification_type not null,

  -- Deep link target, e.g. '/leads/<uuid>'. Relative only.
  link       text check (link is null or link ~ '^/'),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- Partial index: the bell badge only ever counts unread rows, so indexing the
-- read ones wastes writes on a table that grows constantly.
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc)
  where not read;
create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  action     public.audit_action not null,
  module     text not null check (length(btrim(module)) between 1 and 80),
  record_id  uuid,
  old_data   jsonb,
  new_data   jsonb,
  ip_address inet,
  browser    text check (browser is null or length(browser) <= 200),
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_user_id_idx on public.audit_logs (user_id, created_at desc);
create index audit_logs_module_idx on public.audit_logs (module, created_at desc);
create index audit_logs_record_id_idx on public.audit_logs (record_id);

-- ===========================================================================
-- Generic audit trigger
-- ===========================================================================
-- SECURITY DEFINER so it can always write, even where the acting user has no
-- direct insert grant. The audit trail must not be defeatable by the same
-- permissions it exists to police.
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acting    uuid := (select auth.uid());
  new_json  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  old_json  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  raw_id    text := coalesce(new_json ->> 'id', old_json ->> 'id');
  target_id uuid;
begin
  -- Not every audited table keys on a uuid: app_settings uses a boolean
  -- singleton primary key. Extract via jsonb and only cast when the value
  -- actually looks like a uuid, so a non-uuid key logs as null instead of
  -- aborting the user's write with a cast error.
  if raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    target_id := raw_id::uuid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_logs (user_id, action, module, record_id, new_data)
    values (acting, 'insert', tg_table_name, target_id, new_json);
    return new;

  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (user_id, action, module, record_id, old_data, new_data)
    values (acting, 'update', tg_table_name, target_id, old_json, new_json);
    return new;

  else
    insert into public.audit_logs (user_id, action, module, record_id, old_data)
    values (acting, 'delete', tg_table_name, target_id, old_json);
    return old;
  end if;
end;
$$;

-- Attached to the tables whose changes carry real consequences. Attendance is
-- deliberately excluded: it changes many times a day per employee and would
-- swamp the log without adding signal beyond the row's own history.
create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.record_audit();

create trigger leaves_audit
  after insert or update or delete on public.leaves
  for each row execute function public.record_audit();

create trigger leads_audit
  after insert or update or delete on public.leads
  for each row execute function public.record_audit();

create trigger tasks_audit
  after insert or update or delete on public.tasks
  for each row execute function public.record_audit();

create trigger app_settings_audit
  after update on public.app_settings
  for each row execute function public.record_audit();
