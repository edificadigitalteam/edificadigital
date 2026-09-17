-- Synced from the applied migration history of the `edifydb` Supabase project
-- (rrqyihsjftlloizsccvi): version 20260720012316, name
-- `beneficiary_impact_interfaces`. It had been applied to the database with no
-- counterpart in this repository. Everything below is that recorded statement
-- verbatim (md5 837efc6416f522d042c7adf23f6ccbc1) and must stay immutable.

-- Protected beneficiary interface support and private multimedia delivery evidence.

alter table public.impact_event
  add column reference_code text,
  add column submission_key uuid,
  add column created_by uuid references auth.users(id) on delete restrict,
  add column event_name text,
  add column location_name text,
  add column delivered_summary text,
  add column evidence_notice_acknowledged boolean not null default false,
  add column evidence_notice_acknowledged_at timestamptz,
  add constraint impact_event_reference_code_check check (
    reference_code is null or reference_code ~ '^IMP-[0-9]{8}-[A-Z0-9]{8}$'
  ),
  add constraint impact_event_name_check check (
    event_name is null or length(trim(event_name)) > 0
  ),
  add constraint impact_event_location_check check (
    location_name is null or length(trim(location_name)) > 0
  ),
  add constraint impact_event_delivery_summary_check check (
    delivered_summary is null or length(trim(delivered_summary)) > 0
  ),
  add constraint impact_event_evidence_acknowledgement_check check (
    (not evidence_notice_acknowledged and evidence_notice_acknowledged_at is null)
    or (evidence_notice_acknowledged and evidence_notice_acknowledged_at is not null)
  );

create unique index impact_event_reference_code_unique
  on public.impact_event (reference_code)
  where reference_code is not null;

create unique index impact_event_creator_submission_unique
  on public.impact_event (created_by, submission_key)
  where created_by is not null and submission_key is not null;

create index impact_event_created_by_idx
  on public.impact_event (created_by)
  where created_by is not null;

