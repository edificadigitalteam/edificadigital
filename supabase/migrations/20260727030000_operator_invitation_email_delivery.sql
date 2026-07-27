-- Phase 2b: actually deliver the activation/invitation email.
--
-- private.notify_operator_invitation() calls a Supabase Edge Function via
-- pg_net so the activation token never passes through any browser. It reads
-- the Edge Function's base URL and an authenticating key from Supabase
-- Vault (secrets named 'project_url' and 'service_role_key', configured by
-- the project owner directly in the Dashboard — never seen by this
-- migration). If either secret is missing (e.g. local/dev environments),
-- the call is skipped silently — invitation delivery is best-effort and
-- must never block organization/operator creation.

create extension if not exists pg_net;

create or replace function private.notify_operator_invitation(target_operator_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target private.operator_access%rowtype;
  target_organization_name text;
  base_url text;
  auth_key text;
begin
  select * into target
  from private.operator_access
  where id = target_operator_id;

  if target.id is null or target.activation_token is null then
    return;
  end if;

  select organization.name into target_organization_name
  from public.organization organization
  where organization.id = target.organization_id;

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into auth_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if base_url is null or auth_key is null then
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/send-operator-invitation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || auth_key
    ),
    body := jsonb_build_object(
      'email', target.email,
      'display_name', target.display_name,
      'activation_token', target.activation_token,
      'organization_name', target_organization_name
    )
  );
exception when others then
  -- Never let email delivery block the transaction that created/updated the operator.
  return;
end;
$$;

revoke all on function private.notify_operator_invitation(uuid) from public, anon, authenticated;

-- Wire the notification into the three places an activation token is (re)issued.

