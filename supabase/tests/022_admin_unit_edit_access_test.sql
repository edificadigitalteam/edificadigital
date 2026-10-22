begin;
set local search_path = public, extensions, pg_catalog;

select plan(4);

select ok(
  pg_get_functiondef('private.can_manage_calendar_plan(uuid)'::regprocedure) ilike '%current_operator_is_gen_or_digen_leader(p.organization_id)%',
  'GEN and DIGEN can manage other units calendar plans'
);

select ok(
  pg_get_functiondef('private.can_manage_calendar_plan(uuid)'::regprocedure) ilike '%unit_role in (''director'',''manager'',''operator'',''reviewer'')%',
  'unit members keep managing their own calendar plan'
);

select ok(
  pg_get_functiondef('private.can_access_pending_issue_unit(uuid)'::regprocedure) ilike '%can_manage_organization(u.organization_id)%',
  'tenant admins can manage pending issues of any active unit of their organization'
);

select ok(
  pg_get_functiondef('private.guard_pending_issue_scope()'::regprocedure) ilike '%can_issue_digen_instructions(new.organization_id)%',
  'issuing DIGEN instructions is reserved to the DIGEN Director General and, since 20261022150000, the tenant admin'
);

select * from finish();
rollback;
