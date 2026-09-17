create or replace function public.save_unit_work_objective(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  org_id uuid := coalesce(nullif(payload->>'organization_id','')::uuid, private.current_operator_organization_id());
  plan_key uuid := nullif(payload->>'work_plan_id','')::uuid;
  objective_key uuid := nullif(payload->>'id','')::uuid;
  unit_key uuid;
  period_key uuid;
  objective_level_value text := coalesce(nullif(payload->>'objective_level',''),'general');
  objective_code_value text;
  unit_code_value text;
  code_prefix text;
  next_number integer;
begin
  if not private.is_authorized_operator() or org_id is null or plan_key is null or not private.can_manage_work_plan(plan_key) then
    raise exception using errcode='42501', message='Objective access denied';
  end if;

  select p.unit_id, p.management_period_id, u.code
    into unit_key, period_key, unit_code_value
  from public.unit_work_plan p
  join public.organization_unit u on u.id = p.unit_id
  where p.id = plan_key and p.organization_id = org_id;

  if unit_key is null then
    raise exception using errcode='23503', message='Work plan not found';
  end if;

  if objective_level_value not in ('general','specific','operational') then
    raise exception using errcode='23514', message='Invalid objective level';
  end if;

  code_prefix := upper(regexp_replace(unit_code_value,'[^A-Za-z0-9]+','','g')) || '-' ||
    case objective_level_value when 'general' then 'OG' when 'specific' then 'OE' else 'OP' end || '-';

  if objective_key is null then
    select coalesce(max(nullif(regexp_replace(o.code,'^.*-([0-9]+)$','\1'),'')::integer),0)+1
      into next_number
    from public.institutional_objective o
    where o.management_period_id = period_key and o.code like code_prefix || '%';

    objective_code_value := code_prefix || lpad(next_number::text,2,'0');

    insert into public.institutional_objective(
      organization_id, management_period_id, work_plan_id, parent_objective_id,
      code, title, description, objective_level, weight, status, created_by, updated_by
    ) values (
      org_id, period_key, plan_key, nullif(payload->>'parent_objective_id','')::uuid,
      objective_code_value, trim(payload->>'title'), nullif(trim(payload->>'description'),''),
      objective_level_value, nullif(payload->>'weight','')::numeric,
      coalesce(nullif(payload->>'status',''),'active'), auth.uid(), auth.uid()
    ) returning id into objective_key;
  else
    update public.institutional_objective o
    set parent_objective_id = nullif(payload->>'parent_objective_id','')::uuid,
        title = trim(payload->>'title'),
        description = nullif(trim(payload->>'description'),''),
        objective_level = objective_level_value,
        weight = nullif(payload->>'weight','')::numeric,
        status = coalesce(nullif(payload->>'status',''),'active'),
        work_plan_id = plan_key,
        updated_by = auth.uid(),
        updated_at = now()
    where o.id = objective_key
      and o.organization_id = org_id
      and o.work_plan_id = plan_key;

    if not found then
      raise exception using errcode='42501', message='Objective not found';
    end if;
  end if;

  delete from public.objective_unit_assignment a
  where a.objective_id = objective_key
    and a.assignment_type = 'responsible';

  insert into public.objective_unit_assignment(organization_id, objective_id, unit_id, assignment_type)
  values(org_id, objective_key, unit_key, 'responsible');

  return objective_key;
end;
$$;

revoke all on function public.save_unit_work_objective(jsonb) from public;
revoke all on function public.save_unit_work_objective(jsonb) from anon;
grant execute on function public.save_unit_work_objective(jsonb) to authenticated;
