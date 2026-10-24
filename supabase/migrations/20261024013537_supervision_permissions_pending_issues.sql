-- SPRINT S11 stage 3 (#147): institutional instructions in Pending issues follow the
-- instructions.issue permission, assigned to people, instead of the DIGEN unit code.
--
-- - private.current_operator_is_digen_director and private.can_issue_digen_instructions keep
--   their names until the cleanup stage, and now read instructions.issue. The tenant admin
--   keeps issuing without the permission (#136).
-- - Targets: every active unit the issuer does not belong to. For the DIGEN director of CNBV
--   this is the same list as today (every unit except GEN and DIGEN, which they direct).
-- - The issuing unit is the issuer's most specific primary unit (product owner, 2026-10-23),
--   or null when the issuer belongs to no unit.
-- - New column unit_pending_issue.issued_by_name: a snapshot of the issuer's name, written by
--   the database. The screen shows "Unit · Person" without reading private.operator_access.
-- Every replaced function is copied from its live definition in edifydb.

-- Refresh the initial load right before switching the rules ----------------------------------
select private.backfill_supervision_permissions();

-- Issuer name --------------------------------------------------------------------------------
alter table public.unit_pending_issue
  add column if not exists issued_by_name text;
alter table public.unit_pending_issue
  drop constraint if exists unit_pending_issue_issued_by_name_check;
alter table public.unit_pending_issue
  add constraint unit_pending_issue_issued_by_name_check
  check (issued_by_name is null or char_length(issued_by_name) between 1 and 200);

-- Helpers ------------------------------------------------------------------------------------
-- Active units of the current operator in one organization.
create or replace function private.current_operator_member_unit_ids(target_organization_id uuid)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct m.unit_id), array[]::uuid[])
  from public.organization_unit_member m
  join public.organization_unit u on u.id = m.unit_id and u.organization_id = m.organization_id
  where m.organization_id = target_organization_id
    and m.operator_access_id = private.current_operator_access_id()
    and m.active and u.active;
$$;
revoke all on function private.current_operator_member_unit_ids(uuid) from public, anon;
grant execute on function private.current_operator_member_unit_ids(uuid) to authenticated;

-- The unit an instruction is issued from: primary memberships first, then the most specific
-- unit (deepest in the hierarchy), then sort order and name.
create or replace function private.current_operator_issuing_unit_id(target_organization_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  with recursive own as (
    select u.id, u.parent_unit_id, u.sort_order, u.name, bool_or(m.is_primary) as is_primary
    from public.organization_unit_member m
    join public.organization_unit u on u.id = m.unit_id and u.organization_id = m.organization_id
    where m.organization_id = target_organization_id
      and m.operator_access_id = private.current_operator_access_id()
      and m.active and u.active
    group by u.id, u.parent_unit_id, u.sort_order, u.name
  ), depth(id, parent_id, level) as (
    select own.id, own.parent_unit_id, 0 from own
    union all
    select depth.id, parent.parent_unit_id, depth.level + 1
    from depth
    join public.organization_unit parent on parent.id = depth.parent_id
    where depth.level < 50
  )
  select own.id
  from own
  join (select id, max(level) as level from depth group by id) d on d.id = own.id
  order by own.is_primary desc, d.level desc, own.sort_order, own.name, own.id
  limit 1;
$$;
revoke all on function private.current_operator_issuing_unit_id(uuid) from public, anon;
grant execute on function private.current_operator_issuing_unit_id(uuid) to authenticated;

create or replace function private.current_operator_display_name()
returns text language sql stable security definer set search_path = ''
as $$
  select left(coalesce(nullif(trim(a.display_name), ''), a.email), 200)
  from private.operator_access a
  where a.id = private.current_operator_access_id();
$$;
revoke all on function private.current_operator_display_name() from public, anon;
grant execute on function private.current_operator_display_name() to authenticated;

-- Permission checks --------------------------------------------------------------------------
create or replace function private.current_operator_is_digen_director(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.current_operator_has_permission(target_organization_id, 'instructions.issue');
$$;

create or replace function private.can_issue_digen_instructions(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.current_operator_has_permission(target_organization_id, 'instructions.issue')
    or (
      private.is_authorized_operator()
      and private.can_access_organization(target_organization_id)
      and private.can_manage_organization(target_organization_id)
    );
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
          and not (u.id = any (private.current_operator_member_unit_ids(target_organization_id)))
      ),
      '[]'::jsonb
    )
  end;
$$;

-- Trigger ------------------------------------------------------------------------------------
create or replace function private.guard_pending_issue_scope()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  caller_can_issue boolean := false;
  issuer_units uuid[];
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

  caller_can_issue := private.can_issue_digen_instructions(new.organization_id);
  issuer_units := private.current_operator_member_unit_ids(new.organization_id);

  if tg_op = 'INSERT' then
    if new.origin = 'digen_instruction' then
      if not caller_can_issue then
        raise exception using errcode='42501', message='Only people allowed to issue instructions or the organization administrator can issue instructions.';
      end if;
      if new.unit_id = any (issuer_units) then
        raise exception using errcode='23514', message='Assign the instruction to a unit you do not belong to.';
      end if;
      new.issued_by_unit_id := private.current_operator_issuing_unit_id(new.organization_id);
      new.issued_by_name := private.current_operator_display_name();
      new.status := 'pending';
      new.completed_at := null;
    else
      new.origin := 'unit';
      new.issued_by_unit_id := null;
      new.issued_by_name := null;
    end if;
  else
    if old.origin = 'digen_instruction' and not caller_can_issue then
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
        or new.issued_by_name is distinct from old.issued_by_name
        or new.created_by is distinct from old.created_by
        or new.created_at is distinct from old.created_at
        or new.completed_at is distinct from old.completed_at
      then
        raise exception using errcode='42501', message='Only the assigned unit can change instruction status.';
      end if;
    end if;

    if old.origin = 'digen_instruction' and caller_can_issue then
      if new.unit_id is distinct from old.unit_id and new.unit_id = any (issuer_units) then
        raise exception using errcode='23514', message='Assign the instruction to a unit you do not belong to.';
      end if;
      new.origin := 'digen_instruction';
      new.issued_by_unit_id := old.issued_by_unit_id;
      new.issued_by_name := old.issued_by_name;
    elsif old.origin = 'unit' then
      if new.origin is distinct from old.origin then
        raise exception using errcode='42501', message='A unit pending issue cannot be converted into an instruction.';
      end if;
      new.issued_by_unit_id := null;
      new.issued_by_name := null;
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

-- Existing instructions: record the name of the person who created them -----------------------
-- The scope guard runs as the caller; this one-time correction runs without a caller.
alter table public.unit_pending_issue disable trigger unit_pending_issue_scope_guard;
update public.unit_pending_issue i
set issued_by_name = left(coalesce(nullif(trim(a.display_name), ''), a.email), 200)
from auth.users au
join private.operator_access a on lower(a.email) = lower(au.email)
where au.id = i.created_by
  and a.organization_id = i.organization_id
  and i.origin = 'digen_instruction'
  and i.issued_by_name is null;
alter table public.unit_pending_issue enable trigger unit_pending_issue_scope_guard;
