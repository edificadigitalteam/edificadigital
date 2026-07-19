-- Foundational Edifica Digital donation traceability schema.
-- All database artifacts use English and snake_case.

create extension if not exists pgcrypto;

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

create table public.actor (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  country text,
  is_organization boolean not null default false,
  is_anonymous boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actor_email_format_check
    check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create unique index actor_email_unique
  on public.actor (lower(email))
  where email is not null;

create table public.actor_role (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.actor(id) on delete cascade,
  role text not null,
  assigned_at timestamptz not null default now(),
  constraint actor_role_value_check
    check (role in ('donor', 'supplier', 'manager', 'beneficiary')),
  constraint actor_role_actor_role_unique unique (actor_id, role)
);

create table public.media_type (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_es text not null,
  name_en text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_type_code_check check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.unit_of_measure (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_es text not null,
  name_en text not null,
  abbreviation text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_of_measure_code_check check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.donation (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.actor(id) on delete restrict,
  donation_type text not null default 'mixed',
  status text not null default 'draft',
  reference_code text,
  recorded_at timestamptz not null default now(),
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donation_type_check
    check (donation_type in ('monetary', 'in_kind', 'mixed')),
  constraint donation_status_check
    check (status in ('draft', 'announced', 'received', 'verified', 'closed')),
  constraint donation_received_at_check
    check (received_at is null or received_at >= recorded_at)
);

create unique index donation_reference_code_unique
  on public.donation (reference_code)
  where reference_code is not null;

create index donation_actor_idx on public.donation (actor_id);
create index donation_recorded_at_idx on public.donation (recorded_at desc);
create index donation_status_idx on public.donation (status);

create table public.donation_detail (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donation(id) on delete cascade,
  type text not null,
  amount numeric(14,2),
  currency char(3),
  item_description text,
  quantity numeric(14,3),
  unit_of_measure_id uuid references public.unit_of_measure(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donation_detail_type_check
    check (type in ('monetary', 'in_kind')),
  constraint donation_detail_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint donation_detail_type_fields_check
    check (
      (
        type = 'monetary'
        and amount is not null
        and amount > 0
        and currency is not null
        and item_description is null
        and quantity is null
        and unit_of_measure_id is null
      )
      or
      (
        type = 'in_kind'
        and amount is null
        and currency is null
        and item_description is not null
        and length(trim(item_description)) > 0
        and quantity is not null
        and quantity > 0
        and unit_of_measure_id is not null
      )
    )
);

create index donation_detail_donation_idx on public.donation_detail (donation_id);

create table public.donation_attachment (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donation(id) on delete cascade,
  media_type_id uuid not null references public.media_type(id) on delete restrict,
  storage_url text not null check (length(trim(storage_url)) > 0),
  file_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index donation_attachment_donation_idx on public.donation_attachment (donation_id);

create table public.kit_transformation (
  id uuid primary key default gen_random_uuid(),
  transformed_at timestamptz not null default now(),
  kit_name text not null check (length(trim(kit_name)) > 0),
  quantity_generated integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kit_transformation_quantity_check check (quantity_generated > 0)
);

create index kit_transformation_date_idx on public.kit_transformation (transformed_at desc);

create table public.kit_transformation_attachment (
  id uuid primary key default gen_random_uuid(),
  kit_transformation_id uuid not null references public.kit_transformation(id) on delete cascade,
  media_type_id uuid not null references public.media_type(id) on delete restrict,
  storage_url text not null check (length(trim(storage_url)) > 0),
  file_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index kit_transformation_attachment_parent_idx
  on public.kit_transformation_attachment (kit_transformation_id);

create table public.impact_event (
  id uuid primary key default gen_random_uuid(),
  responsible_actor_id uuid not null references public.actor(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  target_population text not null check (length(trim(target_population)) > 0),
  status text not null default 'in_progress',
  total_families integer not null default 0,
  men integer not null default 0,
  women integer not null default 0,
  boys integer not null default 0,
  girls integer not null default 0,
  elderly integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint impact_event_status_check check (status in ('in_progress', 'closed')),
  constraint impact_event_date_check check (start_date <= end_date),
  constraint impact_event_demographics_check check (
    total_families >= 0
    and men >= 0
    and women >= 0
    and boys >= 0
    and girls >= 0
    and elderly >= 0
  )
);

create index impact_event_responsible_actor_idx on public.impact_event (responsible_actor_id);
create index impact_event_dates_idx on public.impact_event (start_date, end_date);
create index impact_event_status_idx on public.impact_event (status);

create table public.impact_detail (
  id uuid primary key default gen_random_uuid(),
  impact_event_id uuid not null references public.impact_event(id) on delete cascade,
  kit_transformation_id uuid not null references public.kit_transformation(id) on delete restrict,
  quantity_delivered integer not null,
  created_at timestamptz not null default now(),
  constraint impact_detail_quantity_check check (quantity_delivered > 0),
  constraint impact_detail_event_transformation_unique unique (impact_event_id, kit_transformation_id)
);

create index impact_detail_transformation_idx on public.impact_detail (kit_transformation_id);

create table public.impact_event_attachment (
  id uuid primary key default gen_random_uuid(),
  impact_event_id uuid not null references public.impact_event(id) on delete cascade,
  media_type_id uuid not null references public.media_type(id) on delete restrict,
  storage_url text not null check (length(trim(storage_url)) > 0),
  file_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index impact_event_attachment_parent_idx
  on public.impact_event_attachment (impact_event_id);

create trigger actor_set_updated_at
before update on public.actor
for each row execute function public.set_updated_at();

create trigger media_type_set_updated_at
before update on public.media_type
for each row execute function public.set_updated_at();

create trigger unit_of_measure_set_updated_at
before update on public.unit_of_measure
for each row execute function public.set_updated_at();

create trigger donation_set_updated_at
before update on public.donation
for each row execute function public.set_updated_at();

create trigger donation_detail_set_updated_at
before update on public.donation_detail
for each row execute function public.set_updated_at();

create trigger kit_transformation_set_updated_at
before update on public.kit_transformation
for each row execute function public.set_updated_at();

create trigger impact_event_set_updated_at
before update on public.impact_event
for each row execute function public.set_updated_at();

insert into public.unit_of_measure (code, name_es, name_en, abbreviation)
values
  ('unit', 'Unidad', 'Unit', 'u'),
  ('kilogram', 'Kilogramo', 'Kilogram', 'kg'),
  ('liter', 'Litro', 'Liter', 'L'),
  ('box', 'Caja', 'Box', 'box'),
  ('pallet', 'Paleta', 'Pallet', 'pallet'),
  ('bag', 'Saco', 'Bag', 'bag')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  abbreviation = excluded.abbreviation,
  active = true;

insert into public.media_type (code, name_es, name_en, description)
values
  ('proof_of_payment', 'Comprobante de pago', 'Proof of payment', 'Evidence for a monetary donation.'),
  ('donation_receipt', 'Acta de recepción', 'Donation receipt', 'Signed receipt for received resources.'),
  ('packing_list', 'Lista de empaque', 'Packing list', 'Declared shipment contents.'),
  ('bill_of_lading', 'Conocimiento de embarque', 'Bill of lading', 'Carrier transport document.'),
  ('customs_document', 'Documento aduanal', 'Customs document', 'Customs declaration or release.'),
  ('inspection_evidence', 'Evidencia de inspección', 'Inspection evidence', 'Photos or documents from physical inspection.'),
  ('transformation_evidence', 'Evidencia de transformación', 'Transformation evidence', 'Photos or documents from kit preparation.'),
  ('delivery_evidence', 'Evidencia de entrega', 'Delivery evidence', 'Photos, records, or signed delivery sheets.')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  description = excluded.description,
  active = true;

alter table public.actor enable row level security;
alter table public.actor_role enable row level security;
alter table public.media_type enable row level security;
alter table public.unit_of_measure enable row level security;
alter table public.donation enable row level security;
alter table public.donation_detail enable row level security;
alter table public.donation_attachment enable row level security;
alter table public.kit_transformation enable row level security;
alter table public.kit_transformation_attachment enable row level security;
alter table public.impact_event enable row level security;
alter table public.impact_detail enable row level security;
alter table public.impact_event_attachment enable row level security;

create policy "Authenticated users manage actors"
on public.actor for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage actor roles"
on public.actor_role for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage media types"
on public.media_type for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage units"
on public.unit_of_measure for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage donations"
on public.donation for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage donation details"
on public.donation_detail for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage donation attachments"
on public.donation_attachment for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage kit transformations"
on public.kit_transformation for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage transformation attachments"
on public.kit_transformation_attachment for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage impact events"
on public.impact_event for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage impact details"
on public.impact_detail for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Authenticated users manage impact attachments"
on public.impact_event_attachment for all to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.actor,
  public.actor_role,
  public.media_type,
  public.unit_of_measure,
  public.donation,
  public.donation_detail,
  public.donation_attachment,
  public.kit_transformation,
  public.kit_transformation_attachment,
  public.impact_event,
  public.impact_detail,
  public.impact_event_attachment
to authenticated;

revoke all on table
  public.actor,
  public.actor_role,
  public.media_type,
  public.unit_of_measure,
  public.donation,
  public.donation_detail,
  public.donation_attachment,
  public.kit_transformation,
  public.kit_transformation_attachment,
  public.impact_event,
  public.impact_detail,
  public.impact_event_attachment
from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users manage attachment files"
on storage.objects for all to authenticated
using (bucket_id = 'attachments' and auth.role() = 'authenticated')
with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
