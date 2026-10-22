begin;
set local search_path = public, extensions, pg_catalog;
select plan(19);
select has_table('public','executive_self_evaluation','Evaluation data is persisted');
select has_column('public','organization','evaluation_module_label','Evaluations can be renamed');
select ok(
  (select relrowsecurity from pg_class where oid='public.executive_self_evaluation'::regclass),
  'RLS protects the evaluation table'
);
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='executive_self_evaluation' and policyname='executive_evaluation_read'),'Evaluation reading is scoped');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='executive_self_evaluation' and policyname='executive_evaluation_insert'),'Evaluation creation is scoped');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='executive_self_evaluation' and policyname='executive_evaluation_update_draft'),'Draft changes are scoped');
select ok(pg_get_functiondef('private.can_manage_calendar_plan(uuid)'::regprocedure)
  ilike '%current_operator_is_gen_or_digen_leader(p.organization_id)%','GEN and DIGEN leaders may edit every unit calendar');
select ok(pg_get_functiondef('private.can_manage_calendar_plan(uuid)'::regprocedure)
  ilike '%can_manage_organization(p.organization_id)%','Tenant admin keeps cross-unit calendar editing');
select ok((select qual::text from pg_policies
  where schemaname='public' and tablename='executive_self_evaluation' and policyname='executive_evaluation_read')
  ilike '%''submitted''%can_manage_organization(organization_id)%','Admin and GEN/DIGEN read submitted evaluations only');
select ok(pg_get_functiondef('private.guard_executive_evaluation()'::regprocedure)
  ilike '%Submitted evaluations are final%','Submitted records are immutable');
select ok(pg_get_functiondef('private.can_self_evaluate_unit(uuid,uuid)'::regprocedure)
  ilike '%m.unit_role = ''director''%','Only active directors submit evaluations');
select ok(pg_get_functiondef('public.evaluation_access_overview(uuid)'::regprocedure)
  ilike '%can_review_all_evaluations%','GEN and DIGEN can receive institutional evaluations');
select ok(pg_get_functiondef('public.calendar_access_overview(uuid,uuid)'::regprocedure)
  ilike '%can_edit_consolidated%','Calendar overview explicitly flags cross-unit editing');
select ok(pg_get_functiondef('private.current_operator_is_gen_or_digen_leader(uuid)'::regprocedure)
  ilike '%upper(trim(u.code))=''GEN''%','GEN authorization requires explicit active GEN membership');
select ok(pg_get_functiondef('private.current_operator_is_gen_or_digen_leader(uuid)'::regprocedure)
  ilike '%current_operator_is_digen_director(target_organization_id)%','DIGEN director remains an authorized institutional reviewer');
select ok((select qual::text from pg_policies
  where schemaname='public' and tablename='executive_self_evaluation' and policyname='executive_evaluation_read')
  ilike '%current_operator_is_gen_or_digen_leader(organization_id)%','GEN and DIGEN can read protected evaluations');
select ok(pg_get_functiondef('private.guard_calendar_activity_review()'::regprocedure)
  ilike '%current_operator_is_gen_or_digen_leader(new.organization_id)%','GEN and DIGEN may set review fields');
select ok(pg_get_functiondef('public.review_calendar_activity(uuid,text,text)'::regprocedure)
  ilike '%current_operator_is_gen_or_digen_leader(org_id)%','GEN and DIGEN may validate and observe activities');
select ok(pg_get_functiondef('public.set_calendar_joint_review(uuid,boolean)'::regprocedure)
  ilike '%current_operator_is_gen_or_digen_leader(org_id)%','GEN and DIGEN may enable shared meeting mode');
select * from finish();
rollback;
