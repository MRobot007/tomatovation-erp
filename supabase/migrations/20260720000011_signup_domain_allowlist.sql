-- ============================================================================
-- 0011 · Restrict signup to company email domains
-- ============================================================================
-- Going live with open signup is a breach vector, not a convenience.
--
-- profiles_select_all and leads_select_all deliberately let any authenticated
-- user read the employee directory and the whole pipeline — assignee pickers,
-- org charts and shared marketing all need that. The assumption underneath is
-- that "authenticated" means "works here".
--
-- With public signup enabled and email auto-confirm on, that assumption does
-- not hold: anyone who finds the URL can create an account and immediately read
-- every employee's name, email and department, plus every lead, its contact
-- details and its value.
--
-- This closes the gap at the door instead of weakening the read policies, which
-- would break the features that depend on them.

alter table public.app_settings
  add column if not exists signup_allowed_domains text[] not null default '{}';

comment on column public.app_settings.signup_allowed_domains is
  'Email domains permitted to self-register. Empty array means signup is closed to everyone except existing accounts.';

-- Seed from the domains already in use by real (non-test) accounts, so this
-- migration cannot lock out the people currently using the system.
update public.app_settings
set signup_allowed_domains = coalesce(
  (
    select array_agg(distinct split_part(email::text, '@', 2))
    from public.profiles
    where email::text not like '%@example.com'
  ),
  '{}'
)
where id;

-- ---------------------------------------------------------------------------
-- Enforcement
-- ---------------------------------------------------------------------------
create or replace function public.enforce_signup_domain()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed text[];
  domain  text;
begin
  select signup_allowed_domains into allowed from public.app_settings where id;

  -- An empty allowlist means the check is not configured. Fail open here
  -- rather than bricking authentication for an operator who has not set it —
  -- the deployment checklist covers configuring it.
  if allowed is null or cardinality(allowed) = 0 then
    return new;
  end if;

  domain := lower(split_part(new.email, '@', 2));

  if not (domain = any (allowed)) then
    raise exception 'Sign-up is restricted to approved company email domains.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- BEFORE INSERT on auth.users, so a rejected signup never creates the auth row
-- at all — no orphan for handle_new_user to build a profile from.
drop trigger if exists on_auth_user_domain_check on auth.users;
create trigger on_auth_user_domain_check
  before insert on auth.users
  for each row execute function public.enforce_signup_domain();

-- ---------------------------------------------------------------------------
-- Operator helper
-- ---------------------------------------------------------------------------
-- Managing a text[] through the settings UI is awkward, and getting it wrong
-- locks staff out. These make the common operations explicit and safe.
create or replace function public.allow_signup_domain(p_domain text)
returns text[]
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  result text[];
begin
  if not public.is_super_admin() and not public.acting_outside_postgrest() then
    raise exception 'Only a super admin may change the signup allowlist'
      using errcode = 'insufficient_privilege';
  end if;

  update public.app_settings
  set signup_allowed_domains =
    array(select distinct unnest(signup_allowed_domains || lower(btrim(p_domain))))
  where id
  returning signup_allowed_domains into result;

  return result;
end;
$$;

create or replace function public.revoke_signup_domain(p_domain text)
returns text[]
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  result text[];
begin
  if not public.is_super_admin() and not public.acting_outside_postgrest() then
    raise exception 'Only a super admin may change the signup allowlist'
      using errcode = 'insufficient_privilege';
  end if;

  update public.app_settings
  set signup_allowed_domains = array_remove(signup_allowed_domains, lower(btrim(p_domain)))
  where id
  returning signup_allowed_domains into result;

  return result;
end;
$$;

do $$
declare
  domains text[];
begin
  select signup_allowed_domains into domains from public.app_settings where id;
  raise notice 'Signup restricted to: %', coalesce(array_to_string(domains, ', '), '(open)');
end;
$$;
