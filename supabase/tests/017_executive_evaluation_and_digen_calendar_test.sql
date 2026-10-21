begin;
set local search_path=public,extensions,pg_catalog;

select plan(16);
select has_table('public','executive_self_evaluation','digital executive self-evaluation exists');
select has_column('public','executive_self_evaluation','swot','SWOT categories persist as structured data');
select has_column('public','executive_self_evaluation','skill_ratings','18 occupational ratings persist');
select has_column('public','executive_self_evaluation','achievements','seven achievement statements persist');
select has_column('public','executive_self_evaluation','created_by','self-evaluation is tied to submitting identity');
select has_column('public','executive_self_evaluation','status','draft and submitted status persist');
select has_column('public','organization','evaluation_module_label','evaluation module supports tenant naming');
select has_function('private','is_digen_evaluation_viewer',array['uuid'],'DIGEN-only evaluator access exists');
select has_function('private','can_write_executive_evaluation',array['uuid','uuid'],'own director/manager access exists');
select has_function('public','executive_evaluation_access_overview',array['uuid'],'frontend receives eligible units and review access');
select has_function('public','digen_update_calendar_activity',array['uuid','jsonb'],'DIGEN correction is an authenticated RPC');
select has_table('private','calendar_activity_correction','calendar changes retain private history');
select ok(
  (select rowsecurity from pg_tables where schemaname='public' and tablename='executive_self_evaluation'),
  'RLS enabled on evaluation records'
);
select ok(
  not has_function_privilege('anon','public.executive_evaluation_access_overview(uuid)','execute')
    and not has_function_privilege('anon','public.digen_update_calendar_activity(uuid,jsonb)','execute')
    and not has_function_privilege('anon','public.admin_set_evaluation_module_label(uuid,text)','execute'),
  'all new public RPCs are blocked for anonymous access'
);
select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='executive_self_evaluation' and policyname='evaluation_select' and qual like '%is_digen_evaluation_viewer%'),
  'submitted evaluation privacy permits DIGEN review'
);
select ok(
  exists(select 1 from pg_policies where schemaname='public' and tablename='executive_self_evaluation' and policyname='evaluation_update' and qual like '%draft%'),
  'submitted records are immutable to the author'
);
select * from finish();
rollback;
