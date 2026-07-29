-- Fix: current_operator_profile() disagreed with private.is_authorized_operator()
-- about what "authorized" means. is_authorized_operator() (the check that
-- actually gates save_donor_directory/list_donor_directory and other
-- operator-only RPCs) requires both `active` and `email_confirmed_at is not
-- null`. current_operator_profile() -- the RPC the frontend uses to decide
-- whether to show the monetary/in-kind/project forms at all -- only checked
-- `active`. Result: an operator with active = true but an unconfirmed email
-- reached the forms and the donor/actor picker, then had every write
-- silently rejected by the stricter backend check. This aligns the two and
-- exposes an `email_confirmed` field so the frontend can show a specific
-- "confirm your email" state instead of a form that looks usable but isn't.

create or replace function public.current_operator_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then
      jsonb_build_object(
        'authorized', false,
        'active', false,
        'email_confirmed', false,
        'email', null,
        'display_name', null,
        'role', null,
        'is_admin', false,
        'organization_id', null,
        'organization_name', null
      )
    else coalesce(
      (
        select jsonb_build_object(
          'authorized', access.active and access.email_confirmed_at is not null,
          'active', access.active,
          'email_confirmed', access.email_confirmed_at is not null,
          'email', access.email,
          'display_name', access.display_name,
          'role', access.role,
          'is_admin', access.active and access.email_confirmed_at is not null and access.role in ('admin', 'super_admin'),
          'organization_id', access.organization_id,
          'organization_name', organization.name
        )
        from private.operator_access access
        left join public.organization organization on organization.id = access.organization_id
        where lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
        limit 1
      ),
      jsonb_build_object(
        'authorized', false,
        'active', false,
        'email_confirmed', false,
        'email', coalesce((select auth.jwt()) ->> 'email', null),
        'display_name', null,
        'role', null,
        'is_admin', false,
        'organization_id', null,
        'organization_name', null
      )
    )
  end;
$$;

revoke all on function public.current_operator_profile() from public, anon;
grant execute on function public.current_operator_profile() to authenticated;
