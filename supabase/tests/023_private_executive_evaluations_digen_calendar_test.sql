begin;
set local search_path = public, extensions, pg_catalog;
select plan(12);
select has_table('public','executive_self_evaluation','Evaluation data is persisted');
select has_column('public','organization','evaluation_module_label','Evaluations can be renamed');
select row_eq(
  'select (select relrowsecurity from pg_class where oid=''public.executive_self_evaluation''::regclass)',
  row(true), 'RLS protects the evaluation table'
);
select has_policy('public','executive_self_evaluation','executive_evaluation_read','Evaluation reading is scoped');
select has_policy('public','executive_self_evaluation','executive_evaluation_insert','Evaluation creation is scoped');
select has_policy('public','executive_self_evaluation','executive_evaluation_update_draft','Draft changes are scoped');
select ok(pg_get_functiondef('private.can_manage_calendar_plan(uuid)'::regprocedure)
  ilike '%current_operator_is_digen_director(p.organization_id)%','DIGEN director may edit every unit calendar');
select unlike(pg_get_functiondef('private.can_manage_calendar_plan(uuid)'::regprocedure),
  '%can_manage_organization(p.organization_id)%','Tenant admin alone cannot edit across units');
select ok(pg_get_functiondef('private.guard_executive_evaluation()'::regprocedure)
  ilike '%Submitted evaluations are final%','Submitted records are immutable');
select ok(pg_get_functiondef('private.can_self_evaluate_unit(uuid,uuid)'::regprocedure)
  ilike '%m.unit_role = ''director''%','Only active directors submit evaluations');
select ok(pg_get_functiondef('public.evaluation_access_overview(uuid)'::regprocedure)
  ilike '%current_operator_is_digen_director(org_id)%','DIGEN identity comes from active membership');
select ok(pg_get_functiondef('public.calendar_access_overview(uuid,uuid)'::regprocedure)
  ilike '%can_edit_consolidated%','Calendar overview explicitly flags cross-unit editing');
select * from finish();
rollback;
