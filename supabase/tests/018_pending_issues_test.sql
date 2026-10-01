begin;
set local search_path = public, extensions, pg_catalog;

select plan(16);

select has_table('public','unit_pending_issue','pending issues are stored per unit');
select has_column('public','unit_pending_issue','organization_id','pending issue has organization');
select has_column('public','unit_pending_issue','management_period_id','pending issue has management period');
select has_column('public','unit_pending_issue','unit_id','pending issue has unit');
select has_column('public','unit_pending_issue','status','pending issue has tracking status');
select has_column('public','unit_pending_issue','urgency','pending issue has urgency');
select has_column('public','unit_pending_issue','due_date','pending issue can have a due date');

select has_function('private','can_access_pending_issue_unit',array['uuid'],'pending issue writes are unit scoped');
select has_function('public','pending_issue_access_overview',array['uuid'],'client can resolve pending issue access');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='unit_pending_issue'
      and policyname='unit_pending_issue_select'
      and qual ilike '%current_operator_is_digen%'
  ),
  'DIGEN can read the institutional consolidated pending issues'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='unit_pending_issue'
      and policyname='unit_pending_issue_update'
      and qual ilike '%can_access_pending_issue_unit%'
      and with_check ilike '%can_access_pending_issue_unit%'
  ),
  'pending issue updates stay scoped to own units'
);

select ok(
  not has_function_privilege('anon','public.pending_issue_access_overview(uuid)','EXECUTE'),
  'pending issue access RPC is unavailable to anon'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pending_issue_access_overview'
      and p.prosecdef=false
  ),
  'pending issue access RPC runs as security invoker'
);

select has_index(
  'public','unit_pending_issue','unit_pending_issue_management_period_id_idx',
  'management period foreign key is indexed'
);

select has_index(
  'public','unit_pending_issue','unit_pending_issue_unit_id_idx',
  'unit foreign key is indexed'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.unit_pending_issue'::regclass),
  'pending issue table has RLS enabled'
);

select * from finish();
rollback;
