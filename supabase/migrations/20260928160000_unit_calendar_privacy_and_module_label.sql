-- Institutional calendar privacy and per-tenant module label.

alter table public.organization
  add column if not exists calendar_module_label text;

alter table public.organization
  drop constraint if exists organization_calendar_module_label_check;
alter table public.organization
  add constraint organization_calendar_module_label_check
  check (calendar_module_label is null or length(trim(calendar_module_label)) > 0);

comment on column public.organization.calendar_module_label is
  'Tenant override for the institutional calendar module label. Null uses the default label Calendario.';

create or replace function private.is_digen_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.organization_unit u
    join public.organization_unit_member m
      on m.unit_id=u.id
     and m.organization_id=u.organization_id
     and m.active
    where u.organization_id=target_organization_id
      and upper(trim(u.code))='DIGEN'
      and u.active
      and m.operator_access_id=private.current_operator_access_id()
  );
$$;

create or replace function private.can_view_all_unit_calendar(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.is_super_admin() or private.is_digen_member(target_organization_id);
$$;

create or replace function private.can_manage_calendar_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.is_super_admin() or exists (
    select 1
    from public.organization_unit u
    join public.organization_unit_member m
      on m.unit_id=u.id
     and m.organization_id=u.organization_id
     and m.active
    where u.id=target_unit_id
      and u.active
      and m.operator_access_id=private.current_operator_access_id()
      and m.unit_role in ('director','manager','operator','reviewer')
  );
$$;

revoke all on function private.is_digen_member(uuid) from public,anon;
revoke all on function private.can_view_all_unit_calendar(uuid) from public,anon;
revoke all on function private.can_manage_calendar_unit(uuid) from public,anon;
grant execute on function private.is_digen_member(uuid) to authenticated;
grant execute on function private.can_view_all_unit_calendar(uuid) to authenticated;
grant execute on function private.can_manage_calendar_unit(uuid) to authenticated;

drop policy if exists unit_work_activity_select on public.unit_work_activity;
create policy unit_work_activity_select
on public.unit_work_activity
for select
to authenticated
using (
  exists (
    select 1
    from public.unit_work_plan p
    where p.id=work_plan_id
      and p.organization_id=organization_id
      and (
        private.can_manage_calendar_unit(p.unit_id)
        or private.can_view_all_unit_calendar(organization_id)
      )
  )
);

drop policy if exists unit_work_activity_insert on public.unit_work_activity;
create policy unit_work_activity_insert
on public.unit_work_activity
for insert
to authenticated
with check (
  exists (
    select 1
    from public.unit_work_plan p
    where p.id=work_plan_id
      and p.organization_id=organization_id
      and private.can_manage_calendar_unit(p.unit_id)
  )
);

drop policy if exists unit_work_activity_update on public.unit_work_activity;
create policy unit_work_activity_update
on public.unit_work_activity
for update
to authenticated
using (
  exists (
    select 1 from public.unit_work_plan p
    where p.id=work_plan_id
      and p.organization_id=organization_id
      and private.can_manage_calendar_unit(p.unit_id)
  )
)
with check (
  exists (
    select 1 from public.unit_work_plan p
    where p.id=work_plan_id
      and p.organization_id=organization_id
      and private.can_manage_calendar_unit(p.unit_id)
  )
);

drop policy if exists unit_work_activity_delete on public.unit_work_activity;
create policy unit_work_activity_delete
on public.unit_work_activity
for delete
to authenticated
using (
  exists (
    select 1 from public.unit_work_plan p
    where p.id=work_plan_id
      and p.organization_id=organization_id
      and private.can_manage_calendar_unit(p.unit_id)
  )
);

create or replace function public.admin_set_calendar_module_label(
  target_organization_id uuid,
  new_label text
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  cleaned_label text;
begin
  if not private.can_manage_organization(target_organization_id) then
    raise exception using errcode='42501', message='Only an organization administrator can change the module label.';
  end if;

  cleaned_label := nullif(trim(coalesce(new_label,'')),'');
  update public.organization
  set calendar_module_label=cleaned_label
  where id=target_organization_id;

  if not found then
    raise exception using errcode='P0002', message='The organization does not exist.';
  end if;

  return cleaned_label;
end;
$$;

revoke all on function public.admin_set_calendar_module_label(uuid,text) from public,anon;
grant execute on function public.admin_set_calendar_module_label(uuid,text) to authenticated;
