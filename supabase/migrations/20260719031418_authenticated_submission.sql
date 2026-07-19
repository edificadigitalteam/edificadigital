-- Authenticated, allow-listed, idempotent submission for in-kind shipments.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.operator_access (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operator_access_email_format_check
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create unique index operator_access_email_unique
  on private.operator_access (lower(email));

revoke all on table private.operator_access from public, anon, authenticated;

-- Operator identities are provisioned directly in the protected environment.
-- Personal email addresses must not be committed to repository migrations.

create or replace function private.is_authorized_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from private.operator_access access
      where access.active
        and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    );
$$;

revoke all on function private.is_authorized_operator() from public, anon;
grant execute on function private.is_authorized_operator() to authenticated;

create or replace function public.current_operator_access()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_authorized_operator();
$$;

revoke all on function public.current_operator_access() from public, anon;
grant execute on function public.current_operator_access() to authenticated;

alter table public.donation
  add column submission_key uuid,
  add column created_by uuid references auth.users(id) on delete restrict;

create unique index donation_creator_submission_unique
  on public.donation (created_by, submission_key)
  where created_by is not null and submission_key is not null;

create index donation_created_by_idx
  on public.donation (created_by)
  where created_by is not null;

alter policy "Authenticated users manage actors"
on public.actor to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage actor roles"
on public.actor_role to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage media types"
on public.media_type to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage units"
on public.unit_of_measure to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage donations"
on public.donation to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage donation details"
on public.donation_detail to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage donation attachments"
on public.donation_attachment to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage kit transformations"
on public.kit_transformation to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage transformation attachments"
on public.kit_transformation_attachment to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage impact events"
on public.impact_event to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage impact details"
on public.impact_detail to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage impact attachments"
on public.impact_event_attachment to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage shipments"
on public.shipment to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage shipment items"
on public.shipment_item to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage inventory lots"
on public.inventory_lot to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage inventory movements"
on public.inventory_movement to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage shipment attachments"
on public.shipment_attachment to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

alter policy "Authenticated users manage attachment files"
on storage.objects to authenticated
using (
  bucket_id = 'attachments'
  and (select private.is_authorized_operator())
)
with check (
  bucket_id = 'attachments'
  and (select private.is_authorized_operator())
);

