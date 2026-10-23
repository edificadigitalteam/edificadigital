-- #141: anon has no privileges on any table or view in public.
-- edifydb still carried the automatic grants (including TRUNCATE and writes) for anon on 14 tables
-- that no migration revoked. RLS blocked the rows, but the privileges contradicted the baseline
-- in AGENTS.md. authenticated keeps exactly what each table's creating migration declared.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(29);

-- anon: no privileges on the 14 tables.
select table_privs_are('public', 'finance_resource_request', 'anon', array[]::text[], 'anon has no access to finance_resource_request');
select table_privs_are('public', 'indicator_progress', 'anon', array[]::text[], 'anon has no access to indicator_progress');
select table_privs_are('public', 'institutional_objective', 'anon', array[]::text[], 'anon has no access to institutional_objective');
select table_privs_are('public', 'management_indicator', 'anon', array[]::text[], 'anon has no access to management_indicator');
select table_privs_are('public', 'management_period', 'anon', array[]::text[], 'anon has no access to management_period');
select table_privs_are('public', 'objective_unit_assignment', 'anon', array[]::text[], 'anon has no access to objective_unit_assignment');
select table_privs_are('public', 'organization_subscription', 'anon', array[]::text[], 'anon has no access to organization_subscription');
select table_privs_are('public', 'organization_unit', 'anon', array[]::text[], 'anon has no access to organization_unit');
select table_privs_are('public', 'organization_unit_member', 'anon', array[]::text[], 'anon has no access to organization_unit_member');
select table_privs_are('public', 'project_objective', 'anon', array[]::text[], 'anon has no access to project_objective');
select table_privs_are('public', 'project_organization_unit', 'anon', array[]::text[], 'anon has no access to project_organization_unit');
select table_privs_are('public', 'subscription_payment', 'anon', array[]::text[], 'anon has no access to subscription_payment');
select table_privs_are('public', 'subscription_plan', 'anon', array[]::text[], 'anon has no access to subscription_plan');
select table_privs_are('public', 'unit_management_report', 'anon', array[]::text[], 'anon has no access to unit_management_report');

-- authenticated: the privileges its RLS policies and the frontend use (regression).
select table_privs_are('public', 'finance_resource_request', 'authenticated', array['SELECT'], 'authenticated reads finance_resource_request');
select table_privs_are('public', 'indicator_progress', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages indicator_progress');
select table_privs_are('public', 'institutional_objective', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages institutional_objective');
select table_privs_are('public', 'management_indicator', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages management_indicator');
select table_privs_are('public', 'management_period', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages management_period');
select table_privs_are('public', 'objective_unit_assignment', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages objective_unit_assignment');
select table_privs_are('public', 'organization_subscription', 'authenticated', array['SELECT'], 'authenticated reads organization_subscription');
select table_privs_are('public', 'organization_unit', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages organization_unit');
select table_privs_are('public', 'organization_unit_member', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages organization_unit_member');
select table_privs_are('public', 'project_objective', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages project_objective');
select table_privs_are('public', 'project_organization_unit', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages project_organization_unit');
select table_privs_are('public', 'subscription_payment', 'authenticated', array['SELECT'], 'authenticated reads subscription_payment');
select table_privs_are('public', 'subscription_plan', 'authenticated', array['SELECT'], 'authenticated reads subscription_plan');
select table_privs_are('public', 'unit_management_report', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages unit_management_report');

-- Guard for every table and view in public, including future ones (AGENTS.md database rule 14).
select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'REFERENCES')
        or has_table_privilege('anon', c.oid, 'TRIGGER')
      )
    order by 1
  ),
  array[]::text[],
  'no public table or view grants any privilege to anon'
);

select * from finish();
rollback;
