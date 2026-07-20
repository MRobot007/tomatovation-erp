-- ============================================================================
-- 0002 · profiles — the spine of the whole authorisation model
-- ============================================================================
-- Every RLS policy in this schema resolves back to profiles.role and
-- profiles.manager_id, so the constraints here are load-bearing security, not
-- data hygiene.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 120),
  email         extensions.citext not null unique,
  role          public.user_role not null default 'employee',
  department    text check (department is null or length(btrim(department)) between 1 and 80),
  manager_id    uuid references public.profiles (id) on delete set null,
  phone         text check (phone is null or phone ~ '^[0-9+\-\s()]{6,20}$'),
  profile_photo text,
  status        public.employee_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Nobody reports to themselves. Deeper cycles are caught by the trigger below.
  constraint profiles_no_self_manage check (manager_id is null or manager_id <> id)
);

comment on table public.profiles is
  'One row per authenticated user. role and manager_id drive every RLS policy.';

create index profiles_manager_id_idx on public.profiles (manager_id);
create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status) where status = 'active';
create index profiles_department_idx on public.profiles (department);

-- ---------------------------------------------------------------------------
-- updated_at maintenance, shared by every table that carries the column
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Reporting-line cycle guard
-- ---------------------------------------------------------------------------
-- A -> B -> C -> A would make the manager-visibility recursion below run
-- forever. Reject the write instead of relying on a depth cap to paper over it.
create or replace function public.prevent_manager_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cursor_id uuid := new.manager_id;
  hops int := 0;
begin
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Reporting line would form a cycle for profile %', new.id
        using errcode = 'check_violation';
    end if;

    hops := hops + 1;
    if hops > 64 then
      raise exception 'Reporting line exceeds the maximum supported depth'
        using errcode = 'check_violation';
    end if;

    select manager_id into cursor_id from public.profiles where id = cursor_id;
  end loop;

  return new;
end;
$$;

create trigger profiles_prevent_manager_cycle
  before insert or update of manager_id on public.profiles
  for each row when (new.manager_id is not null)
  execute function public.prevent_manager_cycle();

-- ===========================================================================
-- Authorisation helpers
-- ===========================================================================
-- These are SECURITY DEFINER on purpose. A policy on profiles that itself
-- queries profiles re-enters RLS and deadlocks into infinite recursion
-- (Postgres raises 42P17). Running the lookup as the definer bypasses RLS for
-- that one read and breaks the cycle.
--
-- Each is STABLE so the planner evaluates it once per statement rather than
-- per row, and each pins search_path so a hostile temp schema cannot shadow
-- the tables they read.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role in ('manager', 'super_admin') from public.profiles where id = (select auth.uid())),
    false
  );
$$;

-- Direct reports only — the spec scopes managers to profiles.manager_id =
-- auth.uid(), not to the whole subtree beneath them.
create or replace function public.manages(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select manager_id = (select auth.uid()) from public.profiles where id = target),
    false
  );
$$;

-- The single predicate every employee-scoped table reuses.
create or replace function public.can_access_employee(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    target = (select auth.uid())
    or public.is_super_admin()
    or public.manages(target);
$$;

-- ===========================================================================
-- Privilege-escalation guard
-- ===========================================================================
-- The UPDATE policy below lets a user edit their own profile so they can fix
-- their phone or photo. Without this trigger that same policy would let them
-- set role = 'super_admin'. Policies cannot compare OLD to NEW, so the check
-- has to live in a trigger.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only a super admin may change a role'
      using errcode = 'insufficient_privilege';
  end if;

  if new.manager_id is distinct from old.manager_id then
    raise exception 'Only a super admin may change a reporting line'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Only a super admin may change employment status'
      using errcode = 'insufficient_privilege';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Email is managed by authentication and cannot be edited here'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ===========================================================================
-- Provisioning: auth.users -> profiles
-- ===========================================================================
-- Without this, a user can authenticate but has no profile row, so every
-- policy denies them and the app looks broken rather than empty. Runs as
-- definer because the inserting session is not yet authenticated as anyone.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    -- Role is never taken from user-supplied metadata: signup metadata is
    -- attacker-controlled, and trusting it here would hand out super_admin.
    'employee'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
