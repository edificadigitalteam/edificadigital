-- Tenant admins can resend the activation link to people of their own
-- organization who still have to confirm their email.
--
-- Until now resend_operator_activation() and the can_resend_invitation flag
-- of admin_list_operator_access() were super_admin-only, so an organization
-- admin could see "Confirmación pendiente" in "Mi organización > Usuarios"
-- with no way to act on it. Scope rules:
--   * super_admin: any unconfirmed person (unchanged).
--   * admin: unconfirmed people whose organization_id equals the caller's.
--   * anyone else: rejected with 42501.
-- Resending only rotates the activation token and emails the address already
-- on file; it never changes role, organization, or active state.

create or replace function public.resend_operator_activation(target_operator_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_operator_role text;
  caller_organization_id uuid;
  target private.operator_access%rowtype;
begin
  select access.role, access.organization_id
  into caller_operator_role, caller_organization_id
  from private.operator_access access
  where access.active and lower(access.email) = caller_email
  limit 1;

  if caller_operator_role is null or caller_operator_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  select * into target
  from private.operator_access
  where id = target_operator_id;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Operator record was not found.';
  end if;

  if caller_operator_role = 'admin'
     and (caller_organization_id is null or target.organization_id is distinct from caller_organization_id) then
    raise exception using errcode = '42501', message = 'You can only resend invitations within your organization.';
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

-- Same signature as 20260730010000; only can_resend_invitation changes.
create or replace function public.admin_list_operator_access()
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
    (
      access.email_confirmed_at is null
      and (
        caller_operator_role = 'super_admin'
        or (caller_operator_role = 'admin' and access.organization_id = caller_organization_id)
      )
    ) as can_resend_invitation,
    access.created_at,
    access.updated_at,
    case
      when caller_operator_role = 'super_admin' then true
      when access.role = 'operator' and access.organization_id = caller_organization_id then true
      else false
    end as can_edit
  from private.operator_access access
  left join public.organization organization on organization.id = access.organization_id
  where caller_operator_role = 'super_admin'
    or (caller_operator_role = 'admin' and access.organization_id = caller_organization_id)
  order by access.active desc, lower(access.display_name), lower(access.email);
end;
$$;

revoke all on function public.admin_list_operator_access() from public, anon;
grant execute on function public.admin_list_operator_access() to authenticated;
