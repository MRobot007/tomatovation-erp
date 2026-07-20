-- ============================================================================
-- 0014 · provision_account must write empty strings, not NULL, for GoTrue
-- ============================================================================
-- Accounts created by 0013 existed and looked correct, but password sign-in
-- returned HTTP 500.
--
-- GoTrue scans confirmation_token, recovery_token, email_change and
-- email_change_token_new into non-nullable Go strings. The columns are
-- nullable in Postgres and have no default, so an INSERT that omits them
-- stores NULL — and the scan panics, surfacing as a 500 with no useful
-- message. Supabase's own signup path writes '' for all four.
--
-- This backfills the accounts already created and fixes the function.

update auth.users
set confirmation_token      = coalesce(confirmation_token, ''),
    recovery_token          = coalesce(recovery_token, ''),
    email_change            = coalesce(email_change, ''),
    email_change_token_new  = coalesce(email_change_token_new, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null;

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
    -- Empty strings, never NULL: GoTrue scans these four into non-nullable
    -- strings and panics with an opaque 500 on sign-in otherwise.
    confirmation_token, recovery_token, email_change, email_change_token_new,
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
    '', '', '', '',
    now(),
    now()
  );

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
