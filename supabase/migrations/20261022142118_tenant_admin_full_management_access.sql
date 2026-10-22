-- SPRINT S10.2 (#136, product owner decision 2026-10-22): the tenant admin acts on every unit
-- of its organization without restrictions in Calendar, Pending issues and Evaluation.
-- "Tenant admin" = private.can_manage_organization(org), the same check 20261008145936 uses
-- for cross-unit editing (it also covers super_admin, as every can_manage_organization caller).
-- Every permission granted before this migration is kept; only the admin is added.
--
-- Calendar:   review (validate/observe), shared-view switch, delete and "Vaciar calendario".
-- Pending:    issue, rewrite and delete DIGEN instructions, like the DIGEN director.
-- Evaluation: read drafts too (submitted rows were already readable).

-- Pending issues: one helper for "may act as the DIGEN instruction issuer". --------------
create or replace function private.can_issue_digen_instructions(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.current_operator_is_digen_director(target_organization_id)
    or (
      private.is_authorized_operator()
      and private.can_access_organization(target_organization_id)
      and private.can_manage_organization(target_organization_id)
    );
$$;
revoke all on function private.can_issue_digen_instructions(uuid) from public, anon;
grant execute on function private.can_issue_digen_instructions(uuid) to authenticated;

-- Same body as 20261007182032, with the issuer check widened to the helper above.
create or replace function private.guard_pending_issue_scope()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  digen_id uuid;
  caller_is_digen_director boolean := false;
begin
  if not exists (
    select 1
    from public.organization_unit u
    where u.id = new.unit_id
      and u.organization_id = new.organization_id
      and u.active
  ) then
    raise exception using errcode='23514', message='Pending issue unit must belong to the same organization.';
  end if;

  if not exists (
    select 1
    from public.management_period mp
    where mp.id = new.management_period_id
      and mp.organization_id = new.organization_id
  ) then
    raise exception using errcode='23514', message='Pending issue period must belong to the same organization.';
  end if;

  caller_is_digen_director := private.can_issue_digen_instructions(new.organization_id);

  select u.id into digen_id
  from public.organization_unit u
  where u.organization_id = new.organization_id
    and u.active
    and upper(trim(u.code)) = 'DIGEN'
  limit 1;

  if tg_op = 'INSERT' then
    if new.origin = 'digen_instruction' then
      if not caller_is_digen_director then
        raise exception using errcode='42501', message='Only the DIGEN Director General or the organization administrator can issue instructions.';
      end if;
      if new.unit_id = digen_id then
        raise exception using errcode='23514', message='DIGEN instructions must be assigned to another unit.';
      end if;
      new.issued_by_unit_id := digen_id;
      new.status := 'pending';
      new.completed_at := null;
    else
      new.origin := 'unit';
      new.issued_by_unit_id := null;
    end if;
  else
    if old.origin = 'digen_instruction' and not caller_is_digen_director then
      if not private.can_access_pending_issue_unit(old.unit_id) then
        raise exception using errcode='42501', message='Only the assigned unit can change instruction status.';
      end if;

      if new.organization_id is distinct from old.organization_id
        or new.management_period_id is distinct from old.management_period_id
        or new.unit_id is distinct from old.unit_id
        or new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.urgency is distinct from old.urgency
        or new.due_date is distinct from old.due_date
        or new.origin is distinct from old.origin
        or new.issued_by_unit_id is distinct from old.issued_by_unit_id
        or new.created_by is distinct from old.created_by
        or new.created_at is distinct from old.created_at
        or new.completed_at is distinct from old.completed_at
      then
        raise exception using errcode='42501', message='Only the assigned unit can change instruction status.';
      end if;
    end if;

    if old.origin = 'digen_instruction' and caller_is_digen_director then
      new.origin := 'digen_instruction';
      new.issued_by_unit_id := digen_id;
    elsif old.origin = 'unit' and new.origin is distinct from old.origin then
      raise exception using errcode='42501', message='A unit pending issue cannot be converted into a DIGEN instruction.';
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();

  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create or replace function private.pending_instruction_target_unit_ids_json(target_organization_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case
    when not private.can_issue_digen_instructions(target_organization_id) then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(u.id order by u.sort_order, u.name)
        from public.organization_unit u
        where u.organization_id = target_organization_id
          and u.active
          and upper(trim(u.code)) not in ('GEN','DIGEN')
      ),
      '[]'::jsonb
    )
  end;
$$;

-- Stays security invoker (20261001155746).
create or replace function public.pending_issue_access_overview(target_organization_id uuid default null)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  org_id uuid;
  membership_unit_ids jsonb;
  consolidated boolean := false;
  can_issue boolean := false;
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
  can_issue := private.can_issue_digen_instructions(org_id);

  return jsonb_build_object(
    'organization_id', org_id,
    'digen_unit_id', private.current_top_unit_id(org_id),
    'is_digen', consolidated,
    'unit_ids', membership_unit_ids,
    'visible_unit_ids', private.visible_unit_ids_json(org_id),
    'can_view_consolidated', consolidated,
    'can_issue_instructions', can_issue,
    'instruction_target_unit_ids', case when can_issue then private.pending_instruction_target_unit_ids_json(org_id) else '[]'::jsonb end
  );
end;
$$;

alter policy unit_pending_issue_select on public.unit_pending_issue
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or unit_id = any(private.current_visible_unit_ids())
    or (origin = 'digen_instruction' and private.can_issue_digen_instructions(organization_id))
  )
);

