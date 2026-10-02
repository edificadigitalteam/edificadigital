-- Unit hierarchy visibility.
-- Every person sees their own units and every unit below them in the organization chart.
-- Tenant admins keep organization-wide visibility. DIAF keeps its finance and
-- management-report review exception. Seeing a unit never grants editing it.
-- Replaces the DIGEN-by-code consolidated rules.

-- Units the caller belongs to, plus every unit below the ones where the caller holds
-- a director/manager/operator/reviewer role. A plain member sees only their own unit.
create or replace function private.current_visible_unit_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with recursive member_units as (
    select m.unit_id, m.unit_role in ('director','manager','operator','reviewer') as inherits
    from public.organization_unit_member m
    where m.active
      and m.operator_access_id = private.current_operator_access_id()
  ), tree(unit_id) as (
    select unit_id from member_units where inherits
    union
    select child.id
    from public.organization_unit child
    join tree on child.parent_unit_id = tree.unit_id
  )
  select coalesce(array_agg(distinct visible.unit_id), '{}'::uuid[])
  from (
    select unit_id from tree
    union
    select unit_id from member_units
  ) visible;
$$;

-- Units strictly below the caller's director/manager/operator/reviewer units.
-- These are the units the caller supervises (for example, calendar review).
create or replace function private.current_supervised_unit_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with recursive tree(unit_id) as (
    select child.id
    from public.organization_unit child
    join public.organization_unit_member m
      on m.unit_id = child.parent_unit_id
     and m.active
     and m.unit_role in ('director','manager','operator','reviewer')
    where m.operator_access_id = private.current_operator_access_id()
    union
    select child.id
    from public.organization_unit child
    join tree on child.parent_unit_id = tree.unit_id
  )
  select coalesce(array_agg(distinct unit_id), '{}'::uuid[]) from tree;
$$;

