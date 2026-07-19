begin;

select plan(26);

select has_table('public', 'monetary_donation_detail', 'monetary detail extension exists');
select has_column('public', 'monetary_donation_detail', 'payment_method', 'payment method is recorded');
select has_column('public', 'monetary_donation_detail', 'usd_base_amount', 'USD reporting base is recorded');
select has_column('public', 'monetary_donation_detail', 'exchange_rate_to_usd', 'applied exchange rate is recorded');
select has_column('public', 'monetary_donation_detail', 'reconciliation_status', 'reconciliation status is recorded');

select has_table('private', 'beneficiary', 'beneficiary identity stays in the private schema');
select has_column('private', 'beneficiary', 'public_code', 'beneficiary receives a non-identifying code');
select has_column('private', 'beneficiary', 'submission_key', 'beneficiary retries have an idempotency key');
select has_column('private', 'beneficiary', 'privacy_notice_acknowledged', 'privacy acknowledgement is recorded');
select has_column('private', 'beneficiary', 'residence_area', 'beneficiary residence area is recorded without an exact address');
select has_column('private', 'beneficiary', 'has_whatsapp', 'WhatsApp availability is recorded');
select has_table('private', 'beneficiary_event', 'beneficiary participation links to impact events');

select has_function(
  'public',
  'submit_monetary_donation',
  array['jsonb'],
  'atomic monetary submission RPC exists'
);

select has_function(
  'public',
  'register_beneficiary',
  array['jsonb'],
  'protected beneficiary registration RPC exists'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.submit_monetary_donation(jsonb)'::regprocedure),
  false,
  'monetary RPC uses security invoker'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.register_beneficiary(jsonb)'::regprocedure),
  false,
  'beneficiary RPC uses security invoker'
);

select ok(
  has_function_privilege('authenticated', 'public.submit_monetary_donation(jsonb)', 'EXECUTE'),
  'authenticated operators can submit monetary donations'
);

select ok(
  not has_function_privilege('anon', 'public.submit_monetary_donation(jsonb)', 'EXECUTE'),
  'anonymous sessions cannot submit monetary donations'
);

select ok(
  has_function_privilege('authenticated', 'public.register_beneficiary(jsonb)', 'EXECUTE'),
  'authenticated operators can register beneficiaries'
);

select ok(
  not has_function_privilege('anon', 'public.register_beneficiary(jsonb)', 'EXECUTE'),
  'anonymous sessions cannot register beneficiaries'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.monetary_donation_detail'::regclass),
  true,
  'monetary detail has RLS'
);

select is(
  (select count(*) from pg_class where oid in ('private.beneficiary'::regclass, 'private.beneficiary_event'::regclass) and relrowsecurity),
  2::bigint,
  'both private beneficiary tables have RLS'
);

select ok(
  not has_table_privilege('anon', 'private.beneficiary', 'SELECT'),
  'anonymous sessions cannot read beneficiary identity'
);

select ok(
  has_table_privilege('authenticated', 'private.beneficiary', 'SELECT,INSERT,UPDATE'),
  'authenticated RPC execution has the required private-table privileges'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'beneficiary'
      and indexdef ilike '%created_by%submission_key%'
      and indexdef ilike '%unique%'
  ),
  'beneficiary retry key is unique per creator'
);

select hasnt_constraint(
  'public',
  'donation',
  'donation_received_at_check',
  'business receipt time may precede system recording time'
);

select * from finish();
rollback;

