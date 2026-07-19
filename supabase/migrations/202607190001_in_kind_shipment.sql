-- In-kind shipment and inventory intake.
-- Requires the foundational actor, donation, donation_detail, media_type,
-- and unit_of_measure tables from Sprint 1.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.actor') is null
    or to_regclass('public.donation') is null
    or to_regclass('public.donation_detail') is null
    or to_regclass('public.media_type') is null
    or to_regclass('public.unit_of_measure') is null then
    raise exception 'Apply the foundational Sprint 1 donation schema before the in-kind shipment migration.';
  end if;
end
$$;

alter table public.donation
  add column if not exists donation_type text not null default 'mixed',
  add column if not exists status text not null default 'draft',
  add column if not exists received_at timestamptz,
  add column if not exists reference_code text;

alter table public.donation_detail
  add column if not exists item_code text,
  add column if not exists category text,
  add column if not exists lot_code text,
  add column if not exists expiry_date date,
  add column if not exists dietary_attributes text[] not null default '{}',
  add column if not exists allergens text,
  add column if not exists reference_value numeric(14,2),
  add column if not exists reference_currency char(3),
  add column if not exists valuation_method text,
  add column if not exists valuation_source text,
  add column if not exists valued_at date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'donation_type_check'
      and conrelid = 'public.donation'::regclass
  ) then
    alter table public.donation
      add constraint donation_type_check
      check (donation_type in ('monetary', 'in_kind', 'mixed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'donation_status_check'
      and conrelid = 'public.donation'::regclass
  ) then
    alter table public.donation
      add constraint donation_status_check
      check (status in ('draft', 'announced', 'received', 'verified', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'donation_detail_reference_value_check'
      and conrelid = 'public.donation_detail'::regclass
  ) then
    alter table public.donation_detail
      add constraint donation_detail_reference_value_check
      check (reference_value is null or reference_value > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'donation_detail_reference_currency_check'
      and conrelid = 'public.donation_detail'::regclass
  ) then
    alter table public.donation_detail
      add constraint donation_detail_reference_currency_check
      check (reference_currency is null or reference_currency ~ '^[A-Z]{3}$');
  end if;
end
$$;

create unique index if not exists donation_reference_code_unique
  on public.donation (reference_code)
  where reference_code is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.shipment (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references public.donation(id) on delete restrict,
  transport_mode text not null,
  status text not null default 'announced',
  origin_country text not null,
  origin_city text,
  destination_country text not null default 'Venezuela',
  destination_city text,
  container_number text,
  tracking_number text,
  carrier_name text,
  departure_date date,
  estimated_arrival date not null,
  actual_arrival date,
  customs_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipment_transport_mode_check
    check (transport_mode in ('sea', 'air', 'road', 'other')),
  constraint shipment_status_check
    check (status in ('announced', 'in_transit', 'customs', 'received', 'closed')),
  constraint shipment_arrival_after_departure_check
    check (actual_arrival is null or departure_date is null or actual_arrival >= departure_date),
  constraint shipment_estimate_after_departure_check
    check (departure_date is null or estimated_arrival >= departure_date)
);

comment on table public.shipment is 'Logistics record for an in-kind donation transported as one shipment.';
comment on column public.shipment.estimated_arrival is 'Expected arrival date at the destination.';

create table public.shipment_item (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipment(id) on delete cascade,
  donation_detail_id uuid unique references public.donation_detail(id) on delete set null,
  item_code text,
  description text not null,
  category text not null,
  declared_quantity numeric(14,3) not null,
  unit_of_measure_id uuid not null references public.unit_of_measure(id) on delete restrict,
  reference_value numeric(14,2),
  reference_currency char(3),
  valuation_method text,
  valuation_source text,
  valued_at date,
  dietary_attributes text[] not null default '{}',
  allergens text,
  declared_lot_code text,
  declared_expiry_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipment_item_category_check
    check (category in ('food', 'clothing', 'hygiene', 'medical', 'household', 'other')),
  constraint shipment_item_declared_quantity_check
    check (declared_quantity > 0),
  constraint shipment_item_reference_value_check
    check (reference_value is null or reference_value > 0),
  constraint shipment_item_reference_currency_check
    check (reference_currency is null or reference_currency ~ '^[A-Z]{3}$')
);

comment on table public.shipment_item is 'One declared line of goods within a shipment.';
comment on column public.shipment_item.reference_value is 'Informative in-kind value; it is not cash received.';

create table public.inventory_lot (
  id uuid primary key default gen_random_uuid(),
  shipment_item_id uuid not null references public.shipment_item(id) on delete restrict,
  warehouse_name text not null,
  lot_code text,
  received_quantity numeric(14,3) not null,
  accepted_quantity numeric(14,3) not null default 0,
  damaged_quantity numeric(14,3) not null default 0,
  unit_of_measure_id uuid not null references public.unit_of_measure(id) on delete restrict,
  received_at timestamptz not null default now(),
  expiry_date date,
  dietary_attributes text[] not null default '{}',
  allergens text,
  item_condition text not null default 'pending_inspection',
  verification_status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_lot_quantity_check
    check (received_quantity > 0 and accepted_quantity >= 0 and damaged_quantity >= 0),
  constraint inventory_lot_accepted_damaged_check
    check (accepted_quantity + damaged_quantity <= received_quantity),
  constraint inventory_lot_condition_check
    check (item_condition in ('pending_inspection', 'new', 'good', 'fair', 'damaged', 'expired')),
  constraint inventory_lot_verification_status_check
    check (verification_status in ('pending', 'verified', 'quarantined', 'rejected'))
);

comment on table public.inventory_lot is 'Accepted or quarantined goods grouped by traceable lot and warehouse.';

create table public.inventory_movement (
  id uuid primary key default gen_random_uuid(),
  inventory_lot_id uuid not null references public.inventory_lot(id) on delete restrict,
  movement_type text not null,
  quantity numeric(14,3) not null,
  destination_name text,
  related_record_type text,
  related_record_id uuid,
  responsible_actor_id uuid references public.actor(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  constraint inventory_movement_type_check
    check (movement_type in ('receipt', 'adjustment', 'reservation', 'transformation', 'distribution', 'transfer', 'damage')),
  constraint inventory_movement_quantity_check
    check (quantity <> 0),
  constraint inventory_movement_direction_check
    check (
      (movement_type in ('receipt', 'adjustment') and quantity <> 0)
      or (movement_type in ('reservation', 'transformation', 'distribution', 'transfer', 'damage') and quantity < 0)
    )
);

comment on table public.inventory_movement is 'Append-only quantity movement for one inventory lot.';

create table public.shipment_attachment (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipment(id) on delete cascade,
  media_type_id uuid references public.media_type(id) on delete restrict,
  attachment_type text not null,
  storage_url text not null,
  file_name text,
  notes text,
  created_at timestamptz not null default now(),
  constraint shipment_attachment_type_check
    check (attachment_type in ('packing_list', 'bill_of_lading', 'customs', 'inspection', 'receipt', 'photo', 'other'))
);

comment on table public.shipment_attachment is 'Shipping, customs, inspection, receipt, and photographic evidence.';

create index shipment_status_idx on public.shipment (status);
create index shipment_estimated_arrival_idx on public.shipment (estimated_arrival);
create index shipment_item_shipment_idx on public.shipment_item (shipment_id);
create index inventory_lot_shipment_item_idx on public.inventory_lot (shipment_item_id);
create index inventory_lot_expiry_idx on public.inventory_lot (expiry_date) where expiry_date is not null;
create index inventory_movement_lot_occurred_idx on public.inventory_movement (inventory_lot_id, occurred_at);
create index shipment_attachment_shipment_idx on public.shipment_attachment (shipment_id);

create trigger shipment_set_updated_at
before update on public.shipment
for each row execute function public.set_updated_at();

create trigger shipment_item_set_updated_at
before update on public.shipment_item
for each row execute function public.set_updated_at();

create trigger inventory_lot_set_updated_at
before update on public.inventory_lot
for each row execute function public.set_updated_at();

create or replace function public.ensure_in_kind_shipment_donation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  linked_type text;
begin
  select donation_type into linked_type
  from public.donation
  where id = new.donation_id;

  if linked_type is distinct from 'in_kind' then
    raise exception 'A shipment requires a donation with donation_type in_kind.';
  end if;

  return new;
end;
$$;

create trigger shipment_requires_in_kind_donation
before insert or update of donation_id on public.shipment
for each row execute function public.ensure_in_kind_shipment_donation();

create or replace view public.inventory_lot_balance
with (security_invoker = true)
as
select
  lot.id as inventory_lot_id,
  lot.shipment_item_id,
  lot.warehouse_name,
  lot.accepted_quantity,
  coalesce(sum(movement.quantity), 0::numeric) as movement_quantity,
  coalesce(sum(movement.quantity), 0::numeric) as available_quantity
from public.inventory_lot lot
left join public.inventory_movement movement
  on movement.inventory_lot_id = lot.id
group by lot.id, lot.shipment_item_id, lot.warehouse_name, lot.accepted_quantity;

comment on view public.inventory_lot_balance is 'Current lot balance derived from append-only inventory movements.';

alter table public.shipment enable row level security;
alter table public.shipment_item enable row level security;
alter table public.inventory_lot enable row level security;
alter table public.inventory_movement enable row level security;
alter table public.shipment_attachment enable row level security;

create policy "Authenticated users manage shipments"
on public.shipment
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage shipment items"
on public.shipment_item
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage inventory lots"
on public.inventory_lot
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage inventory movements"
on public.inventory_movement
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage shipment attachments"
on public.shipment_attachment
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