create or replace function public.admin_save_organization(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  saved public.organization%rowtype;
  is_new_organization boolean;
  new_admin_operator_id uuid;
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid organization identifier.';
  end;

  is_new_organization := target_id is null;

  if is_new_organization then
    insert into public.organization (
      code, name, legal_name, tax_id, country, city,
      contact_email, contact_phone, subscription_status, active
    ) values (
      lower(trim(payload ->> 'code')),
      trim(payload ->> 'name'),
      nullif(trim(payload ->> 'legal_name'), ''),
      nullif(trim(payload ->> 'tax_id'), ''),
      nullif(trim(payload ->> 'country'), ''),
      nullif(trim(payload ->> 'city'), ''),
      lower(trim(payload ->> 'contact_email')),
      nullif(trim(payload ->> 'contact_phone'), ''),
      coalesce(nullif(payload ->> 'subscription_status', ''), 'trial'),
      coalesce((payload ->> 'active')::boolean, true)
    ) returning * into saved;
  else
    update public.organization
    set code = lower(trim(payload ->> 'code')),
        name = trim(payload ->> 'name'),
        legal_name = nullif(trim(payload ->> 'legal_name'), ''),
        tax_id = nullif(trim(payload ->> 'tax_id'), ''),
        country = nullif(trim(payload ->> 'country'), ''),
        city = nullif(trim(payload ->> 'city'), ''),
        contact_email = lower(trim(payload ->> 'contact_email')),
        contact_phone = nullif(trim(payload ->> 'contact_phone'), ''),
        subscription_status = coalesce(nullif(payload ->> 'subscription_status', ''), 'trial'),
        active = coalesce((payload ->> 'active')::boolean, true),
        updated_at = now()
    where id = target_id
    returning * into saved;
  end if;

  if saved.id is null then
    raise exception using errcode = 'P0002', message = 'Organization was not found.';
  end if;

  if is_new_organization then
    insert into private.operator_access (
      email, display_name, role, organization_id, active,
      activation_token, activation_token_expires_at
    ) values (
      saved.contact_email, 'Admin', 'admin', saved.id, true,
      gen_random_uuid(), now() + interval '7 days'
    )
    returning id into new_admin_operator_id;

    perform private.notify_operator_invitation(new_admin_operator_id);
  end if;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.admin_save_organization(jsonb) from public, anon;
grant execute on function public.admin_save_organization(jsonb) to authenticated;

create or replace function public.admin_save_operator_access(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_operator_role text;
  caller_organization_id uuid;
  target_id uuid;
  target_email text;
  target_name text;
  target_role text;
  target_active boolean;
  target_organization_id uuid;
  existing_role text;
  existing_organization_id uuid;
  is_new_operator boolean;
  saved private.operator_access%rowtype;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select access.role, access.organization_id
  into caller_operator_role, caller_organization_id
  from private.operator_access access
  where access.active and lower(access.email) = caller_email
  limit 1;

  if caller_operator_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
    target_organization_id := nullif(payload ->> 'organization_id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid identifier.';
  end;

  is_new_operator := target_id is null;

  target_email := lower(trim(coalesce(payload ->> 'email', '')));
  target_name := trim(coalesce(payload ->> 'display_name', ''));
  target_role := coalesce(nullif(payload ->> 'role', ''), 'operator');
  target_active := coalesce((payload ->> 'active')::boolean, true);

  if target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'A valid email is required.';
  end if;
  if target_name = '' then
    raise exception using errcode = '22023', message = 'Display name is required.';
  end if;
  if target_role not in ('operator', 'admin', 'super_admin') then
    raise exception using errcode = '22023', message = 'Invalid operator role.';
  end if;

  if caller_operator_role = 'admin' then
    target_role := 'operator';
    target_organization_id := caller_organization_id;
  end if;

  if target_organization_id is not null and not exists (
    select 1 from public.organization organization where organization.id = target_organization_id
  ) then
    raise exception using errcode = '22023', message = 'Organization was not found.';
  end if;

  if target_id is not null then
    select access.role, access.organization_id
    into existing_role, existing_organization_id
    from private.operator_access access
    where access.id = target_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'Operator record was not found.';
    end if;

    if caller_operator_role = 'admin' and (
      existing_role <> 'operator' or existing_organization_id is distinct from caller_organization_id
    ) then
      raise exception using errcode = '42501', message = 'This account requires superadministrator access.';
    end if;
  end if;

  if target_email = caller_email and (not target_active or target_role <> caller_operator_role) then
    raise exception using errcode = '22023', message = 'You cannot deactivate or change your own administrative role.';
  end if;

  if target_id is null then
    insert into private.operator_access (
      email, display_name, role, active, organization_id,
      activation_token, activation_token_expires_at
    )
    values (
      target_email, target_name, target_role, target_active, target_organization_id,
      gen_random_uuid(), now() + interval '7 days'
    )
    on conflict ((lower(email))) do update
      set display_name = excluded.display_name,
          role = excluded.role,
          active = excluded.active,
          organization_id = excluded.organization_id,
          updated_at = now()
    returning * into saved;
  else
    update private.operator_access
    set email = target_email,
        display_name = target_name,
        role = target_role,
        active = target_active,
        organization_id = target_organization_id,
        updated_at = now()
    where id = target_id
    returning * into saved;
  end if;

  if is_new_operator then
    perform private.notify_operator_invitation(saved.id);
  end if;

  return jsonb_build_object(
    'id', saved.id,
    'email', saved.email,
    'display_name', saved.display_name,
    'role', saved.role,
    'active', saved.active,
    'organization_id', saved.organization_id,
    'created_at', saved.created_at,
    'updated_at', saved.updated_at
  );
end;
$$;

revoke all on function public.admin_save_operator_access(jsonb) from public, anon;
grant execute on function public.admin_save_operator_access(jsonb) to authenticated;

create or replace function public.resend_operator_activation(target_operator_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_is_super_admin boolean;
  target private.operator_access%rowtype;
begin
  select exists (
    select 1 from private.operator_access access
    where access.active and access.role = 'super_admin' and lower(access.email) = caller_email
  ) into caller_is_super_admin;

  if not caller_is_super_admin then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  select * into target
  from private.operator_access
  where id = target_operator_id;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Operator record was not found.';
  end if;

  if target.email_confirmed_at is not null then
    raise exception using errcode = '22023', message = 'This operator has already confirmed their email.';
  end if;

  update private.operator_access
  set activation_token = gen_random_uuid(),
      activation_token_expires_at = now() + interval '7 days',
      updated_at = now()
  where id = target_operator_id
  returning * into target;

  perform private.notify_operator_invitation(target.id);

  return jsonb_build_object('id', target.id, 'email', target.email);
end;
$$;

revoke all on function public.resend_operator_activation(uuid) from public, anon;
grant execute on function public.resend_operator_activation(uuid) to authenticated;
