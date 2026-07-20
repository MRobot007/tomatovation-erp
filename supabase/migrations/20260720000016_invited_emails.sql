-- ============================================================================
-- 0016 · Admin-provisioned accounts bypass the signup domain allowlist
-- ============================================================================
-- A super admin creating an account for `someone@gmail.com` was refused by
-- enforce_signup_domain, which is wrong: the allowlist exists to stop strangers
-- SELF-registering, not to stop an admin deliberately onboarding a contractor,
-- an auditor, or anyone else on an outside address.
--
-- The trigger cannot tell the two apart by database role. Both the public
-- /auth/v1/signup endpoint and the admin createUser API are GoTrue, so both
-- arrive as supabase_auth_admin. Exempting that role would disable the check
-- for public signup too — which is the entire point of having it.
--
-- So the intent is recorded out of band. The create-employee Edge Function
-- holds the service_role key and writes an invite row before creating the user;
-- the trigger accepts any email that has one. A stranger hitting /signup has no
-- invite and is still refused.
--
-- Invites are single-use and expire, so a leaked row cannot become a permanent
-- hole in the allowlist.

create table public.invited_emails (
  email       extensions.citext primary key,
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days'
);

comment on table public.invited_emails is
  'Emails a super admin has explicitly provisioned. Consumed on signup, so an invite grants exactly one account.';

create index invited_emails_expires_at_idx on public.invited_emails (expires_at);

alter table public.invited_emails enable row level security;

-- Visible and manageable only by a super admin. The Edge Function writes with
-- the service_role key, which bypasses RLS entirely, so it needs no policy.
create policy invited_emails_select_admin
  on public.invited_emails for select
  to authenticated
  using (public.is_super_admin());

create policy invited_emails_insert_admin
  on public.invited_emails for insert
  to authenticated
  with check (public.is_super_admin());

create policy invited_emails_delete_admin
  on public.invited_emails for delete
  to authenticated
  using (public.is_super_admin());

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
  invited boolean;
begin
  -- Direct database session: the operator is provisioning deliberately.
  if public.acting_outside_postgrest() then
    return new;
  end if;

  -- Explicitly invited by a super admin. Consumed here so the invite grants
  -- exactly one account and cannot be reused if the row ever leaks.
  delete from public.invited_emails
  where email = new.email and expires_at > now()
  returning true into invited;

  if invited then
    return new;
  end if;

  select signup_allowed_domains into allowed from public.app_settings where id;

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

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_invites()
returns int
language sql
security definer
set search_path = public, pg_temp
as $$
  with removed as (
    delete from public.invited_emails where expires_at <= now() returning 1
  )
  select count(*)::int from removed;
$$;

do $$
begin
  perform cron.unschedule('erp-purge-invites');
exception
  when others then null;
end;
$$;

select cron.schedule('erp-purge-invites', '0 3 * * *', $$select public.purge_expired_invites()$$);
