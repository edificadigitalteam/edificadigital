-- Synced from the applied migration history of the `edifydb` Supabase project
-- (rrqyihsjftlloizsccvi): version 20260917031741, name
-- `add_digen_and_management_report_oversight`. It had been applied to the
-- database with no counterpart in this repository. Everything below is that
-- recorded statement verbatim (md5 7c910a8d795022c8d774e27e94f0a97b) and must
-- stay immutable.
--
-- Replay note: the opening block seeds the DIGEN unit for the organization
-- whose code is `cnbv` and raises `CNBV organization not found` when that
-- organization is absent, so replaying this file against an empty local
-- database fails until that organization exists.

do $$
declare
  org_id uuid;
  digen_id uuid;
begin
  select id into org_id
  from public.organization
  where lower(code)='cnbv'
  limit 1;

  if org_id is null then
    raise exception 'CNBV organization not found';
  end if;

  select id into digen_id
  from public.organization_unit
  where organization_id=org_id and upper(trim(code))='DIGEN'
  limit 1;

  if digen_id is null then
    insert into public.organization_unit(
      organization_id,parent_unit_id,code,name,unit_type,description,sort_order,active
    ) values (
      org_id,null,'DIGEN','Dirección General','directorate',
      'Dirección General con supervisión institucional sobre las demás Direcciones y acceso al consolidado de informes.',
      5,true
    ) returning id into digen_id;
  else
    update public.organization_unit
    set name='Dirección General',
        unit_type='directorate',
        description='Dirección General con supervisión institucional sobre las demás Direcciones y acceso al consolidado de informes.',
        sort_order=5,
        active=true,
        updated_at=now()
    where id=digen_id;
  end if;

  update public.organization_unit
  set parent_unit_id=digen_id,
      updated_at=now()
  where organization_id=org_id
    and unit_type='directorate'
    and id<>digen_id
    and (parent_unit_id is null or parent_unit_id=digen_id);

  insert into public.unit_work_plan(
    organization_id,management_period_id,unit_id,title,status
  )
  select p.organization_id,p.id,digen_id,
         'Plan Anual de Trabajo '||extract(year from p.start_date)::int||' · DIGEN',
         case when p.status='closed' then 'closed' when p.status='active' then 'active' else 'planning' end
  from public.management_period p
  where p.organization_id=org_id
    and extract(year from p.start_date)=extract(year from p.end_date)
  on conflict(management_period_id,unit_id) do nothing;
end $$;

create or replace function private.can_view_all_management_reports(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    private.can_manage_organization(target_organization_id)
    or private.can_review_management_reports(target_organization_id)
    or exists (
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

create or replace function public.management_report_access_overview(target_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  org_id uuid;
  digen_id uuid;
  unit_ids jsonb;
  is_digen boolean := false;
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

  select u.id into digen_id
  from public.organization_unit u
  where u.organization_id=org_id and upper(trim(u.code))='DIGEN' and u.active
  limit 1;

  select coalesce(jsonb_agg(m.unit_id),'[]'::jsonb)
  into unit_ids
  from public.organization_unit_member m
  where m.organization_id=org_id
    and m.operator_access_id=private.current_operator_access_id()
    and m.active;

  if digen_id is not null then
    select exists(
      select 1
      from public.organization_unit_member m
      where m.organization_id=org_id
        and m.unit_id=digen_id
        and m.operator_access_id=private.current_operator_access_id()
        and m.active
    ) into is_digen;
  end if;

  return jsonb_build_object(
    'organization_id',org_id,
    'digen_unit_id',digen_id,
    'is_digen',is_digen,
    'can_view_all_reports',private.can_view_all_management_reports(org_id),
    'can_review_reports',private.can_review_management_reports(org_id),
    'unit_ids',unit_ids
  );
end;
$$;

revoke all on function public.management_report_access_overview(uuid) from public;
revoke all on function public.management_report_access_overview(uuid) from anon;
grant execute on function public.management_report_access_overview(uuid) to authenticated;

-- Reporting visibility now follows organizational responsibility:
-- own unit, DIAF/report reviewers, DIGEN, or organization administrators.
drop policy if exists unit_management_report_select on public.unit_management_report;
create policy unit_management_report_select
on public.unit_management_report
for select
to authenticated
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_unit(unit_id)
    or private.can_view_all_management_reports(organization_id)
  )
);

drop policy if exists unit_management_report_item_select on public.unit_management_report_item;
create policy unit_management_report_item_select
on public.unit_management_report_item
for select
to authenticated
using (
  private.can_access_organization(organization_id)
  and (
    private.can_manage_unit(unit_id)
    or private.can_view_all_management_reports(organization_id)
  )
);
