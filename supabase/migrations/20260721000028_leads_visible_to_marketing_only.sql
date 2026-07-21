-- ============================================================================
-- 0028 · The pipeline is for the people who work it
-- ============================================================================
-- leads_select_all let every authenticated user read the entire pipeline —
-- every company, contact, deal value and note. That was a deliberate call at
-- the time ("marketing is collaborative"), and it is the wrong one: an
-- engineer has no reason to see what a customer is being quoted, and a leaver
-- with an account still open has every reason not to.
--
-- Access is now: managers and super admins, plus employees in a department
-- flagged for it. Marketing is flagged; Tech is not.
--
-- The flag lives on the department rather than being a hardcoded 'Marketing'
-- string in the policy. Departments get created from the UI by any manager, so
-- a policy naming one would be a policy that silently stops matching the day
-- somebody types "Marketing Team".

alter table public.departments
  add column if not exists has_crm_access boolean not null default false;

comment on column public.departments.has_crm_access is
  'Whether employees in this department can see the sales pipeline. Managers and super admins always can, regardless of department.';

update public.departments
set has_crm_access = true
where lower(name::text) in ('marketing', 'sales');

-- ---------------------------------------------------------------------------
-- The rule, in one place
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because it reads profiles and departments while deciding
-- whether the caller may read leads. Left as invoker it would be subject to
-- the very policies it is being used to evaluate.
--
-- session_user, not current_user: inside a SECURITY DEFINER function
-- current_user is the function OWNER, which silently makes any check against
-- it true. That mistake cost a whole afternoon in migration 0009 and is not
-- being repeated.
create or replace function public.can_access_leads()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_manager()
    or exists (
      select 1
      from public.profiles p
      join public.departments d
        -- lower() on both sides rather than relying on citext equality: the
        -- citext operators live in the extensions schema, which is not on this
        -- function's search_path, so `=` would silently compare
        -- case-SENSITIVELY. Migration 0027 shipped that bug twice.
        on lower(d.name::text) = lower(btrim(p.department))
      where p.id = (select auth.uid())
        and d.has_crm_access
    );
$$;

comment on function public.can_access_leads is
  'True for managers, super admins, and employees whose department has_crm_access. The single definition of pipeline visibility.';

-- ---------------------------------------------------------------------------
-- Apply it
-- ---------------------------------------------------------------------------
drop policy if exists leads_select_all on public.leads;

create policy leads_select_permitted
  on public.leads for select
  to authenticated
  using (public.can_access_leads());

-- Creating a lead you would not then be allowed to read is not a useful
-- capability, and leaving insert open would let someone outside marketing
-- write into a table they cannot see.
drop policy if exists leads_insert_authenticated on public.leads;

create policy leads_insert_permitted
  on public.leads for insert
  to authenticated
  with check (created_by = (select auth.uid()) and public.can_access_leads());

drop policy if exists leads_update_assignee on public.leads;

create policy leads_update_permitted
  on public.leads for update
  to authenticated
  using (
    public.can_access_leads()
    and (
      assigned_to = (select auth.uid())
      or created_by = (select auth.uid())
      or public.is_manager()
    )
  )
  with check (
    public.can_access_leads()
    and (
      assigned_to = (select auth.uid())
      or created_by = (select auth.uid())
      or public.is_manager()
    )
  );

-- ---------------------------------------------------------------------------
-- The activity timeline carries the same information
-- ---------------------------------------------------------------------------
-- Call notes and meeting summaries are the pipeline in prose. Restricting the
-- leads table while leaving this open would close the front door and leave the
-- window off the latch.
drop policy if exists lead_activities_select_all on public.lead_activities;

create policy lead_activities_select_permitted
  on public.lead_activities for select
  to authenticated
  using (public.can_access_leads());

drop policy if exists lead_activities_insert_authenticated on public.lead_activities;

create policy lead_activities_insert_permitted
  on public.lead_activities for insert
  to authenticated
  with check (employee_id = (select auth.uid()) and public.can_access_leads());

-- ---------------------------------------------------------------------------
-- Verify, rather than trust that the above did what it says
-- ---------------------------------------------------------------------------
do $$
declare
  marketing_flagged boolean;
  tech_flagged      boolean;
  open_policies     int;
begin
  select has_crm_access into marketing_flagged
  from public.departments where lower(name::text) = 'marketing';

  if marketing_flagged is not true then
    raise exception 'Migration 0028 self-check failed: Marketing does not have CRM access';
  end if;

  select coalesce(bool_or(has_crm_access), false) into tech_flagged
  from public.departments where lower(name::text) = 'tech';

  if tech_flagged then
    raise exception 'Migration 0028 self-check failed: Tech should NOT have CRM access';
  end if;

  -- No policy on either table may still be unconditional. A leftover
  -- `using (true)` would make everything above decorative.
  select count(*) into open_policies
  from pg_policies
  where schemaname = 'public'
    and tablename in ('leads', 'lead_activities')
    and cmd = 'SELECT'
    and coalesce(qual, '') = 'true';

  if open_policies > 0 then
    raise exception 'Migration 0028 self-check failed: % unconditional SELECT policy(ies) remain on the pipeline', open_policies;
  end if;
end;
$$;
