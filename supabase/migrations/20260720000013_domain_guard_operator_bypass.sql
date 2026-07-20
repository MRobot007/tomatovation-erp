-- ============================================================================
-- 0013 · Let operators provision accounts regardless of the allowlist
-- ============================================================================
-- enforce_signup_domain shipped in 0012 without the operator escape hatch every
-- other guard in this schema has. That made it impossible to create an account
-- outside the allowlist even from a direct database session — including the
-- test fixtures the live suites sign into, and any legitimate exception such as
-- a contractor or an auditor.
--
-- Same reasoning as acting_outside_postgrest() elsewhere: a session connected
-- as postgres already owns every table, so a trigger blocking it was never
-- security, only an obstacle. Signups over the API are still restricted.

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
  -- Direct database session: the operator is provisioning deliberately.
  if public.acting_outside_postgrest() then
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
-- Operator account provisioning
-- ---------------------------------------------------------------------------
-- Creates a confirmed account directly, bypassing the API and the allowlist.
-- This is how test fixtures and one-off exceptions are made without weakening
-- the allowlist for everyone.
--
-- Not granted to anon or authenticated: it mints credentials, so it belongs to
-- the SQL Editor and nowhere else.
create or replace function public.provision_account(
  p_email    text,
  p_password text,
  p_name     text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  new_id uuid;
begin
  if not public.acting_outside_postgrest() then
    raise exception 'provision_account may only be called from a direct database session'
      using errcode = 'insufficient_privilege';
  end if;

  select id into new_id from auth.users where email = lower(btrim(p_email));
  if new_id is not null then
    return new_id;
  end if;

  new_id := extensions.gen_random_uuid();

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(btrim(p_email)),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name),
    now(),
    now()
  );

  -- GoTrue requires a matching identity row, or password sign-in fails with
  -- "Invalid login credentials" despite the user existing.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  values (
    extensions.gen_random_uuid(),
    new_id,
    new_id::text,
    jsonb_build_object('sub', new_id::text, 'email', lower(btrim(p_email)), 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  return new_id;
end;
$$;

revoke all on function public.provision_account(text, text, text) from public, anon, authenticated;
