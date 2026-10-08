-- Tenant admins edit every unit's calendar and pending issues.
-- They already see every unit (can_manage_organization). Writing used to require
-- unit membership; an admin outside the organization chart could only read.
-- Issuing and rewriting DIGEN instructions stays with the DIGEN Director General
-- (guard_pending_issue_scope is unchanged).

create or replace function private.can_manage_calendar_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and exists (
      select 1
      from public.unit_work_plan p
      where p.id = target_plan_id
        and (
          private.can_manage_organization(p.organization_id)
          or exists (
            select 1
            from public.organization_unit_member m
            where m.unit_id = p.unit_id
              and m.organization_id = p.organization_id
              and m.active
              and m.operator_access_id = private.current_operator_access_id()
              and m.unit_role in ('director','manager','operator','reviewer')
          )
        )
    );
$$;

create or replace function private.can_access_pending_issue_unit(target_unit_id uuid)
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
      where u.id = target_unit_id
        and u.active
        and (
          private.can_manage_organization(u.organization_id)
          or exists (
            select 1
            from public.organization_unit_member m
            where m.unit_id = u.id
              and m.organization_id = u.organization_id
              and m.operator_access_id = private.current_operator_access_id()
              and m.active
              and m.unit_role in ('director','manager','operator','reviewer')
          )
        )
    );
$$;

revoke all on function private.can_manage_calendar_plan(uuid) from public, anon;
revoke all on function private.can_access_pending_issue_unit(uuid) from public, anon;
grant execute on function private.can_manage_calendar_plan(uuid) to authenticated;
grant execute on function private.can_access_pending_issue_unit(uuid) to authenticated;
