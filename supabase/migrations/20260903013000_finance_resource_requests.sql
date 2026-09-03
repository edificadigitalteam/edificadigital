create table if not exists public.finance_resource_request (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete restrict,
  management_period_id uuid references public.management_period(id) on delete set null,
  project_id uuid references public.project(id) on delete set null,
  title text not null,
  justification text,
  requested_amount numeric(18,2) not null check (requested_amount > 0),
  currency text not null default 'USD',
  needed_by date,
  status text not null default 'submitted' check (status in ('submitted','in_review','observed','approved','rejected','released')),
  finance_notes text,
  approved_amount numeric(18,2),
  approved_by uuid,
  approved_at timestamptz,
  released_from_fund_id uuid references public.finance_fund(id) on delete set null,
  release_reference text,
  released_by uuid,
  released_at timestamptz,
  requested_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_transaction
  add column if not exists resource_request_id uuid references public.finance_resource_request(id) on delete set null;

create index if not exists finance_resource_request_org_idx on public.finance_resource_request(organization_id);
create index if not exists finance_resource_request_unit_idx on public.finance_resource_request(unit_id);
create index if not exists finance_resource_request_status_idx on public.finance_resource_request(organization_id,status);
create index if not exists finance_resource_request_period_idx on public.finance_resource_request(management_period_id);
create index if not exists finance_resource_request_project_idx on public.finance_resource_request(project_id);
create index if not exists finance_transaction_resource_request_idx on public.finance_transaction(resource_request_id);

alter table public.finance_resource_request enable row level security;

drop policy if exists finance_resource_request_select on public.finance_resource_request;
create policy finance_resource_request_select on public.finance_resource_request
for select to authenticated
using (private.can_access_finance_unit(organization_id, unit_id));

grant select on public.finance_resource_request to authenticated;
revoke insert, update, delete on public.finance_resource_request from anon, authenticated;

create or replace function public.save_finance_resource_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := coalesce(nullif(payload->>'organization_id','')::uuid, private.current_operator_organization_id());
  target_unit uuid := nullif(payload->>'unit_id','')::uuid;
  request_id uuid := nullif(payload->>'id','')::uuid;
  request_amount numeric := nullif(payload->>'requested_amount','')::numeric;
  request_title text := trim(coalesce(payload->>'title',''));
  existing public.finance_resource_request%rowtype;
begin
  if not private.is_authorized_operator() or org_id is null or target_unit is null or not private.can_access_finance_unit(org_id,target_unit) then
    raise exception using errcode='42501', message='Resource request access denied';
  end if;
  if request_title = '' then raise exception using errcode='23514', message='Request title is required'; end if;
  if request_amount is null or request_amount <= 0 then raise exception using errcode='23514', message='Requested amount must be greater than zero'; end if;
  if not exists(select 1 from public.organization_unit where id=target_unit and organization_id=org_id and active=true) then raise exception using errcode='23514', message='Invalid unit'; end if;
  if nullif(payload->>'management_period_id','') is not null and not exists(select 1 from public.management_period where id=nullif(payload->>'management_period_id','')::uuid and organization_id=org_id) then raise exception using errcode='23514', message='Invalid management period'; end if;
  if nullif(payload->>'project_id','') is not null and not exists(select 1 from public.project where id=nullif(payload->>'project_id','')::uuid and organization_id=org_id) then raise exception using errcode='23514', message='Invalid project'; end if;

  if request_id is not null then
    select * into existing from public.finance_resource_request where id=request_id;
    if existing.id is null or existing.organization_id<>org_id or not private.can_access_finance_unit(org_id,existing.unit_id) then raise exception using errcode='42501', message='Resource request not found'; end if;
    if not private.can_manage_finance(org_id) and existing.status not in ('submitted','observed') then raise exception using errcode='23514', message='This request can no longer be edited'; end if;
    update public.finance_resource_request set
      unit_id=target_unit,
      management_period_id=nullif(payload->>'management_period_id','')::uuid,
      project_id=nullif(payload->>'project_id','')::uuid,
      title=request_title,
      justification=nullif(trim(payload->>'justification'),''),
      requested_amount=request_amount,
      currency=upper(coalesce(nullif(trim(payload->>'currency'),''),'USD')),
      needed_by=nullif(payload->>'needed_by','')::date,
      status='submitted',
      finance_notes=case when existing.status='observed' then existing.finance_notes else finance_notes end,
      updated_at=now()
    where id=request_id;
  else
    insert into public.finance_resource_request(organization_id,unit_id,management_period_id,project_id,title,justification,requested_amount,currency,needed_by,status,requested_by)
    values(org_id,target_unit,nullif(payload->>'management_period_id','')::uuid,nullif(payload->>'project_id','')::uuid,request_title,nullif(trim(payload->>'justification'),''),request_amount,upper(coalesce(nullif(trim(payload->>'currency'),''),'USD')),nullif(payload->>'needed_by','')::date,'submitted',auth.uid())
    returning id into request_id;
  end if;
  return request_id;
end;
$$;

create or replace function public.review_finance_resource_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid := nullif(payload->>'id','')::uuid;
  next_status text := payload->>'status';
  approved numeric := nullif(payload->>'approved_amount','')::numeric;
  request_record public.finance_resource_request%rowtype;
begin
  select * into request_record from public.finance_resource_request where id=request_id;
  if request_record.id is null or not private.can_manage_finance(request_record.organization_id) then raise exception using errcode='42501', message='Finance access denied'; end if;
  if next_status not in ('in_review','observed','approved','rejected') then raise exception using errcode='23514', message='Invalid review status'; end if;
  if next_status='approved' then
    if approved is null then approved := request_record.requested_amount; end if;
    if approved <= 0 or approved > request_record.requested_amount then raise exception using errcode='23514', message='Approved amount must be greater than zero and cannot exceed requested amount'; end if;
  else
    approved := request_record.approved_amount;
  end if;
  update public.finance_resource_request set
    status=next_status,
    finance_notes=nullif(trim(payload->>'finance_notes'),''),
    approved_amount=approved,
    approved_by=case when next_status='approved' then auth.uid() else approved_by end,
    approved_at=case when next_status='approved' then now() else approved_at end,
    updated_at=now()
  where id=request_id;
  return request_id;
end;
$$;

create or replace function public.release_finance_resource_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid := nullif(payload->>'id','')::uuid;
  fund_id uuid := nullif(payload->>'fund_id','')::uuid;
  request_record public.finance_resource_request%rowtype;
  fund_record public.finance_fund%rowtype;
  current_balance numeric;
  movement_id uuid;
  release_amount numeric;
begin
  select * into request_record from public.finance_resource_request where id=request_id for update;
  if request_record.id is null or not private.can_manage_finance(request_record.organization_id) then raise exception using errcode='42501', message='Finance access denied'; end if;
  if request_record.status <> 'approved' then raise exception using errcode='23514', message='Only approved requests can release resources'; end if;
  release_amount := coalesce(request_record.approved_amount,request_record.requested_amount);

  select * into fund_record from public.finance_fund where id=fund_id and organization_id=request_record.organization_id and active=true;
  if fund_record.id is null then raise exception using errcode='23514', message='Invalid fund'; end if;
  if upper(fund_record.currency) <> upper(request_record.currency) then raise exception using errcode='23514', message='Fund currency does not match request currency'; end if;

  select coalesce(sum(case when t.movement_type in ('income','transfer_in','adjustment_in') then t.amount else -t.amount end),0)
  into current_balance
  from public.finance_transaction t where t.fund_id=fund_record.id;
  if current_balance < release_amount then raise exception using errcode='23514', message='Insufficient fund balance'; end if;

  insert into public.finance_transaction(organization_id,fund_id,unit_id,resource_request_id,movement_type,occurred_on,amount,currency,description,reference,created_by)
  values(request_record.organization_id,fund_record.id,request_record.unit_id,request_record.id,'expense',current_date,release_amount,fund_record.currency,'Liberación de recursos · '||request_record.title,nullif(trim(payload->>'reference'),''),auth.uid())
  returning id into movement_id;

  update public.finance_resource_request set
    status='released',
    released_from_fund_id=fund_record.id,
    release_reference=nullif(trim(payload->>'reference'),''),
    released_by=auth.uid(),
    released_at=now(),
    updated_at=now()
  where id=request_record.id;
  return movement_id;
end;
$$;

revoke all on function public.save_finance_resource_request(jsonb) from public, anon;
revoke all on function public.review_finance_resource_request(jsonb) from public, anon;
revoke all on function public.release_finance_resource_request(jsonb) from public, anon;
grant execute on function public.save_finance_resource_request(jsonb) to authenticated;
grant execute on function public.review_finance_resource_request(jsonb) to authenticated;
grant execute on function public.release_finance_resource_request(jsonb) to authenticated;
