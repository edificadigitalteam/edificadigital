-- SPRINT S11 stage 2 (#147): Calendar and Evaluation read supervision permissions.
--
-- Until now these rules called private.current_operator_is_gen_or_digen_leader,
-- which recognizes the first tenant's GEN and DIGEN units by their code. Each
-- call is replaced by the permission it stands for, granted to people through
-- private.operator_permission (stage 1, 20261023200000):
-- - calendar.manage_all: view, edit and review every unit's calendar and switch
--   the shared view;
-- - evaluations.review: read every submitted executive self-evaluation;
-- - management.read_all (or calendar.manage_all, which edits activities that
--   point to them): read every unit's work plans, objectives and indicators.
-- Every function is copied from its live definition in edifydb; only that call
-- changes, and every other condition, grant and the tenant admin's access
-- (#136) are kept.
--
-- It also adds the per-tenant setting decided on 2026-10-23: whether people who
-- review evaluations may fill in their own unit's self-evaluation. Default true
-- keeps the current behavior; the tenant with GEN/DIGEN units (CNBV) gets false.

-- Refresh the initial load right before switching the rules ----------------------------------
select private.backfill_supervision_permissions();

-- Per-tenant setting -------------------------------------------------------------------------
alter table public.organization
  add column if not exists evaluation_reviewers_can_self_evaluate boolean not null default true;

-- Decision of 2026-10-23: in the tenant with GEN/DIGEN units, reviewers only receive results.
update public.organization o
set evaluation_reviewers_can_self_evaluate = false
where exists (
  select 1 from public.organization_unit u
  where u.organization_id = o.id and u.active and upper(trim(u.code)) in ('GEN', 'DIGEN')
);

create or replace function public.admin_set_evaluation_reviewers_can_self_evaluate(
  target_organization_id uuid,
  enabled boolean
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_manage_organization(target_organization_id) then
    raise exception using errcode = '42501', message = 'Only organization administrators can change this setting.';
  end if;
  if enabled is null then
    raise exception using errcode = '22023', message = 'Choose whether reviewers may fill in their own evaluation.';
  end if;
  update public.organization
  set evaluation_reviewers_can_self_evaluate = enabled
  where id = target_organization_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Organization not found';
  end if;
  return enabled;
end;
$$;
revoke all on function public.admin_set_evaluation_reviewers_can_self_evaluate(uuid, boolean) from public, anon;
grant execute on function public.admin_set_evaluation_reviewers_can_self_evaluate(uuid, boolean) to authenticated;

-- Calendar -----------------------------------------------------------------------------------
create or replace function private.can_manage_calendar_plan(target_plan_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_authorized_operator()
    and exists (
      select 1 from public.unit_work_plan p
      where p.id = target_plan_id
        and private.can_access_organization(p.organization_id)
        and (
          private.can_manage_organization(p.organization_id)
          or private.current_operator_has_permission(p.organization_id, 'calendar.manage_all')
          or exists (
            select 1 from public.organization_unit_member m
            where m.unit_id = p.unit_id
              and m.organization_id = p.organization_id
              and m.active
              and m.operator_access_id = private.current_operator_access_id()
              and m.unit_role in ('director','manager','operator','reviewer')
          )
        )
    );
$$;

create or replace function private.can_view_calendar_plan(target_plan_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.unit_work_plan p
    join public.management_period mp on mp.id = p.management_period_id
    where p.id = target_plan_id
      and private.can_access_organization(p.organization_id)
      and (
        private.can_manage_organization(p.organization_id)
        or private.current_operator_has_permission(p.organization_id, 'calendar.manage_all')
        or p.unit_id = any(private.current_visible_unit_ids())
        or (
          mp.calendar_joint_review_enabled
          and exists (
            select 1 from public.organization_unit_member m
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
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  caller_can_review boolean;
begin
  caller_can_review := private.can_supervise_unit(
    (select p.unit_id from public.unit_work_plan p where p.id = new.work_plan_id)
  ) or private.current_operator_has_permission(new.organization_id, 'calendar.manage_all')
    or private.can_manage_organization(new.organization_id);

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

create or replace function public.calendar_access_overview(target_organization_id uuid default null, target_period_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
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
  can_review_all := sees_all or private.current_operator_has_permission(org_id, 'calendar.manage_all');
  can_edit_all := can_review_all;
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
    'can_review_consolidated',can_review_all,
    'can_delete_consolidated',sees_all
  );
end;
$$;

create or replace function public.review_calendar_activity(target_activity_id uuid, target_status text, target_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  activity_unit_id uuid;
  org_id uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;

  if target_status not in ('pending','validated','observed') then
    raise exception using errcode='23514', message='Invalid calendar review status';
  end if;

  select p.unit_id, p.organization_id into activity_unit_id, org_id
  from public.unit_work_activity a
  join public.unit_work_plan p on p.id = a.work_plan_id
  where a.id = target_activity_id;

  if activity_unit_id is null then
    raise exception using errcode='P0002', message='Calendar activity not found';
  end if;

  if not (private.can_supervise_unit(activity_unit_id)
    or private.current_operator_has_permission(org_id, 'calendar.manage_all')
    or private.can_manage_organization(org_id)) then
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
returns boolean language plpgsql security definer set search_path = ''
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

  if not (private.current_operator_oversees_organization(org_id)
    or private.current_operator_has_permission(org_id, 'calendar.manage_all')
    or private.can_manage_organization(org_id)) then
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

-- Evaluation ---------------------------------------------------------------------------------
create or replace function private.can_self_evaluate_unit(target_organization_id uuid, target_unit_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_authorized_operator()
    and private.can_access_organization(target_organization_id)
    and exists(
      select 1 from public.organization_unit_member m
      join public.organization_unit u on u.id = m.unit_id and u.organization_id = m.organization_id
      where m.organization_id = target_organization_id
        and m.unit_id = target_unit_id
        and m.operator_access_id = private.current_operator_access_id()
        and m.unit_role = 'director'
        and m.active and u.active
    )
    and (
      coalesce((select o.evaluation_reviewers_can_self_evaluate from public.organization o
                where o.id = target_organization_id), true)
      or not private.current_operator_has_permission(target_organization_id, 'evaluations.review')
    );
$$;

create or replace function public.evaluation_access_overview(target_organization_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  director_units jsonb;
  is_admin boolean := false;
  is_reviewer boolean := false;
  reviewers_self_evaluate boolean := true;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;
  org_id := case when private.is_super_admin() and target_organization_id is not null
    then target_organization_id else private.current_operator_organization_id() end;
  if org_id is null or not private.can_access_organization(org_id) then
    raise exception using errcode='42501', message='Organization access denied';
  end if;
  is_reviewer := private.current_operator_has_permission(org_id, 'evaluations.review');
  select coalesce(o.evaluation_reviewers_can_self_evaluate, true) into reviewers_self_evaluate
  from public.organization o where o.id = org_id;
  reviewers_self_evaluate := coalesce(reviewers_self_evaluate, true);

  select coalesce(jsonb_agg(u.id order by u.sort_order, u.name), '[]'::jsonb)
    into director_units
  from public.organization_unit_member m
  join public.organization_unit u on u.id=m.unit_id and u.organization_id=m.organization_id
  where m.organization_id=org_id
    and m.operator_access_id=private.current_operator_access_id()
    and m.unit_role='director' and m.active and u.active
    and (reviewers_self_evaluate or not is_reviewer);
  is_admin := private.can_manage_organization(org_id);
  return jsonb_build_object(
    'organization_id', org_id,
    'director_unit_ids', director_units,
    'is_digen_director', private.current_operator_is_digen_director(org_id),
    'is_evaluation_reviewer', is_reviewer,
    'reviewers_can_self_evaluate', reviewers_self_evaluate,
    'can_review_all_evaluations', is_admin or is_reviewer,
    'can_read_draft_evaluations', is_admin
  );
end;
$$;

-- Policies -----------------------------------------------------------------------------------
alter policy executive_evaluation_read on public.executive_self_evaluation
using (
  (private.can_access_organization(organization_id)
    and (private.can_manage_organization(organization_id)
      or (status = 'submitted' and private.current_operator_has_permission(organization_id, 'evaluations.review'))))
  or (evaluator_user_id = (select auth.uid()) and private.can_self_evaluate_unit(organization_id, unit_id))
);

alter policy institutional_objective_select on public.institutional_objective
using (
  private.can_access_organization(organization_id)
  and (
    work_plan_id is null
    or private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or private.current_operator_has_permission(organization_id, 'management.read_all')
    or private.current_operator_has_permission(organization_id, 'calendar.manage_all')
    or exists (
      select 1 from public.unit_work_plan p
      where p.id = institutional_objective.work_plan_id
        and p.unit_id = any ((select private.current_visible_unit_ids())::uuid[])
    )
  )
);

alter policy management_indicator_select on public.management_indicator
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or private.current_operator_has_permission(organization_id, 'management.read_all')
    or private.current_operator_has_permission(organization_id, 'calendar.manage_all')
    or unit_id = any ((select private.current_visible_unit_ids())::uuid[])
  )
);

alter policy unit_work_plan_select on public.unit_work_plan
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.can_review_management_reports(organization_id)
    or private.current_operator_has_permission(organization_id, 'management.read_all')
    or private.current_operator_has_permission(organization_id, 'calendar.manage_all')
    or unit_id = any ((select private.current_visible_unit_ids())::uuid[])
  )
);
