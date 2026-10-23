-- SPRINT S10.3: directorates submit; GEN and DIGEN exclusively receive/oversee.
-- Corrective migration; keep existing evaluations, admin visibility and all other RLS.
-- Only active unit directors outside GEN/DIGEN can submit a self-evaluation.
create or replace function private.can_self_evaluate_unit(target_organization_id uuid, target_unit_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_authorized_operator()
    and private.can_access_organization(target_organization_id)
    and not private.current_operator_is_gen_or_digen_leader(target_organization_id)
    and exists (
      select 1
      from public.organization_unit_member m
      join public.organization_unit u
        on u.id = m.unit_id and u.organization_id = m.organization_id
      where m.organization_id = target_organization_id
        and m.unit_id = target_unit_id
        and m.operator_access_id = private.current_operator_access_id()
        and m.unit_role = 'director'
        and m.active and u.active
        and upper(trim(u.code)) not in ('GEN', 'DIGEN')
    );
$$;
revoke all on function private.can_self_evaluate_unit(uuid, uuid) from public, anon;
grant execute on function private.can_self_evaluate_unit(uuid, uuid) to authenticated;

-- Preserve S10.2 tenant-admin draft access while clearly identifying the
-- GEN/DIGEN supervisory role and returning only eligible author unit IDs.
create or replace function public.evaluation_access_overview(target_organization_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  director_units jsonb;
  is_admin boolean := false;
  is_supervisor boolean := false;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;
  org_id := case when private.is_super_admin() and target_organization_id is not null
    then target_organization_id else private.current_operator_organization_id() end;
  if org_id is null or not private.can_access_organization(org_id) then
    raise exception using errcode='42501', message='Organization access denied';
  end if;

  is_admin := private.can_manage_organization(org_id);
  is_supervisor := private.current_operator_is_gen_or_digen_leader(org_id);
  select coalesce(jsonb_agg(u.id order by u.sort_order, u.name), '[]'::jsonb)
    into director_units
  from public.organization_unit_member m
  join public.organization_unit u on u.id=m.unit_id and u.organization_id=m.organization_id
  where m.organization_id=org_id
    and m.operator_access_id=private.current_operator_access_id()
    and m.unit_role='director' and m.active and u.active
    and upper(trim(u.code)) not in ('GEN','DIGEN')
    and not is_supervisor;

  return jsonb_build_object(
    'organization_id', org_id,
    'director_unit_ids', director_units,
    'is_digen_director', private.current_operator_is_digen_director(org_id),
    'is_evaluation_supervisor', is_supervisor,
    'can_review_all_evaluations', is_admin or is_supervisor,
    'can_read_draft_evaluations', is_admin
  );
end;
$$;
revoke all on function public.evaluation_access_overview(uuid) from public, anon;
grant execute on function public.evaluation_access_overview(uuid) to authenticated;
