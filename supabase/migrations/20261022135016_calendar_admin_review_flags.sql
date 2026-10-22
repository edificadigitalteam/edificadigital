-- SPRINT S10.1 (#136): the tenant admin edits every unit's calendar but does not review it.
-- review_calendar_activity and set_calendar_joint_review accept supervising units, the
-- organization's top unit and GEN/DIGEN leaders only. The overview flags now match them.
-- Signature, security definer, search_path and grants are unchanged.
-- Every other key keeps its 20261021142000 value; can_review_consolidated is new.
create or replace function public.calendar_access_overview(
  target_organization_id uuid default null, target_period_id uuid default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  membership_unit_ids jsonb;
  has_oversight boolean := false;
  sees_all boolean := false;
  joint_enabled boolean := false;
  can_edit_all boolean := false;
  can_review_all boolean := false;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;
  org_id := case
    when private.is_super_admin() and target_organization_id is not null then target_organization_id
    else private.current_operator_organization_id()
  end;
  if org_id is null or not private.can_access_organization(org_id) then
    raise exception using errcode='42501', message='Organization access denied';
  end if;
  select coalesce(jsonb_agg(m.unit_id order by m.created_at), '[]'::jsonb)
  into membership_unit_ids
  from public.organization_unit_member m
  where m.organization_id = org_id
    and m.operator_access_id = private.current_operator_access_id()
    and m.active and m.unit_role in ('director','manager','operator','reviewer');

  has_oversight := private.current_operator_has_oversight(org_id);
  sees_all := private.can_manage_organization(org_id);
  can_review_all := private.current_operator_is_gen_or_digen_leader(org_id);
  can_edit_all := sees_all or can_review_all;
  if target_period_id is not null then
    select mp.calendar_joint_review_enabled into joint_enabled
    from public.management_period mp
    where mp.id=target_period_id and mp.organization_id=org_id;
    joint_enabled := coalesce(joint_enabled,false);
  end if;

  return jsonb_build_object(
    'organization_id',org_id,
    'digen_unit_id',private.current_top_unit_id(org_id),
    'is_digen',has_oversight,
    'unit_ids',membership_unit_ids,
    'visible_unit_ids',private.visible_unit_ids_json(org_id),
    'supervised_unit_ids',private.supervised_unit_ids_json(org_id),
    'can_review',has_oversight or can_review_all,
    'can_manage_joint_review',private.current_operator_oversees_organization(org_id) or can_review_all,
    'joint_review_enabled',joint_enabled,
    'can_view_consolidated',has_oversight or sees_all or joint_enabled or can_edit_all,
    'can_edit_consolidated',can_edit_all,
    'can_review_consolidated',can_review_all
  );
end;
$$;

revoke all on function public.calendar_access_overview(uuid, uuid) from public, anon;
grant execute on function public.calendar_access_overview(uuid, uuid) to authenticated;
