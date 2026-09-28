begin;
set local search_path = public, extensions, pg_catalog;

select plan(2);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='unit_work_activity'
      and column_name='objective_id'
      and is_nullable='YES'
  ),
  'calendar activities can exist without an annual-plan objective'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='unit_work_activity'
      and c.conname='unit_work_activity_objective_id_fkey'
      and c.confdeltype='n'
  ),
  'deleting an objective preserves calendar activities by setting objective_id null'
);

select * from finish();
rollback;