create or replace function private.can_view_unit(target_organization_id uuid, target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_organization(target_organization_id)
    and (
      private.can_manage_organization(target_organization_id)
      or target_unit_id = any(private.current_visible_unit_ids())
    );
$$;

create or replace function private.can_supervise_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and target_unit_id = any(private.current_supervised_unit_ids());
$$;

-- True when the caller supervises at least one unit of the organization.
create or replace function private.current_operator_has_oversight(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and exists (
      select 1
      from public.organization_unit u
      where u.organization_id = target_organization_id
        and u.id = any(private.current_supervised_unit_ids())
    );
$$;

-- True when, through unit membership, the caller sees every active unit of the organization.
create or replace function private.current_operator_oversees_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_operator_has_oversight(target_organization_id)
    and not exists (
      select 1
      from public.organization_unit u
      where u.organization_id = target_organization_id
        and u.active
        and not (u.id = any(private.current_visible_unit_ids()))
    );
$$;

-- Kept for compatibility: "DIGEN" now means "supervises other units".
create or replace function private.current_operator_is_digen(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_operator_has_oversight(target_organization_id);
$$;

create or replace function private.can_view_all_management_reports(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_organization(target_organization_id)
    or private.can_review_management_reports(target_organization_id)
    or private.current_operator_oversees_organization(target_organization_id);
$$;

create or replace function private.can_access_finance_unit(target_organization_id uuid, target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_finance(target_organization_id)
    or exists (
      select 1
      from public.organization_unit unit
      where unit.id = target_unit_id
        and unit.organization_id = target_organization_id
        and unit.id = any(private.current_visible_unit_ids())
    );
$$;

create or replace function private.can_view_calendar_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unit_work_plan p
    join public.management_period mp on mp.id = p.management_period_id
    where p.id = target_plan_id
      and private.can_access_organization(p.organization_id)
      and (
        private.can_manage_organization(p.organization_id)
        or p.unit_id = any(private.current_visible_unit_ids())
        or (
          mp.calendar_joint_review_enabled
          and exists (
            select 1
            from public.organization_unit_member m
            where m.organization_id = p.organization_id
              and m.operator_access_id = private.current_operator_access_id()
              and m.active
              and m.unit_role in ('director','manager','operator','reviewer')
          )
        )
      )
  );
$$;

create or replace function private.guard_calendar_activity_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_can_review boolean;
begin
  caller_can_review := private.can_supervise_unit(
    (select p.unit_id from public.unit_work_plan p where p.id = new.work_plan_id)
  );

  if tg_op = 'INSERT' then
    if not caller_can_review then
      new.review_status := 'pending';
      new.review_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  if not caller_can_review and (
    new.review_status is distinct from old.review_status
    or new.review_note is distinct from old.review_note
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
  ) then
    raise exception using errcode = '42501', message = 'Only a supervising unit can change calendar review fields.';
  end if;

  if not caller_can_review and (
    new.work_plan_id is distinct from old.work_plan_id
    or new.objective_id is distinct from old.objective_id
    or new.indicator_id is distinct from old.indicator_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.status is distinct from old.status
    or new.responsible_name is distinct from old.responsible_name
    or new.modality is distinct from old.modality
  ) then
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.review_calendar_activity(target_activity_id uuid, target_status text, target_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_unit_id uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;

  if target_status not in ('pending','validated','observed') then
    raise exception using errcode='23514', message='Invalid calendar review status';
  end if;

  select p.unit_id into activity_unit_id
  from public.unit_work_activity a
  join public.unit_work_plan p on p.id = a.work_plan_id
  where a.id = target_activity_id;

  if activity_unit_id is null then
    raise exception using errcode='P0002', message='Calendar activity not found';
  end if;

  if not private.can_supervise_unit(activity_unit_id) then
    raise exception using errcode='42501', message='Only a supervising unit can review this calendar activity';
  end if;

  update public.unit_work_activity
  set review_status = target_status,
      review_note = nullif(trim(coalesce(target_note,'')), ''),
      reviewed_by = case when target_status = 'pending' then null else auth.uid() end,
      reviewed_at = case when target_status = 'pending' then null else now() end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = target_activity_id;

  return target_activity_id;
end;
$$;

create or replace function public.set_calendar_joint_review(target_period_id uuid, enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;

  select mp.organization_id into org_id
  from public.management_period mp
  where mp.id = target_period_id;

  if org_id is null then
    raise exception using errcode='P0002', message='Management period not found';
  end if;

  if not private.current_operator_oversees_organization(org_id) then
    raise exception using errcode='42501', message='Only the organization top unit can change joint calendar visibility';
  end if;

  update public.management_period
  set calendar_joint_review_enabled = enabled,
      calendar_joint_review_enabled_by = case when enabled then auth.uid() else null end,
      calendar_joint_review_enabled_at = case when enabled then now() else null end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = target_period_id;

  return enabled;
end;
$$;

-- Access overviews keep their previous keys so clients keep working, and add:
-- visible_unit_ids, supervised_unit_ids, can_review and can_manage_joint_review.
-- digen_unit_id now holds the caller's highest own unit in the organization chart.

create or replace function private.current_top_unit_id(target_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive own as (
    select u.id, u.parent_unit_id
    from public.organization_unit u
    join public.organization_unit_member m on m.unit_id = u.id and m.active
    where u.organization_id = target_organization_id
      and u.active
      and m.operator_access_id = private.current_operator_access_id()
  ), depth(id, parent_id, level) as (
    select own.id, own.parent_unit_id, 0 from own
    union all
    select depth.id, parent.parent_unit_id, depth.level + 1
    from depth
    join public.organization_unit parent on parent.id = depth.parent_id
    where depth.level < 50
  )
  select id from depth group by id order by max(level), id limit 1;
$$;

create or replace function private.visible_unit_ids_json(target_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(u.id order by u.sort_order, u.name), '[]'::jsonb)
  from public.organization_unit u
  where u.organization_id = target_organization_id
    and (
      private.can_manage_organization(target_organization_id)
      or u.id = any(private.current_visible_unit_ids())
    );
$$;

create or replace function private.supervised_unit_ids_json(target_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(u.id order by u.sort_order, u.name), '[]'::jsonb)
  from public.organization_unit u
  where u.organization_id = target_organization_id
    and u.id = any(private.current_supervised_unit_ids());
$$;

create or replace function public.calendar_access_overview(target_organization_id uuid default null, target_period_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  membership_unit_ids jsonb;
  has_oversight boolean := false;
  sees_all boolean := false;
  joint_enabled boolean := false;
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
    and m.active
    and m.unit_role in ('director','manager','operator','reviewer');

  has_oversight := private.current_operator_has_oversight(org_id);
  sees_all := private.can_manage_organization(org_id);

  if target_period_id is not null then
    select mp.calendar_joint_review_enabled into joint_enabled
    from public.management_period mp
    where mp.id = target_period_id and mp.organization_id = org_id;
    joint_enabled := coalesce(joint_enabled, false);
  end if;

  return jsonb_build_object(
    'organization_id', org_id,
    'digen_unit_id', private.current_top_unit_id(org_id),
    'is_digen', has_oversight,
    'unit_ids', membership_unit_ids,
    'visible_unit_ids', private.visible_unit_ids_json(org_id),
    'supervised_unit_ids', private.supervised_unit_ids_json(org_id),
    'can_review', has_oversight,
    'can_manage_joint_review', private.current_operator_oversees_organization(org_id),
    'joint_review_enabled', joint_enabled,
    'can_view_consolidated', has_oversight or sees_all or joint_enabled
  );
end;
$$;

create or replace function public.pending_issue_access_overview(target_organization_id uuid default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  org_id uuid;
  membership_unit_ids jsonb;
  consolidated boolean := false;
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
  join public.organization_unit u
    on u.id = m.unit_id
   and u.organization_id = m.organization_id
   and u.active
  where m.organization_id = org_id
    and m.operator_access_id = private.current_operator_access_id()
    and m.active
    and m.unit_role in ('director','manager','operator','reviewer');

  consolidated := private.current_operator_has_oversight(org_id) or private.can_manage_organization(org_id);

  return jsonb_build_object(
    'organization_id', org_id,
    'digen_unit_id', private.current_top_unit_id(org_id),
    'is_digen', consolidated,
    'unit_ids', membership_unit_ids,
    'visible_unit_ids', private.visible_unit_ids_json(org_id),
    'can_view_consolidated', consolidated
  );
end;
$$;

create or replace function public.management_report_access_overview(target_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  unit_ids jsonb;
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

  select coalesce(jsonb_agg(m.unit_id),'[]'::jsonb)
  into unit_ids
  from public.organization_unit_member m
  where m.organization_id=org_id
    and m.operator_access_id=private.current_operator_access_id()
    and m.active;

  return jsonb_build_object(
    'organization_id',org_id,
    'digen_unit_id',private.current_top_unit_id(org_id),
    'is_digen',private.current_operator_has_oversight(org_id),
    'can_view_all_reports',private.can_view_all_management_reports(org_id),
    'can_review_reports',private.can_review_management_reports(org_id),
    'unit_ids',unit_ids,
    'visible_unit_ids',private.visible_unit_ids_json(org_id)
  );
end;
$$;

-- Row-level visibility (existing SELECT policies are altered in place).
-- Writes keep their existing own-unit policies.

alter policy management_indicator_select on public.management_indicator
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or unit_id = any((select private.current_visible_unit_ids())::uuid[])
  )
);

alter policy indicator_progress_select on public.indicator_progress
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or unit_id = any((select private.current_visible_unit_ids())::uuid[])
  )
);

alter policy unit_work_plan_select on public.unit_work_plan
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or unit_id = any((select private.current_visible_unit_ids())::uuid[])
  )
);

alter policy objective_unit_assignment_select on public.objective_unit_assignment
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or unit_id = any((select private.current_visible_unit_ids())::uuid[])
  )
);

alter policy institutional_objective_select on public.institutional_objective
using (
  private.can_access_organization(organization_id)
  and (
    work_plan_id is null
    or private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or exists (
      select 1
      from public.unit_work_plan plan
      where plan.id = institutional_objective.work_plan_id
        and plan.unit_id = any((select private.current_visible_unit_ids())::uuid[])
    )
  )
);

alter policy unit_management_report_select on public.unit_management_report
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or unit_id = any((select private.current_visible_unit_ids())::uuid[])
  )
);

