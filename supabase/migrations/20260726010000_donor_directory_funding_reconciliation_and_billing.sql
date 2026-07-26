-- Donor directory, project funding reconciliation, and SaaS billing foundation.

alter table public.project
  add column if not exists funding_partner_actor_id uuid references public.actor(id) on delete set null;

create index if not exists project_funding_partner_actor_idx
  on public.project (funding_partner_actor_id)
  where funding_partner_actor_id is not null;

-- Preserve existing project partner names as reusable donor records.
insert into public.actor (organization_id, name, is_organization, active)
select distinct project.organization_id, trim(project.funding_partner), true, true
from public.project project
where nullif(trim(project.funding_partner), '') is not null
  and not exists (
    select 1
    from public.actor actor
    join public.actor_role role on role.actor_id = actor.id and role.role = 'donor'
    where actor.organization_id = project.organization_id
      and lower(actor.name) = lower(trim(project.funding_partner))
  );

insert into public.actor_role (actor_id, role)
select actor.id, 'donor'
from public.actor actor
where actor.organization_id is not null
  and exists (
    select 1
    from public.project project
    where project.organization_id = actor.organization_id
      and lower(trim(project.funding_partner)) = lower(actor.name)
  )
on conflict (actor_id, role) do nothing;

update public.project project
set funding_partner_actor_id = actor.id
from public.actor actor
join public.actor_role role on role.actor_id = actor.id and role.role = 'donor'
where project.funding_partner_actor_id is null
  and actor.organization_id = project.organization_id
  and lower(actor.name) = lower(trim(project.funding_partner));

create or replace function public.list_donor_directory(target_organization_id uuid default null)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  email text,
  phone text,
  country text,
  is_organization boolean,
  is_anonymous boolean,
  active boolean,
  donation_count bigint,
  project_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_organization_id uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operational access is required.';
  end if;

  resolved_organization_id := coalesce(target_organization_id, private.current_operator_organization_id());

  if not private.is_super_admin() and resolved_organization_id is distinct from private.current_operator_organization_id() then
    raise exception using errcode = '42501', message = 'The requested donor directory belongs to another organization.';
  end if;

  return query
  select
    actor.id,
    actor.organization_id,
    actor.name,
    actor.email,
    actor.phone,
    actor.country,
    actor.is_organization,
    actor.is_anonymous,
    actor.active,
    (select count(*) from public.donation donation where donation.actor_id = actor.id),
    (select count(*) from public.project project where project.funding_partner_actor_id = actor.id),
    actor.created_at,
    actor.updated_at
  from public.actor actor
  join public.actor_role role on role.actor_id = actor.id and role.role = 'donor'
  where (resolved_organization_id is null and private.is_super_admin())
     or actor.organization_id = resolved_organization_id
  order by actor.active desc, lower(actor.name), actor.created_at desc;
end;
$$;

