begin;
set local search_path = public, extensions, pg_catalog;

select plan(13);

select has_column('public','unit_pending_issue','origin','pending issue stores its origin');
select has_column('public','unit_pending_issue','issued_by_unit_id','pending issue stores issuing unit');

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='unit_pending_issue'
      and c.conname='unit_pending_issue_origin_check'
  ),
  'pending issue origin is constrained'
);

select has_function('private','current_operator_is_digen_director',array['uuid'],'DIGEN director authorization helper exists');
select has_function('private','pending_instruction_target_unit_ids_json',array['uuid'],'DIGEN instruction target helper exists');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='unit_pending_issue'
      and policyname='unit_pending_issue_select'
      and qual ilike '%current_visible_unit_ids%'
      and qual ilike '%digen_instruction%'
      and qual ilike '%current_operator_is_digen_director%'
  ),
  'ordinary issues keep hierarchy visibility while DIGEN can follow issued instructions'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='unit_pending_issue'
      and policyname='unit_pending_issue_insert'
      and with_check ilike '%current_operator_is_digen_director%'
      and with_check ilike '%digen_instruction%'
  ),
  'DIGEN director can insert targeted instructions'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='unit_pending_issue'
      and policyname='unit_pending_issue_update'
      and qual ilike '%current_operator_is_digen_director%'
  ),
  'DIGEN director can update issued instructions'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='unit_pending_issue'
      and policyname='unit_pending_issue_delete'
      and qual ilike '%digen_instruction%'
      and qual ilike '%current_operator_is_digen_director%'
  ),
  'only DIGEN manages deletion of DIGEN instructions'
);

select ok(
  pg_get_functiondef('private.guard_pending_issue_scope()'::regprocedure) ilike '%Only the assigned unit can change instruction status%'
  and pg_get_functiondef('private.guard_pending_issue_scope()'::regprocedure) ilike '%title is distinct from old.title%'
  and pg_get_functiondef('private.guard_pending_issue_scope()'::regprocedure) ilike '%due_date is distinct from old.due_date%',
  'trigger limits target-unit changes on DIGEN instructions to status/audit fields'
);

select ok(
  pg_get_functiondef('public.pending_issue_access_overview(uuid)'::regprocedure) ilike '%can_issue_instructions%'
  and pg_get_functiondef('public.pending_issue_access_overview(uuid)'::regprocedure) ilike '%instruction_target_unit_ids%',
  'access overview exposes instruction capability and targets'
);

select ok(
  not has_function_privilege('anon','public.pending_issue_access_overview(uuid)','EXECUTE'),
  'pending issue overview remains unavailable to anon'
);

select has_index('public','unit_pending_issue','unit_pending_issue_issued_by_unit_id_idx','issuing unit foreign key is indexed');

select * from finish();
rollback;