alter policy unit_pending_issue_insert on public.unit_pending_issue
with check (
  private.can_access_organization(organization_id)
  and (
    (select private.can_access_pending_issue_unit(unit_id))
    or (origin = 'digen_instruction' and (select private.can_issue_digen_instructions(organization_id)))
  )
);

alter policy unit_pending_issue_update on public.unit_pending_issue
using (
  (select private.can_access_pending_issue_unit(unit_id))
  or (origin = 'digen_instruction' and (select private.can_issue_digen_instructions(organization_id)))
)
with check (
  private.can_access_organization(organization_id)
  and (
    (select private.can_access_pending_issue_unit(unit_id))
    or (origin = 'digen_instruction' and (select private.can_issue_digen_instructions(organization_id)))
  )
);

alter policy unit_pending_issue_delete on public.unit_pending_issue
using (
  (origin = 'unit' and (select private.can_access_pending_issue_unit(unit_id)))
  or (origin = 'digen_instruction' and (select private.can_issue_digen_instructions(organization_id)))
);

-- Calendar: review, shared view and delete. -------------------------------------------------
-- Same bodies as 20261021142000, with the tenant admin added to each check.
create or replace function private.guard_calendar_activity_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  caller_can_review boolean;
begin
  caller_can_review := private.can_supervise_unit(
    (select p.unit_id from public.unit_work_plan p where p.id = new.work_plan_id)
  ) or private.current_operator_is_gen_or_digen_leader(new.organization_id)
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
    or private.current_operator_is_gen_or_digen_leader(org_id)
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
    or private.current_operator_is_gen_or_digen_leader(org_id)
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

-- Deleting stays with active unit members, plus the tenant admin.
alter policy unit_work_activity_delete on public.unit_work_activity
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or exists (
      select 1 from public.unit_work_plan p
      join public.organization_unit_member m
        on m.unit_id = p.unit_id
       and m.organization_id = p.organization_id
      where p.id = unit_work_activity.work_plan_id
        and m.operator_access_id = private.current_operator_access_id()
        and m.active
        and m.unit_role in ('director','manager','operator','reviewer')
    )
  )
);

-- Same keys as 20261022135016; the admin now also reviews, and can_delete_consolidated is new.
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
  can_review_all := sees_all or private.current_operator_is_gen_or_digen_leader(org_id);
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
revoke all on function public.calendar_access_overview(uuid, uuid) from public, anon;
grant execute on function public.calendar_access_overview(uuid, uuid) to authenticated;

-- Evaluation: the admin also reads drafts. Authors keep reading their own rows, and
-- GEN/DIGEN leaders keep reading submitted rows only. Writing is unchanged (authors only).
alter policy executive_evaluation_read on public.executive_self_evaluation
using (
  (private.can_access_organization(organization_id)
    and (private.can_manage_organization(organization_id)
      or (status = 'submitted' and private.current_operator_is_gen_or_digen_leader(organization_id))))
  or (evaluator_user_id = (select auth.uid())
    and private.can_self_evaluate_unit(organization_id, unit_id))
);

create or replace function public.evaluation_access_overview(target_organization_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  director_units jsonb;
  is_admin boolean := false;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;
  org_id := case when private.is_super_admin() and target_organization_id is not null
    then target_organization_id else private.current_operator_organization_id() end;
  if org_id is null or not private.can_access_organization(org_id) then
    raise exception using errcode='42501', message='Organization access denied';
  end if;
  select coalesce(jsonb_agg(u.id order by u.sort_order, u.name), '[]'::jsonb)
    into director_units
  from public.organization_unit_member m
  join public.organization_unit u on u.id=m.unit_id and u.organization_id=m.organization_id
  where m.organization_id=org_id
    and m.operator_access_id=private.current_operator_access_id()
    and m.unit_role='director' and m.active and u.active;
  is_admin := private.can_manage_organization(org_id);
  return jsonb_build_object(
    'organization_id', org_id,
    'director_unit_ids', director_units,
    'is_digen_director', private.current_operator_is_digen_director(org_id),
    'can_review_all_evaluations', is_admin or private.current_operator_is_gen_or_digen_leader(org_id),
    'can_read_draft_evaluations', is_admin
  );
end;
$$;
revoke all on function public.evaluation_access_overview(uuid) from public, anon;
grant execute on function public.evaluation_access_overview(uuid) to authenticated;
