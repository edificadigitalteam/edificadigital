-- Creating an organization auto-provisions its admin operator, pending email confirmation.

-- 1. contact_email becomes the organization's access identifier: required and unique.
alter table public.organization
  alter column contact_email set not null,
  add constraint organization_contact_email_unique unique (contact_email);

-- 2. Activation columns on the operator allow-list.
alter table private.operator_access
  add column activation_token uuid,
  add column activation_token_expires_at timestamptz,
  add column email_confirmed_at timestamptz;

-- Pre-existing operators must not be locked out once confirmation is required.
update private.operator_access
set email_confirmed_at = coalesce(email_confirmed_at, created_at, now())
where email_confirmed_at is null;

-- 3. Authorization now also requires a confirmed email.
create or replace function private.is_authorized_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from private.operator_access access
      where access.active
        and access.email_confirmed_at is not null
        and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    );
$$;

-- 4. admin_save_organization: stop self-assigning the calling super_admin to the
-- organization they create (a host/platform account, not a tenant seat — and it
-- collides with the seat limit, starving the new tenant admin's own seat), and
-- auto-provision the organization's admin operator on create instead.
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
    );
  end if;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.admin_save_organization(jsonb) from public, anon;
grant execute on function public.admin_save_organization(jsonb) to authenticated;

-- 5. Activation confirmation: the caller has no session yet, so the token is the credential.
create or replace function public.confirm_operator_activation(token uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  matched private.operator_access%rowtype;
begin
  select * into matched
  from private.operator_access
  where activation_token = token
    and activation_token_expires_at > now()
  limit 1;

  if matched.id is null then
    return false;
  end if;

  update private.operator_access
  set email_confirmed_at = now(),
      activation_token = null,
      activation_token_expires_at = null,
      updated_at = now()
  where id = matched.id;

  return true;
end;
$$;

revoke all on function public.confirm_operator_activation(uuid) from public;
grant execute on function public.confirm_operator_activation(uuid) to anon, authenticated;
