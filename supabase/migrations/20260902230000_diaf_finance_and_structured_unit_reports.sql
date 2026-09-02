-- DIAF institutional finance + structured management report items.
-- Applied to edifydb before this repository migration was committed.

create or replace function private.can_manage_finance(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_organization(target_organization_id)
    or exists (
      select 1
      from public.organization_unit_member membership
      join public.organization_unit unit on unit.id = membership.unit_id
      where membership.active
        and membership.operator_access_id = private.current_operator_access_id()
        and unit.organization_id = target_organization_id
        and upper(unit.code) = 'DIAF'
        and unit.active
    );
$$;

create or replace function private.can_access_finance_unit(target_organization_id uuid, target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_finance(target_organization_id)
    or exists (
      select 1
      from public.organization_unit_member membership
      join public.organization_unit unit on unit.id = membership.unit_id
      where membership.active
        and membership.operator_access_id = private.current_operator_access_id()
        and membership.unit_id = target_unit_id
        and unit.organization_id = target_organization_id
    );
$$;

create table if not exists public.finance_fund (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organization(id) on delete cascade,
  owner_unit_id uuid references public.organization_unit(id) on delete set null, code text not null, name text not null,
  fund_type text not null default 'internal_fund' check (fund_type in ('bank_account','cash_box','internal_fund','digital_wallet','other')),
  institution text, account_reference text, currency text not null default 'USD' check (char_length(currency)=3), purpose text,
  active boolean not null default true, created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,code),
  check(length(trim(code))>0), check(length(trim(name))>0)
);
create index if not exists finance_fund_org_active_idx on public.finance_fund(organization_id,active,name);
create index if not exists finance_fund_owner_unit_idx on public.finance_fund(owner_unit_id) where owner_unit_id is not null;

create table if not exists public.finance_submission (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organization(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete restrict, management_period_id uuid references public.management_period(id) on delete set null,
  document_type text not null default 'invoice' check(document_type in ('invoice','receipt','quote','payment_request','other')),
  vendor_name text, document_number text, document_date date not null default current_date, due_date date, description text not null,
  amount numeric(18,2) not null check(amount>0), currency text not null default 'USD' check(char_length(currency)=3),
  status text not null default 'draft' check(status in ('draft','submitted','in_review','approved','observed','paid','rejected')),
  fund_id uuid references public.finance_fund(id) on delete set null, diaf_notes text, payment_reference text,
  submitted_by uuid references auth.users(id) on delete set null, reviewed_by uuid references auth.users(id) on delete set null, paid_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz, reviewed_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(length(trim(description))>0)
);
create index if not exists finance_submission_org_status_idx on public.finance_submission(organization_id,status,created_at desc);
create index if not exists finance_submission_unit_idx on public.finance_submission(unit_id,created_at desc);
create index if not exists finance_submission_fund_idx on public.finance_submission(fund_id) where fund_id is not null;
create index if not exists finance_submission_period_idx on public.finance_submission(management_period_id) where management_period_id is not null;

create table if not exists public.finance_transaction (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organization(id) on delete cascade,
  fund_id uuid not null references public.finance_fund(id) on delete restrict, unit_id uuid references public.organization_unit(id) on delete set null,
  submission_id uuid references public.finance_submission(id) on delete set null, counterpart_fund_id uuid references public.finance_fund(id) on delete set null,
  transfer_group_id uuid, movement_type text not null check(movement_type in ('income','expense','transfer_in','transfer_out','adjustment_in','adjustment_out')),
  occurred_on date not null default current_date, amount numeric(18,2) not null check(amount>0), currency text not null check(char_length(currency)=3),
  description text not null, reference text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  check(length(trim(description))>0)
);
create index if not exists finance_transaction_fund_date_idx on public.finance_transaction(fund_id,occurred_on desc,created_at desc);
create index if not exists finance_transaction_org_date_idx on public.finance_transaction(organization_id,occurred_on desc);
create index if not exists finance_transaction_unit_idx on public.finance_transaction(unit_id) where unit_id is not null;
create index if not exists finance_transaction_transfer_idx on public.finance_transaction(transfer_group_id) where transfer_group_id is not null;
create unique index if not exists finance_transaction_paid_submission_uniq on public.finance_transaction(submission_id) where submission_id is not null and movement_type='expense';

create table if not exists public.finance_submission_attachment (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organization(id) on delete cascade,
  submission_id uuid not null references public.finance_submission(id) on delete cascade,
  attachment_type text not null default 'invoice' check(attachment_type in ('invoice','support','payment_proof','other')),
  storage_path text not null unique, file_name text not null,
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp','text/csv','application/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  file_size_bytes bigint not null check(file_size_bytes>0 and file_size_bytes<=20971520), uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists finance_submission_attachment_submission_idx on public.finance_submission_attachment(submission_id,created_at);

create table if not exists public.unit_management_report_item (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organization(id) on delete cascade,
  report_id uuid not null references public.unit_management_report(id) on delete cascade, management_period_id uuid not null references public.management_period(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  item_type text not null check(item_type in ('achievement','challenge','next_step')), statement text not null, sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(length(trim(statement))>0)
);
create index if not exists unit_management_report_item_report_idx on public.unit_management_report_item(report_id,item_type,sort_order);
create index if not exists unit_management_report_item_unit_period_idx on public.unit_management_report_item(unit_id,management_period_id);

insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,created_by,updated_by)
select report.organization_id,report.id,report.management_period_id,report.unit_id,source.item_type,source.statement,0,report.created_by,report.updated_by
from public.unit_management_report report
cross join lateral (values ('achievement'::text,nullif(trim(report.achievements),'')),('challenge'::text,nullif(trim(report.challenges),'')),('next_step'::text,nullif(trim(report.next_steps),''))) source(item_type,statement)
where source.statement is not null and not exists(select 1 from public.unit_management_report_item item where item.report_id=report.id and item.item_type=source.item_type);

alter table public.finance_fund enable row level security;
alter table public.finance_submission enable row level security;
alter table public.finance_transaction enable row level security;
alter table public.finance_submission_attachment enable row level security;
alter table public.unit_management_report_item enable row level security;

drop policy if exists finance_fund_select on public.finance_fund;
create policy finance_fund_select on public.finance_fund for select to authenticated using(private.can_manage_finance(organization_id) or (owner_unit_id is not null and private.can_access_finance_unit(organization_id,owner_unit_id)));
drop policy if exists finance_submission_select on public.finance_submission;
create policy finance_submission_select on public.finance_submission for select to authenticated using(private.can_access_finance_unit(organization_id,unit_id));
drop policy if exists finance_transaction_select on public.finance_transaction;
create policy finance_transaction_select on public.finance_transaction for select to authenticated using(private.can_manage_finance(organization_id) or (unit_id is not null and private.can_access_finance_unit(organization_id,unit_id)) or exists(select 1 from public.finance_fund fund where fund.id=fund_id and fund.owner_unit_id is not null and private.can_access_finance_unit(organization_id,fund.owner_unit_id)));
drop policy if exists finance_submission_attachment_select on public.finance_submission_attachment;
create policy finance_submission_attachment_select on public.finance_submission_attachment for select to authenticated using(exists(select 1 from public.finance_submission submission where submission.id=submission_id and private.can_access_finance_unit(submission.organization_id,submission.unit_id)));
drop policy if exists unit_management_report_item_select on public.unit_management_report_item;
create policy unit_management_report_item_select on public.unit_management_report_item for select to authenticated using(private.can_access_organization(organization_id));
drop policy if exists unit_management_report_item_insert on public.unit_management_report_item;
create policy unit_management_report_item_insert on public.unit_management_report_item for insert to authenticated with check(private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
drop policy if exists unit_management_report_item_update on public.unit_management_report_item;
create policy unit_management_report_item_update on public.unit_management_report_item for update to authenticated using(private.can_manage_unit(unit_id)) with check(private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
drop policy if exists unit_management_report_item_delete on public.unit_management_report_item;
create policy unit_management_report_item_delete on public.unit_management_report_item for delete to authenticated using(private.can_manage_unit(unit_id));

create or replace function public.finance_access_overview(target_organization_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare org_id uuid; diaf_id uuid; unit_ids jsonb;
begin
  if not private.is_authorized_operator() then raise exception using errcode='42501',message='Unauthorized'; end if;
  org_id:=case when private.is_super_admin() and target_organization_id is not null then target_organization_id else private.current_operator_organization_id() end;
  if org_id is null or not private.can_access_organization(org_id) then raise exception using errcode='42501',message='Organization access denied'; end if;
  select unit.id into diaf_id from public.organization_unit unit where unit.organization_id=org_id and upper(unit.code)='DIAF' and unit.active limit 1;
  select coalesce(jsonb_agg(membership.unit_id),'[]'::jsonb) into unit_ids from public.organization_unit_member membership where membership.active and membership.organization_id=org_id and membership.operator_access_id=private.current_operator_access_id();
  return jsonb_build_object('organization_id',org_id,'can_manage_finance',private.can_manage_finance(org_id),'diaf_unit_id',diaf_id,'unit_ids',unit_ids);
end;$$;

create or replace function public.list_finance_funds(target_organization_id uuid default null)
returns table(id uuid,organization_id uuid,owner_unit_id uuid,owner_unit_code text,owner_unit_name text,code text,name text,fund_type text,institution text,account_reference text,currency text,purpose text,active boolean,inflows numeric,outflows numeric,balance numeric,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare org_id uuid;
begin
  if not private.is_authorized_operator() then raise exception using errcode='42501',message='Unauthorized'; end if;
  org_id:=case when private.is_super_admin() and target_organization_id is not null then target_organization_id else private.current_operator_organization_id() end;
  if org_id is null or not private.can_access_organization(org_id) then raise exception using errcode='42501',message='Organization access denied'; end if;
  return query select fund.id,fund.organization_id,fund.owner_unit_id,unit.code,unit.name,fund.code,fund.name,fund.fund_type,fund.institution,fund.account_reference,fund.currency,fund.purpose,fund.active,
    coalesce(sum(case when movement.movement_type in ('income','transfer_in','adjustment_in') then movement.amount else 0 end),0)::numeric,
    coalesce(sum(case when movement.movement_type in ('expense','transfer_out','adjustment_out') then movement.amount else 0 end),0)::numeric,
    (coalesce(sum(case when movement.movement_type in ('income','transfer_in','adjustment_in') then movement.amount else 0 end),0)-coalesce(sum(case when movement.movement_type in ('expense','transfer_out','adjustment_out') then movement.amount else 0 end),0))::numeric,
    fund.created_at,fund.updated_at
  from public.finance_fund fund left join public.organization_unit unit on unit.id=fund.owner_unit_id left join public.finance_transaction movement on movement.fund_id=fund.id
  where fund.organization_id=org_id and (private.can_manage_finance(org_id) or (fund.owner_unit_id is not null and private.can_access_finance_unit(org_id,fund.owner_unit_id))) group by fund.id,unit.code,unit.name order by fund.active desc,fund.name;
end;$$;

create or replace function public.save_finance_fund(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org_id uuid:=coalesce(nullif(payload->>'organization_id','')::uuid,private.current_operator_organization_id()); fund_id uuid:=nullif(payload->>'id','')::uuid; owner_id uuid:=nullif(payload->>'owner_unit_id','')::uuid; opening numeric:=coalesce(nullif(payload->>'opening_balance','')::numeric,0); fund_currency text:=upper(coalesce(nullif(trim(payload->>'currency'),''),'USD'));
begin
  if not private.is_authorized_operator() or org_id is null or not private.can_manage_finance(org_id) then raise exception using errcode='42501',message='Finance access denied'; end if;
  if owner_id is not null and not exists(select 1 from public.organization_unit unit where unit.id=owner_id and unit.organization_id=org_id) then raise exception using errcode='23514',message='Invalid owner unit'; end if;
  if fund_id is null then
    insert into public.finance_fund(organization_id,owner_unit_id,code,name,fund_type,institution,account_reference,currency,purpose,active,created_by,updated_by)
    values(org_id,owner_id,upper(trim(payload->>'code')),trim(payload->>'name'),coalesce(nullif(payload->>'fund_type',''),'internal_fund'),nullif(trim(payload->>'institution'),''),nullif(trim(payload->>'account_reference'),''),fund_currency,nullif(trim(payload->>'purpose'),''),coalesce((payload->>'active')::boolean,true),auth.uid(),auth.uid()) returning id into fund_id;
    if opening>0 then insert into public.finance_transaction(organization_id,fund_id,movement_type,occurred_on,amount,currency,description,reference,created_by) values(org_id,fund_id,'income',coalesce(nullif(payload->>'opening_date','')::date,current_date),opening,fund_currency,'Saldo inicial',nullif(trim(payload->>'opening_reference'),''),auth.uid()); end if;
  else
    update public.finance_fund fund set owner_unit_id=owner_id,code=upper(trim(payload->>'code')),name=trim(payload->>'name'),fund_type=coalesce(nullif(payload->>'fund_type',''),'internal_fund'),institution=nullif(trim(payload->>'institution'),''),account_reference=nullif(trim(payload->>'account_reference'),''),currency=fund_currency,purpose=nullif(trim(payload->>'purpose'),''),active=coalesce((payload->>'active')::boolean,true),updated_by=auth.uid(),updated_at=now() where fund.id=fund_id and fund.organization_id=org_id;
    if not found then raise exception using errcode='42501',message='Fund not found'; end if;
  end if; return fund_id;
end;$$;

create or replace function public.record_finance_movement(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare fund_record public.finance_fund%rowtype; movement_id uuid; movement text:=payload->>'movement_type'; movement_amount numeric:=nullif(payload->>'amount','')::numeric; current_balance numeric; target_unit uuid:=nullif(payload->>'unit_id','')::uuid;
begin
  select * into fund_record from public.finance_fund where id=nullif(payload->>'fund_id','')::uuid;
  if fund_record.id is null or not private.can_manage_finance(fund_record.organization_id) then raise exception using errcode='42501',message='Finance access denied'; end if;
  if movement not in ('income','expense','adjustment_in','adjustment_out') then raise exception using errcode='23514',message='Invalid movement type'; end if;
  if movement_amount is null or movement_amount<=0 then raise exception using errcode='23514',message='Amount must be greater than zero'; end if;
  if target_unit is not null and not exists(select 1 from public.organization_unit where id=target_unit and organization_id=fund_record.organization_id) then raise exception using errcode='23514',message='Invalid unit'; end if;
  if movement in ('expense','adjustment_out') then select coalesce(sum(case when t.movement_type in ('income','transfer_in','adjustment_in') then t.amount else -t.amount end),0) into current_balance from public.finance_transaction t where t.fund_id=fund_record.id; if current_balance<movement_amount then raise exception using errcode='23514',message='Insufficient fund balance'; end if; end if;
  insert into public.finance_transaction(organization_id,fund_id,unit_id,movement_type,occurred_on,amount,currency,description,reference,created_by) values(fund_record.organization_id,fund_record.id,target_unit,movement,coalesce(nullif(payload->>'occurred_on','')::date,current_date),movement_amount,fund_record.currency,trim(payload->>'description'),nullif(trim(payload->>'reference'),''),auth.uid()) returning id into movement_id;
  return movement_id;
end;$$;

create or replace function public.transfer_finance_funds(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare source_fund public.finance_fund%rowtype; destination_fund public.finance_fund%rowtype; transfer_amount numeric:=nullif(payload->>'amount','')::numeric; current_balance numeric; group_id uuid:=gen_random_uuid(); occurred date:=coalesce(nullif(payload->>'occurred_on','')::date,current_date); description_text text:=coalesce(nullif(trim(payload->>'description'),''),'Transferencia entre fondos'); reference_text text:=nullif(trim(payload->>'reference'),'');
begin
  select * into source_fund from public.finance_fund where id=nullif(payload->>'from_fund_id','')::uuid; select * into destination_fund from public.finance_fund where id=nullif(payload->>'to_fund_id','')::uuid;
  if source_fund.id is null or destination_fund.id is null or source_fund.id=destination_fund.id then raise exception using errcode='23514',message='Invalid fund transfer'; end if;
  if source_fund.organization_id<>destination_fund.organization_id or not private.can_manage_finance(source_fund.organization_id) then raise exception using errcode='42501',message='Finance access denied'; end if;
  if source_fund.currency<>destination_fund.currency then raise exception using errcode='23514',message='Funds must use the same currency'; end if;
  if transfer_amount is null or transfer_amount<=0 then raise exception using errcode='23514',message='Amount must be greater than zero'; end if;
  select coalesce(sum(case when t.movement_type in ('income','transfer_in','adjustment_in') then t.amount else -t.amount end),0) into current_balance from public.finance_transaction t where t.fund_id=source_fund.id; if current_balance<transfer_amount then raise exception using errcode='23514',message='Insufficient fund balance'; end if;
  insert into public.finance_transaction(organization_id,fund_id,unit_id,counterpart_fund_id,transfer_group_id,movement_type,occurred_on,amount,currency,description,reference,created_by) values(source_fund.organization_id,source_fund.id,destination_fund.owner_unit_id,destination_fund.id,group_id,'transfer_out',occurred,transfer_amount,source_fund.currency,description_text,reference_text,auth.uid());
  insert into public.finance_transaction(organization_id,fund_id,unit_id,counterpart_fund_id,transfer_group_id,movement_type,occurred_on,amount,currency,description,reference,created_by) values(destination_fund.organization_id,destination_fund.id,destination_fund.owner_unit_id,source_fund.id,group_id,'transfer_in',occurred,transfer_amount,destination_fund.currency,description_text,reference_text,auth.uid()); return group_id;
end;$$;

create or replace function public.save_finance_submission(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org_id uuid:=coalesce(nullif(payload->>'organization_id','')::uuid,private.current_operator_organization_id()); target_unit uuid:=nullif(payload->>'unit_id','')::uuid; submission_id uuid:=nullif(payload->>'id','')::uuid; next_status text:=coalesce(nullif(payload->>'status',''),'submitted'); existing public.finance_submission%rowtype;
begin
  if not private.is_authorized_operator() or org_id is null or target_unit is null or not private.can_access_finance_unit(org_id,target_unit) then raise exception using errcode='42501',message='Finance submission access denied'; end if;
  if not exists(select 1 from public.organization_unit unit where unit.id=target_unit and unit.organization_id=org_id) then raise exception using errcode='23514',message='Invalid unit'; end if;
  if next_status not in ('draft','submitted') then next_status:='submitted'; end if;
  if submission_id is not null then
    select * into existing from public.finance_submission where id=submission_id;
    if existing.id is null or existing.organization_id<>org_id or not private.can_access_finance_unit(org_id,existing.unit_id) then raise exception using errcode='42501',message='Submission not found'; end if;
    if not private.can_manage_finance(org_id) and existing.status not in ('draft','observed') then raise exception using errcode='23514',message='Only draft or observed submissions can be edited'; end if;
    update public.finance_submission set unit_id=target_unit,management_period_id=nullif(payload->>'management_period_id','')::uuid,document_type=coalesce(nullif(payload->>'document_type',''),'invoice'),vendor_name=nullif(trim(payload->>'vendor_name'),''),document_number=nullif(trim(payload->>'document_number'),''),document_date=coalesce(nullif(payload->>'document_date','')::date,current_date),due_date=nullif(payload->>'due_date','')::date,description=trim(payload->>'description'),amount=nullif(payload->>'amount','')::numeric,currency=upper(coalesce(nullif(trim(payload->>'currency'),''),'USD')),status=next_status,submitted_by=coalesce(submitted_by,auth.uid()),submitted_at=case when next_status='submitted' then now() else submitted_at end,updated_at=now() where id=submission_id;
  else
    insert into public.finance_submission(organization_id,unit_id,management_period_id,document_type,vendor_name,document_number,document_date,due_date,description,amount,currency,status,submitted_by,submitted_at) values(org_id,target_unit,nullif(payload->>'management_period_id','')::uuid,coalesce(nullif(payload->>'document_type',''),'invoice'),nullif(trim(payload->>'vendor_name'),''),nullif(trim(payload->>'document_number'),''),coalesce(nullif(payload->>'document_date','')::date,current_date),nullif(payload->>'due_date','')::date,trim(payload->>'description'),nullif(payload->>'amount','')::numeric,upper(coalesce(nullif(trim(payload->>'currency'),''),'USD')),next_status,auth.uid(),case when next_status='submitted' then now() end) returning id into submission_id;
  end if; return submission_id;
end;$$;

create or replace function public.review_finance_submission(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare submission public.finance_submission%rowtype; fund_record public.finance_fund%rowtype; next_status text:=payload->>'status'; selected_fund uuid:=nullif(payload->>'fund_id','')::uuid; current_balance numeric;
begin
  select * into submission from public.finance_submission where id=nullif(payload->>'id','')::uuid for update;
  if submission.id is null or not private.can_manage_finance(submission.organization_id) then raise exception using errcode='42501',message='Finance review access denied'; end if;
  if submission.status='paid' then raise exception using errcode='23514',message='Paid submissions are immutable'; end if;
  if next_status not in ('in_review','approved','observed','rejected','paid') then raise exception using errcode='23514',message='Invalid review status'; end if;
  if next_status='paid' then
    if selected_fund is null then raise exception using errcode='23514',message='Select a fund before marking as paid'; end if;
    select * into fund_record from public.finance_fund where id=selected_fund and organization_id=submission.organization_id and active;
    if fund_record.id is null then raise exception using errcode='23514',message='Invalid fund'; end if;
    if fund_record.currency<>submission.currency then raise exception using errcode='23514',message='Invoice currency must match fund currency'; end if;
    select coalesce(sum(case when t.movement_type in ('income','transfer_in','adjustment_in') then t.amount else -t.amount end),0) into current_balance from public.finance_transaction t where t.fund_id=fund_record.id; if current_balance<submission.amount then raise exception using errcode='23514',message='Insufficient fund balance'; end if;
    insert into public.finance_transaction(organization_id,fund_id,unit_id,submission_id,movement_type,occurred_on,amount,currency,description,reference,created_by) values(submission.organization_id,fund_record.id,submission.unit_id,submission.id,'expense',current_date,submission.amount,submission.currency,submission.description,nullif(trim(payload->>'payment_reference'),''),auth.uid());
  end if;
  update public.finance_submission set status=next_status,fund_id=case when next_status='paid' then selected_fund else coalesce(selected_fund,fund_id) end,diaf_notes=nullif(trim(payload->>'diaf_notes'),''),payment_reference=case when next_status='paid' then nullif(trim(payload->>'payment_reference'),'') else payment_reference end,reviewed_by=auth.uid(),reviewed_at=now(),paid_by=case when next_status='paid' then auth.uid() else paid_by end,paid_at=case when next_status='paid' then now() else paid_at end,updated_at=now() where id=submission.id; return submission.id;
end;$$;

create or replace function public.record_finance_attachment(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare submission public.finance_submission%rowtype; attachment_id uuid; kind text:=coalesce(nullif(payload->>'attachment_type',''),'invoice');
begin
  select * into submission from public.finance_submission where id=nullif(payload->>'submission_id','')::uuid;
  if submission.id is null or not private.can_access_finance_unit(submission.organization_id,submission.unit_id) then raise exception using errcode='42501',message='Attachment access denied'; end if;
  if kind='payment_proof' and not private.can_manage_finance(submission.organization_id) then raise exception using errcode='42501',message='Only DIAF can attach payment proof'; end if;
  insert into public.finance_submission_attachment(organization_id,submission_id,attachment_type,storage_path,file_name,mime_type,file_size_bytes,uploaded_by) values(submission.organization_id,submission.id,kind,payload->>'storage_path',payload->>'file_name',payload->>'mime_type',(payload->>'file_size_bytes')::bigint,auth.uid()) returning id into attachment_id; return attachment_id;
end;$$;

create or replace function public.save_unit_management_report_v2(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org_id uuid:=coalesce(nullif(payload->>'organization_id','')::uuid,private.current_operator_organization_id()); period_id uuid:=nullif(payload->>'management_period_id','')::uuid; target_unit uuid:=nullif(payload->>'unit_id','')::uuid; report_id uuid:=nullif(payload->>'id','')::uuid; next_status text:=coalesce(nullif(payload->>'status',''),'draft'); achievement_text text; challenge_text text; next_step_text text; item record; item_index integer;
begin
  if not private.is_authorized_operator() or org_id is null or period_id is null or target_unit is null or not private.can_manage_unit(target_unit) then raise exception using errcode='42501',message='Report access denied'; end if;
  if not exists(select 1 from public.organization_unit unit where unit.id=target_unit and unit.organization_id=org_id) then raise exception using errcode='23514',message='Invalid unit'; end if;
  if not exists(select 1 from public.management_period period where period.id=period_id and period.organization_id=org_id) then raise exception using errcode='23514',message='Invalid management period'; end if;
  if next_status not in ('draft','submitted','reviewed','approved','closed') then raise exception using errcode='23514',message='Invalid report status'; end if;
  select string_agg(trim(value),E'\n' order by ordinality) into achievement_text from jsonb_array_elements_text(coalesce(payload->'achievements','[]'::jsonb)) with ordinality as x(value,ordinality) where trim(value)<>'';
  select string_agg(trim(value),E'\n' order by ordinality) into challenge_text from jsonb_array_elements_text(coalesce(payload->'challenges','[]'::jsonb)) with ordinality as x(value,ordinality) where trim(value)<>'';
  select string_agg(trim(value),E'\n' order by ordinality) into next_step_text from jsonb_array_elements_text(coalesce(payload->'next_steps','[]'::jsonb)) with ordinality as x(value,ordinality) where trim(value)<>'';
  if report_id is null then
    insert into public.unit_management_report(organization_id,management_period_id,unit_id,status,executive_summary,achievements,challenges,next_steps,reviewer_notes,submitted_at,reviewed_at,approved_at,created_by,updated_by) values(org_id,period_id,target_unit,next_status,nullif(trim(payload->>'executive_summary'),''),achievement_text,challenge_text,next_step_text,nullif(trim(payload->>'reviewer_notes'),''),case when next_status in ('submitted','reviewed','approved','closed') then now() end,case when next_status in ('reviewed','approved','closed') then now() end,case when next_status in ('approved','closed') then now() end,auth.uid(),auth.uid()) returning id into report_id;
  else
    update public.unit_management_report report set status=next_status,executive_summary=nullif(trim(payload->>'executive_summary'),''),achievements=achievement_text,challenges=challenge_text,next_steps=next_step_text,reviewer_notes=nullif(trim(payload->>'reviewer_notes'),''),submitted_at=case when next_status in ('submitted','reviewed','approved','closed') then coalesce(report.submitted_at,now()) else report.submitted_at end,reviewed_at=case when next_status in ('reviewed','approved','closed') then coalesce(report.reviewed_at,now()) else report.reviewed_at end,approved_at=case when next_status in ('approved','closed') then coalesce(report.approved_at,now()) else report.approved_at end,updated_by=auth.uid(),updated_at=now() where report.id=report_id and report.organization_id=org_id and report.unit_id=target_unit;
    if not found then raise exception using errcode='42501',message='Report not found'; end if;
  end if;
  delete from public.unit_management_report_item where report_id=report_id;
  item_index:=0; for item in select value from jsonb_array_elements_text(coalesce(payload->'achievements','[]'::jsonb)) loop if trim(item.value)<>'' then insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,created_by,updated_by) values(org_id,report_id,period_id,target_unit,'achievement',trim(item.value),item_index,auth.uid(),auth.uid()); item_index:=item_index+1; end if; end loop;
  item_index:=0; for item in select value from jsonb_array_elements_text(coalesce(payload->'challenges','[]'::jsonb)) loop if trim(item.value)<>'' then insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,created_by,updated_by) values(org_id,report_id,period_id,target_unit,'challenge',trim(item.value),item_index,auth.uid(),auth.uid()); item_index:=item_index+1; end if; end loop;
  item_index:=0; for item in select value from jsonb_array_elements_text(coalesce(payload->'next_steps','[]'::jsonb)) loop if trim(item.value)<>'' then insert into public.unit_management_report_item(organization_id,report_id,management_period_id,unit_id,item_type,statement,sort_order,created_by,updated_by) values(org_id,report_id,period_id,target_unit,'next_step',trim(item.value),item_index,auth.uid(),auth.uid()); item_index:=item_index+1; end if; end loop;
  return report_id;
end;$$;

revoke all on function public.finance_access_overview(uuid) from public;
revoke all on function public.list_finance_funds(uuid) from public;
revoke all on function public.save_finance_fund(jsonb) from public;
revoke all on function public.record_finance_movement(jsonb) from public;
revoke all on function public.transfer_finance_funds(jsonb) from public;
revoke all on function public.save_finance_submission(jsonb) from public;
revoke all on function public.review_finance_submission(jsonb) from public;
revoke all on function public.record_finance_attachment(jsonb) from public;
revoke all on function public.save_unit_management_report_v2(jsonb) from public;
grant execute on function public.finance_access_overview(uuid) to authenticated;
grant execute on function public.list_finance_funds(uuid) to authenticated;
grant execute on function public.save_finance_fund(jsonb) to authenticated;
grant execute on function public.record_finance_movement(jsonb) to authenticated;
grant execute on function public.transfer_finance_funds(jsonb) to authenticated;
grant execute on function public.save_finance_submission(jsonb) to authenticated;
grant execute on function public.review_finance_submission(jsonb) to authenticated;
grant execute on function public.record_finance_attachment(jsonb) to authenticated;
grant execute on function public.save_unit_management_report_v2(jsonb) to authenticated;
