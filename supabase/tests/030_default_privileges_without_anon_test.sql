-- #144: objects that postgres creates in public no longer grant anything to anon by default,
-- and new tables no longer grant TRUNCATE, REFERENCES, TRIGGER or MAINTAIN to authenticated.
-- anon executes only the three RPCs that are public on purpose.
-- Migrations run as postgres, so these defaults cover every future migration.
-- Functions are the exception: Postgres grants EXECUTE to PUBLIC globally, and per-schema
-- default privileges can only add to that. Each migration therefore still revokes execute
-- from public and anon on new functions; the guard below fails in CI when one does not.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(11);

-- Default privileges of postgres in public (pg_default_acl).
create function pg_temp.default_privs(p_type "char", p_grantee text) returns text[]
language sql stable as $$
  select coalesce(array_agg(distinct a.privilege_type order by a.privilege_type), array[]::text[])
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = p_type
    and a.grantee = (select oid from pg_roles where rolname = p_grantee)
$$;

select is(pg_temp.default_privs('r', 'anon'), array[]::text[],
  'postgres grants nothing to anon on new tables in public');
select is(pg_temp.default_privs('S', 'anon'), array[]::text[],
  'postgres grants nothing to anon on new sequences in public');
select is(pg_temp.default_privs('f', 'anon'), array[]::text[],
  'postgres adds no explicit execute for anon on new functions in public');
select ok(
  not (pg_temp.default_privs('r', 'authenticated') && array['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']),
  'postgres grants no TRUNCATE, REFERENCES, TRIGGER or MAINTAIN to authenticated on new tables in public'
);

-- Behavior: objects created now, as postgres, inside this rolled-back transaction.
create table public.t030_default_privs (id bigint generated always as identity primary key);

select table_privs_are('public', 't030_default_privs', 'anon', array[]::text[],
  'a new table grants nothing to anon');
select ok(
  not has_table_privilege('authenticated', 'public.t030_default_privs', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.t030_default_privs', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.t030_default_privs', 'TRIGGER')
  and not has_table_privilege('authenticated', 'public.t030_default_privs', 'MAINTAIN'),
  'a new table grants no TRUNCATE, REFERENCES, TRIGGER or MAINTAIN to authenticated'
);
select ok(
  not has_sequence_privilege('anon', pg_get_serial_sequence('public.t030_default_privs', 'id'), 'USAGE')
  and not has_sequence_privilege('anon', pg_get_serial_sequence('public.t030_default_privs', 'id'), 'SELECT')
  and not has_sequence_privilege('anon', pg_get_serial_sequence('public.t030_default_privs', 'id'), 'UPDATE'),
  'a new sequence grants nothing to anon'
);

-- Guard: anon executes only the RPCs that are public on purpose.
select is(
  array(
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
    order by 1
  ),
  array[
    'confirm_operator_activation(uuid)',
    'request_login_access(text)',
    'resolve_tenant_host(text)'
  ],
  'anon executes only the three public RPCs'
);

-- Regression: the public RPCs keep their explicit anon grant.
select ok(has_function_privilege('anon', 'public.confirm_operator_activation(uuid)', 'execute'),
  'anon still executes confirm_operator_activation');
select ok(has_function_privilege('anon', 'public.request_login_access(text)', 'execute'),
  'anon still executes request_login_access');
select ok(has_function_privilege('anon', 'public.resolve_tenant_host(text)', 'execute'),
  'anon still executes resolve_tenant_host');

select * from finish();
rollback;
