-- Administrative roles for Edifica operators.
-- Personal operator records remain provisioned directly in the protected database.

alter table private.operator_access
  add column if not exists role text not null default 'operator';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operator_access_role_check'
      and conrelid = 'private.operator_access'::regclass
  ) then
    alter table private.operator_access
      add constraint operator_access_role_check
      check (role in ('operator', 'admin', 'super_admin'));
  end if;
end
$$;

create or replace function private.is_authorized_admin()
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
        and access.role in ('admin', 'super_admin')
        and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    );
$$;

revoke all on function private.is_authorized_admin() from public, anon;
grant execute on function private.is_authorized_admin() to authenticated;

create or replace function public.current_operator_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'authorized', access.active,
        'display_name', access.display_name,
        'role', access.role,
        'is_admin', access.active and access.role in ('admin', 'super_admin')
      )
      from private.operator_access access
      where lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      limit 1
    ),
    jsonb_build_object(
      'authorized', false,
      'display_name', null,
      'role', null,
      'is_admin', false
    )
  );
$$;

revoke all on function public.current_operator_profile() from public, anon;
grant execute on function public.current_operator_profile() to authenticated;

comment on column private.operator_access.role is
  'Application role: operator, admin, or super_admin.';

comment on function public.current_operator_profile() is
  'Returns the authenticated operator access state and role without exposing the protected allow-list.';
