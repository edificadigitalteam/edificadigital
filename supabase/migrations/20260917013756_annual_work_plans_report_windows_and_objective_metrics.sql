-- Annual work plans, activity calendar, report windows and objective-linked reporting.
-- This migration reflects the production migration applied on 2026-09-17.

create table if not exists public.unit_work_plan (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  management_period_id uuid not null references public.management_period(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  title text not null,
  status text not null default 'planning' check (status in ('planning','active','closed')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(management_period_id, unit_id)
);

create table if not exists public.unit_work_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  work_plan_id uuid not null references public.unit_work_plan(id) on delete cascade,
  objective_id uuid not null references public.institutional_objective(id) on delete cascade,
  indicator_id uuid references public.management_indicator(id) on delete set null,
  title text not null,
  description text,
  start_date date not null,
  end_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  responsible_name text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.management_report_window (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  management_period_id uuid not null references public.management_period(id) on delete cascade,
  code text not null,
  title text not null,
  window_type text not null default 'periodic' check (window_type in ('periodic','annual')),
  start_date date not null,
  end_date date not null,
  due_date date,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(management_period_id, code),
  check (end_date >= start_date)
);

alter table public.institutional_objective add column if not exists work_plan_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.institutional_objective'::regclass and conname='institutional_objective_work_plan_id_fkey') then
    alter table public.institutional_objective add constraint institutional_objective_work_plan_id_fkey foreign key(work_plan_id) references public.unit_work_plan(id) on delete set null;
  end if;
end $$;

alter table public.unit_management_report add column if not exists report_window_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.unit_management_report'::regclass and conname='unit_management_report_report_window_id_fkey') then
    alter table public.unit_management_report add constraint unit_management_report_report_window_id_fkey foreign key(report_window_id) references public.management_report_window(id) on delete set null;
  end if;
end $$;

alter table public.unit_management_report_item add column if not exists objective_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.unit_management_report_item'::regclass and conname='unit_management_report_item_objective_id_fkey') then
    alter table public.unit_management_report_item add constraint unit_management_report_item_objective_id_fkey foreign key(objective_id) references public.institutional_objective(id) on delete set null;
  end if;
end $$;

alter table public.unit_management_report drop constraint if exists unit_management_report_management_period_id_unit_id_key;
create unique index if not exists unit_management_report_window_unit_uidx on public.unit_management_report(report_window_id, unit_id) where report_window_id is not null;
create index if not exists unit_management_report_window_idx on public.unit_management_report(report_window_id) where report_window_id is not null;
create index if not exists institutional_objective_work_plan_idx on public.institutional_objective(work_plan_id) where work_plan_id is not null;
create index if not exists unit_work_plan_org_period_idx on public.unit_work_plan(organization_id,management_period_id,unit_id);
create index if not exists unit_work_activity_plan_date_idx on public.unit_work_activity(work_plan_id,start_date,end_date);
create index if not exists unit_work_activity_objective_idx on public.unit_work_activity(objective_id);
create index if not exists unit_work_activity_indicator_idx on public.unit_work_activity(indicator_id) where indicator_id is not null;
create index if not exists management_report_window_period_idx on public.management_report_window(management_period_id,sort_order);
create index if not exists unit_management_report_item_objective_idx on public.unit_management_report_item(objective_id) where objective_id is not null;

create or replace function private.can_manage_work_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1 from public.unit_work_plan p
    where p.id=target_plan_id
      and private.can_access_organization(p.organization_id)
      and private.can_manage_unit(p.unit_id)
  );
$$;

alter table public.unit_work_plan enable row level security;
alter table public.unit_work_activity enable row level security;
alter table public.management_report_window enable row level security;

drop policy if exists unit_work_plan_select on public.unit_work_plan;
create policy unit_work_plan_select on public.unit_work_plan for select to authenticated using (private.can_access_organization(organization_id));
drop policy if exists unit_work_plan_insert on public.unit_work_plan;
create policy unit_work_plan_insert on public.unit_work_plan for insert to authenticated with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
drop policy if exists unit_work_plan_update on public.unit_work_plan;
create policy unit_work_plan_update on public.unit_work_plan for update to authenticated using (private.can_manage_unit(unit_id)) with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
drop policy if exists unit_work_plan_delete on public.unit_work_plan;
create policy unit_work_plan_delete on public.unit_work_plan for delete to authenticated using (private.can_manage_unit(unit_id));

drop policy if exists unit_work_activity_select on public.unit_work_activity;
create policy unit_work_activity_select on public.unit_work_activity for select to authenticated using (private.can_access_organization(organization_id));
drop policy if exists unit_work_activity_insert on public.unit_work_activity;
create policy unit_work_activity_insert on public.unit_work_activity for insert to authenticated with check (private.can_access_organization(organization_id) and private.can_manage_work_plan(work_plan_id));
drop policy if exists unit_work_activity_update on public.unit_work_activity;
create policy unit_work_activity_update on public.unit_work_activity for update to authenticated using (private.can_manage_work_plan(work_plan_id)) with check (private.can_access_organization(organization_id) and private.can_manage_work_plan(work_plan_id));
drop policy if exists unit_work_activity_delete on public.unit_work_activity;
create policy unit_work_activity_delete on public.unit_work_activity for delete to authenticated using (private.can_manage_work_plan(work_plan_id));

drop policy if exists management_report_window_select on public.management_report_window;
create policy management_report_window_select on public.management_report_window for select to authenticated using (private.can_access_organization(organization_id));
drop policy if exists management_report_window_insert on public.management_report_window;
create policy management_report_window_insert on public.management_report_window for insert to authenticated with check (private.can_manage_organization(organization_id));
drop policy if exists management_report_window_update on public.management_report_window;
create policy management_report_window_update on public.management_report_window for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
drop policy if exists management_report_window_delete on public.management_report_window;
create policy management_report_window_delete on public.management_report_window for delete to authenticated using (private.can_manage_organization(organization_id));

-- Objectives attached to a unit work plan can be managed by that unit.
drop policy if exists institutional_objective_insert on public.institutional_objective;
create policy institutional_objective_insert on public.institutional_objective for insert to authenticated with check (private.can_manage_organization(organization_id) or (work_plan_id is not null and private.can_manage_work_plan(work_plan_id)));
drop policy if exists institutional_objective_update on public.institutional_objective;
create policy institutional_objective_update on public.institutional_objective for update to authenticated using (private.can_manage_organization(organization_id) or (work_plan_id is not null and private.can_manage_work_plan(work_plan_id))) with check (private.can_manage_organization(organization_id) or (work_plan_id is not null and private.can_manage_work_plan(work_plan_id)));
drop policy if exists institutional_objective_delete on public.institutional_objective;
create policy institutional_objective_delete on public.institutional_objective for delete to authenticated using (private.can_manage_organization(organization_id) or (work_plan_id is not null and private.can_manage_work_plan(work_plan_id)));

-- Create one work plan per unit for existing annual periods.
insert into public.unit_work_plan(organization_id,management_period_id,unit_id,title,status)
select p.organization_id,p.id,u.id,'Plan Anual de Trabajo '||extract(year from p.start_date)::int||' · '||u.code,
       case when p.status='closed' then 'closed' when p.status='active' then 'active' else 'planning' end
from public.management_period p
join public.organization_unit u on u.organization_id=p.organization_id and u.active
where extract(year from p.start_date)=extract(year from p.end_date)
on conflict(management_period_id,unit_id) do nothing;

-- Link pre-existing objectives to the responsible unit work plan when possible.
update public.institutional_objective o
set work_plan_id=p.id
from public.objective_unit_assignment a
join public.unit_work_plan p on p.unit_id=a.unit_id and p.management_period_id=o.management_period_id
where a.objective_id=o.id and a.assignment_type='responsible' and o.work_plan_id is null;

-- Seed the three executive-board cuts plus the annual report for annual management periods.
insert into public.management_report_window(organization_id,management_period_id,code,title,window_type,start_date,end_date,due_date,sort_order)
select p.organization_id,p.id,x.code,x.title,x.window_type,x.start_date,x.end_date,x.due_date,x.sort_order
from public.management_period p
cross join lateral (
  values
    ('MAR'::text,'Junta Ejecutiva · Marzo'::text,'periodic'::text,make_date(extract(year from p.start_date)::int,1,1),make_date(extract(year from p.start_date)::int,3,31),make_date(extract(year from p.start_date)::int,3,31),10),
    ('JUL','Junta Ejecutiva · Julio','periodic',make_date(extract(year from p.start_date)::int,4,1),make_date(extract(year from p.start_date)::int,7,31),make_date(extract(year from p.start_date)::int,7,31),20),
    ('NOV','Junta Ejecutiva · Noviembre','periodic',make_date(extract(year from p.start_date)::int,8,1),make_date(extract(year from p.start_date)::int,11,30),make_date(extract(year from p.start_date)::int,11,30),30),
    ('ANNUAL','Informe anual','annual',make_date(extract(year from p.start_date)::int,1,1),make_date(extract(year from p.start_date)::int,12,31),make_date(extract(year from p.start_date)::int+1,1,31),40)
) as x(code,title,window_type,start_date,end_date,due_date,sort_order)
where extract(year from p.start_date)=extract(year from p.end_date)
on conflict(management_period_id,code) do nothing;

-- Window-aware report saving. Narrative achievements may link to an objective, an indicator, or both.
create or replace function public.save_unit_management_report_v4(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  org_id uuid := coalesce(nullif(payload->>'organization_id','')::uuid, private.current_operator_organization_id());
  window_id uuid := nullif(payload->>'report_window_id','')::uuid;
  period_id uuid;
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
  item_objective_id uuid;
  indicator_objective_id uuid;
  position_no integer := 0;
  achievement_text text;
  challenge_text text;
  next_step_text text;
begin
  if not private.is_authorized_operator() or org_id is null or window_id is null or target_unit is null then raise exception using errcode='42501', message='Report access denied'; end if;
  if next_status not in ('draft','submitted','reviewed','approved','closed') then raise exception using errcode='23514', message='Invalid report status'; end if;
  select w.management_period_id into period_id from public.management_report_window w where w.id=window_id and w.organization_id=org_id and w.active;
  if period_id is null then raise exception using errcode='23503', message='Report window not found'; end if;
  if not exists(select 1 from public.organization_unit u where u.id=target_unit and u.organization_id=org_id) then raise exception using errcode='23503', message='Unit does not belong to organization'; end if;
  unit_can_manage := private.can_manage_unit(target_unit);
  diaf_can_review := private.can_review_management_reports(org_id);
  if next_status in ('draft','submitted') and not (unit_can_manage or diaf_can_review) then raise exception using errcode='42501', message='Only the responsible unit can prepare or submit this report'; end if;
  if next_status in ('reviewed','approved','closed') and not diaf_can_review then raise exception using errcode='42501', message='Only DIAF or an organization administrator can review or approve management reports'; end if;
  select u.id into diaf_unit_id from public.organization_unit u where u.organization_id=org_id and upper(trim(u.code))='DIAF' and u.active order by u.sort_order nulls last,u.created_at limit 1;

  select string_agg(trim(x->>'statement'),E'\n' order by ordinality) into achievement_text from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) with ordinality as r(x,ordinality) where coalesce(x->>'item_type','')='achievement' and trim(coalesce(x->>'statement',''))<>'';
  select string_agg(trim(x->>'statement'),E'\n' order by ordinality) into challenge_text from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) with ordinality as r(x,ordinality) where coalesce(x->>'item_type','')='challenge' and trim(coalesce(x->>'statement',''))<>'';
  select string_agg(trim(x->>'statement'),E'\n' order by ordinality) into next_step_text from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) with ordinality as r(x,ordinality) where coalesce(x->>'item_type','')='next_step' and trim(coalesce(x->>'statement',''))<>'';

  if saved_id is null then select r.id into saved_id from public.unit_management_report r where r.report_window_id=window_id and r.unit_id=target_unit limit 1; end if;
  if saved_id is null then
    insert into public.unit_management_report(organization_id,management_period_id,report_window_id,unit_id,status,executive_summary,achievements,challenges,next_steps,reviewer_notes,submitted_to_unit_id,submitted_at,reviewed_at,approved_at,reviewed_by,approved_by,created_by,updated_by)
    values(org_id,period_id,window_id,target_unit,next_status,nullif(trim(payload->>'executive_summary'),''),achievement_text,challenge_text,next_step_text,nullif(trim(payload->>'reviewer_notes'),''),case when next_status in ('submitted','reviewed','approved','closed') then diaf_unit_id end,case when next_status in ('submitted','reviewed','approved','closed') then now() end,case when next_status in ('reviewed','approved','closed') then now() end,case when next_status in ('approved','closed') then now() end,case when next_status in ('reviewed','approved','closed') then auth.uid() end,case when next_status in ('approved','closed') then auth.uid() end,auth.uid(),auth.uid()) returning id into saved_id;
  else
    update public.unit_management_report r set status=next_status,report_window_id=window_id,management_period_id=period_id,executive_summary=nullif(trim(payload->>'executive_summary'),''),achievements=achievement_text,challenges=challenge_text,next_steps=next_step_text,reviewer_notes=nullif(trim(payload->>'reviewer_notes'),''),submitted_to_unit_id=case when next_status in ('submitted','reviewed','approved','closed') then coalesce(r.submitted_to_unit_id,diaf_unit_id) else r.submitted_to_unit_id end,submitted_at=case when next_status in ('submitted','reviewed','approved','closed') then coalesce(r.submitted_at,now()) else r.submitted_at end,reviewed_at=case when next_status in ('reviewed','approved','closed') then coalesce(r.reviewed_at,now()) else r.reviewed_at end,approved_at=case when next_status in ('approved','closed') then coalesce(r.approved_at,now()) else r.approved_at end,reviewed_by=case when next_status in ('reviewed','approved','closed') then coalesce(r.reviewed_by,auth.uid()) else r.reviewed_by end,approved_by=case when next_status in ('approved','closed') then coalesce(r.approved_by,auth.uid()) else r.approved_by end,updated_by=auth.uid(),updated_at=now()
    where r.id=saved_id and r.organization_id=org_id and r.unit_id=target_unit;
    if not found then raise exception using errcode='42501', message='Report not found'; end if;
  end if;

  delete from public.unit_management_report_item ri where ri.report_id=saved_id;
  for item in select value from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) loop
    item_type_value := coalesce(nullif(item->>'item_type',''),'achievement');
    item_statement := trim(coalesce(item->>'statement',''));
    item_indicator_id := nullif(item->>'indicator_id','')::uuid;
    item_objective_id := nullif(item->>'objective_id','')::uuid;
    if item_statement='' then continue; end if;
    if item_type_value not in ('achievement','challenge','next_step') then raise exception using errcode='23514', message='Invalid report item type'; end if;
    if item_indicator_id is not null then
      select i.objective_id into indicator_objective_id from public.management_indicator i where i.id=item_indicator_id and i.organization_id=org_id and i.management_period_id=period_id and i.unit_id=target_unit and i.active;
      if not found then raise exception using errcode='23503', message='Indicator must belong to the same unit and management period'; end if;
      if item_objective_id is null then item_objective_id := indicator_objective_id; end if;
      if indicator_objective_id is not null and item_objective_id is distinct from indicator_objective_id then raise exception using errcode='23514', message='Statement objective and indicator do not match'; end if;
    end if;
    if item_objective_id is not null and not exists(select 1 from public.institutional_objective o join public.objective_unit_assignment a on a.objective_id=o.id and a.assignment_type='responsible' where o.id=item_objective_id and o.organization_id=org_id and o.management_period_id=period_id and a.unit_id=target_unit) then raise exception using errcode='23503', message='Objective must belong to the same unit and management period'; end if;
    if item_type_value='achievement' and item_objective_id is null and item_indicator_id is null then raise exception using errcode='23514', message='Every result statement must belong to an objective or indicator'; end if;
    insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,indicator_id,objective_id,created_by,updated_by)
    values(org_id,saved_id,period_id,target_unit,item_type_value,item_statement,position_no,item_indicator_id,item_objective_id,auth.uid(),auth.uid());
    position_no := position_no + 1;
  end loop;
  return saved_id;
end;
$$;

revoke all on function public.save_unit_management_report_v4(jsonb) from public;
revoke all on function public.save_unit_management_report_v4(jsonb) from anon;
grant execute on function public.save_unit_management_report_v4(jsonb) to authenticated;
