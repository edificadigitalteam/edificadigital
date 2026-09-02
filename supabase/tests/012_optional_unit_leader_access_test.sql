begin;

select plan(7);

select has_function(
  'public',
  'admin_save_organization_unit_v2',
  array['jsonb'],
  'organization unit save RPC keeps its public signature'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization_unit_v2(jsonb)'::regprocedure) ilike '%create_access%',
  'organization unit save RPC reads the leader access choice'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization_unit_v2(jsonb)'::regprocedure) ilike '%leader_email is null%',
  'organization unit save RPC permits a leader without email when access is disabled'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization_unit_v2(jsonb)'::regprocedure) ilike '%if leader_create_access then%',
  'operator provisioning is conditional on the access choice'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization_unit_v2(jsonb)'::regprocedure) ilike '%leader_operator_id%',
  'RPC response continues to expose the optional leader operator id'
);

select ok(
  has_function_privilege('authenticated', 'public.admin_save_organization_unit_v2(jsonb)', 'EXECUTE'),
  'authenticated sessions retain execute access'
);

select ok(
  not has_function_privilege('anon', 'public.admin_save_organization_unit_v2(jsonb)', 'EXECUTE'),
  'anonymous sessions remain unable to execute the RPC'
);

select * from finish();
rollback;
