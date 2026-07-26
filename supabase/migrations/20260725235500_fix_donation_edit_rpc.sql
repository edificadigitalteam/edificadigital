-- Fix ambiguous identifiers in the donation editing RPC.

create or replace function public.update_donation_record(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_donation_id uuid;
  donation_record public.donation%rowtype;
  target_detail_id uuid;
  caller_is_admin boolean := private.is_authorized_admin();
begin
  begin
    target_donation_id := (payload ->> 'id')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'A valid donation identifier is required.';
  end;

  select donation.*
  into donation_record
  from public.donation donation
  where donation.id = target_donation_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Donation record was not found.';
  end if;

  if donation_record.created_by is distinct from current_user_id and not caller_is_admin then
    raise exception using errcode = '42501', message = 'You cannot edit this donation.';
  end if;

  update public.donation donation
  set status = coalesce(nullif(payload ->> 'status', ''), donation.status),
      received_at = case
        when payload ? 'received_at' then nullif(payload ->> 'received_at', '')::timestamptz
        else donation.received_at
      end,
      notes = case
        when payload ? 'notes' then nullif(trim(payload ->> 'notes'), '')
        else donation.notes
      end,
      project_id = case
        when payload ? 'project_id' then nullif(payload ->> 'project_id', '')::uuid
        else donation.project_id
      end,
      updated_at = now()
  where donation.id = target_donation_id
  returning donation.* into donation_record;

  update public.actor actor
  set name = coalesce(nullif(trim(payload #>> '{donor,name}'), ''), actor.name),
      email = case
        when (payload #> '{donor}') ? 'email' then nullif(lower(trim(payload #>> '{donor,email}')), '')
        else actor.email
      end,
      phone = case
        when (payload #> '{donor}') ? 'phone' then nullif(trim(payload #>> '{donor,phone}'), '')
        else actor.phone
      end,
      country = case
        when (payload #> '{donor}') ? 'country' then nullif(trim(payload #>> '{donor,country}'), '')
        else actor.country
      end,
      updated_at = now()
  where actor.id = donation_record.actor_id;

  if donation_record.donation_type = 'monetary' and payload ? 'monetary' then
    select detail.id
    into target_detail_id
    from public.donation_detail detail
    where detail.donation_id = target_donation_id
      and detail.type = 'monetary'
    order by detail.created_at
    limit 1;

    if target_detail_id is null then
      raise exception using errcode = 'P0002', message = 'Monetary detail was not found.';
    end if;

    update public.donation_detail detail
    set amount = coalesce(nullif(payload #>> '{monetary,amount}', '')::numeric, detail.amount),
        currency = coalesce(nullif(upper(payload #>> '{monetary,currency}'), ''), detail.currency),
        updated_at = now()
    where detail.id = target_detail_id;

    update public.monetary_donation_detail monetary
    set payment_method = coalesce(nullif(payload #>> '{monetary,payment_method}', ''), monetary.payment_method),
        usd_base_amount = coalesce(nullif(payload #>> '{monetary,usd_base_amount}', '')::numeric, monetary.usd_base_amount),
        exchange_rate_to_usd = coalesce(nullif(payload #>> '{monetary,exchange_rate_to_usd}', '')::numeric, monetary.exchange_rate_to_usd),
        exchange_rate_source = case
          when (payload #> '{monetary}') ? 'exchange_rate_source' then nullif(trim(payload #>> '{monetary,exchange_rate_source}'), '')
          else monetary.exchange_rate_source
        end,
        exchange_rate_date = case
          when (payload #> '{monetary}') ? 'exchange_rate_date' then nullif(payload #>> '{monetary,exchange_rate_date}', '')::date
          else monetary.exchange_rate_date
        end,
        sender_institution = case
          when (payload #> '{monetary}') ? 'sender_institution' then nullif(trim(payload #>> '{monetary,sender_institution}'), '')
          else monetary.sender_institution
        end,
        receiver_account_label = case
          when (payload #> '{monetary}') ? 'receiver_account_label' then nullif(trim(payload #>> '{monetary,receiver_account_label}'), '')
          else monetary.receiver_account_label
        end,
        transaction_reference = case
          when (payload #> '{monetary}') ? 'transaction_reference' then nullif(trim(payload #>> '{monetary,transaction_reference}'), '')
          else monetary.transaction_reference
        end,
        updated_at = now()
    where monetary.donation_detail_id = target_detail_id;
  end if;

  if donation_record.donation_type in ('in_kind', 'mixed') and payload ? 'shipment' then
    update public.shipment shipment
    set transport_mode = coalesce(nullif(payload #>> '{shipment,transport_mode}', ''), shipment.transport_mode),
        status = coalesce(nullif(payload #>> '{shipment,status}', ''), shipment.status),
        shipment_scope = coalesce(nullif(payload #>> '{shipment,shipment_scope}', ''), shipment.shipment_scope),
        origin_country = coalesce(nullif(trim(payload #>> '{shipment,origin_country}'), ''), shipment.origin_country),
        origin_city = case
          when (payload #> '{shipment}') ? 'origin_city' then nullif(trim(payload #>> '{shipment,origin_city}'), '')
          else shipment.origin_city
        end,
        destination_country = coalesce(nullif(trim(payload #>> '{shipment,destination_country}'), ''), shipment.destination_country),
        destination_city = case
          when (payload #> '{shipment}') ? 'destination_city' then nullif(trim(payload #>> '{shipment,destination_city}'), '')
          else shipment.destination_city
        end,
        container_number = case
          when (payload #> '{shipment}') ? 'container_number' then nullif(trim(payload #>> '{shipment,container_number}'), '')
          else shipment.container_number
        end,
        tracking_number = case
          when (payload #> '{shipment}') ? 'tracking_number' then nullif(trim(payload #>> '{shipment,tracking_number}'), '')
          else shipment.tracking_number
        end,
        departure_date = case
          when (payload #> '{shipment}') ? 'departure_date' then nullif(payload #>> '{shipment,departure_date}', '')::date
          else shipment.departure_date
        end,
        estimated_arrival = case
          when (payload #> '{shipment}') ? 'estimated_arrival' then nullif(payload #>> '{shipment,estimated_arrival}', '')::date
          else shipment.estimated_arrival
        end,
        actual_arrival = case
          when (payload #> '{shipment}') ? 'actual_arrival' then nullif(payload #>> '{shipment,actual_arrival}', '')::date
          else shipment.actual_arrival
        end,
        category_codes = case
          when (payload #> '{shipment}') ? 'category_codes' then array(
            select jsonb_array_elements_text(payload #> '{shipment,category_codes}')
          )
          else shipment.category_codes
        end,
        contents_summary = case
          when (payload #> '{shipment}') ? 'contents_summary' then nullif(trim(payload #>> '{shipment,contents_summary}'), '')
          else shipment.contents_summary
        end,
        declared_package_count = case
          when (payload #> '{shipment}') ? 'declared_package_count' then nullif(payload #>> '{shipment,declared_package_count}', '')::numeric
          else shipment.declared_package_count
        end,
        package_unit_code = case
          when (payload #> '{shipment}') ? 'package_unit_code' then nullif(payload #>> '{shipment,package_unit_code}', '')
          else shipment.package_unit_code
        end,
        notes = case
          when (payload #> '{shipment}') ? 'notes' then nullif(trim(payload #>> '{shipment,notes}'), '')
          else shipment.notes
        end,
        updated_at = now()
    where shipment.donation_id = target_donation_id;
  end if;

  return jsonb_build_object(
    'id', target_donation_id,
    'updated', true,
    'updated_by', current_user_id
  );
end;
$$;

revoke all on function public.update_donation_record(jsonb) from public, anon;
grant execute on function public.update_donation_record(jsonb) to authenticated;