create table public.impact_donation (
  id uuid primary key default gen_random_uuid(),
  impact_event_id uuid not null references public.impact_event(id) on delete cascade,
  donation_id uuid not null references public.donation(id) on delete restrict,
  delivered_summary text not null,
  quantity_delivered numeric(14,3),
  unit_of_measure_id uuid references public.unit_of_measure(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint impact_donation_summary_check check (length(trim(delivered_summary)) > 0),
  constraint impact_donation_quantity_check check (
    (quantity_delivered is null and unit_of_measure_id is null)
    or (quantity_delivered > 0 and unit_of_measure_id is not null)
  ),
  constraint impact_donation_event_donation_unique unique (impact_event_id, donation_id)
);

create index impact_donation_donation_idx on public.impact_donation (donation_id);
create index impact_donation_unit_idx on public.impact_donation (unit_of_measure_id)
  where unit_of_measure_id is not null;
create index impact_donation_created_by_idx on public.impact_donation (created_by);

create trigger impact_donation_set_updated_at
before update on public.impact_donation
for each row execute function public.set_updated_at();

alter table public.impact_donation enable row level security;

create policy "Authorized operators manage impact donation links"
on public.impact_donation for all to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

revoke all on table public.impact_donation from public, anon;
grant select, insert, update, delete on table public.impact_donation to authenticated;

alter table public.impact_event_attachment
  add column attachment_type text,
  add column captured_at timestamptz,
  add column caption text,
  add column mime_type text,
  add column file_size_bytes bigint,
  add column created_by uuid references auth.users(id) on delete restrict,
  add constraint impact_event_attachment_type_check check (
    attachment_type is null or attachment_type in (
      'delivery_photo',
      'short_video',
      'signed_delivery_sheet',
      'recipient_acknowledgement',
      'other_delivery_evidence'
    )
  ),
  add constraint impact_event_attachment_size_check check (
    file_size_bytes is null or file_size_bytes between 1 and 20971520
  );

create index impact_event_attachment_created_by_idx
  on public.impact_event_attachment (created_by)
  where created_by is not null;

insert into public.media_type (code, name_es, name_en, description)
values
  ('delivery_photo', 'Foto de la entrega', 'Delivery photo', 'Private visual evidence of a delivery event.'),
  ('short_video', 'Video breve', 'Short video', 'Private short video evidence of a delivery event.'),
  ('signed_delivery_sheet', 'Acta de entrega firmada', 'Signed delivery sheet', 'Private signed delivery document.'),
  ('recipient_acknowledgement', 'Constancia de recepción', 'Recipient acknowledgement', 'Private acknowledgement of receipt.'),
  ('other_delivery_evidence', 'Otra evidencia de entrega', 'Other delivery evidence', 'Other approved private delivery evidence.')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  description = excluded.description,
  active = true;

update storage.buckets
set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
where id = 'attachments';

create or replace function public.submit_impact_evidence(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  submission_id uuid;
  reference_value text;
  result_event_id uuid;
  existing_reference text;
  responsible_id uuid;
  responsible_contact text;
  responsible_email text;
  responsible_phone text;
  start_value date;
  end_value date;
  event_status text;
  total_families_value integer;
  men_value integer;
  women_value integer;
  boys_value integer;
  girls_value integer;
  elderly_value integer;
  donation_reference text;
  source_donation_id uuid;
  delivered_quantity numeric(14,3);
  unit_id uuid;
  attachment jsonb;
  media_id uuid;
  evidence_type text;
  evidence_mime text;
  evidence_size bigint;
  expected_storage_prefix text;
begin
  if current_user_id is null or not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operator access is required.';
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
  if reference_value is null or reference_value !~ '^IMP-[0-9]{8}-[A-Z0-9]{8}$' then
    raise exception using errcode = '22023', message = 'A valid impact reference is required.';
  end if;

  select event.id, event.reference_code
  into result_event_id, existing_reference
  from public.impact_event event
  where event.created_by = current_user_id
    and event.submission_key = submission_id;

  if result_event_id is not null then
    return jsonb_build_object(
      'impact_event_id', result_event_id,
      'reference_code', existing_reference,
      'created', false
    );
  end if;

  if jsonb_typeof(payload -> 'responsible') <> 'object'
    or nullif(trim(payload #>> '{responsible,name}'), '') is null then
    raise exception using errcode = '22023', message = 'Responsible person name is required.';
  end if;

  if jsonb_typeof(payload -> 'event') <> 'object'
    or nullif(trim(payload #>> '{event,event_name}'), '') is null
    or nullif(trim(payload #>> '{event,location_name}'), '') is null
    or nullif(trim(payload #>> '{event,target_population}'), '') is null
    or nullif(trim(payload #>> '{event,delivered_summary}'), '') is null then
    raise exception using errcode = '22023', message = 'Event name, place, target population, and delivery summary are required.';
  end if;

  if not coalesce((payload #>> '{event,evidence_notice_acknowledged}')::boolean, false) then
    raise exception using errcode = '22023', message = 'Evidence privacy acknowledgement is required.';
  end if;

  begin
    start_value := (payload #>> '{event,start_date}')::date;
    end_value := (payload #>> '{event,end_date}')::date;
    total_families_value := coalesce((payload #>> '{event,total_families}')::integer, 0);
    men_value := coalesce((payload #>> '{event,men}')::integer, 0);
    women_value := coalesce((payload #>> '{event,women}')::integer, 0);
    boys_value := coalesce((payload #>> '{event,boys}')::integer, 0);
    girls_value := coalesce((payload #>> '{event,girls}')::integer, 0);
    elderly_value := coalesce((payload #>> '{event,elderly}')::integer, 0);
  exception when others then
    raise exception using errcode = '22023', message = 'Event date and aggregate totals must be valid.';
  end;

  event_status := coalesce(nullif(payload #>> '{event,status}', ''), 'closed');
  if start_value > end_value or end_value > current_date
    or event_status not in ('in_progress', 'closed')
    or least(total_families_value, men_value, women_value, boys_value, girls_value, elderly_value) < 0 then
    raise exception using errcode = '22023', message = 'Event dates, status, or aggregate totals are invalid.';
  end if;

  responsible_contact := nullif(trim(payload #>> '{responsible,contact}'), '');
  if responsible_contact ~* '^[^[:space:]@]+@[^[:space:]@]+.[^[:space:]@]+$' then
    responsible_email := lower(responsible_contact);
    select actor.id into responsible_id from public.actor actor where lower(actor.email) = responsible_email;
  else
    responsible_phone := responsible_contact;
  end if;

  if responsible_id is null then
    insert into public.actor (name, email, phone)
    values (trim(payload #>> '{responsible,name}'), responsible_email, responsible_phone)
    returning id into responsible_id;
  end if;

  insert into public.actor_role (actor_id, role)
  values (responsible_id, 'manager')
  on conflict (actor_id, role) do nothing;

  insert into public.impact_event (
    responsible_actor_id, start_date, end_date, target_population, status,
    total_families, men, women, boys, girls, elderly, notes,
    reference_code, submission_key, created_by, event_name, location_name,
    delivered_summary, evidence_notice_acknowledged, evidence_notice_acknowledged_at
  ) values (
    responsible_id, start_value, end_value, trim(payload #>> '{event,target_population}'), event_status,
    total_families_value, men_value, women_value, boys_value, girls_value, elderly_value,
    nullif(trim(payload #>> '{event,notes}'), ''), reference_value, submission_id, current_user_id,
    trim(payload #>> '{event,event_name}'), trim(payload #>> '{event,location_name}'),
    trim(payload #>> '{event,delivered_summary}'), true, now()
  ) returning id into result_event_id;

  if jsonb_typeof(payload -> 'donation') = 'object' then
    donation_reference := upper(nullif(trim(payload #>> '{donation,reference_code}'), ''));
    if donation_reference is null then
      raise exception using errcode = '22023', message = 'Donation reference is required for a donation link.';
    end if;

    select donation.id into source_donation_id
    from public.donation donation
    where donation.reference_code = donation_reference;

    if source_donation_id is null then
      raise exception using errcode = '22023', message = 'The supplied donation reference was not found.';
    end if;

    begin
      delivered_quantity := nullif(payload #>> '{donation,quantity_delivered}', '')::numeric(14,3);
    exception when others then
      raise exception using errcode = '22023', message = 'Delivered quantity must be valid.';
    end;

    if delivered_quantity is not null then
      select unit.id into unit_id
      from public.unit_of_measure unit
      where unit.active and unit.code = payload #>> '{donation,unit_code}';
      if delivered_quantity <= 0 or unit_id is null then
        raise exception using errcode = '22023', message = 'A positive delivered quantity and valid unit are required together.';
      end if;
    end if;

    insert into public.impact_donation (
      impact_event_id, donation_id, delivered_summary, quantity_delivered, unit_of_measure_id, created_by
    ) values (
      result_event_id, source_donation_id,
      coalesce(nullif(trim(payload #>> '{donation,delivered_summary}'), ''), trim(payload #>> '{event,delivered_summary}')),
      delivered_quantity, unit_id, current_user_id
    );
  end if;

  if jsonb_typeof(payload -> 'attachments') <> 'array'
    or jsonb_array_length(payload -> 'attachments') = 0 then
    raise exception using errcode = '22023', message = 'At least one delivery evidence file is required.';
  end if;

  expected_storage_prefix := format('impact/%s/%s/', current_user_id, submission_id);

  for attachment in select value from jsonb_array_elements(payload -> 'attachments')
  loop
    evidence_type := attachment ->> 'attachment_type';
    evidence_mime := attachment ->> 'mime_type';
    begin
      evidence_size := (attachment ->> 'file_size_bytes')::bigint;
    exception when others then
      raise exception using errcode = '22023', message = 'Evidence file size must be valid.';
    end;

    if evidence_type not in ('delivery_photo', 'short_video', 'signed_delivery_sheet', 'recipient_acknowledgement', 'other_delivery_evidence')
      or evidence_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime')
      or evidence_size not between 1 and 20971520
      or nullif(trim(attachment ->> 'storage_path'), '') is null
      or position(expected_storage_prefix in (attachment ->> 'storage_path')) <> 1
      or nullif(trim(attachment ->> 'file_name'), '') is null then
      raise exception using errcode = '22023', message = 'Evidence metadata is invalid.';
    end if;

    if (evidence_type = 'delivery_photo' and evidence_mime not like 'image/%')
      or (evidence_type = 'short_video' and evidence_mime not like 'video/%')
      or (evidence_type in ('signed_delivery_sheet', 'recipient_acknowledgement') and evidence_mime <> 'application/pdf' and evidence_mime not like 'image/%') then
      raise exception using errcode = '22023', message = 'Evidence category and file type do not match.';
    end if;

    select media.id into media_id
    from public.media_type media
    where media.active and media.code = evidence_type;

    if media_id is null then
      raise exception using errcode = '22023', message = 'Evidence media type is unavailable.';
    end if;

    insert into public.impact_event_attachment (
      impact_event_id, media_type_id, storage_url, file_name, notes,
      attachment_type, captured_at, caption, mime_type, file_size_bytes, created_by
    ) values (
      result_event_id, media_id, attachment ->> 'storage_path', attachment ->> 'file_name',
      nullif(trim(attachment ->> 'notes'), ''), evidence_type,
      nullif(attachment ->> 'captured_at', '')::timestamptz,
      nullif(trim(attachment ->> 'caption'), ''), evidence_mime, evidence_size, current_user_id
    );
  end loop;

  return jsonb_build_object(
    'impact_event_id', result_event_id,
    'reference_code', reference_value,
    'created', true
  );
end;
$$;

comment on function public.submit_impact_evidence(jsonb) is
  'Atomically creates an aggregate delivery event, optional source-donation link, and private multimedia evidence metadata for an active operator.';

revoke all on function public.submit_impact_evidence(jsonb) from public, anon;
grant execute on function public.submit_impact_evidence(jsonb) to authenticated;