create or replace function public.submit_in_kind_shipment(payload jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  submission_id uuid;
  reference_value text;
  sender_email text;
  sender_phone text;
  sender_id uuid;
  donation_id uuid;
  shipment_id uuid;
  existing_reference text;
  item jsonb;
  attachment jsonb;
  unit_id uuid;
  detail_id uuid;
  media_id uuid;
  item_quantity numeric(14,3);
  item_reference_value numeric(14,2);
  expected_storage_prefix text;
  donation_status text;
begin
  if current_user_id is null or not private.is_authorized_operator() then
    raise exception using
      errcode = '42501',
      message = 'Operational access is required.';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = '22023', message = 'Submission payload must be an object.';
  end if;

  begin
    submission_id := (payload ->> 'submission_key')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'A valid submission key is required.';
  end;

  reference_value := nullif(trim(payload ->> 'reference_code'), '');
  if reference_value is null or reference_value !~ '^INK-[A-Z]{2}-[0-9]{8}-[A-Z0-9]{8}$' then
    raise exception using errcode = '22023', message = 'A valid shipment reference is required.';
  end if;

  select donation.id, shipment.id, donation.reference_code
  into donation_id, shipment_id, existing_reference
  from public.donation donation
  join public.shipment shipment on shipment.donation_id = donation.id
  where donation.created_by = current_user_id
    and donation.submission_key = submission_id;

  if found then
    return jsonb_build_object(
      'donation_id', donation_id,
      'shipment_id', shipment_id,
      'reference_code', existing_reference,
      'created', false
    );
  end if;

  if jsonb_typeof(payload -> 'sender') <> 'object'
    or nullif(trim(payload #>> '{sender,name}'), '') is null then
    raise exception using errcode = '22023', message = 'Sender name is required.';
  end if;

  sender_email := nullif(lower(trim(payload #>> '{sender,email}')), '');
  sender_phone := nullif(trim(payload #>> '{sender,phone}'), '');

  if sender_email is not null then
    select actor.id into sender_id
    from public.actor actor
    where lower(actor.email) = sender_email;
  end if;

  if sender_id is null then
    insert into public.actor (
      name,
      email,
      phone,
      country,
      is_organization
    ) values (
      trim(payload #>> '{sender,name}'),
      sender_email,
      sender_phone,
      nullif(trim(payload #>> '{sender,country}'), ''),
      coalesce((payload #>> '{sender,is_organization}')::boolean, false)
    )
    returning id into sender_id;
  else
    update public.actor
    set
      phone = coalesce(phone, sender_phone),
      country = coalesce(country, nullif(trim(payload #>> '{sender,country}'), ''))
    where id = sender_id;
  end if;

  insert into public.actor_role (actor_id, role)
  values (sender_id, 'donor')
  on conflict (actor_id, role) do nothing;

  if jsonb_typeof(payload -> 'shipment') <> 'object' then
    raise exception using errcode = '22023', message = 'Shipment data is required.';
  end if;

  donation_status := case payload #>> '{shipment,status}'
    when 'received' then 'received'
    when 'closed' then 'closed'
    else 'announced'
  end;

  insert into public.donation (
    actor_id,
    donation_type,
    status,
    reference_code,
    received_at,
    notes,
    submission_key,
    created_by
  ) values (
    sender_id,
    'in_kind',
    donation_status,
    reference_value,
    case when donation_status in ('received', 'closed') then now() else null end,
    nullif(trim(payload #>> '{shipment,notes}'), ''),
    submission_id,
    current_user_id
  )
  returning id into donation_id;

  insert into public.shipment (
    donation_id,
    transport_mode,
    status,
    origin_country,
    origin_city,
    destination_country,
    destination_city,
    container_number,
    tracking_number,
    carrier_name,
    departure_date,
    estimated_arrival,
    actual_arrival,
    customs_reference,
    notes
  ) values (
    donation_id,
    payload #>> '{shipment,transport_mode}',
    payload #>> '{shipment,status}',
    payload #>> '{shipment,origin_country}',
    nullif(trim(payload #>> '{shipment,origin_city}'), ''),
    payload #>> '{shipment,destination_country}',
    nullif(trim(payload #>> '{shipment,destination_city}'), ''),
    nullif(trim(payload #>> '{shipment,container_number}'), ''),
    nullif(trim(payload #>> '{shipment,tracking_number}'), ''),
    nullif(trim(payload #>> '{shipment,carrier_name}'), ''),
    nullif(payload #>> '{shipment,departure_date}', '')::date,
    (payload #>> '{shipment,estimated_arrival}')::date,
    nullif(payload #>> '{shipment,actual_arrival}', '')::date,
    nullif(trim(payload #>> '{shipment,customs_reference}'), ''),
    nullif(trim(payload #>> '{shipment,notes}'), '')
  )
  returning id into shipment_id;

  if jsonb_typeof(payload -> 'items') <> 'array'
    or jsonb_array_length(payload -> 'items') = 0 then
    raise exception using errcode = '22023', message = 'At least one shipment item is required.';
  end if;

  for item in select value from jsonb_array_elements(payload -> 'items') loop
    if jsonb_typeof(item) <> 'object' then
      raise exception using errcode = '22023', message = 'Every shipment item must be an object.';
    end if;

    select unit.id into unit_id
    from public.unit_of_measure unit
    where unit.active and unit.code = item ->> 'unit_code';

    if unit_id is null then
      raise exception using errcode = '22023', message = 'A valid unit code is required for every item.';
    end if;

    begin
      item_quantity := (item ->> 'declared_quantity')::numeric(14,3);
      item_reference_value := nullif(item ->> 'reference_value', '')::numeric(14,2);
    exception when others then
      raise exception using errcode = '22023', message = 'Item quantities and values must be numeric.';
    end;

    if item_quantity <= 0 then
      raise exception using errcode = '22023', message = 'Item quantity must be greater than zero.';
    end if;

    if nullif(trim(item ->> 'description'), '') is null
      or item ->> 'category' not in ('food', 'clothing', 'hygiene', 'medical', 'household', 'other') then
      raise exception using errcode = '22023', message = 'Every item requires a description and valid category.';
    end if;

    if item_reference_value is not null and (
      item_reference_value <= 0
      or coalesce(item ->> 'reference_currency', '') !~ '^[A-Z]{3}$'
    ) then
      raise exception using errcode = '22023', message = 'Reference value requires a positive amount and currency.';
    end if;

    insert into public.donation_detail (
      donation_id,
      type,
      item_description,
      quantity,
      unit_of_measure_id,
      item_code,
      category,
      lot_code,
      expiry_date,
      dietary_attributes,
      allergens,
      reference_value,
      reference_currency,
      valuation_method,
      valuation_source,
      valued_at
    ) values (
      donation_id,
      'in_kind',
      trim(item ->> 'description'),
      item_quantity,
      unit_id,
      nullif(trim(item ->> 'item_code'), ''),
      item ->> 'category',
      nullif(trim(item ->> 'lot_code'), ''),
      nullif(item ->> 'expiry_date', '')::date,
      coalesce(array(select jsonb_array_elements_text(item -> 'dietary_attributes')), '{}'),
      nullif(trim(item ->> 'allergens'), ''),
      item_reference_value,
      case when item_reference_value is null then null else item ->> 'reference_currency' end,
      nullif(trim(item ->> 'valuation_method'), ''),
      nullif(trim(item ->> 'valuation_source'), ''),
      nullif(item ->> 'valued_at', '')::date
    )
    returning id into detail_id;

    insert into public.shipment_item (
      shipment_id,
      donation_detail_id,
      item_code,
      description,
      category,
      declared_quantity,
      unit_of_measure_id,
      reference_value,
      reference_currency,
      valuation_method,
      valuation_source,
      valued_at,
      dietary_attributes,
      allergens,
      declared_lot_code,
      declared_expiry_date,
      notes
    ) values (
      shipment_id,
      detail_id,
      nullif(trim(item ->> 'item_code'), ''),
      trim(item ->> 'description'),
      item ->> 'category',
      item_quantity,
      unit_id,
      item_reference_value,
      case when item_reference_value is null then null else item ->> 'reference_currency' end,
      nullif(trim(item ->> 'valuation_method'), ''),
      nullif(trim(item ->> 'valuation_source'), ''),
      nullif(item ->> 'valued_at', '')::date,
      coalesce(array(select jsonb_array_elements_text(item -> 'dietary_attributes')), '{}'),
      nullif(trim(item ->> 'allergens'), ''),
      nullif(trim(item ->> 'lot_code'), ''),
      nullif(item ->> 'expiry_date', '')::date,
      nullif(trim(item ->> 'notes'), '')
    );
  end loop;

  expected_storage_prefix := format('shipments/%s/%s/', current_user_id, submission_id);

  if payload ? 'attachments' and jsonb_typeof(payload -> 'attachments') <> 'array' then
    raise exception using errcode = '22023', message = 'Attachments must be an array.';
  end if;

  for attachment in
    select value from jsonb_array_elements(coalesce(payload -> 'attachments', '[]'::jsonb))
  loop
    if attachment ->> 'attachment_type' not in (
      'packing_list', 'bill_of_lading', 'customs', 'inspection', 'receipt', 'photo', 'other'
    ) then
      raise exception using errcode = '22023', message = 'Attachment type is invalid.';
    end if;

    if nullif(trim(attachment ->> 'storage_path'), '') is null
      or position(expected_storage_prefix in (attachment ->> 'storage_path')) <> 1
      or nullif(trim(attachment ->> 'file_name'), '') is null then
      raise exception using errcode = '22023', message = 'Attachment path or file name is invalid.';
    end if;

    select media.id into media_id
    from public.media_type media
    where media.code = case attachment ->> 'attachment_type'
      when 'packing_list' then 'packing_list'
      when 'bill_of_lading' then 'bill_of_lading'
      when 'customs' then 'customs_document'
      when 'inspection' then 'inspection_evidence'
      when 'receipt' then 'donation_receipt'
      when 'photo' then 'inspection_evidence'
      else null
    end;

    insert into public.shipment_attachment (
      shipment_id,
      media_type_id,
      attachment_type,
      storage_url,
      file_name,
      notes
    ) values (
      shipment_id,
      media_id,
      attachment ->> 'attachment_type',
      attachment ->> 'storage_path',
      attachment ->> 'file_name',
      nullif(trim(attachment ->> 'notes'), '')
    );
  end loop;

  return jsonb_build_object(
    'donation_id', donation_id,
    'shipment_id', shipment_id,
    'reference_code', reference_value,
    'created', true
  );
end;
$$;

comment on function public.submit_in_kind_shipment(jsonb) is
  'Atomically creates an allow-listed operator in-kind donation, shipment, declared items, and evidence metadata.';

revoke all on function public.submit_in_kind_shipment(jsonb) from public, anon;
grant execute on function public.submit_in_kind_shipment(jsonb) to authenticated;
