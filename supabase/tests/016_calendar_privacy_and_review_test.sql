begin;

select plan(18);

select has_column('public','organization','calendar_module_label','organization stores the calendar module label override');
select has_column('public','management_period','calendar_joint_review_enabled','management periods can authorize a joint calendar review');
select has_column('public','management_period','calendar_joint_review_enabled_by','joint review records who enabled it');
select has_column('public','management_period','calendar_joint_review_enabled_at','joint review records when it was enabled');

select has_column('public','unit_work_activity','modality','calendar activities store modality');
select has_column('public','unit_work_activity','review_status','calendar activities store DIGEN review status');
select has_column('public','unit_work_activity','review_note','calendar activities store DIGEN review notes');
select has_column('public','unit_work_activity','reviewed_by','calendar activities record the reviewer');
select has_column('public','unit_work_activity','reviewed_at','calendar activities record review time');

select has_function('private','current_operator_is_digen',array['uuid'],'calendar authorization can identify DIGEN membership');
select has_function('private','can_manage_calendar_plan',array['uuid'],'calendar write authorization is unit scoped');
select has_function('private','can_view_calendar_plan',array['uuid'],'calendar read authorization is unit/DIGEN/joint-review scoped');
select has_function('public','calendar_access_overview',array['uuid','uuid'],'the client can resolve calendar access without reading private membership data');
select has_function('public','review_calendar_activity',array['uuid','text','text'],'DIGEN reviews an activity through a dedicated RPC');
select has_function('public','set_calendar_joint_review',array['uuid','boolean'],'DIGEN controls the temporary joint review window');
select has_function('public','admin_set_calendar_module_label',array['uuid','text'],'tenant admins can rename the calendar module');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='unit_work_activity'
      and policyname='unit_work_activity_select'
      and qual ilike '%can_view_calendar_plan%'
  ),
  'unit_work_activity SELECT is limited by calendar visibility rules'
);

select ok(
  not has_function_privilege('anon','public.calendar_access_overview(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.review_calendar_activity(uuid,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.set_calendar_joint_review(uuid,boolean)','EXECUTE'),
  'calendar RPCs are unavailable to anon'
);

select * from finish();
rollback;
