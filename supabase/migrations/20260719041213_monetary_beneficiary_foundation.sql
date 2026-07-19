-- Multi-currency monetary receipts and protected nominal beneficiary records.

alter table public.donation
  drop constraint if exists donation_received_at_check;

create table public.monetary_donation_detail (
  donation_detail_id uuid primary key
    references public.donation_detail(id) on delete cascade,
  payment_method text not null,
  usd_base_amount numeric(14,2) not null,
  exchange_rate_to_usd numeric(20,10) not null,
  exchange_rate_source text,
  exchange_rate_date date,
  sender_institution text,
  receiver_account_label text,
  transaction_reference text,
  reconciliation_status text not null default 'pending',
  reconciled_by uuid references auth.users(id) on delete restrict,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monetary_payment_method_check check (
    payment_method in (
      'cash', 'bank_transfer', 'mobile_payment', 'digital_wallet', 'crypto', 'other'
    )
  ),
  constraint monetary_usd_base_amount_check check (usd_base_amount > 0),
  constraint monetary_exchange_rate_check check (exchange_rate_to_usd > 0),
  constraint monetary_transaction_reference_check check (
    payment_method = 'cash'
    or nullif(trim(transaction_reference), '') is not null
  ),
  constraint monetary_institution_check check (
    payment_method not in ('bank_transfer', 'mobile_payment')
    or (
      nullif(trim(sender_institution), '') is not null
      and nullif(trim(receiver_account_label), '') is not null
    )
  ),
  constraint monetary_reconciliation_status_check check (
    reconciliation_status in ('pending', 'verified', 'rejected')
  ),
  constraint monetary_reconciliation_audit_check check (
    (
      reconciliation_status = 'pending'
      and reconciled_by is null
      and reconciled_at is null
    )
    or (
      reconciliation_status in ('verified', 'rejected')
      and reconciled_by is not null
      and reconciled_at is not null
    )
  )
);

create index monetary_donation_reconciliation_idx
  on public.monetary_donation_detail (reconciliation_status, created_at desc);

create or replace function private.validate_monetary_donation_detail()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  origin_type text;
  origin_amount numeric(14,2);
  origin_currency text;
  expected_usd numeric(14,2);
begin
  select detail.type, detail.amount, trim(detail.currency)
  into origin_type, origin_amount, origin_currency
  from public.donation_detail detail
  where detail.id = new.donation_detail_id;

  if origin_type is distinct from 'monetary'
    or origin_amount is null
    or origin_currency is null then
    raise exception using errcode = '23514', message = 'Monetary extension requires a monetary donation detail.';
  end if;

  expected_usd := round(origin_amount * new.exchange_rate_to_usd, 2);

  if abs(expected_usd - new.usd_base_amount) > 0.02 then
    raise exception using errcode = '23514', message = 'USD base amount must match the applied exchange rate.';
  end if;

  if origin_currency = 'USD' and (
    new.exchange_rate_to_usd <> 1
    or abs(origin_amount - new.usd_base_amount) > 0.01
  ) then
    raise exception using errcode = '23514', message = 'USD receipts require an identity conversion.';
  end if;

  if origin_currency <> 'USD' and (
    nullif(trim(new.exchange_rate_source), '') is null
    or new.exchange_rate_date is null
  ) then
    raise exception using errcode = '23514', message = 'Non-USD receipts require an exchange-rate source and date.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_monetary_donation_detail() from public, anon;

create trigger monetary_donation_detail_validate
before insert or update on public.monetary_donation_detail
for each row execute function private.validate_monetary_donation_detail();

create trigger monetary_donation_detail_set_updated_at
before update on public.monetary_donation_detail
for each row execute function public.set_updated_at();

alter table public.monetary_donation_detail enable row level security;

create policy "Authorized operators manage monetary donation details"
on public.monetary_donation_detail for all to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

