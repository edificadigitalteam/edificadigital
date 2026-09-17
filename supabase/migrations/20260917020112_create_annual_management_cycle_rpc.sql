create or replace function public.create_annual_management_cycle(target_organization_id uuid, target_year integer)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  org_id uuid := coalesce(target_organization_id, private.current_operator_organization_id());
  period_id uuid;
  start_on date;
  end_on date;
begin
  if not private.is_authorized_operator() or org_id is null or not private.can_manage_organization(org_id) then
    raise exception using errcode='42501', message='Annual management cycle access denied';
  end if;
  if target_year < 2000 or target_year > 2100 then
    raise exception using errcode='22023', message='Invalid management year';
  end if;

  start_on := make_date(target_year,1,1);
  end_on := make_date(target_year,12,31);

  select p.id into period_id
  from public.management_period p
  where p.organization_id=org_id and p.start_date=start_on and p.end_date=end_on
  limit 1;

  if period_id is null then
    insert into public.management_period(organization_id,name,start_date,end_date,status,created_by,updated_by)
    values(org_id,'Gestión '||target_year,start_on,end_on,'planning',auth.uid(),auth.uid())
    returning id into period_id;
  end if;

  insert into public.management_report_window(organization_id,management_period_id,code,title,window_type,start_date,end_date,due_date,sort_order,created_by,updated_by)
  values
    (org_id,period_id,'MAR','Junta Ejecutiva · Marzo','periodic',make_date(target_year,1,1),make_date(target_year,3,31),make_date(target_year,3,31),10,auth.uid(),auth.uid()),
    (org_id,period_id,'JUL','Junta Ejecutiva · Julio','periodic',make_date(target_year,4,1),make_date(target_year,7,31),make_date(target_year,7,31),20,auth.uid(),auth.uid()),
    (org_id,period_id,'NOV','Junta Ejecutiva · Noviembre','periodic',make_date(target_year,8,1),make_date(target_year,11,30),make_date(target_year,11,30),30,auth.uid(),auth.uid()),
    (org_id,period_id,'ANNUAL','Informe anual','annual',start_on,end_on,make_date(target_year+1,1,31),40,auth.uid(),auth.uid())
  on conflict(management_period_id,code) do update set
    title=excluded.title,window_type=excluded.window_type,start_date=excluded.start_date,end_date=excluded.end_date,due_date=excluded.due_date,sort_order=excluded.sort_order,active=true,updated_by=auth.uid(),updated_at=now();

  insert into public.unit_work_plan(organization_id,management_period_id,unit_id,title,status,created_by,updated_by)
  select org_id,period_id,u.id,'Plan Anual de Trabajo '||target_year||' · '||u.code,'planning',auth.uid(),auth.uid()
  from public.organization_unit u
  where u.organization_id=org_id and u.active
  on conflict(management_period_id,unit_id) do nothing;

  return period_id;
end;
$$;

revoke all on function public.create_annual_management_cycle(uuid,integer) from public;
revoke all on function public.create_annual_management_cycle(uuid,integer) from anon;
grant execute on function public.create_annual_management_cycle(uuid,integer) to authenticated;
