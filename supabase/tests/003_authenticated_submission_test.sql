begin;

select plan(14);

select has_schema('private', 'private authorization schema exists');
select has_table('private', 'operator_access', 'operator allow-list exists');
select has_column('public', 'donation', 'submission_key', 'donation stores an idempotency key');
select has_column('public', 'donation', 'created_by', 'donation records its authenticated creator');

select has_function(
  'public',
  'submit_in_kind_shipment',
  array['jsonb'],
  'atomic in-kind submission RPC exists'
);

select has_function(
  'public',
  'current_operator_access',
  array[]::text[],
  'application can check current operator access'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.submit_in_kind_shipment(jsonb)'::regprocedure),
  false,
  'submission RPC uses security invoker'
);

select ok(
  has_function_privilege('authenticated', 'public.submit_in_kind_shipment(jsonb)', 'EXECUTE'),
  'authenticated role can execute the submission RPC'
);

select ok(
  not has_function_privilege('anon', 'public.submit_in_kind_shipment(jsonb)', 'EXECUTE'),
  'anonymous role cannot execute the submission RPC'
);

select ok(
  not has_table_privilege('authenticated', 'private.operator_access', 'SELECT'),
  'authenticated clients cannot enumerate the private operator allow-list'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%auth.role%' or coalesce(with_check, '') ilike '%auth.role%')
  ),
  0::bigint,
  'public policies avoid deprecated auth.role predicates'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%is_authorized_operator%'
        or coalesce(with_check, '') ilike '%is_authorized_operator%'
      )
  ),
  17::bigint,
  'every operational table policy checks operator authorization'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and coalesce(qual, '') ilike '%is_authorized_operator%'
      and coalesce(with_check, '') ilike '%is_authorized_operator%'
  ),
  1::bigint,
  'attachment storage policy checks operator authorization'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'donation'
      and indexdef ilike '%created_by%submission_key%'
      and indexdef ilike '%unique%'
  ),
  'donation retries are unique per creator and submission key'
);

select * from finish();
rollback;