revoke all on table public.monetary_donation_detail from public, anon;
grant select, insert, update, delete on table public.monetary_donation_detail to authenticated;

create table private.beneficiary (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  submission_key uuid not null,
  full_name text not null,
  date_of_birth date,
  age_band text not null default 'unknown',
  sex text not null default 'unknown',
  phone text,
  has_whatsapp boolean not null default false,
  email text,
  residence_country text,
  residence_area text not null,
  privacy_notice_acknowledged boolean not null,
  privacy_notice_acknowledged_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficiary_public_code_check
    check (public_code ~ '^BEN-[A-Z0-9]{12}$'),
  constraint beneficiary_name_check
    check (length(trim(full_name)) > 0),
  constraint beneficiary_age_band_check check (
    age_band in ('0_5', '6_12', '13_17', '18_59', '60_plus', 'unknown')
  ),
  constraint beneficiary_sex_check check (
    sex in ('female', 'male', 'intersex', 'prefer_not_to_say', 'unknown')
  ),
  constraint beneficiary_phone_whatsapp_check check (
    not has_whatsapp or nullif(trim(phone), '') is not null
  ),
  constraint beneficiary_email_format_check check (
    email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint beneficiary_residence_area_check
    check (length(trim(residence_area)) > 0),
  constraint beneficiary_privacy_acknowledgement_check check (
    privacy_notice_acknowledged
    and privacy_notice_acknowledged_at is not null
  )
);

create unique index beneficiary_creator_submission_unique
  on private.beneficiary (created_by, submission_key);

create index beneficiary_archive_idx
  on private.beneficiary (archived_at, created_at desc);

create table private.beneficiary_event (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references private.beneficiary(id) on delete restrict,
  impact_event_id uuid not null references public.impact_event(id) on delete restrict,
  submission_key uuid not null,
  attendance_status text not null default 'registered',
  household_members_represented integer not null default 1,
  service_codes text[] not null default '{}',
  recorded_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficiary_event_attendance_check check (
    attendance_status in ('registered', 'attended', 'cancelled')
  ),
  constraint beneficiary_event_household_check check (household_members_represented > 0),
  constraint beneficiary_event_unique unique (beneficiary_id, impact_event_id)
);

create unique index beneficiary_event_creator_submission_unique
  on private.beneficiary_event (created_by, submission_key);

create index beneficiary_event_impact_idx
  on private.beneficiary_event (impact_event_id, attendance_status);

create trigger beneficiary_set_updated_at
before update on private.beneficiary
for each row execute function public.set_updated_at();

create trigger beneficiary_event_set_updated_at
before update on private.beneficiary_event
for each row execute function public.set_updated_at();

alter table private.beneficiary enable row level security;
alter table private.beneficiary force row level security;
alter table private.beneficiary_event enable row level security;
alter table private.beneficiary_event force row level security;

create policy "Authorized operators manage beneficiary identity"
on private.beneficiary for all to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

create policy "Authorized operators manage beneficiary participation"
on private.beneficiary_event for all to authenticated
using ((select private.is_authorized_operator()))
with check ((select private.is_authorized_operator()));

revoke all on table private.beneficiary, private.beneficiary_event from public, anon;
grant select, insert, update on table private.beneficiary, private.beneficiary_event to authenticated;

create or replace function public.submit_monetary_donation(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  submission_id uuid;
  reference_value text;
  donor_id uuid;
  donor_email text;
  donor_phone text;
  result_donation_id uuid;
  result_detail_id uuid;
  origin_amount numeric(14,2);
  origin_currency text;
  usd_base_amount numeric(14,2);
  exchange_rate numeric(20,10);
  received_value timestamptz;
  payment_method_value text;
  attachment jsonb;
  media_id uuid;
  expected_storage_prefix text;
begin
  if current_user_id is null or not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operator access is required.';
  end if;

  begin
    submission_id := (payload ->> 'submission_key')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'A valid submission key is required.';
  end;

  reference_value := nullif(trim(payload ->> 'reference_code'), '');
  if reference_value is null or reference_value !~ '^MON-[A-Z]{3}-[0-9]{8}-[A-Z0-9]{8}$' then
    raise exception using errcode = '22023', message = 'A valid monetary reference is required.';
  end if;

  select donation.id into result_donation_id
  from public.donation donation
  where donation.created_by = current_user_id
    and donation.submission_key = submission_id;

  if result_donation_id is not null then
    select detail.id into result_detail_id
    from public.donation_detail detail
    where detail.donation_id = result_donation_id
      and detail.type = 'monetary'
    order by detail.created_at
    limit 1;

    return jsonb_build_object(
      'donation_id', result_donation_id,
      'detail_id', result_detail_id,
      'reference_code', reference_value,
      'created', false
    );
  end if;

  if jsonb_typeof(payload -> 'donor') <> 'object'
    or nullif(trim(payload #>> '{donor,name}'), '') is null then
    raise exception using errcode = '22023', message = 'Donor name is required.';
  end if;

  donor_email := lower(nullif(trim(payload #>> '{donor,email}'), ''));
  donor_phone := nullif(trim(payload #>> '{donor,phone}'), '');

  if donor_email is not null then
    select actor.id into donor_id
    from public.actor actor
    where lower(actor.email) = donor_email;
  end if;

  if donor_id is null then
    insert into public.actor (
      name,
      email,
      phone,
      is_organization,
      is_anonymous
    ) values (
      trim(payload #>> '{donor,name}'),
      donor_email,
      donor_phone,
      coalesce((payload #>> '{donor,is_organization}')::boolean, false),
      coalesce((payload #>> '{donor,is_anonymous}')::boolean, false)
    )
    returning id into donor_id;
  else
    update public.actor
    set
      phone = coalesce(phone, donor_phone),
      is_anonymous = is_anonymous or coalesce((payload #>> '{donor,is_anonymous}')::boolean, false)
    where id = donor_id;
  end if;

  insert into public.actor_role (actor_id, role)
  values (donor_id, 'donor')
  on conflict (actor_id, role) do nothing;

  begin
    origin_amount := (payload ->> 'origin_amount')::numeric(14,2);
    usd_base_amount := (payload ->> 'usd_base_amount')::numeric(14,2);
    exchange_rate := (payload ->> 'exchange_rate_to_usd')::numeric(20,10);
    received_value := (payload ->> 'received_at')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'Amounts, exchange rate, and receipt time must be valid.';
  end;

  origin_currency := upper(trim(payload ->> 'origin_currency'));
  payment_method_value := payload ->> 'payment_method';

  if origin_amount <= 0
    or usd_base_amount <= 0
    or exchange_rate <= 0
    or origin_currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'Positive monetary values and a valid currency are required.';
  end if;

  if received_value > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'Receipt time cannot be in the future.';
  end if;

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
    donor_id,
    'monetary',
    'received',
    reference_value,
    received_value,
    nullif(trim(payload ->> 'notes'), ''),
    submission_id,
    current_user_id
  )
  returning id into result_donation_id;

  insert into public.donation_detail (
    donation_id,
    type,
    amount,
    currency
  ) values (
    result_donation_id,
    'monetary',
    origin_amount,
    origin_currency
  )
  returning id into result_detail_id;

  insert into public.monetary_donation_detail (
    donation_detail_id,
    payment_method,
    usd_base_amount,
    exchange_rate_to_usd,
    exchange_rate_source,
    exchange_rate_date,
    sender_institution,
    receiver_account_label,
    transaction_reference
  ) values (
    result_detail_id,
    payment_method_value,
    usd_base_amount,
    exchange_rate,
    nullif(trim(payload ->> 'exchange_rate_source'), ''),
    nullif(payload ->> 'exchange_rate_date', '')::date,
    nullif(trim(payload ->> 'sender_institution'), ''),
    nullif(trim(payload ->> 'receiver_account_label'), ''),
    nullif(trim(payload ->> 'transaction_reference'), '')
  );

  expected_storage_prefix := format('donations/%s/%s/', current_user_id, submission_id);

  if coalesce(jsonb_typeof(payload -> 'attachments'), '') <> 'array' then
    raise exception using errcode = '22023', message = 'Payment or receipt evidence is required.';
  end if;

  if jsonb_array_length(payload -> 'attachments') = 0 then
    raise exception using errcode = '22023', message = 'Payment or receipt evidence is required.';
  end if;

  for attachment in
    select value from jsonb_array_elements(coalesce(payload -> 'attachments', '[]'::jsonb))
  loop
    if attachment ->> 'attachment_type' not in ('proof_of_payment', 'receipt') then
      raise exception using errcode = '22023', message = 'Attachment type is invalid.';
    end if;

    if nullif(trim(attachment ->> 'storage_path'), '') is null
      or position(expected_storage_prefix in (attachment ->> 'storage_path')) <> 1
      or nullif(trim(attachment ->> 'file_name'), '') is null then
      raise exception using errcode = '22023', message = 'Attachment path or file name is invalid.';
    end if;

    select media.id into media_id
    from public.media_type media
    where media.active
      and media.code = case attachment ->> 'attachment_type'
        when 'proof_of_payment' then 'proof_of_payment'
        else 'donation_receipt'
      end;

    if media_id is null then
      raise exception using errcode = '22023', message = 'Attachment media type is unavailable.';
    end if;

    insert into public.donation_attachment (
      donation_id,
      media_type_id,
      storage_url,
      file_name,
      notes
    ) values (
      result_donation_id,
      media_id,
      attachment ->> 'storage_path',
      attachment ->> 'file_name',
      nullif(trim(attachment ->> 'notes'), '')
    );
  end loop;

  return jsonb_build_object(
    'donation_id', result_donation_id,
    'detail_id', result_detail_id,
    'reference_code', reference_value,
    'created', true
  );
end;
$$;

comment on function public.submit_monetary_donation(jsonb) is
  'Atomically creates an allow-listed operator monetary donation, multi-currency reporting detail, and evidence metadata.';

revoke all on function public.submit_monetary_donation(jsonb) from public, anon;
grant execute on function public.submit_monetary_donation(jsonb) to authenticated;

create or replace function public.register_beneficiary(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  submission_id uuid;
  beneficiary_id uuid;
  beneficiary_code text;
  birth_date_value date;
  age_years integer;
  age_band_value text;
  sex_value text;
  phone_value text;
  impact_event_value uuid;
  event_id uuid;
  household_value integer;
begin
  if current_user_id is null or not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operator access is required.';
  end if;

  begin
    submission_id := (payload ->> 'submission_key')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'A valid submission key is required.';
  end;

  select beneficiary.id, beneficiary.public_code
  into beneficiary_id, beneficiary_code
  from private.beneficiary beneficiary
  where beneficiary.created_by = current_user_id
    and beneficiary.submission_key = submission_id;

  if beneficiary_id is not null then
    return jsonb_build_object(
      'beneficiary_id', beneficiary_id,
      'public_code', beneficiary_code,
      'created', false
    );
  end if;

  if jsonb_typeof(payload -> 'beneficiary') <> 'object'
    or nullif(trim(payload #>> '{beneficiary,full_name}'), '') is null
    or nullif(trim(payload #>> '{beneficiary,residence_area}'), '') is null then
    raise exception using errcode = '22023', message = 'Beneficiary name and residence area are required.';
  end if;

  if not coalesce((payload #>> '{beneficiary,privacy_notice_acknowledged}')::boolean, false) then
    raise exception using errcode = '22023', message = 'Privacy notice acknowledgement is required.';
  end if;

  begin
    birth_date_value := nullif(payload #>> '{beneficiary,date_of_birth}', '')::date;
  exception when others then
    raise exception using errcode = '22023', message = 'Date of birth must be valid.';
  end;

  if birth_date_value is not null and birth_date_value > current_date then
    raise exception using errcode = '22023', message = 'Date of birth cannot be in the future.';
  end if;

  age_band_value := nullif(payload #>> '{beneficiary,age_band}', '');
  if birth_date_value is not null then
    age_years := extract(year from age(current_date, birth_date_value));
    age_band_value := case
      when age_years <= 5 then '0_5'
      when age_years <= 12 then '6_12'
      when age_years <= 17 then '13_17'
      when age_years <= 59 then '18_59'
      else '60_plus'
    end;
  end if;
  age_band_value := coalesce(age_band_value, 'unknown');
  sex_value := coalesce(nullif(payload #>> '{beneficiary,sex}', ''), 'unknown');
  phone_value := nullif(trim(payload #>> '{beneficiary,phone}'), '');

  beneficiary_id := gen_random_uuid();
  beneficiary_code := 'BEN-' || upper(left(replace(beneficiary_id::text, '-', ''), 12));

  insert into private.beneficiary (
    id,
    public_code,
    submission_key,
    full_name,
    date_of_birth,
    age_band,
    sex,
    phone,
    has_whatsapp,
    email,
    residence_country,
    residence_area,
    privacy_notice_acknowledged,
    privacy_notice_acknowledged_at,
    created_by,
    updated_by
  ) values (
    beneficiary_id,
    beneficiary_code,
    submission_id,
    trim(payload #>> '{beneficiary,full_name}'),
    birth_date_value,
    age_band_value,
    sex_value,
    phone_value,
    coalesce((payload #>> '{beneficiary,has_whatsapp}')::boolean, false),
    lower(nullif(trim(payload #>> '{beneficiary,email}'), '')),
    nullif(trim(payload #>> '{beneficiary,residence_country}'), ''),
    trim(payload #>> '{beneficiary,residence_area}'),
    true,
    now(),
    current_user_id,
    current_user_id
  );

  if payload ? 'event' and jsonb_typeof(payload -> 'event') = 'object' then
    begin
      impact_event_value := (payload #>> '{event,impact_event_id}')::uuid;
      household_value := coalesce((payload #>> '{event,household_members_represented}')::integer, 1);
    exception when others then
      raise exception using errcode = '22023', message = 'Beneficiary event data must be valid.';
    end;

    if impact_event_value is null then
      raise exception using errcode = '22023', message = 'Impact event is required when participation is supplied.';
    end if;

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
      beneficiary_id,
      impact_event_value,
      submission_id,
      coalesce(nullif(payload #>> '{event,attendance_status}', ''), 'registered'),
      household_value,
      coalesce(array(
        select jsonb_array_elements_text(coalesce(payload #> '{event,service_codes}', '[]'::jsonb))
      ), '{}'),
      current_user_id,
      current_user_id
    )
    returning id into event_id;
  end if;

  return jsonb_build_object(
    'beneficiary_id', beneficiary_id,
    'beneficiary_event_id', event_id,
    'public_code', beneficiary_code,
    'created', true
  );
end;
$$;

comment on function public.register_beneficiary(jsonb) is
  'Registers minimum nominal beneficiary identity in the protected private schema and optionally links an impact event.';

revoke all on function public.register_beneficiary(jsonb) from public, anon;
grant execute on function public.register_beneficiary(jsonb) to authenticated;

comment on table public.monetary_donation_detail is
  'Multi-currency reporting and reconciliation extension for a monetary donation detail.';

comment on table private.beneficiary is
  'Protected minimum nominal beneficiary identity; public reporting must use aggregate impact data.';

comment on table private.beneficiary_event is
  'Protected beneficiary participation in an operational impact event.';
