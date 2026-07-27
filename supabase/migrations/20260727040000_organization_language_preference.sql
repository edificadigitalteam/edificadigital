-- Each organization has a default language; the system sends that
-- organization's operators a single-language email (no more bilingual
-- ES/EN in the same message) matching it.

alter table public.organization
  add column language text not null default 'en';

alter table public.organization
  add constraint organization_language_check check (language in ('es', 'en'));

drop function if exists public.admin_list_organizations();
create function public.admin_list_organizations()
returns table (
  id uuid,
  code text,
  name text,
  legal_name text,
  tax_id text,
  country text,
  city text,
  contact_email text,
  contact_phone text,
  subscription_status text,
  language text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  can_edit boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_role text;
  caller_organization_id uuid;
begin
  select access.role, access.organization_id
  into caller_role, caller_organization_id
  from private.operator_access access
  where access.active
    and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  limit 1;

  if caller_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  return query
  select
    organization.id,
    organization.code,
    organization.name,
    organization.legal_name,
    organization.tax_id,
    organization.country,
    organization.city,
    organization.contact_email,
    organization.contact_phone,
    organization.subscription_status,
    organization.language,
    organization.active,
    organization.created_at,
    organization.updated_at,
    caller_role = 'super_admin' as can_edit
  from public.organization organization
  where caller_role = 'super_admin' or organization.id = caller_organization_id
  order by organization.active desc, lower(organization.name);
end;
$$;

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
  target_language text;
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid organization identifier.';
  end;

  target_language := coalesce(nullif(payload ->> 'language', ''), 'en');
  if target_language not in ('es', 'en') then
    raise exception using errcode = '22023', message = 'Invalid organization language.';
  end if;

  is_new_organization := target_id is null;

  if is_new_organization then
    insert into public.organization (
      code, name, legal_name, tax_id, country, city,
      contact_email, contact_phone, subscription_status, language, active
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
      target_language,
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
        language = target_language,
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

-- notify_operator_invitation now also sends the organization's language
-- preference (default 'en', matching the column default, for operators
-- with no organization yet).
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
  target_language text;
  base_url text;
  auth_key text;
begin
  select * into target
  from private.operator_access
  where id = target_operator_id;

  if target.id is null or target.activation_token is null then
    return;
  end if;

  select organization.name, organization.language
  into target_organization_name, target_language
  from public.organization organization
  where organization.id = target.organization_id;

  target_language := coalesce(target_language, 'en');

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
      'organization_name', target_organization_name,
      'language', target_language
    )
  );
exception when others then
  return;
end;
$$;

revoke all on function private.notify_operator_invitation(uuid) from public, anon, authenticated;
