begin;
set local search_path = public, extensions, pg_catalog;
select plan(8);

select ok(pg_get_functiondef('private.can_self_evaluate_unit(uuid,uuid)'::regprocedure)
  ilike '%m.unit_role = ''director''%', 'Only active directors can submit evaluation forms');
select ok(pg_get_functiondef('private.can_self_evaluate_unit(uuid,uuid)'::regprocedure)
  ilike '%upper(trim(u.code)) not in (''GEN'', ''DIGEN'')%', 'GEN and DIGEN units cannot submit self-evaluations');
select ok(pg_get_functiondef('private.can_self_evaluate_unit(uuid,uuid)'::regprocedure)
  ilike '%not private.current_operator_is_gen_or_digen_leader(target_organization_id)%',
  'GEN/DIGEN supervisors cannot submit under another directorate');
select ok(pg_get_functiondef('public.evaluation_access_overview(uuid)'::regprocedure)
  ilike '%upper(trim(u.code)) not in (''GEN'',''DIGEN'')%',
  'Access overview returns only subordinate directorate forms');
select ok(pg_get_functiondef('public.evaluation_access_overview(uuid)'::regprocedure)
  ilike '%''is_evaluation_supervisor'', is_supervisor%', 'UI receives a dedicated supervisor flag');
select ok(pg_get_functiondef('public.evaluation_access_overview(uuid)'::regprocedure)
  ilike '%''can_review_all_evaluations'', is_admin or is_supervisor%',
  'GEN/DIGEN and tenant admin continue to receive evaluation results');
select ok(pg_get_functiondef('public.evaluation_access_overview(uuid)'::regprocedure)
  ilike '%''can_read_draft_evaluations'', is_admin%', 'Tenant admin draft visibility is preserved');
select ok((select qual::text from pg_policies
  where schemaname='public' and tablename='executive_self_evaluation' and policyname='executive_evaluation_read')
  ilike '%can_self_evaluate_unit%', 'Author row access continues using central database authorization');

select * from finish();
rollback;
