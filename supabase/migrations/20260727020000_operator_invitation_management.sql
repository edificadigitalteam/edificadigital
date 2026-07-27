-- Operator invitation management: fix a lockout gap and add a super_admin resend action.
--
-- admin_save_operator_access's insert path never provisioned an activation
-- token, so any operator added through the "add operator" admin form (as
-- opposed to organization creation) got email_confirmed_at = null forever
-- and could never pass is_authorized_operator()'s confirmation check.

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

-- Expose confirmation state so the UI can show a pending badge and gate the
-- resend-invitation action (only super_admin can resend, per product decision).
drop function if exists public.admin_list_operator_access();
create function public.admin_list_operator_access()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  active boolean,
  organization_id uuid,
  organization_name text,
  email_confirmed_at timestamptz,
  can_resend_invitation boolean,
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
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_operator_role text;
  caller_organization_id uuid;
begin
  select access.role, access.organization_id
  into caller_operator_role, caller_organization_id
  from private.operator_access access
  where access.active and lower(access.email) = caller_email
  limit 1;

  if caller_operator_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  return query
  select
    access.id,
    access.email,
    access.display_name,
    access.role,
    access.active,
    access.organization_id,
    organization.name,
    access.email_confirmed_at,
    (caller_operator_role = 'super_admin' and access.email_confirmed_at is null) as can_resend_invitation,
    access.created_at,
    access.updated_at,
    case
      when caller_operator_role = 'super_admin' then true
      when access.role = 'operator' and access.organization_id = caller_organization_id then true
      else false
    end as can_edit
  from private.operator_access access
  left join public.organization organization on organization.id = access.organization_id
  order by access.active desc, lower(access.display_name), lower(access.email);
end;
$$;

revoke all on function public.admin_list_operator_access() from public, anon;
grant execute on function public.admin_list_operator_access() to authenticated;

-- Resend: regenerates the activation token/expiry for an unconfirmed operator.
-- Actual email delivery is deferred to a follow-up (needs a transactional email
-- provider account); this RPC only manages the token so the UI/flow is ready.
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

  return jsonb_build_object('id', target.id, 'email', target.email);
end;
$$;

revoke all on function public.resend_operator_activation(uuid) from public, anon;
grant execute on function public.resend_operator_activation(uuid) to authenticated;
