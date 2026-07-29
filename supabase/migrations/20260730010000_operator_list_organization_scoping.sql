-- admin_list_operator_access() returned every operator across every
-- organization to any 'admin' caller, not just their own organization's
-- operators -- a cross-tenant data leak (an organization admin could see
-- the full name/email/role of every other organization's users). Only
-- 'super_admin' (platform/host accounts with no organization_id) should see
-- everything; an 'admin' caller must only see their own organization's rows.

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
  where caller_operator_role = 'super_admin'
    or (caller_operator_role = 'admin' and access.organization_id = caller_organization_id)
  order by access.active desc, lower(access.display_name), lower(access.email);
end;
$$;

revoke all on function public.admin_list_operator_access() from public, anon;
grant execute on function public.admin_list_operator_access() to authenticated;
