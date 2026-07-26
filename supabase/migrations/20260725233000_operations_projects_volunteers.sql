-- Operational expansion for organizations, funded projects, volunteers, simplified shipments, and editable records.

insert into public.unit_of_measure (code, name_es, name_en, abbreviation)
values ('lot', 'Lote', 'Lot', 'lote')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  abbreviation = excluded.abbreviation,
  active = true;

insert into public.media_type (code, name_es, name_en, description)
values
  ('manifest_spreadsheet', 'Manifiesto en hoja de cálculo', 'Spreadsheet manifest', 'CSV or spreadsheet with detailed shipment contents.'),
  ('project_proposal', 'Propuesta de proyecto', 'Project proposal', 'Approved or submitted project proposal.'),
  ('project_budget', 'Presupuesto de proyecto', 'Project budget', 'Approved project budget and revisions.'),
  ('invoice', 'Factura', 'Invoice', 'Supplier invoice linked to project execution.'),
  ('expense_receipt', 'Comprobante de gasto', 'Expense receipt', 'Receipt or payment evidence for a project expense.'),
  ('project_report', 'Informe de proyecto', 'Project report', 'Narrative or financial report delivered to a funding partner.')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  description = excluded.description,
  active = true;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'attachments';

create table if not exists public.organization (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  legal_name text,
  tax_id text,
  country text,
  city text,
  contact_email text,
  contact_phone text,
  subscription_status text not null default 'trial',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_code_check check (code ~ '^[a-z][a-z0-9_-]{1,39}$'),
  constraint organization_name_check check (length(trim(name)) > 0),
  constraint organization_subscription_status_check check (
    subscription_status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')
  ),
  constraint organization_contact_email_check check (
    contact_email is null or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create trigger organization_set_updated_at
before update on public.organization
for each row execute function public.set_updated_at();

alter table private.operator_access
  add column if not exists organization_id uuid references public.organization(id) on delete set null;

create index if not exists operator_access_organization_idx
  on private.operator_access (organization_id, active);

create table if not exists public.project (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete restrict,
  code text not null,
  name text not null,
  funding_partner text not null,
  status text not null default 'planning',
  start_date date,
  end_date date,
  approved_budget numeric(16,2),
  currency char(3) not null default 'USD',
  objective text not null,
  expected_results text,
  reporting_requirements text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_code_check check (code ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,49}$'),
  constraint project_name_check check (length(trim(name)) > 0),
  constraint project_partner_check check (length(trim(funding_partner)) > 0),
  constraint project_status_check check (
    status in ('planning', 'submitted', 'approved', 'active', 'paused', 'completed', 'cancelled')
  ),
  constraint project_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint project_budget_check check (approved_budget is null or approved_budget >= 0),
  constraint project_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint project_objective_check check (length(trim(objective)) > 0),
  constraint project_org_code_unique unique (organization_id, code)
);

create index if not exists project_organization_status_idx
  on public.project (organization_id, status, created_at desc);

create trigger project_set_updated_at
before update on public.project
for each row execute function public.set_updated_at();

create table if not exists public.volunteer (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete restrict,
  project_id uuid references public.project(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  country text,
  city text,
  volunteer_type text not null default 'general',
  specialties text[] not null default '{}',
  profession text,
  professional_license text,
  availability text,
  emergency_contact text,
  status text not null default 'active',
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_name_check check (length(trim(full_name)) > 0),
  constraint volunteer_email_check check (
    email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint volunteer_type_check check (volunteer_type in ('general', 'specialized')),
  constraint volunteer_status_check check (status in ('active', 'inactive', 'unavailable'))
);

create index if not exists volunteer_organization_status_idx
  on public.volunteer (organization_id, status, created_at desc);
create index if not exists volunteer_project_idx
  on public.volunteer (project_id) where project_id is not null;

create trigger volunteer_set_updated_at
before update on public.volunteer
for each row execute function public.set_updated_at();

alter table public.donation
  add column if not exists organization_id uuid references public.organization(id) on delete restrict,
  add column if not exists project_id uuid references public.project(id) on delete set null;

create index if not exists donation_organization_created_idx
  on public.donation (organization_id, created_at desc);
create index if not exists donation_project_idx
  on public.donation (project_id) where project_id is not null;

alter table public.shipment
  add column if not exists shipment_scope text not null default 'international',
  add column if not exists category_codes text[] not null default '{}',
  add column if not exists contents_summary text,
  add column if not exists declared_package_count numeric(14,3),
  add column if not exists package_unit_code text;

alter table public.shipment
  drop constraint if exists shipment_scope_check,
  add constraint shipment_scope_check check (shipment_scope in ('national', 'international')),
  drop constraint if exists shipment_declared_package_count_check,
  add constraint shipment_declared_package_count_check check (
    declared_package_count is null or declared_package_count > 0
  );

create or replace function private.current_operator_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select access.organization_id
  from private.operator_access access
  where access.active
    and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  limit 1;
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.operator_access access
    where access.active
      and access.role = 'super_admin'
      and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;

revoke all on function private.current_operator_organization_id() from public, anon;
revoke all on function private.is_super_admin() from public, anon;
grant execute on function private.current_operator_organization_id() to authenticated;
grant execute on function private.is_super_admin() to authenticated;

create or replace function private.assign_donation_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is null then
    new.organization_id := private.current_operator_organization_id();
  end if;
  return new;
end;
$$;

revoke all on function private.assign_donation_organization() from public, anon, authenticated;

drop trigger if exists donation_assign_organization on public.donation;
create trigger donation_assign_organization
before insert on public.donation
for each row execute function private.assign_donation_organization();

create or replace function public.current_operator_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then
      jsonb_build_object(
        'authorized', false,
        'active', false,
        'email', null,
        'display_name', null,
        'role', null,
        'is_admin', false,
        'organization_id', null,
        'organization_name', null
      )
    else coalesce(
      (
        select jsonb_build_object(
          'authorized', access.active,
          'active', access.active,
          'email', access.email,
          'display_name', access.display_name,
          'role', access.role,
          'is_admin', access.active and access.role in ('admin', 'super_admin'),
          'organization_id', access.organization_id,
          'organization_name', organization.name
        )
        from private.operator_access access
        left join public.organization organization on organization.id = access.organization_id
        where lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
        limit 1
      ),
      jsonb_build_object(
        'authorized', false,
        'active', false,
        'email', coalesce((select auth.jwt()) ->> 'email', null),
        'display_name', null,
        'role', null,
        'is_admin', false,
        'organization_id', null,
        'organization_name', null
      )
    )
  end;
$$;

revoke all on function public.current_operator_profile() from public, anon;
grant execute on function public.current_operator_profile() to authenticated;

drop function if exists public.admin_list_operator_access();
create function public.admin_list_operator_access()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  active boolean,
  organization_id uuid,
  organization_name text,
  created_at timestamptz,
  updated_at timestamptz,
  can_edit boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_operator_role text;
  caller_organization_id uuid;
begin
  select access.role, access.organization_id
  into caller_operator_role, caller_organization_id
  from private.operator_access access
  where access.active and lower(access.email) = caller_email
  limit 1;

  if caller_operator_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  return query
  select
    access.id,
    access.email,
    access.display_name,
    access.role,
    access.active,
    access.organization_id,
    organization.name,
    access.created_at,
    access.updated_at,
    case
      when caller_operator_role = 'super_admin' then true
      when access.role = 'operator' and access.organization_id = caller_organization_id then true
      else false
    end as can_edit
  from private.operator_access access
  left join public.organization organization on organization.id = access.organization_id
  where caller_operator_role = 'super_admin'
     or access.organization_id = caller_organization_id
  order by access.active desc, lower(access.display_name), lower(access.email);
end;
$$;

revoke all on function public.admin_list_operator_access() from public, anon;
grant execute on function public.admin_list_operator_access() to authenticated;

create or replace function public.admin_save_operator_access(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_operator_role text;
  caller_organization_id uuid;
  target_id uuid;
  target_email text;
  target_name text;
  target_role text;
  target_active boolean;
  target_organization_id uuid;
  existing_role text;
  existing_organization_id uuid;
  saved private.operator_access%rowtype;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select access.role, access.organization_id
  into caller_operator_role, caller_organization_id
  from private.operator_access access
  where access.active and lower(access.email) = caller_email
  limit 1;

  if caller_operator_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
    target_organization_id := nullif(payload ->> 'organization_id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid identifier.';
  end;

  target_email := lower(trim(coalesce(payload ->> 'email', '')));
  target_name := trim(coalesce(payload ->> 'display_name', ''));
  target_role := coalesce(nullif(payload ->> 'role', ''), 'operator');
  target_active := coalesce((payload ->> 'active')::boolean, true);

  if target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'A valid email is required.';
  end if;
  if target_name = '' then
    raise exception using errcode = '22023', message = 'Display name is required.';
  end if;
  if target_role not in ('operator', 'admin', 'super_admin') then
    raise exception using errcode = '22023', message = 'Invalid operator role.';
  end if;

  if caller_operator_role = 'admin' then
    target_role := 'operator';
    target_organization_id := caller_organization_id;
  end if;

  if target_organization_id is not null and not exists (
    select 1 from public.organization organization where organization.id = target_organization_id
  ) then
    raise exception using errcode = '22023', message = 'Organization was not found.';
  end if;

  if target_id is not null then
    select access.role, access.organization_id
    into existing_role, existing_organization_id
    from private.operator_access access
    where access.id = target_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'Operator record was not found.';
    end if;

    if caller_operator_role = 'admin' and (
      existing_role <> 'operator' or existing_organization_id is distinct from caller_organization_id
    ) then
      raise exception using errcode = '42501', message = 'This account requires superadministrator access.';
    end if;
  end if;

  if target_email = caller_email and (not target_active or target_role <> caller_operator_role) then
    raise exception using errcode = '22023', message = 'You cannot deactivate or change your own administrative role.';
  end if;

  if target_id is null then
    insert into private.operator_access (email, display_name, role, active, organization_id)
    values (target_email, target_name, target_role, target_active, target_organization_id)
    on conflict ((lower(email))) do update
      set display_name = excluded.display_name,
          role = excluded.role,
          active = excluded.active,
          organization_id = excluded.organization_id,
          updated_at = now()
    returning * into saved;
  else
    update private.operator_access
    set email = target_email,
        display_name = target_name,
        role = target_role,
        active = target_active,
        organization_id = target_organization_id,
        updated_at = now()
    where id = target_id
    returning * into saved;
  end if;

  return jsonb_build_object(
    'id', saved.id,
    'email', saved.email,
    'display_name', saved.display_name,
    'role', saved.role,
    'active', saved.active,
    'organization_id', saved.organization_id,
    'created_at', saved.created_at,
    'updated_at', saved.updated_at
  );
end;
$$;

revoke all on function public.admin_save_operator_access(jsonb) from public, anon;
grant execute on function public.admin_save_operator_access(jsonb) to authenticated;

create or replace function public.admin_list_organizations()
returns table (
  id uuid,
  code text,
  name text,
  legal_name text,
  tax_id text,
  country text,
  city text,
  contact_email text,
  contact_phone text,
  subscription_status text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  can_edit boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_role text;
  caller_organization_id uuid;
begin
  select access.role, access.organization_id
  into caller_role, caller_organization_id
  from private.operator_access access
  where access.active
    and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  limit 1;

  if caller_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  return query
  select
    organization.id,
    organization.code,
    organization.name,
    organization.legal_name,
    organization.tax_id,
    organization.country,
    organization.city,
    organization.contact_email,
    organization.contact_phone,
    organization.subscription_status,
    organization.active,
    organization.created_at,
    organization.updated_at,
    caller_role = 'super_admin' as can_edit
  from public.organization organization
  where caller_role = 'super_admin' or organization.id = caller_organization_id
  order by organization.active desc, lower(organization.name);
end;
$$;

create or replace function public.admin_save_organization(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  saved public.organization%rowtype;
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid organization identifier.';
  end;

  if target_id is null then
    insert into public.organization (
      code, name, legal_name, tax_id, country, city,
      contact_email, contact_phone, subscription_status, active
    ) values (
      lower(trim(payload ->> 'code')),
      trim(payload ->> 'name'),
      nullif(trim(payload ->> 'legal_name'), ''),
      nullif(trim(payload ->> 'tax_id'), ''),
      nullif(trim(payload ->> 'country'), ''),
      nullif(trim(payload ->> 'city'), ''),
      nullif(lower(trim(payload ->> 'contact_email')), ''),
      nullif(trim(payload ->> 'contact_phone'), ''),
      coalesce(nullif(payload ->> 'subscription_status', ''), 'trial'),
      coalesce((payload ->> 'active')::boolean, true)
    ) returning * into saved;
  else
    update public.organization
    set code = lower(trim(payload ->> 'code')),
        name = trim(payload ->> 'name'),
        legal_name = nullif(trim(payload ->> 'legal_name'), ''),
        tax_id = nullif(trim(payload ->> 'tax_id'), ''),
        country = nullif(trim(payload ->> 'country'), ''),
        city = nullif(trim(payload ->> 'city'), ''),
        contact_email = nullif(lower(trim(payload ->> 'contact_email')), ''),
        contact_phone = nullif(trim(payload ->> 'contact_phone'), ''),
        subscription_status = coalesce(nullif(payload ->> 'subscription_status', ''), 'trial'),
        active = coalesce((payload ->> 'active')::boolean, true),
        updated_at = now()
    where id = target_id
    returning * into saved;
  end if;

  if saved.id is null then
    raise exception using errcode = 'P0002', message = 'Organization was not found.';
  end if;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.admin_list_organizations() from public, anon;
revoke all on function public.admin_save_organization(jsonb) from public, anon;
grant execute on function public.admin_list_organizations() to authenticated;
grant execute on function public.admin_save_organization(jsonb) to authenticated;

create or replace function public.update_donation_record(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  donation_id uuid;
  record public.donation%rowtype;
  detail_id uuid;
  actor_record public.actor%rowtype;
  is_admin boolean := private.is_authorized_admin();
begin
  begin
    donation_id := (payload ->> 'id')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'A valid donation identifier is required.';
  end;

  select * into record from public.donation where id = donation_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Donation record was not found.';
  end if;

  if record.created_by is distinct from current_user_id and not is_admin then
    raise exception using errcode = '42501', message = 'You cannot edit this donation.';
  end if;

  update public.donation
  set status = coalesce(nullif(payload ->> 'status', ''), status),
      received_at = case
        when payload ? 'received_at' then nullif(payload ->> 'received_at', '')::timestamptz
        else received_at
      end,
      notes = case when payload ? 'notes' then nullif(trim(payload ->> 'notes'), '') else notes end,
      project_id = case
        when payload ? 'project_id' then nullif(payload ->> 'project_id', '')::uuid
        else project_id
      end,
      updated_at = now()
  where id = donation_id
  returning * into record;

  select * into actor_record from public.actor where id = record.actor_id;
  update public.actor
  set name = coalesce(nullif(trim(payload #>> '{donor,name}'), ''), name),
      email = case when payload #> '{donor}' ? 'email' then nullif(lower(trim(payload #>> '{donor,email}')), '') else email end,
      phone = case when payload #> '{donor}' ? 'phone' then nullif(trim(payload #>> '{donor,phone}'), '') else phone end,
      country = case when payload #> '{donor}' ? 'country' then nullif(trim(payload #>> '{donor,country}'), '') else country end,
      updated_at = now()
  where id = record.actor_id;

  if record.donation_type = 'monetary' and payload ? 'monetary' then
    select id into detail_id
    from public.donation_detail
    where donation_id = record.id and type = 'monetary'
    order by created_at
    limit 1;

    update public.donation_detail
    set amount = coalesce(nullif(payload #>> '{monetary,amount}', '')::numeric, amount),
        currency = coalesce(nullif(upper(payload #>> '{monetary,currency}'), ''), currency),
        updated_at = now()
    where id = detail_id;

    update public.monetary_donation_detail
    set payment_method = coalesce(nullif(payload #>> '{monetary,payment_method}', ''), payment_method),
        usd_base_amount = coalesce(nullif(payload #>> '{monetary,usd_base_amount}', '')::numeric, usd_base_amount),
        exchange_rate_to_usd = coalesce(nullif(payload #>> '{monetary,exchange_rate_to_usd}', '')::numeric, exchange_rate_to_usd),
        exchange_rate_source = case when payload #> '{monetary}' ? 'exchange_rate_source' then nullif(trim(payload #>> '{monetary,exchange_rate_source}'), '') else exchange_rate_source end,
        exchange_rate_date = case when payload #> '{monetary}' ? 'exchange_rate_date' then nullif(payload #>> '{monetary,exchange_rate_date}', '')::date else exchange_rate_date end,
        sender_institution = case when payload #> '{monetary}' ? 'sender_institution' then nullif(trim(payload #>> '{monetary,sender_institution}'), '') else sender_institution end,
        receiver_account_label = case when payload #> '{monetary}' ? 'receiver_account_label' then nullif(trim(payload #>> '{monetary,receiver_account_label}'), '') else receiver_account_label end,
        transaction_reference = case when payload #> '{monetary}' ? 'transaction_reference' then nullif(trim(payload #>> '{monetary,transaction_reference}'), '') else transaction_reference end,
        updated_at = now()
    where donation_detail_id = detail_id;
  end if;

  if record.donation_type in ('in_kind', 'mixed') and payload ? 'shipment' then
    update public.shipment
    set transport_mode = coalesce(nullif(payload #>> '{shipment,transport_mode}', ''), transport_mode),
        status = coalesce(nullif(payload #>> '{shipment,status}', ''), status),
        shipment_scope = coalesce(nullif(payload #>> '{shipment,shipment_scope}', ''), shipment_scope),
        origin_country = coalesce(nullif(trim(payload #>> '{shipment,origin_country}'), ''), origin_country),
        origin_city = case when payload #> '{shipment}' ? 'origin_city' then nullif(trim(payload #>> '{shipment,origin_city}'), '') else origin_city end,
        destination_country = coalesce(nullif(trim(payload #>> '{shipment,destination_country}'), ''), destination_country),
        destination_city = case when payload #> '{shipment}' ? 'destination_city' then nullif(trim(payload #>> '{shipment,destination_city}'), '') else destination_city end,
        container_number = case when payload #> '{shipment}' ? 'container_number' then nullif(trim(payload #>> '{shipment,container_number}'), '') else container_number end,
        tracking_number = case when payload #> '{shipment}' ? 'tracking_number' then nullif(trim(payload #>> '{shipment,tracking_number}'), '') else tracking_number end,
        departure_date = case when payload #> '{shipment}' ? 'departure_date' then nullif(payload #>> '{shipment,departure_date}', '')::date else departure_date end,
        estimated_arrival = case when payload #> '{shipment}' ? 'estimated_arrival' then nullif(payload #>> '{shipment,estimated_arrival}', '')::date else estimated_arrival end,
        actual_arrival = case when payload #> '{shipment}' ? 'actual_arrival' then nullif(payload #>> '{shipment,actual_arrival}', '')::date else actual_arrival end,
        category_codes = case when payload #> '{shipment}' ? 'category_codes' then array(select jsonb_array_elements_text(payload #> '{shipment,category_codes}')) else category_codes end,
        contents_summary = case when payload #> '{shipment}' ? 'contents_summary' then nullif(trim(payload #>> '{shipment,contents_summary}'), '') else contents_summary end,
        declared_package_count = case when payload #> '{shipment}' ? 'declared_package_count' then nullif(payload #>> '{shipment,declared_package_count}', '')::numeric else declared_package_count end,
        package_unit_code = case when payload #> '{shipment}' ? 'package_unit_code' then nullif(payload #>> '{shipment,package_unit_code}', '') else package_unit_code end,
        notes = case when payload #> '{shipment}' ? 'notes' then nullif(trim(payload #>> '{shipment,notes}'), '') else notes end,
        updated_at = now()
    where donation_id = record.id;
  end if;

  return jsonb_build_object('id', record.id, 'updated', true);
end;
$$;

revoke all on function public.update_donation_record(jsonb) from public, anon;
grant execute on function public.update_donation_record(jsonb) to authenticated;

alter table public.organization enable row level security;
alter table public.project enable row level security;
alter table public.volunteer enable row level security;

create policy "Operators view their organization"
on public.organization for select to authenticated
using (
  private.is_authorized_operator()
  and (private.is_super_admin() or id = private.current_operator_organization_id())
);

create policy "Superadmins manage organizations"
on public.organization for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy "Operators view organization projects"
on public.project for select to authenticated
using (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
);

create policy "Admins manage organization projects"
on public.project for all to authenticated
using (
  private.is_authorized_admin()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
)
with check (
  private.is_authorized_admin()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
);

create policy "Operators manage organization volunteers"
on public.volunteer for all to authenticated
using (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
)
with check (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
);

grant select, insert, update, delete on table
  public.organization,
  public.project,
  public.volunteer
to authenticated;

revoke all on table
  public.organization,
  public.project,
  public.volunteer
from anon;