create or replace function public.save_donor_directory(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_organization_id uuid;
  target_name text;
  target_email text;
  target_phone text;
  target_country text;
  target_is_organization boolean;
  target_is_anonymous boolean;
  target_active boolean;
  saved public.actor%rowtype;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operational access is required.';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = '22023', message = 'Donor data is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
    target_organization_id := coalesce(
      nullif(payload ->> 'organization_id', '')::uuid,
      private.current_operator_organization_id()
    );
  exception when others then
    raise exception using errcode = '22023', message = 'The donor or organization identifier is invalid.';
  end;

  if target_organization_id is null then
    raise exception using errcode = '22023', message = 'Select an organization for this donor.';
  end if;

  if not private.can_access_organization(target_organization_id) then
    raise exception using errcode = '42501', message = 'You cannot manage donors for this organization.';
  end if;

  target_is_anonymous := coalesce((payload ->> 'is_anonymous')::boolean, false);
  target_is_organization := coalesce((payload ->> 'is_organization')::boolean, true);
  target_name := trim(coalesce(payload ->> 'name', ''));
  target_email := nullif(lower(trim(payload ->> 'email')), '');
  target_phone := nullif(trim(payload ->> 'phone'), '');
  target_country := nullif(trim(payload ->> 'country'), '');
  target_active := coalesce((payload ->> 'active')::boolean, true);

  if target_is_anonymous then
    target_name := coalesce(nullif(target_name, ''), 'Donante anónimo');
    target_email := null;
    target_phone := null;
    target_is_organization := false;
  elsif target_name = '' then
    raise exception using errcode = '22023', message = 'The donor name is required.';
  end if;

  if target_email is not null and target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Enter a valid donor email.';
  end if;

  if target_id is null and target_email is not null then
    select actor.id into target_id
    from public.actor actor
    join public.actor_role role on role.actor_id = actor.id and role.role = 'donor'
    where actor.organization_id = target_organization_id
      and lower(actor.email) = target_email
    limit 1;
  end if;

  if target_id is null then
    insert into public.actor (
      organization_id, name, email, phone, country,
      is_organization, is_anonymous, active
    ) values (
      target_organization_id, target_name, target_email, target_phone, target_country,
      target_is_organization, target_is_anonymous, target_active
    )
    returning * into saved;
  else
    update public.actor actor
    set
      name = target_name,
      email = target_email,
      phone = target_phone,
      country = target_country,
      is_organization = target_is_organization,
      is_anonymous = target_is_anonymous,
      active = target_active,
      updated_at = now()
    where actor.id = target_id
      and actor.organization_id = target_organization_id
    returning * into saved;

    if not found then
      raise exception using errcode = 'P0002', message = 'The donor record was not found in this organization.';
    end if;
  end if;

  insert into public.actor_role (actor_id, role)
  values (saved.id, 'donor')
  on conflict (actor_id, role) do nothing;

  return jsonb_build_object(
    'id', saved.id,
    'organization_id', saved.organization_id,
    'name', saved.name,
    'email', saved.email,
    'phone', saved.phone,
    'country', saved.country,
    'is_organization', saved.is_organization,
    'is_anonymous', saved.is_anonymous,
    'active', saved.active
  );
end;
$$;

create or replace function public.submit_monetary_donation_v2(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  base_result jsonb;
  result_donation_id uuid;
  selected_actor_id uuid;
  previous_actor_id uuid;
  target_organization_id uuid;
  target_project_id uuid;
begin
  begin
    selected_actor_id := nullif(payload ->> 'donor_actor_id', '')::uuid;
    target_organization_id := coalesce(nullif(payload ->> 'organization_id', '')::uuid, private.current_operator_organization_id());
    target_project_id := nullif(payload ->> 'project_id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'The donor, organization, or project identifier is invalid.';
  end;

  if target_organization_id is null or not private.can_access_organization(target_organization_id) then
    raise exception using errcode = '42501', message = 'A valid organization is required.';
  end if;

  if target_project_id is not null and not exists (
    select 1 from public.project project
    where project.id = target_project_id and project.organization_id = target_organization_id
  ) then
    raise exception using errcode = '22023', message = 'The selected project does not belong to the organization.';
  end if;

  if selected_actor_id is not null and not exists (
    select 1
    from public.actor actor
    join public.actor_role role on role.actor_id = actor.id and role.role = 'donor'
    where actor.id = selected_actor_id
      and actor.organization_id = target_organization_id
      and actor.active
  ) then
    raise exception using errcode = '22023', message = 'The selected donor is unavailable.';
  end if;

  base_result := public.submit_monetary_donation(payload);
  result_donation_id := (base_result ->> 'donation_id')::uuid;

  select donation.actor_id into previous_actor_id
  from public.donation donation
  where donation.id = result_donation_id;

  update public.donation
  set
    actor_id = coalesce(selected_actor_id, actor_id),
    organization_id = target_organization_id,
    project_id = target_project_id,
    updated_at = now()
  where id = result_donation_id;

  if selected_actor_id is not null and previous_actor_id is distinct from selected_actor_id then
    delete from public.actor_role role
    where role.actor_id = previous_actor_id
      and not exists (select 1 from public.donation donation where donation.actor_id = previous_actor_id)
      and not exists (select 1 from public.project project where project.funding_partner_actor_id = previous_actor_id);
    delete from public.actor actor
    where actor.id = previous_actor_id
      and not exists (select 1 from public.donation donation where donation.actor_id = previous_actor_id)
      and not exists (select 1 from public.project project where project.funding_partner_actor_id = previous_actor_id);
  end if;

  return base_result || jsonb_build_object(
    'organization_id', target_organization_id,
    'project_id', target_project_id,
    'donor_actor_id', coalesce(selected_actor_id, previous_actor_id)
  );
end;
$$;

create or replace function public.submit_in_kind_shipment_v2(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  base_result jsonb;
  result_donation_id uuid;
  selected_actor_id uuid;
  previous_actor_id uuid;
  target_organization_id uuid;
  target_project_id uuid;
begin
  begin
    selected_actor_id := nullif(payload ->> 'donor_actor_id', '')::uuid;
    target_organization_id := coalesce(nullif(payload ->> 'organization_id', '')::uuid, private.current_operator_organization_id());
    target_project_id := nullif(payload ->> 'project_id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'The donor, organization, or project identifier is invalid.';
  end;

  if target_organization_id is null or not private.can_access_organization(target_organization_id) then
    raise exception using errcode = '42501', message = 'A valid organization is required.';
  end if;

  if target_project_id is not null and not exists (
    select 1 from public.project project
    where project.id = target_project_id and project.organization_id = target_organization_id
  ) then
    raise exception using errcode = '22023', message = 'The selected project does not belong to the organization.';
  end if;

  if selected_actor_id is not null and not exists (
    select 1
    from public.actor actor
    join public.actor_role role on role.actor_id = actor.id and role.role = 'donor'
    where actor.id = selected_actor_id
      and actor.organization_id = target_organization_id
      and actor.active
  ) then
    raise exception using errcode = '22023', message = 'The selected donor is unavailable.';
  end if;

  base_result := public.submit_in_kind_shipment(payload);
  result_donation_id := (base_result ->> 'donation_id')::uuid;

  select donation.actor_id into previous_actor_id
  from public.donation donation
  where donation.id = result_donation_id;

  update public.donation
  set
    actor_id = coalesce(selected_actor_id, actor_id),
    organization_id = target_organization_id,
    project_id = target_project_id,
    updated_at = now()
  where id = result_donation_id;

  update public.actor actor
  set organization_id = target_organization_id
  where actor.id = coalesce(selected_actor_id, previous_actor_id)
    and actor.organization_id is null;

  if selected_actor_id is not null and previous_actor_id is distinct from selected_actor_id then
    delete from public.actor_role role
    where role.actor_id = previous_actor_id
      and not exists (select 1 from public.donation donation where donation.actor_id = previous_actor_id)
      and not exists (select 1 from public.project project where project.funding_partner_actor_id = previous_actor_id);
    delete from public.actor actor
    where actor.id = previous_actor_id
      and not exists (select 1 from public.donation donation where donation.actor_id = previous_actor_id)
      and not exists (select 1 from public.project project where project.funding_partner_actor_id = previous_actor_id);
  end if;

  return base_result || jsonb_build_object(
    'organization_id', target_organization_id,
    'project_id', target_project_id,
    'donor_actor_id', coalesce(selected_actor_id, previous_actor_id)
  );
end;
$$;

create or replace function public.project_funding_reconciliation(target_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_project public.project%rowtype;
  received_project_currency numeric := 0;
  received_usd numeric := 0;
  executed_amount numeric := 0;
  donation_rows jsonb := '[]'::jsonb;
  received_by_currency jsonb := '{}'::jsonb;
  in_kind_by_currency jsonb := '{}'::jsonb;
begin
  select * into target_project
  from public.project project
  where project.id = target_project_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Project not found.';
  end if;

  if not private.can_access_organization(target_project.organization_id) then
    raise exception using errcode = '42501', message = 'You cannot access this project.';
  end if;

  select coalesce(sum(detail.amount), 0)
  into received_project_currency
  from public.donation donation
  join public.donation_detail detail on detail.donation_id = donation.id and detail.type = 'monetary'
  where donation.project_id = target_project_id
    and detail.currency = target_project.currency;

  select coalesce(sum(monetary.usd_base_amount), 0)
  into received_usd
  from public.donation donation
  join public.donation_detail detail on detail.donation_id = donation.id and detail.type = 'monetary'
  join public.monetary_donation_detail monetary on monetary.donation_detail_id = detail.id
  where donation.project_id = target_project_id;

  select coalesce(sum(expense.amount), 0)
  into executed_amount
  from public.project_expense expense
  where expense.project_id = target_project_id
    and expense.status <> 'rejected'
    and expense.currency = target_project.currency;

  select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
  into received_by_currency
  from (
    select trim(detail.currency)::text as currency, sum(detail.amount) as total
    from public.donation donation
    join public.donation_detail detail on detail.donation_id = donation.id and detail.type = 'monetary'
    where donation.project_id = target_project_id
    group by trim(detail.currency)::text
  ) totals;

  select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
  into in_kind_by_currency
  from (
    select trim(detail.reference_currency)::text as currency, sum(detail.reference_value) as total
    from public.donation donation
    join public.donation_detail detail on detail.donation_id = donation.id and detail.type = 'in_kind'
    where donation.project_id = target_project_id
      and detail.reference_value is not null
      and detail.reference_currency is not null
    group by trim(detail.reference_currency)::text
  ) totals;

  select coalesce(jsonb_agg(row_data order by received_at desc nulls last, created_at desc), '[]'::jsonb)
  into donation_rows
  from (
    select jsonb_build_object(
      'id', donation.id,
      'reference_code', donation.reference_code,
      'donation_type', donation.donation_type,
      'status', donation.status,
      'received_at', donation.received_at,
      'created_at', donation.created_at,
      'donor_name', actor.name,
      'amount', monetary_detail.amount,
      'currency', monetary_detail.currency,
      'usd_base_amount', monetary_detail.usd_base_amount,
      'in_kind_reference_value', in_kind_detail.reference_value,
      'in_kind_reference_currency', in_kind_detail.reference_currency,
      'contents_summary', shipment.contents_summary,
      'package_count', shipment.declared_package_count,
      'package_unit', shipment.package_unit_code
    ) as row_data,
    donation.received_at,
    donation.created_at
    from public.donation donation
    join public.actor actor on actor.id = donation.actor_id
    left join lateral (
      select detail.amount, trim(detail.currency)::text as currency, monetary.usd_base_amount
      from public.donation_detail detail
      left join public.monetary_donation_detail monetary on monetary.donation_detail_id = detail.id
      where detail.donation_id = donation.id and detail.type = 'monetary'
      order by detail.created_at
      limit 1
    ) monetary_detail on true
    left join lateral (
      select sum(detail.reference_value) as reference_value,
             min(trim(detail.reference_currency)::text) as reference_currency
      from public.donation_detail detail
      where detail.donation_id = donation.id and detail.type = 'in_kind'
    ) in_kind_detail on true
    left join public.shipment shipment on shipment.donation_id = donation.id
    where donation.project_id = target_project_id
  ) rows;

  return jsonb_build_object(
    'project_id', target_project.id,
    'project_currency', trim(target_project.currency),
    'approved_amount', target_project.approved_budget,
    'received_project_currency', received_project_currency,
    'received_usd', received_usd,
    'received_by_currency', received_by_currency,
    'in_kind_reference_by_currency', in_kind_by_currency,
    'executed_amount', executed_amount,
    'balance_after_execution', received_project_currency - executed_amount,
    'donation_count', jsonb_array_length(donation_rows),
    'donations', donation_rows
  );
end;
$$;

-- SaaS customer, subscription, seat-limit, and payment model.
create table if not exists public.subscription_plan (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_es text not null,
  name_en text not null,
  description_es text,
  description_en text,
  monthly_price numeric(14,2),
  annual_price numeric(14,2),
  currency char(3) not null default 'USD',
  included_users integer not null default 1,
  max_users integer not null default 1,
  max_projects integer,
  storage_limit_mb integer,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plan_code_check check (code ~ '^[a-z][a-z0-9_-]{1,39}$'),
  constraint subscription_plan_price_check check (
    (monthly_price is null or monthly_price >= 0)
    and (annual_price is null or annual_price >= 0)
  ),
  constraint subscription_plan_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint subscription_plan_users_check check (included_users >= 1 and max_users >= included_users)
);

create table if not exists public.organization_subscription (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organization(id) on delete cascade,
  plan_id uuid references public.subscription_plan(id) on delete set null,
  billing_cycle text not null default 'monthly',
  status text not null default 'trial',
  seat_limit integer not null default 1,
  current_period_start date,
  current_period_end date,
  next_billing_date date,
  agreed_amount numeric(14,2),
  currency char(3) not null default 'USD',
  payment_provider text,
  external_customer_id text,
  external_subscription_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscription_cycle_check check (billing_cycle in ('monthly', 'annual')),
  constraint organization_subscription_status_check check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  constraint organization_subscription_seat_check check (seat_limit >= 1),
  constraint organization_subscription_amount_check check (agreed_amount is null or agreed_amount >= 0),
  constraint organization_subscription_currency_check check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.subscription_payment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  subscription_id uuid references public.organization_subscription(id) on delete set null,
  payment_date date not null default current_date,
  amount numeric(14,2) not null,
  currency char(3) not null default 'USD',
  status text not null default 'paid',
  payment_method text,
  external_reference text,
  period_start date,
  period_end date,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payment_amount_check check (amount > 0),
  constraint subscription_payment_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint subscription_payment_status_check check (status in ('pending', 'paid', 'failed', 'refunded'))
);

create index if not exists subscription_payment_organization_date_idx
  on public.subscription_payment (organization_id, payment_date desc);

insert into public.subscription_plan (
  code, name_es, name_en, description_es, description_en,
  included_users, max_users, features
) values (
  'custom', 'Plan personalizado', 'Custom plan',
  'Plan configurable para cada organización usuaria de Edifica.',
  'Configurable plan for each organization using Edifica.',
  1, 500, jsonb_build_object('projects', true, 'reports', true, 'donors', true, 'beneficiaries', true)
)
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  description_es = excluded.description_es,
  description_en = excluded.description_en,
  active = true;

insert into public.organization_subscription (
  organization_id, plan_id, billing_cycle, status, seat_limit, currency
)
select
  organization.id,
  plan.id,
  'monthly',
  organization.subscription_status,
  greatest(1, coalesce((
    select count(*)::integer
    from private.operator_access access
    where access.organization_id = organization.id and access.active
  ), 0)),
  'USD'
from public.organization organization
cross join public.subscription_plan plan
where plan.code = 'custom'
on conflict (organization_id) do nothing;

create or replace function private.enforce_organization_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_seats integer;
  occupied_seats integer;
begin
  if new.organization_id is null or not new.active then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.active
     and old.organization_id is not distinct from new.organization_id then
    return new;
  end if;

  select subscription.seat_limit into allowed_seats
  from public.organization_subscription subscription
  where subscription.organization_id = new.organization_id
    and subscription.status in ('trial', 'active', 'past_due')
  limit 1;

  if allowed_seats is null then
    allowed_seats := 1;
  end if;

  select count(*) into occupied_seats
  from private.operator_access access
  where access.organization_id = new.organization_id
    and access.active
    and access.id is distinct from new.id;

  if occupied_seats >= allowed_seats then
    raise exception using
      errcode = '23514',
      message = format('The organization has reached its limit of %s active users.', allowed_seats);
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_organization_seat_limit() from public, anon, authenticated;

drop trigger if exists operator_access_enforce_seat_limit on private.operator_access;
create trigger operator_access_enforce_seat_limit
before insert or update of active, organization_id on private.operator_access
for each row execute function private.enforce_organization_seat_limit();

create or replace function public.organization_billing_overview(target_organization_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_organization_id uuid := coalesce(target_organization_id, private.current_operator_organization_id());
  result jsonb;
begin
  if resolved_organization_id is null or not private.can_access_organization(resolved_organization_id) then
    raise exception using errcode = '42501', message = 'You cannot access this organization billing account.';
  end if;

  select jsonb_build_object(
    'organization_id', organization.id,
    'organization_name', organization.name,
    'billing_email', organization.contact_email,
    'subscription_id', subscription.id,
    'plan_id', plan.id,
    'plan_code', plan.code,
    'plan_name_es', plan.name_es,
    'plan_name_en', plan.name_en,
    'billing_cycle', subscription.billing_cycle,
    'status', subscription.status,
    'seat_limit', subscription.seat_limit,
    'active_users', (select count(*) from private.operator_access access where access.organization_id = organization.id and access.active),
    'available_seats', greatest(subscription.seat_limit - (select count(*) from private.operator_access access where access.organization_id = organization.id and access.active), 0),
    'agreed_amount', subscription.agreed_amount,
    'currency', trim(subscription.currency),
    'current_period_start', subscription.current_period_start,
    'current_period_end', subscription.current_period_end,
    'next_billing_date', subscription.next_billing_date,
    'payment_provider', subscription.payment_provider,
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', payment.id,
        'payment_date', payment.payment_date,
        'amount', payment.amount,
        'currency', trim(payment.currency),
        'status', payment.status,
        'payment_method', payment.payment_method,
        'external_reference', payment.external_reference,
        'period_start', payment.period_start,
        'period_end', payment.period_end,
        'notes', payment.notes
      ) order by payment.payment_date desc, payment.created_at desc)
      from public.subscription_payment payment
      where payment.organization_id = organization.id
    ), '[]'::jsonb)
  ) into result
  from public.organization organization
  join public.organization_subscription subscription on subscription.organization_id = organization.id
  left join public.subscription_plan plan on plan.id = subscription.plan_id
  where organization.id = resolved_organization_id;

  return coalesce(result, jsonb_build_object('organization_id', resolved_organization_id));
end;
$$;

create or replace function public.admin_save_organization_subscription(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  target_plan_id uuid;
  saved public.organization_subscription%rowtype;
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  begin
    target_organization_id := (payload ->> 'organization_id')::uuid;
    target_plan_id := nullif(payload ->> 'plan_id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'The organization or plan identifier is invalid.';
  end;

  insert into public.organization_subscription (
    organization_id, plan_id, billing_cycle, status, seat_limit,
    current_period_start, current_period_end, next_billing_date,
    agreed_amount, currency, payment_provider,
    external_customer_id, external_subscription_id, notes
  ) values (
    target_organization_id,
    target_plan_id,
    coalesce(nullif(payload ->> 'billing_cycle', ''), 'monthly'),
    coalesce(nullif(payload ->> 'status', ''), 'trial'),
    greatest(coalesce((payload ->> 'seat_limit')::integer, 1), 1),
    nullif(payload ->> 'current_period_start', '')::date,
    nullif(payload ->> 'current_period_end', '')::date,
    nullif(payload ->> 'next_billing_date', '')::date,
    nullif(payload ->> 'agreed_amount', '')::numeric,
    upper(coalesce(nullif(payload ->> 'currency', ''), 'USD')),
    nullif(trim(payload ->> 'payment_provider'), ''),
    nullif(trim(payload ->> 'external_customer_id'), ''),
    nullif(trim(payload ->> 'external_subscription_id'), ''),
    nullif(trim(payload ->> 'notes'), '')
  )
  on conflict (organization_id) do update set
    plan_id = excluded.plan_id,
    billing_cycle = excluded.billing_cycle,
    status = excluded.status,
    seat_limit = excluded.seat_limit,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    next_billing_date = excluded.next_billing_date,
    agreed_amount = excluded.agreed_amount,
    currency = excluded.currency,
    payment_provider = excluded.payment_provider,
    external_customer_id = excluded.external_customer_id,
    external_subscription_id = excluded.external_subscription_id,
    notes = excluded.notes,
    updated_at = now()
  returning * into saved;

  update public.organization
  set subscription_status = saved.status, updated_at = now()
  where id = target_organization_id;

  return to_jsonb(saved);
end;
$$;

create or replace function public.admin_record_subscription_payment(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  saved public.subscription_payment%rowtype;
  target_organization_id uuid;
  target_subscription_id uuid;
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  begin
    target_organization_id := (payload ->> 'organization_id')::uuid;
    target_subscription_id := nullif(payload ->> 'subscription_id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'The organization or subscription identifier is invalid.';
  end;

  insert into public.subscription_payment (
    organization_id, subscription_id, payment_date, amount, currency,
    status, payment_method, external_reference, period_start, period_end,
    notes, recorded_by
  ) values (
    target_organization_id,
    target_subscription_id,
    coalesce(nullif(payload ->> 'payment_date', '')::date, current_date),
    (payload ->> 'amount')::numeric,
    upper(coalesce(nullif(payload ->> 'currency', ''), 'USD')),
    coalesce(nullif(payload ->> 'status', ''), 'paid'),
    nullif(trim(payload ->> 'payment_method'), ''),
    nullif(trim(payload ->> 'external_reference'), ''),
    nullif(payload ->> 'period_start', '')::date,
    nullif(payload ->> 'period_end', '')::date,
    nullif(trim(payload ->> 'notes'), ''),
    (select auth.uid())
  ) returning * into saved;

  return to_jsonb(saved);
end;
$$;

alter table public.subscription_plan enable row level security;
alter table public.organization_subscription enable row level security;
alter table public.subscription_payment enable row level security;

create policy "Authenticated users read active plans"
on public.subscription_plan for select to authenticated
using (active or private.is_super_admin());

create policy "Tenant users read their subscription"
on public.organization_subscription for select to authenticated
using (private.can_access_organization(organization_id));

create policy "Tenant users read their subscription payments"
on public.subscription_payment for select to authenticated
using (private.can_access_organization(organization_id));

revoke all on function public.list_donor_directory(uuid) from public, anon;
revoke all on function public.save_donor_directory(jsonb) from public, anon;
revoke all on function public.submit_monetary_donation_v2(jsonb) from public, anon;
revoke all on function public.submit_in_kind_shipment_v2(jsonb) from public, anon;
revoke all on function public.project_funding_reconciliation(uuid) from public, anon;
revoke all on function public.organization_billing_overview(uuid) from public, anon;
revoke all on function public.admin_save_organization_subscription(jsonb) from public, anon;
revoke all on function public.admin_record_subscription_payment(jsonb) from public, anon;

grant execute on function public.list_donor_directory(uuid) to authenticated;
grant execute on function public.save_donor_directory(jsonb) to authenticated;
grant execute on function public.submit_monetary_donation_v2(jsonb) to authenticated;
grant execute on function public.submit_in_kind_shipment_v2(jsonb) to authenticated;
grant execute on function public.project_funding_reconciliation(uuid) to authenticated;
grant execute on function public.organization_billing_overview(uuid) to authenticated;
grant execute on function public.admin_save_organization_subscription(jsonb) to authenticated;
grant execute on function public.admin_record_subscription_payment(jsonb) to authenticated;

grant select on public.subscription_plan to authenticated;
grant select on public.organization_subscription to authenticated;
grant select on public.subscription_payment to authenticated;

comment on function public.list_donor_directory(uuid) is 'Lists reusable donor and partner records within the active Edifica tenant.';
comment on function public.project_funding_reconciliation(uuid) is 'Compares approved funding, linked donations, and executed project expenses.';
comment on table public.organization_subscription is 'Commercial subscription account for one Edifica tenant organization.';
comment on table public.subscription_payment is 'Payment history received from an Edifica customer organization.';
