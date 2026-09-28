begin;

select plan(10);

select has_column('public','organization','calendar_module_label','calendar module label exists');
select has_function_privilege('authenticated','public.admin_set_calendar_module_label(uuid,text)','EXECUTE') as authenticated_can_rename \gset
select ok(:'authenticated_can_rename'::boolean,'authenticated can call narrow calendar label RPC');
select has_function_privilege('anon','public.admin_set_calendar_module_label(uuid,text)','EXECUTE') as anon_can_rename \gset
select ok(not :'anon_can_rename'::boolean,'anon cannot rename calendar module');

select has_function_privilege('authenticated','private.can_view_all_unit_calendar(uuid)','EXECUTE') as private_exposed \gset
select ok(not :'private_exposed'::boolean,'calendar oversight helper is not exposed to authenticated');

select policies_are(
  'public','unit_work_activity',
  array['unit_work_activity_delete','unit_work_activity_insert','unit_work_activity_select','unit_work_activity_update'],
  'calendar activity has the four scoped policies'
);

select policy_cmd_is('public','unit_work_activity','unit_work_activity_select','SELECT','select policy exists');
select policy_cmd_is('public','unit_work_activity','unit_work_activity_insert','INSERT','insert policy exists');
select policy_cmd_is('public','unit_work_activity','unit_work_activity_update','UPDATE','update policy exists');
select policy_cmd_is('public','unit_work_activity','unit_work_activity_delete','DELETE','delete policy exists');

select matches(
  (select qual from pg_policies where schemaname='public' and tablename='unit_work_activity' and policyname='unit_work_activity_select'),
  'can_view_all_unit_calendar',
  'select policy includes DIGEN consolidated access'
);

select * from finish();
rollback;