alter policy unit_management_report_item_select on public.unit_management_report_item
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or unit_id = any((select private.current_visible_unit_ids())::uuid[])
  )
);

alter policy unit_pending_issue_select on public.unit_pending_issue
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or unit_id = any((select private.current_visible_unit_ids())::uuid[])
  )
);

revoke all on function private.current_visible_unit_ids() from public, anon;
revoke all on function private.current_supervised_unit_ids() from public, anon;
revoke all on function private.can_view_unit(uuid, uuid) from public, anon;
revoke all on function private.can_supervise_unit(uuid) from public, anon;
revoke all on function private.current_operator_has_oversight(uuid) from public, anon;
revoke all on function private.current_operator_oversees_organization(uuid) from public, anon;
revoke all on function private.current_top_unit_id(uuid) from public, anon;
revoke all on function private.visible_unit_ids_json(uuid) from public, anon;
revoke all on function private.supervised_unit_ids_json(uuid) from public, anon;

grant execute on function private.current_visible_unit_ids() to authenticated;
grant execute on function private.current_supervised_unit_ids() to authenticated;
grant execute on function private.can_view_unit(uuid, uuid) to authenticated;
grant execute on function private.can_supervise_unit(uuid) to authenticated;
grant execute on function private.current_operator_has_oversight(uuid) to authenticated;
grant execute on function private.current_operator_oversees_organization(uuid) to authenticated;
grant execute on function private.current_top_unit_id(uuid) to authenticated;
grant execute on function private.visible_unit_ids_json(uuid) to authenticated;
grant execute on function private.supervised_unit_ids_json(uuid) to authenticated;

create index if not exists organization_unit_parent_unit_id_idx
  on public.organization_unit(parent_unit_id)
  where parent_unit_id is not null;
