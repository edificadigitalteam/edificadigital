begin;

select plan(3);

-- admin_list_operator_access() must not leak operators across organizations
-- to an org-scoped 'admin' caller. Only 'super_admin' callers (who have no
-- organization_id of their own) should see every operator regardless of
-- organization.

select ok(
  (
    (select prosrc from pg_proc where oid = 'public.admin_list_operator_access()'::regprocedure)
    ~* 'where[\s\S]*caller_operator_role\s*=\s*''super_admin'''
  ),
  'admin_list_operator_access has a WHERE clause branching on super_admin'
);

select ok(
  (
    (select prosrc from pg_proc where oid = 'public.admin_list_operator_access()'::regprocedure)
    ~* 'where[\s\S]*caller_operator_role\s*=\s*''admin''\s*and\s*access\.organization_id\s*=\s*caller_organization_id'
  ),
  'admin_list_operator_access WHERE clause restricts admin callers to their own organization'
);

select ok(
  (
    (select prosrc from pg_proc where oid = 'public.admin_list_operator_access()'::regprocedure)
    ~* 'organization\.id\s*=\s*access\.organization_id\s*\n\s*where'
  ),
  'admin_list_operator_access adds a WHERE clause right after the organization join (the old query went straight to ORDER BY, returning every row)'
);

select * from finish();

rollback;
