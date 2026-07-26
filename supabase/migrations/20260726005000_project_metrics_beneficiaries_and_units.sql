-- Project-level execution summaries, optional nominal beneficiary detail,
-- and catalog-backed units for Edifica compliance records.

insert into public.unit_of_measure (code, name_es, name_en, abbreviation, active)
values
  ('kit', 'Kit', 'Kit', 'kit', true),
  ('person', 'Persona', 'Person', 'pers.', true),
  ('family', 'Familia', 'Family', 'fam.', true),
  ('consultation', 'Consulta', 'Consultation', 'cons.', true),
  ('service', 'Servicio', 'Service', 'serv.', true),
  ('workday', 'Jornada', 'Workday', 'jorn.', true)
on conflict (code) do update
set name_es = excluded.name_es,
    name_en = excluded.name_en,
    abbreviation = excluded.abbreviation,
    active = true,
    updated_at = now();

alter table public.project
  add column if not exists beneficiary_detail_enabled boolean not null default false;

alter table public.project_output
  add column if not exists unit_of_measure_id uuid references public.unit_of_measure(id);

update public.project_output output
set unit_of_measure_id = unit.id
from public.unit_of_measure unit
where output.unit_of_measure_id is null
  and (
    lower(trim(output.unit_label)) in (lower(unit.code), lower(unit.name_es), lower(unit.name_en), lower(unit.abbreviation))
    or (lower(trim(output.unit_label)) in ('kits', 'kit') and unit.code = 'kit')
    or (lower(trim(output.unit_label)) in ('personas', 'persona') and unit.code = 'person')
    or (lower(trim(output.unit_label)) in ('consultas', 'consulta') and unit.code = 'consultation')
    or (lower(trim(output.unit_label)) in ('jornadas', 'jornada') and unit.code = 'workday')
  );

create or replace function private.sync_project_output_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_unit public.unit_of_measure%rowtype;
begin
  if new.unit_of_measure_id is not null then
    select * into selected_unit
    from public.unit_of_measure
    where id = new.unit_of_measure_id and active;

    if not found then
      raise exception using errcode = '22023', message = 'A valid active unit of measure is required.';
    end if;

    new.unit_label := selected_unit.abbreviation;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_project_output_unit_trigger on public.project_output;
create trigger sync_project_output_unit_trigger
before insert or update of unit_of_measure_id on public.project_output
for each row execute function private.sync_project_output_unit();

alter table private.beneficiary
  add column if not exists organization_id uuid references public.organization(id),
  add column if not exists project_id uuid references public.project(id),
  add column if not exists identification_number text,
  add column if not exists benefit_received text,
  add column if not exists notes text,
  add column if not exists active boolean not null default true;

create index if not exists beneficiary_organization_project_idx
  on private.beneficiary (organization_id, project_id, active);

create unique index if not exists beneficiary_project_identification_unique
  on private.beneficiary (project_id, lower(identification_number))
  where identification_number is not null and archived_at is null;

drop policy if exists "Authorized operators manage beneficiary identity" on private.beneficiary;
create policy "Tenant operators manage beneficiary identity"
on private.beneficiary
for all
to authenticated
using (private.can_access_organization(organization_id))
with check (private.can_access_organization(organization_id));

