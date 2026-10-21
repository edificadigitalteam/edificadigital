-- Digital executive self-evaluation. Personal entries remain private to their author
-- until submission; DIGEN reads submitted entries institution-wide.
create table if not exists public.executive_self_evaluation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  management_period_id uuid not null references public.management_period(id) on delete restrict,
  unit_id uuid not null references public.organization_unit(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  director_name text not null,
  evaluation_date date,
  place text,
  entry_year integer,
  period_number integer,
  swot jsonb not null default '{"strengths":[],"opportunities":[],"weaknesses":[],"threats":[]}'::jsonb,
  skill_ratings jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(management_period_id,unit_id,created_by),
  check (length(btrim(director_name)) > 0),
  check (entry_year is null or entry_year between 1900 and 2100),
  check (period_number is null or period_number > 0),
  check (jsonb_typeof(swot) = 'object' and jsonb_typeof(skill_ratings) = 'object' and jsonb_typeof(achievements) = 'array')
);

create index if not exists executive_self_evaluation_unit_period_idx
  on public.executive_self_evaluation(organization_id,management_period_id,unit_id,status);
create index if not exists executive_self_evaluation_created_by_idx
  on public.executive_self_evaluation(created_by);

create or replace function private.is_digen_evaluation_viewer(target_organization_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select private.is_authorized_operator()
     and private.can_access_organization(target_organization_id)
     and exists (
        select 1 from public.organization_unit u
        join public.organization_unit_member m
          on m.unit_id=u.id and m.organization_id=u.organization_id
        where u.organization_id=target_organization_id and upper(btrim(u.code))='DIGEN'
          and u.active and m.active
          and m.operator_access_id=private.current_operator_access_id()
     );
$$;

create or replace function private.can_write_executive_evaluation(target_organization_id uuid,target_unit_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select private.is_authorized_operator()
     and private.can_access_organization(target_organization_id)
     and exists (
       select 1 from public.organization_unit u
       join public.organization_unit_member m on m.unit_id=u.id and m.organization_id=u.organization_id
       where u.id=target_unit_id and u.organization_id=target_organization_id and u.active and m.active
         and m.operator_access_id=private.current_operator_access_id()
         and m.unit_role in ('director','manager')
     );
$$;

create or replace function private.guard_executive_self_evaluation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if not exists(select 1 from public.management_period p where p.id=new.management_period_id and p.organization_id=new.organization_id)
     or not exists(select 1 from public.organization_unit u where u.id=new.unit_id and u.organization_id=new.organization_id)
  then raise exception using errcode='23514',message='Evaluation period and unit must belong to this organization'; end if;
  if tg_op='UPDATE' and (
    new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
    or new.management_period_id is distinct from old.management_period_id
    or new.unit_id is distinct from old.unit_id or new.created_by is distinct from old.created_by
  ) then raise exception using errcode='23514',message='Evaluation ownership and period cannot change'; end if;
  if new.status='submitted' then new.submitted_at:=coalesce(old.submitted_at,now()); else new.submitted_at:=null; end if;
  new.updated_at:=now();
  return new;
end;
$$;
drop trigger if exists executive_self_evaluation_guard on public.executive_self_evaluation;
create trigger executive_self_evaluation_guard before insert or update on public.executive_self_evaluation
for each row execute function private.guard_executive_self_evaluation();

alter table public.executive_self_evaluation enable row level security;
drop policy if exists evaluation_select on public.executive_self_evaluation;
create policy evaluation_select on public.executive_self_evaluation for select to authenticated
using (
  (created_by=(select auth.uid()) and private.can_write_executive_evaluation(organization_id,unit_id))
  or (status='submitted' and private.is_digen_evaluation_viewer(organization_id))
);
drop policy if exists evaluation_insert on public.executive_self_evaluation;
create policy evaluation_insert on public.executive_self_evaluation for insert to authenticated
with check (created_by=(select auth.uid()) and private.can_write_executive_evaluation(organization_id,unit_id));
drop policy if exists evaluation_update on public.executive_self_evaluation;
create policy evaluation_update on public.executive_self_evaluation for update to authenticated
using (status='draft' and created_by=(select auth.uid()) and private.can_write_executive_evaluation(organization_id,unit_id))
with check (created_by=(select auth.uid()) and private.can_write_executive_evaluation(organization_id,unit_id));
revoke all on public.executive_self_evaluation from public,anon;
grant select,insert,update on public.executive_self_evaluation to authenticated;

alter table public.organization add column if not exists evaluation_module_label text;
alter table public.organization drop constraint if exists organization_evaluation_module_label_check;
alter table public.organization add constraint organization_evaluation_module_label_check
check (evaluation_module_label is null or char_length(btrim(evaluation_module_label)) between 1 and 60);

create or replace function public.admin_set_evaluation_module_label(target_organization_id uuid, new_label text)
returns text language plpgsql security definer set search_path=''
as $$
declare clean_label text:=nullif(btrim(coalesce(new_label,'')),'');
begin
  if not private.is_authorized_operator() or not private.can_manage_organization(target_organization_id) then
    raise exception using errcode='42501',message='Module label access denied';
  end if;
  if clean_label is not null and char_length(clean_label)>60 then
    raise exception using errcode='22023',message='Module label must be at most 60 characters';
  end if;
  update public.organization set evaluation_module_label=clean_label where id=target_organization_id;
  if not found then raise exception using errcode='P0002',message='Organization not found'; end if;
  return coalesce(clean_label,'Evaluación');
end;
$$;
revoke all on function public.admin_set_evaluation_module_label(uuid,text) from public,anon;
grant execute on function public.admin_set_evaluation_module_label(uuid,text) to authenticated;

-- Controlled DIGEN correction during the annual calendar meeting. Preserve plan,
-- unit, objective, indicator, ownership and financial/approval boundaries.
create or replace function public.digen_update_calendar_activity(target_activity_id uuid, payload jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  row_org uuid;
  row_unit uuid;
  row_period uuid;
  new_title text;
  new_start date;
  new_end date;
  new_status text;
  new_modality text;
begin
  if not private.is_authorized_operator() then raise exception using errcode='42501',message='Unauthorized'; end if;
  select a.organization_id,p.unit_id,p.management_period_id
    into row_org,row_unit,row_period
  from public.unit_work_activity a join public.unit_work_plan p on p.id=a.work_plan_id
  where a.id=target_activity_id
  for update of a;
  if row_org is null then raise exception using errcode='P0002',message='Activity not found'; end if;
  if not private.is_digen_evaluation_viewer(row_org) or row_unit not in (
    select u.id from public.organization_unit u where u.id=any(private.current_supervised_unit_ids())
  ) then
    raise exception using errcode='42501',message='Only DIGEN can edit activities of supervised units';
  end if;
  if jsonb_typeof(payload)<>'object' or (payload ? 'work_plan_id') or (payload ? 'organization_id') or (payload ? 'unit_id')
    or (payload ? 'objective_id') or (payload ? 'indicator_id') or (payload ? 'created_by')
    or (payload ? 'review_status') or (payload ? 'reviewed_by') then
    raise exception using errcode='22023',message='Only calendar activity content can be edited';
  end if;
  new_title:=nullif(btrim(payload->>'title'),'');
  new_start:=nullif(payload->>'start_date','')::date;
  new_end:=nullif(payload->>'end_date','')::date;
  new_status:=coalesce(nullif(payload->>'status',''),'planned');
  new_modality:=coalesce(nullif(payload->>'modality',''),'in_person');
  if new_title is null or new_start is null or new_status not in ('planned','in_progress','completed','cancelled')
     or new_modality not in ('in_person','virtual','hybrid') or (new_end is not null and new_end<new_start)
     or not exists(select 1 from public.management_period p where p.id=row_period and new_start between p.start_date and p.end_date and (new_end is null or new_end<=p.end_date))
  then raise exception using errcode='22023',message='Invalid activity information or dates'; end if;
  update public.unit_work_activity a
  set title=new_title,description=nullif(btrim(payload->>'description'),''),
      start_date=new_start,end_date=new_end,status=new_status,
      modality=new_modality,responsible_name=nullif(btrim(payload->>'responsible_name'),''),
      review_status='pending',review_note=null,reviewed_at=null,reviewed_by=null,
      updated_by=auth.uid(),updated_at=now()
  where a.id=target_activity_id and a.organization_id=row_org;
  return target_activity_id;
end;
$$;
revoke all on function public.digen_update_calendar_activity(uuid,jsonb) from public,anon;
grant execute on function public.digen_update_calendar_activity(uuid,jsonb) to authenticated;
