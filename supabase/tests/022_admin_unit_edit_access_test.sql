begin;
set local search_path = public, extensions, pg_catalog;

select plan(4);

select ok(
  pg_get_functiondef('private.can_manage_calendar_plan(uuid)'::regprocedure) ilike '%can_manage_organization(p.organization_id)%',
  'tenant admins can manage any calendar plan of their organization'
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
  pg_get_functiondef('private.guard_pending_issue_scope()'::regprocedure) ilike '%Only the DIGEN Director General can issue instructions.%',
  'issuing DIGEN instructions stays reserved to the DIGEN Director General'
);

select * from finish();
rollback;
