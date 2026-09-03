alter table public.unit_management_report_item
  add column if not exists indicator_id uuid references public.management_indicator(id) on delete set null;

alter table public.unit_management_report
  add column if not exists submitted_to_unit_id uuid references public.organization_unit(id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

create index if not exists unit_management_report_item_indicator_id_idx
  on public.unit_management_report_item(indicator_id)
  where indicator_id is not null;

create index if not exists unit_management_report_submitted_to_unit_id_idx
  on public.unit_management_report(submitted_to_unit_id)
  where submitted_to_unit_id is not null;

create or replace function private.can_review_management_reports(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_finance(target_organization_id);
$$;

create or replace function public.save_unit_management_report_v3(payload jsonb)
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
  diaf_unit_id uuid;
  unit_can_manage boolean;
  diaf_can_review boolean;
  item jsonb;
  item_type_value text;
  item_statement text;
  item_indicator_id uuid;
  position_no integer := 0;
  achievement_text text;
  challenge_text text;
  next_step_text text;
begin
  if not private.is_authorized_operator() or org_id is null or period_id is null or target_unit is null then
    raise exception using errcode='42501', message='Report access denied';
  end if;

  if next_status not in ('draft','submitted','reviewed','approved','closed') then
    raise exception using errcode='23514', message='Invalid report status';
  end if;

  if not exists (select 1 from public.organization_unit u where u.id=target_unit and u.organization_id=org_id) then
    raise exception using errcode='23503', message='Unit does not belong to organization';
  end if;
  if not exists (select 1 from public.management_period p where p.id=period_id and p.organization_id=org_id) then
    raise exception using errcode='23503', message='Management period does not belong to organization';
  end if;

  unit_can_manage := private.can_manage_unit(target_unit);
  diaf_can_review := private.can_review_management_reports(org_id);

  if next_status in ('draft','submitted') and not (unit_can_manage or diaf_can_review) then
    raise exception using errcode='42501', message='Only the responsible unit can prepare or submit this report';
  end if;
  if next_status in ('reviewed','approved','closed') and not diaf_can_review then
    raise exception using errcode='42501', message='Only DIAF or an organization administrator can review or approve management reports';
  end if;

  select u.id into diaf_unit_id
  from public.organization_unit u
  where u.organization_id=org_id and upper(trim(u.code))='DIAF' and u.active
  order by u.sort_order nulls last, u.created_at
  limit 1;

  select string_agg(trim(x->>'statement'), E'\n' order by ordinality) into achievement_text
  from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) with ordinality as item_rows(x,ordinality)
  where coalesce(x->>'item_type','')='achievement' and trim(coalesce(x->>'statement',''))<>'';
  select string_agg(trim(x->>'statement'), E'\n' order by ordinality) into challenge_text
  from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) with ordinality as item_rows(x,ordinality)
  where coalesce(x->>'item_type','')='challenge' and trim(coalesce(x->>'statement',''))<>'';
  select string_agg(trim(x->>'statement'), E'\n' order by ordinality) into next_step_text
  from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) with ordinality as item_rows(x,ordinality)
  where coalesce(x->>'item_type','')='next_step' and trim(coalesce(x->>'statement',''))<>'';

  if saved_id is null then
    insert into public.unit_management_report(
      organization_id,management_period_id,unit_id,status,executive_summary,achievements,challenges,next_steps,reviewer_notes,
      submitted_to_unit_id,submitted_at,reviewed_at,approved_at,reviewed_by,approved_by,created_by,updated_by
    ) values (
      org_id,period_id,target_unit,next_status,nullif(trim(payload->>'executive_summary'),''),achievement_text,challenge_text,next_step_text,
      nullif(trim(payload->>'reviewer_notes'),''),
      case when next_status in ('submitted','reviewed','approved','closed') then diaf_unit_id end,
      case when next_status in ('submitted','reviewed','approved','closed') then now() end,
      case when next_status in ('reviewed','approved','closed') then now() end,
      case when next_status in ('approved','closed') then now() end,
      case when next_status in ('reviewed','approved','closed') then auth.uid() end,
      case when next_status in ('approved','closed') then auth.uid() end,
      auth.uid(),auth.uid()
    ) returning id into saved_id;
  else
    update public.unit_management_report report
    set status=next_status,
        executive_summary=nullif(trim(payload->>'executive_summary'),''),
        achievements=achievement_text,
        challenges=challenge_text,
        next_steps=next_step_text,
        reviewer_notes=nullif(trim(payload->>'reviewer_notes'),''),
        submitted_to_unit_id=case when next_status in ('submitted','reviewed','approved','closed') then coalesce(report.submitted_to_unit_id,diaf_unit_id) else report.submitted_to_unit_id end,
        submitted_at=case when next_status in ('submitted','reviewed','approved','closed') then coalesce(report.submitted_at,now()) else report.submitted_at end,
        reviewed_at=case when next_status in ('reviewed','approved','closed') then coalesce(report.reviewed_at,now()) else report.reviewed_at end,
        approved_at=case when next_status in ('approved','closed') then coalesce(report.approved_at,now()) else report.approved_at end,
        reviewed_by=case when next_status in ('reviewed','approved','closed') then coalesce(report.reviewed_by,auth.uid()) else report.reviewed_by end,
        approved_by=case when next_status in ('approved','closed') then coalesce(report.approved_by,auth.uid()) else report.approved_by end,
        updated_by=auth.uid(),updated_at=now()
    where report.id=saved_id and report.organization_id=org_id and report.unit_id=target_unit;
    if not found then raise exception using errcode='42501', message='Report not found'; end if;
  end if;

  delete from public.unit_management_report_item row_item where row_item.report_id=saved_id;
  position_no := 0;
  for item in select value from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) loop
    item_type_value := coalesce(nullif(item->>'item_type',''),'achievement');
    item_statement := trim(coalesce(item->>'statement',''));
    item_indicator_id := nullif(item->>'indicator_id','')::uuid;
    if item_statement='' then continue; end if;
    if item_type_value not in ('achievement','challenge','next_step') then
      raise exception using errcode='23514', message='Invalid report item type';
    end if;
    if item_type_value='achievement' and item_indicator_id is null then
      raise exception using errcode='23514', message='Every achievement must be linked to one indicator';
    end if;
    if item_indicator_id is not null and not exists (
      select 1 from public.management_indicator i
      where i.id=item_indicator_id and i.organization_id=org_id and i.management_period_id=period_id and i.unit_id=target_unit and i.active
    ) then
      raise exception using errcode='23503', message='Indicator must belong to the same unit and management period';
    end if;
    insert into public.unit_management_report_item(
      organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,indicator_id,created_by,updated_by
    ) values (
      org_id,saved_id,period_id,target_unit,item_type_value,item_statement,position_no,item_indicator_id,auth.uid(),auth.uid()
    );
    position_no := position_no + 1;
  end loop;
  return saved_id;
end;
$$;

revoke all on function public.save_unit_management_report_v3(jsonb) from public;
revoke execute on function public.save_unit_management_report_v3(jsonb) from anon;
grant execute on function public.save_unit_management_report_v3(jsonb) to authenticated;

comment on column public.unit_management_report_item.indicator_id is 'Links each report activity/achievement to its source management indicator so reports are assembled from the same accountability data used in Tracking.';
comment on column public.unit_management_report.submitted_to_unit_id is 'Organizational unit that receives the final accountability report. For CNBV this resolves automatically to DIAF.';
