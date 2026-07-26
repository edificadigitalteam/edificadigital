-- Normalize the operator profile contract and expose protected administrator RPCs.

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
        'email', null,
        'display_name', null,
        'role', null,
        'is_admin', false
      )
    else coalesce(
      (
        select jsonb_build_object(
          'authorized', access.active,
          'active', access.active,
          'email', access.email,
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
        'active', false,
        'email', coalesce((select auth.jwt()) ->> 'email', null),
        'display_name', null,
        'role', null,
        'is_admin', false
      )
    )
  end;
$$;

revoke all on function public.current_operator_profile() from public, anon;
grant execute on function public.current_operator_profile() to authenticated;

create or replace function public.admin_list_operator_access()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
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
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_operator_role text;
begin
  select access.role
  into caller_operator_role
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
    access.created_at,
    access.updated_at,
    case
      when caller_operator_role = 'super_admin' then true
      when access.role = 'operator' then true
      else false
    end as can_edit
  from private.operator_access access
  order by access.active desc, lower(access.display_name), lower(access.email);
end;
$$;

revoke all on function public.admin_list_operator_access() from public, anon;
grant execute on function public.admin_list_operator_access() to authenticated;

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
  target_id uuid;
  target_email text;
  target_name text;
  target_role text;
  target_active boolean;
  existing_role text;
  saved private.operator_access%rowtype;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select access.role
  into caller_operator_role
  from private.operator_access access
  where access.active and lower(access.email) = caller_email
  limit 1;

  if caller_operator_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = '22023', message = 'Operator data is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid operator identifier.';
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

  if caller_operator_role = 'admin' and target_role <> 'operator' then
    raise exception using errcode = '42501', message = 'Administrators can assign the operator role only.';
  end if;

  if target_id is not null then
    select access.role
    into existing_role
    from private.operator_access access
    where access.id = target_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'Operator record was not found.';
    end if;

    if caller_operator_role = 'admin' and existing_role <> 'operator' then
      raise exception using errcode = '42501', message = 'This account requires superadministrator access.';
    end if;
  end if;

  if target_email = caller_email and (not target_active or target_role <> caller_operator_role) then
    raise exception using errcode = '22023', message = 'You cannot deactivate or change your own administrative role.';
  end if;

  if target_id is null then
    insert into private.operator_access (email, display_name, role, active)
    values (target_email, target_name, target_role, target_active)
    on conflict ((lower(email))) do update
      set display_name = excluded.display_name,
          role = excluded.role,
          active = excluded.active,
          updated_at = now()
    returning * into saved;
  else
    update private.operator_access
    set email = target_email,
        display_name = target_name,
        role = target_role,
        active = target_active,
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
    'created_at', saved.created_at,
    'updated_at', saved.updated_at
  );
end;
$$;

revoke all on function public.admin_save_operator_access(jsonb) from public, anon;
grant execute on function public.admin_save_operator_access(jsonb) to authenticated;

comment on function public.admin_list_operator_access() is
  'Lists Edifica operator access records for authenticated administrators.';
comment on function public.admin_save_operator_access(jsonb) is
  'Creates or updates an Edifica operator access record with role safeguards.';
