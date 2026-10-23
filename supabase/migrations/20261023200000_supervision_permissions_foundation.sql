-- SPRINT S11 stage 1 (#147): supervision permissions assigned to people.
--
-- Supervision in Calendar, Evaluation and Pending issues is still decided by
-- the unit codes GEN and DIGEN of the first tenant. This stage adds the
-- replacement without switching anything over: a platform-defined catalog,
-- per-person grants within an organization, a check helper, admin RPCs and an
-- initial load that grants exactly what the legacy helpers authorize today.
-- No policy or function reads the new permissions yet (stages 2 and 3 do).

-- Catalog -----------------------------------------------------------------------------------
create or replace function private.supervision_permissions()
returns text[] language sql immutable set search_path = ''
as $$
  select array['calendar.manage_all', 'evaluations.review', 'instructions.issue', 'management.read_all']
$$;
revoke all on function private.supervision_permissions() from public, anon;
grant execute on function private.supervision_permissions() to authenticated;

-- Grants -------------------------------------------------------------------------------------
create table if not exists private.operator_permission (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  operator_access_id uuid not null references private.operator_access(id) on delete cascade,
  permission text not null check (permission = any (private.supervision_permissions())),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (organization_id, operator_access_id, permission)
);
create index if not exists operator_permission_operator_access_id_idx on private.operator_permission(operator_access_id);
create index if not exists operator_permission_granted_by_idx on private.operator_permission(granted_by);

-- Same model as private.operator_access: only security-definer functions touch it.
alter table private.operator_permission enable row level security;
revoke all on table private.operator_permission from public, anon, authenticated;

drop trigger if exists operator_permission_audit_change on private.operator_permission;
create trigger operator_permission_audit_change
after insert or update or delete on private.operator_permission
for each row execute function private.audit_record_change();

-- Check helper -------------------------------------------------------------------------------
create or replace function private.current_operator_has_permission(target_organization_id uuid, target_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_authorized_operator()
    and private.can_access_organization(target_organization_id)
    and exists (
      select 1
      from private.operator_permission p
      join private.operator_access a on a.id = p.operator_access_id
      where p.organization_id = target_organization_id
        and p.permission = target_permission
        and a.id = private.current_operator_access_id()
        and a.active
        and a.organization_id = target_organization_id
    );
$$;
revoke all on function private.current_operator_has_permission(uuid, text) from public, anon;
grant execute on function private.current_operator_has_permission(uuid, text) to authenticated;

-- Admin RPCs ---------------------------------------------------------------------------------
create or replace function public.admin_list_operator_permissions(target_organization_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  org_id uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;
  org_id := case when private.is_super_admin() and target_organization_id is not null
    then target_organization_id else private.current_operator_organization_id() end;
  if org_id is null or not private.can_manage_organization(org_id) then
    raise exception using errcode = '42501', message = 'Administrative access to this organization is required.';
  end if;

  return jsonb_build_object(
    'organization_id', org_id,
    'catalog', to_jsonb(private.supervision_permissions()),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'operator_access_id', a.id,
        'permissions', coalesce((
          select jsonb_agg(p.permission order by p.permission)
          from private.operator_permission p
          where p.organization_id = org_id and p.operator_access_id = a.id
        ), '[]'::jsonb)
      ) order by a.display_name)
      from private.operator_access a
      where a.organization_id = org_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_list_operator_permissions(uuid) from public, anon;
grant execute on function public.admin_list_operator_permissions(uuid) to authenticated;

create or replace function public.admin_set_operator_permissions(
  target_organization_id uuid,
  target_operator_access_id uuid,
  target_permissions text[]
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  wanted text[] := coalesce(target_permissions, array[]::text[]);
  unknown text[];
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;
  org_id := case when private.is_super_admin() and target_organization_id is not null
    then target_organization_id else private.current_operator_organization_id() end;
  if org_id is null or org_id is distinct from target_organization_id or not private.can_manage_organization(org_id) then
    raise exception using errcode = '42501', message = 'Administrative access to this organization is required.';
  end if;

  if not exists (
    select 1 from private.operator_access a
    where a.id = target_operator_access_id and a.organization_id = org_id
  ) then
    raise exception using errcode = 'P0002', message = 'This person does not belong to the organization.';
  end if;

  select array_agg(w order by w) into unknown
  from unnest(wanted) w
  where w is null or not (w = any (private.supervision_permissions()));
  if unknown is not null then
    raise exception using errcode = '22023', message = 'Unknown supervision permission.';
  end if;

  delete from private.operator_permission p
  where p.organization_id = org_id
    and p.operator_access_id = target_operator_access_id
    and not (p.permission = any (wanted));

  insert into private.operator_permission (organization_id, operator_access_id, permission, granted_by)
  select distinct org_id, target_operator_access_id, w, (select auth.uid())
  from unnest(wanted) w
  on conflict (organization_id, operator_access_id, permission) do nothing;

  return jsonb_build_object(
    'organization_id', org_id,
    'operator_access_id', target_operator_access_id,
    'permissions', coalesce((
      select jsonb_agg(p.permission order by p.permission)
      from private.operator_permission p
      where p.organization_id = org_id and p.operator_access_id = target_operator_access_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_set_operator_permissions(uuid, uuid, text[]) from public, anon;
grant execute on function public.admin_set_operator_permissions(uuid, uuid, text[]) to authenticated;

-- Initial load -------------------------------------------------------------------------------
-- Mirrors private.current_operator_is_digen_director and
-- private.current_operator_is_gen_or_digen_leader as deployed in 20261022142118:
-- - active director of an active DIGEN unit: all four permissions;
-- - active director, manager, operator or reviewer of an active GEN unit:
--   every permission except instructions.issue.
-- Idempotent; stages 2 and 3 run it again right before switching the rules.
create or replace function private.backfill_supervision_permissions()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  inserted integer;
begin
  with leaders as (
    select m.organization_id, m.operator_access_id, upper(trim(u.code)) as code
    from public.organization_unit_member m
    join public.organization_unit u on u.id = m.unit_id and u.organization_id = m.organization_id
    join private.operator_access a on a.id = m.operator_access_id and a.organization_id = m.organization_id
    where m.active and u.active
      and (
        (upper(trim(u.code)) = 'DIGEN' and m.unit_role = 'director')
        or (upper(trim(u.code)) = 'GEN' and m.unit_role in ('director', 'manager', 'operator', 'reviewer'))
      )
  ), grants as (
    select distinct l.organization_id, l.operator_access_id, perm
    from leaders l
    cross join lateral unnest(
      case when l.code = 'DIGEN'
        then private.supervision_permissions()
        else array['calendar.manage_all', 'evaluations.review', 'management.read_all'] end
    ) perm
  ), ins as (
    insert into private.operator_permission (organization_id, operator_access_id, permission)
    select organization_id, operator_access_id, perm from grants
    on conflict (organization_id, operator_access_id, permission) do nothing
    returning 1
  )
  select count(*) into inserted from ins;
  return inserted;
end;
$$;
revoke all on function private.backfill_supervision_permissions() from public, anon, authenticated;

select private.backfill_supervision_permissions();
