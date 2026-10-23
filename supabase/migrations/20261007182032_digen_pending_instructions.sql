alter table public.unit_pending_issue
  add column if not exists origin text not null default 'unit',
  add column if not exists issued_by_unit_id uuid references public.organization_unit(id) on delete set null;

alter table public.unit_pending_issue
  drop constraint if exists unit_pending_issue_origin_check;

alter table public.unit_pending_issue
  add constraint unit_pending_issue_origin_check
  check (origin in ('unit','digen_instruction'));

create index if not exists unit_pending_issue_issued_by_unit_id_idx
  on public.unit_pending_issue(issued_by_unit_id)
  where issued_by_unit_id is not null;

create or replace function private.current_operator_is_digen_director(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and exists (
      select 1
      from public.organization_unit_member m
      join public.organization_unit u
        on u.id = m.unit_id
       and u.organization_id = m.organization_id
       and u.active
      where m.organization_id = target_organization_id
        and m.operator_access_id = private.current_operator_access_id()
        and m.active
        and m.unit_role = 'director'
        and upper(trim(u.code)) = 'DIGEN'
    );
$$;

create or replace function private.pending_instruction_target_unit_ids_json(target_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.current_operator_is_digen_director(target_organization_id) then '[]'::jsonb
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

create or replace function private.guard_pending_issue_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
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

  caller_is_digen_director := private.current_operator_is_digen_director(new.organization_id);

  select u.id into digen_id
  from public.organization_unit u
  where u.organization_id = new.organization_id
    and u.active
    and upper(trim(u.code)) = 'DIGEN'
  limit 1;

  if tg_op = 'INSERT' then
    if new.origin = 'digen_instruction' then
      if not caller_is_digen_director then
        raise exception using errcode='42501', message='Only the DIGEN Director General can issue instructions.';
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

drop policy if exists unit_pending_issue_select on public.unit_pending_issue;
create policy unit_pending_issue_select
on public.unit_pending_issue
for select
to authenticated
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_organization(organization_id)
    or private.current_operator_is_digen_director(organization_id)
    or unit_id = any(private.current_visible_unit_ids())
  )
);

drop policy if exists unit_pending_issue_insert on public.unit_pending_issue;
create policy unit_pending_issue_insert
on public.unit_pending_issue
for insert
to authenticated
with check (
  private.can_access_organization(organization_id)
  and (
    (select private.can_access_pending_issue_unit(unit_id))
    or (
      origin = 'digen_instruction'
      and (select private.current_operator_is_digen_director(organization_id))
    )
  )
);

drop policy if exists unit_pending_issue_update on public.unit_pending_issue;
create policy unit_pending_issue_update
on public.unit_pending_issue
for update
to authenticated
using (
  (select private.can_access_pending_issue_unit(unit_id))
  or (
    origin = 'digen_instruction'
    and (select private.current_operator_is_digen_director(organization_id))
  )
)
with check (
  private.can_access_organization(organization_id)
  and (
    (select private.can_access_pending_issue_unit(unit_id))
    or (
      origin = 'digen_instruction'
      and (select private.current_operator_is_digen_director(organization_id))
    )
  )
);

drop policy if exists unit_pending_issue_delete on public.unit_pending_issue;
create policy unit_pending_issue_delete
on public.unit_pending_issue
for delete
to authenticated
using (
  (
    origin = 'unit'
    and (select private.can_access_pending_issue_unit(unit_id))
  )
  or (
    origin = 'digen_instruction'
    and (select private.current_operator_is_digen_director(organization_id))
  )
);

create or replace function public.pending_issue_access_overview(target_organization_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
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
  can_issue := private.current_operator_is_digen_director(org_id);

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

revoke all on function private.current_operator_is_digen_director(uuid) from public, anon;
grant execute on function private.current_operator_is_digen_director(uuid) to authenticated;

revoke all on function private.pending_instruction_target_unit_ids_json(uuid) from public, anon;
grant execute on function private.pending_instruction_target_unit_ids_json(uuid) to authenticated;

revoke all on function public.pending_issue_access_overview(uuid) from public, anon;
grant execute on function public.pending_issue_access_overview(uuid) to authenticated;
