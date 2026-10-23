begin;
set local search_path = public, extensions, pg_catalog;

select plan(20);

-- Since 2026-10-30 Supabase stops granting Data API access to new tables in
-- `public` automatically. A database built from migrations (db reset, preview
-- branches, new projects) only has the privileges the migrations grant.

-- Finance tables are read through the Data API and written through
-- security-definer RPCs only.
select table_privs_are('public', 'finance_fund', 'authenticated', array['SELECT'], 'authenticated reads finance_fund');
select table_privs_are('public', 'finance_submission', 'authenticated', array['SELECT'], 'authenticated reads finance_submission');
select table_privs_are('public', 'finance_transaction', 'authenticated', array['SELECT'], 'authenticated reads finance_transaction');
select table_privs_are('public', 'finance_submission_attachment', 'authenticated', array['SELECT'], 'authenticated reads finance_submission_attachment');

-- Work plans, report windows and report items are edited directly under RLS.
select table_privs_are('public', 'unit_management_report_item', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages unit_management_report_item');
select table_privs_are('public', 'unit_work_plan', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages unit_work_plan');
select table_privs_are('public', 'management_report_window', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages management_report_window');
select table_privs_are('public', 'unit_work_activity', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated manages unit_work_activity');

-- Anonymous visitors have no access to any of them.
select table_privs_are('public', 'finance_fund', 'anon', array[]::text[], 'anon has no access to finance_fund');
select table_privs_are('public', 'finance_submission', 'anon', array[]::text[], 'anon has no access to finance_submission');
select table_privs_are('public', 'finance_transaction', 'anon', array[]::text[], 'anon has no access to finance_transaction');
select table_privs_are('public', 'finance_submission_attachment', 'anon', array[]::text[], 'anon has no access to finance_submission_attachment');
select table_privs_are('public', 'unit_management_report_item', 'anon', array[]::text[], 'anon has no access to unit_management_report_item');
select table_privs_are('public', 'unit_work_plan', 'anon', array[]::text[], 'anon has no access to unit_work_plan');
select table_privs_are('public', 'management_report_window', 'anon', array[]::text[], 'anon has no access to management_report_window');
select table_privs_are('public', 'unit_work_activity', 'anon', array[]::text[], 'anon has no access to unit_work_activity');

-- Guards for every table and view in public, including future ones.
select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and not has_table_privilege('authenticated', c.oid, 'SELECT')
    order by 1
  ),
  array[]::text[],
  'every public table and view grants SELECT to authenticated explicitly'
);

select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and not has_table_privilege('service_role', c.oid, 'SELECT')
    order by 1
  ),
  array[]::text[],
  'every public table and view grants SELECT to service_role explicitly'
);

select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not (
        has_table_privilege('service_role', c.oid, 'INSERT')
        and has_table_privilege('service_role', c.oid, 'UPDATE')
        and has_table_privilege('service_role', c.oid, 'DELETE')
      )
    order by 1
  ),
  array[]::text[],
  'every public table grants INSERT, UPDATE and DELETE to service_role explicitly'
);

-- Representative round trip: an authenticated session reaches a table that
-- previously relied on the automatic grant (RLS still filters the rows).
set local role authenticated;
select lives_ok(
  'select count(*) from public.unit_work_plan',
  'authenticated can query unit_work_plan through its explicit grant'
);
reset role;

select * from finish();
rollback;
