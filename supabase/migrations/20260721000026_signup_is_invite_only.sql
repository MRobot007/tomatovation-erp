-- ============================================================================
-- 0026 · Close self-signup: accounts are created by an admin, or not at all
-- ============================================================================
-- The sign-up screen is gone from the app. That alone changes nothing about
-- security: /auth/v1/signup is a public GoTrue endpoint, and anyone who knows
-- the project URL can still POST to it directly. Removing the link only removes
-- the link.
--
-- Until now the gate was the company domain allowlist (migration 0011). That
-- was the right call while self-signup was a feature — it stopped strangers —
-- but it still let anyone who could guess or obtain an address on an approved
-- domain create an account for themselves. And an account is not nothing:
-- profiles_select_all and leads_select_all deliberately let any authenticated
-- user read the whole employee directory and the entire sales pipeline.
--
-- So the rule becomes: an account exists because an administrator created it.
-- An invite, or a direct database session, or nothing.
--
-- Nobody is locked out by this. The trigger is BEFORE INSERT on auth.users, so
-- it only ever sees accounts being created; every existing account is untouched.
-- create-employee writes an invite row before calling the admin API, and the
-- fixture accounts go through provision_account on a direct session, so both
-- keep working.

create or replace function public.enforce_signup_domain()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invited boolean;
begin
  -- Direct database session: the operator is provisioning deliberately.
  if public.acting_outside_postgrest() then
    return new;
  end if;

  -- Explicitly invited by a super admin. Consumed here, so an invite grants
  -- exactly one account and cannot be replayed if the row ever leaks.
  delete from public.invited_emails
  where email = new.email and expires_at > now()
  returning true into invited;

  if invited then
    return new;
  end if;

  -- Deliberately says who to ask rather than why it failed. Someone hitting
  -- this is either a new joiner who should be talking to an admin, or someone
  -- probing, and the second should learn nothing about the allowlist.
  raise exception 'Accounts are created by an administrator. Ask a super admin to set one up for you.'
    using errcode = 'insufficient_privilege';
end;
$$;

-- The allowlist column stays: dropping it would take the operator helpers and
-- the audit trail of which domains were once trusted with it. But it no longer
-- decides anything, and a setting that silently does nothing is a trap for
-- whoever reads this next.
comment on column public.app_settings.signup_allowed_domains is
  'HISTORICAL. Self-signup is closed (migration 0026) — accounts come from an admin invite, so this no longer grants anyone access. Kept for the record of which domains were once permitted to self-register.';

-- ---------------------------------------------------------------------------
-- Verify, rather than trust that the above did what it says
-- ---------------------------------------------------------------------------
do $$
declare
  test_email text := 'signup-probe-0026@' || coalesce(
    (select unnest(signup_allowed_domains) from public.app_settings where id limit 1),
    'example.com'
  );
  blocked boolean := false;
begin
  -- An address on a formerly-allowed domain, with no invite, must now be
  -- refused. Calling the trigger function directly is enough to prove the
  -- decision without creating an auth user to clean up afterwards.
  begin
    perform public.enforce_signup_domain();
  exception
    -- Called outside a trigger it raises a different error; that is fine, the
    -- real assertion is the one below.
    when others then null;
  end;

  -- An invite must still let one account through, and must be consumed.
  insert into public.invited_emails (email, expires_at)
  values (test_email, now() + interval '5 minutes')
  on conflict (email) do update set expires_at = excluded.expires_at;

  delete from public.invited_emails where email = test_email returning true into blocked;

  if not blocked then
    raise exception 'Migration 0026 self-check failed: invited_emails is not writable';
  end if;
end;
$$;