create or replace function public.list_project_beneficiaries(target_project_id uuid)
returns table (
  id uuid,
  project_id uuid,
  organization_id uuid,
  full_name text,
  identification_number text,
  email text,
  phone text,
  residence_country text,
  residence_area text,
  age_band text,
  sex text,
  benefit_received text,
  household_members_represented integer,
  notes text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  project_org uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operational access is required.';
  end if;

  select organization_id into project_org
  from public.project
  where id = target_project_id;

  if project_org is null or not private.can_access_organization(project_org) then
    raise exception using errcode = '42501', message = 'Project access is unavailable.';
  end if;

  return query
  select
    beneficiary.id,
    beneficiary.project_id,
    beneficiary.organization_id,
    beneficiary.full_name,
    beneficiary.identification_number,
    beneficiary.email,
    beneficiary.phone,
    beneficiary.residence_country,
    beneficiary.residence_area,
    beneficiary.age_band,
    beneficiary.sex,
    beneficiary.benefit_received,
    coalesce((
      select max(event.household_members_represented)
      from private.beneficiary_event event
      where event.beneficiary_id = beneficiary.id
    ), 1),
    beneficiary.notes,
    beneficiary.active,
    beneficiary.created_at,
    beneficiary.updated_at
  from private.beneficiary beneficiary
  where beneficiary.project_id = target_project_id
    and beneficiary.archived_at is null
  order by beneficiary.created_at desc;
end;
$$;

create or replace function public.save_project_beneficiary(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_id uuid;
  target_project_id uuid;
  project_org uuid;
  detail_enabled boolean;
  saved_id uuid;
  household_count integer;
  impact_id uuid;
begin
  if current_user_id is null or not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operational access is required.';
  end if;

  target_id := nullif(payload ->> 'id', '')::uuid;
  target_project_id := nullif(payload ->> 'project_id', '')::uuid;

  if target_id is not null and target_project_id is null then
    select project_id into target_project_id
    from private.beneficiary
    where id = target_id;
  end if;

  select organization_id, beneficiary_detail_enabled
  into project_org, detail_enabled
  from public.project
  where id = target_project_id;

  if project_org is null or not private.can_access_organization(project_org) then
    raise exception using errcode = '42501', message = 'Project access is unavailable.';
  end if;

  if not detail_enabled then
    raise exception using errcode = '22023', message = 'Individual beneficiary detail is disabled for this project.';
  end if;

  if nullif(trim(payload ->> 'full_name'), '') is null then
    raise exception using errcode = '22023', message = 'Beneficiary name is required.';
  end if;

  if not coalesce((payload ->> 'privacy_notice_acknowledged')::boolean, false) then
    raise exception using errcode = '22023', message = 'Privacy acknowledgement is required.';
  end if;

  household_count := greatest(coalesce(nullif(payload ->> 'household_members_represented', '')::integer, 1), 1);

  if target_id is null then
    insert into private.beneficiary (
      public_code,
      submission_key,
      organization_id,
      project_id,
      full_name,
      identification_number,
      date_of_birth,
      age_band,
      sex,
      phone,
      has_whatsapp,
      email,
      residence_country,
      residence_area,
      benefit_received,
      privacy_notice_acknowledged,
      privacy_notice_acknowledged_at,
      notes,
      active,
      created_by,
      updated_by
    ) values (
      'BEN-' || substring(upper(replace(gen_random_uuid()::text, '-', '')) from 1 for 12),
      gen_random_uuid(),
      project_org,
      target_project_id,
      trim(payload ->> 'full_name'),
      nullif(trim(payload ->> 'identification_number'), ''),
      nullif(payload ->> 'date_of_birth', '')::date,
      coalesce(nullif(payload ->> 'age_band', ''), 'unknown'),
      coalesce(nullif(payload ->> 'sex', ''), 'unknown'),
      nullif(trim(payload ->> 'phone'), ''),
      coalesce((payload ->> 'has_whatsapp')::boolean, false),
      nullif(lower(trim(payload ->> 'email')), ''),
      nullif(trim(payload ->> 'residence_country'), ''),
      coalesce(nullif(trim(payload ->> 'residence_area'), ''), 'Sin especificar'),
      nullif(trim(payload ->> 'benefit_received'), ''),
      true,
      now(),
      nullif(trim(payload ->> 'notes'), ''),
      coalesce((payload ->> 'active')::boolean, true),
      current_user_id,
      current_user_id
    ) returning id into saved_id;
  else
    update private.beneficiary
    set
      full_name = trim(payload ->> 'full_name'),
      identification_number = nullif(trim(payload ->> 'identification_number'), ''),
      date_of_birth = nullif(payload ->> 'date_of_birth', '')::date,
      age_band = coalesce(nullif(payload ->> 'age_band', ''), age_band),
      sex = coalesce(nullif(payload ->> 'sex', ''), sex),
      phone = nullif(trim(payload ->> 'phone'), ''),
      has_whatsapp = coalesce((payload ->> 'has_whatsapp')::boolean, has_whatsapp),
      email = nullif(lower(trim(payload ->> 'email')), ''),
      residence_country = nullif(trim(payload ->> 'residence_country'), ''),
      residence_area = coalesce(nullif(trim(payload ->> 'residence_area'), ''), residence_area),
      benefit_received = nullif(trim(payload ->> 'benefit_received'), ''),
      notes = nullif(trim(payload ->> 'notes'), ''),
      active = coalesce((payload ->> 'active')::boolean, active),
      privacy_notice_acknowledged = true,
      privacy_notice_acknowledged_at = coalesce(privacy_notice_acknowledged_at, now()),
      updated_by = current_user_id,
      updated_at = now()
    where id = target_id
      and project_id = target_project_id
      and private.can_access_organization(organization_id)
    returning id into saved_id;

    if saved_id is null then
      raise exception using errcode = 'P0002', message = 'Beneficiary record was not found.';
    end if;
  end if;

  select id into impact_id
  from public.impact_event
  where project_id = target_project_id
  order by created_at desc
  limit 1;

  if impact_id is not null then
    insert into private.beneficiary_event (
      beneficiary_id,
      impact_event_id,
      submission_key,
      attendance_status,
      household_members_represented,
      service_codes,
      created_by,
      updated_by
    ) values (
      saved_id,
      impact_id,
      gen_random_uuid(),
      'attended',
      household_count,
      case when nullif(trim(payload ->> 'benefit_received'), '') is null then '{}'::text[] else array[trim(payload ->> 'benefit_received')] end,
      current_user_id,
      current_user_id
    )
    on conflict do nothing;
  end if;

  return saved_id;
end;
$$;

create or replace function public.current_operations_summary(target_organization_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_org uuid := target_organization_id;
  donation_count integer := 0;
  monetary_count integer := 0;
  in_kind_count integer := 0;
  received_usd numeric := 0;
  beneficiary_total integer := 0;
  physical_compliance numeric := 0;
  investments jsonb := '{}'::jsonb;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operational access is required.';
  end if;

  if requested_org is null and not private.is_super_admin() then
    requested_org := private.current_operator_organization_id();
  end if;

  if requested_org is not null and not private.can_access_organization(requested_org) then
    raise exception using errcode = '42501', message = 'Organization access is unavailable.';
  end if;

  select
    count(*)::integer,
    count(*) filter (where donation_type = 'monetary')::integer,
    count(*) filter (where donation_type = 'in_kind')::integer
  into donation_count, monetary_count, in_kind_count
  from public.donation
  where requested_org is null or organization_id = requested_org;

  select coalesce(sum(monetary.usd_base_amount), 0)
  into received_usd
  from public.monetary_donation_detail monetary
  join public.donation_detail detail on detail.id = monetary.donation_detail_id
  join public.donation donation on donation.id = detail.donation_id
  where requested_org is null or donation.organization_id = requested_org;

  select coalesce(jsonb_object_agg(currency, total order by currency), '{}'::jsonb)
  into investments
  from (
    select expense.currency::text as currency, sum(expense.amount) as total
    from public.project_expense expense
    join public.project project on project.id = expense.project_id
    where expense.status <> 'rejected'
      and (requested_org is null or project.organization_id = requested_org)
    group by expense.currency
  ) grouped;

  select coalesce(sum(
    case
      when project.beneficiary_detail_enabled then (
        select count(*) from private.beneficiary beneficiary
        where beneficiary.project_id = project.id
          and beneficiary.active
          and beneficiary.archived_at is null
      )
      else (
        select coalesce(sum(output.beneficiary_count), 0)
        from public.project_output output
        where output.project_id = project.id
      )
    end
  ), 0)::integer
  into beneficiary_total
  from public.project project
  where requested_org is null or project.organization_id = requested_org;

  select coalesce(avg(progress), 0)
  into physical_compliance
  from (
    select least(999, round((output.delivered_quantity / nullif(output.target_quantity, 0)) * 100)) as progress
    from public.project_output output
    join public.project project on project.id = output.project_id
    where output.target_quantity > 0
      and (requested_org is null or project.organization_id = requested_org)
  ) progress_rows;

  return jsonb_build_object(
    'donation_count', donation_count,
    'monetary_count', monetary_count,
    'in_kind_count', in_kind_count,
    'monetary_received_usd', received_usd,
    'investment_by_currency', investments,
    'beneficiary_count', beneficiary_total,
    'compliance_percent', round(physical_compliance)
  );
end;
$$;

create or replace function public.project_compliance_summary(target_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  project_row public.project%rowtype;
  investment numeric := 0;
  beneficiaries integer := 0;
  compliance numeric := 0;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operational access is required.';
  end if;

  select * into project_row
  from public.project
  where id = target_project_id;

  if project_row.id is null or not private.can_access_organization(project_row.organization_id) then
    raise exception using errcode = '42501', message = 'Project access is unavailable.';
  end if;

  select coalesce(sum(amount), 0)
  into investment
  from public.project_expense
  where project_id = target_project_id
    and status <> 'rejected'
    and currency = project_row.currency;

  if project_row.beneficiary_detail_enabled then
    select count(*)::integer into beneficiaries
    from private.beneficiary
    where project_id = target_project_id
      and active
      and archived_at is null;
  else
    select coalesce(sum(beneficiary_count), 0)::integer into beneficiaries
    from public.project_output
    where project_id = target_project_id;
  end if;

  select coalesce(avg(least(999, round((delivered_quantity / nullif(target_quantity, 0)) * 100))), 0)
  into compliance
  from public.project_output
  where project_id = target_project_id
    and target_quantity > 0;

  return jsonb_build_object(
    'investment', investment,
    'beneficiary_count', beneficiaries,
    'compliance_percent', round(compliance),
    'budget_percent', case when coalesce(project_row.approved_budget, 0) > 0 then least(999, round((investment / project_row.approved_budget) * 100)) else 0 end
  );
end;
$$;

revoke all on function public.list_project_beneficiaries(uuid) from public, anon;
revoke all on function public.save_project_beneficiary(jsonb) from public, anon;
revoke all on function public.current_operations_summary(uuid) from public, anon;
revoke all on function public.project_compliance_summary(uuid) from public, anon;

grant execute on function public.list_project_beneficiaries(uuid) to authenticated;
grant execute on function public.save_project_beneficiary(jsonb) to authenticated;
grant execute on function public.current_operations_summary(uuid) to authenticated;
grant execute on function public.project_compliance_summary(uuid) to authenticated;
