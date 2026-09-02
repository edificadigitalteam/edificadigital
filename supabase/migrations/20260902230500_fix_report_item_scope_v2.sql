create or replace function public.save_unit_management_report_v2(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := coalesce(nullif(payload->>'organization_id','')::uuid, private.current_operator_organization_id());
  period_id uuid := nullif(payload->>'management_period_id','')::uuid;
  target_unit uuid := nullif(payload->>'unit_id','')::uuid;
  saved_id uuid := nullif(payload->>'id','')::uuid;
  next_status text := coalesce(nullif(payload->>'status',''),'draft');
  achievement_text text;
  challenge_text text;
  next_step_text text;
  value_text text;
  position_no integer;
begin
  if not private.is_authorized_operator() or org_id is null or period_id is null or target_unit is null or not private.can_manage_unit(target_unit) then
    raise exception using errcode='42501', message='Report access denied';
  end if;
  if next_status not in ('draft','submitted','reviewed','approved','closed') then
    raise exception using errcode='23514', message='Invalid report status';
  end if;

  select string_agg(trim(value), E'\n' order by ordinality) into achievement_text from jsonb_array_elements_text(coalesce(payload->'achievements','[]'::jsonb)) with ordinality as x(value,ordinality) where trim(value)<>'';
  select string_agg(trim(value), E'\n' order by ordinality) into challenge_text from jsonb_array_elements_text(coalesce(payload->'challenges','[]'::jsonb)) with ordinality as x(value,ordinality) where trim(value)<>'';
  select string_agg(trim(value), E'\n' order by ordinality) into next_step_text from jsonb_array_elements_text(coalesce(payload->'next_steps','[]'::jsonb)) with ordinality as x(value,ordinality) where trim(value)<>'';

  if saved_id is null then
    insert into public.unit_management_report(organization_id,management_period_id,unit_id,status,executive_summary,achievements,challenges,next_steps,reviewer_notes,submitted_at,reviewed_at,approved_at,created_by,updated_by)
    values(org_id,period_id,target_unit,next_status,nullif(trim(payload->>'executive_summary'),''),achievement_text,challenge_text,next_step_text,nullif(trim(payload->>'reviewer_notes'),''),case when next_status in ('submitted','reviewed','approved','closed') then now() end,case when next_status in ('reviewed','approved','closed') then now() end,case when next_status in ('approved','closed') then now() end,auth.uid(),auth.uid())
    returning id into saved_id;
  else
    update public.unit_management_report report set status=next_status, executive_summary=nullif(trim(payload->>'executive_summary'),''), achievements=achievement_text, challenges=challenge_text, next_steps=next_step_text, reviewer_notes=nullif(trim(payload->>'reviewer_notes'),''), submitted_at=case when next_status in ('submitted','reviewed','approved','closed') then coalesce(report.submitted_at,now()) else report.submitted_at end, reviewed_at=case when next_status in ('reviewed','approved','closed') then coalesce(report.reviewed_at,now()) else report.reviewed_at end, approved_at=case when next_status in ('approved','closed') then coalesce(report.approved_at,now()) else report.approved_at end, updated_by=auth.uid(), updated_at=now()
    where report.id=saved_id and report.organization_id=org_id and report.unit_id=target_unit;
    if not found then raise exception using errcode='42501', message='Report not found'; end if;
  end if;

  delete from public.unit_management_report_item row_item where row_item.report_id=saved_id;

  position_no := 0;
  for value_text in select value from jsonb_array_elements_text(coalesce(payload->'achievements','[]'::jsonb)) loop
    if trim(value_text)<>'' then insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,created_by,updated_by) values(org_id,saved_id,period_id,target_unit,'achievement',trim(value_text),position_no,auth.uid(),auth.uid()); position_no := position_no + 1; end if;
  end loop;
  position_no := 0;
  for value_text in select value from jsonb_array_elements_text(coalesce(payload->'challenges','[]'::jsonb)) loop
    if trim(value_text)<>'' then insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,created_by,updated_by) values(org_id,saved_id,period_id,target_unit,'challenge',trim(value_text),position_no,auth.uid(),auth.uid()); position_no := position_no + 1; end if;
  end loop;
  position_no := 0;
  for value_text in select value from jsonb_array_elements_text(coalesce(payload->'next_steps','[]'::jsonb)) loop
    if trim(value_text)<>'' then insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,created_by,updated_by) values(org_id,saved_id,period_id,target_unit,'next_step',trim(value_text),position_no,auth.uid(),auth.uid()); position_no := position_no + 1; end if;
  end loop;
  return saved_id;
end;
$$;

revoke all on function public.save_unit_management_report_v2(jsonb) from public;
grant execute on function public.save_unit_management_report_v2(jsonb) to authenticated;
