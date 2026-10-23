-- SPRINT S11 stage 1 (#147): supervision permissions assigned to people.
-- Adds private.operator_permission, private.current_operator_has_permission, the admin RPCs and
-- the initial load. No access rule reads the permissions yet: the legacy GEN/DIGEN helpers stay
-- in charge, and the initial load must reproduce exactly who they authorize today.
-- Behavioral test with throwaway fixtures, rolled back.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(29);

-- Structure and privileges ------------------------------------------------------------------
select has_table('private', 'operator_permission', 'private.operator_permission exists');
select ok(not has_table_privilege('anon', 'private.operator_permission', 'select'), 'anon cannot read operator_permission');
select ok(not has_table_privilege('authenticated', 'private.operator_permission', 'select')
  and not has_table_privilege('authenticated', 'private.operator_permission', 'insert'),
  'authenticated cannot read or write operator_permission directly');
select is(private.supervision_permissions(),
  array['calendar.manage_all', 'evaluations.review', 'instructions.issue', 'management.read_all'],
  'the platform defines four supervision permissions');
select ok(has_function_privilege('authenticated', 'private.current_operator_has_permission(uuid,text)', 'execute')
  and not has_function_privilege('anon', 'private.current_operator_has_permission(uuid,text)', 'execute'),
  'authenticated, and not anon, can execute current_operator_has_permission');
select ok(not has_function_privilege('anon', 'public.admin_list_operator_permissions(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.admin_set_operator_permissions(uuid,uuid,text[])', 'execute'),
  'anon cannot execute the admin permission RPCs');
select ok(not has_function_privilege('authenticated', 'private.backfill_supervision_permissions()', 'execute'),
  'authenticated cannot run the initial load');

-- Fixtures -----------------------------------------------------------------------------------
create temp table t_ids(k text primary key, id uuid not null default gen_random_uuid());
create temp table t_out(who text, k text, v text);
grant all on t_ids, t_out to authenticated;
insert into t_ids(k) values ('org_a'), ('org_b'), ('u_gen'), ('u_digen'), ('u_dime'), ('u_b'),
  ('a_admin'), ('a_digen'), ('a_gen_mgr'), ('a_gen_op'), ('a_dime'), ('b_admin'), ('b_op');
create function pg_temp.id(p_k text) returns uuid language sql stable as $$ select id from pg_temp.t_ids where k = p_k $$;
grant execute on function pg_temp.id(text) to authenticated;

insert into auth.users (id, email)
select gen_random_uuid(), e from unnest(array[
  's11-admin@example.test', 's11-digen@example.test', 's11-genmgr@example.test', 's11-genop@example.test',
  's11-dime@example.test', 's11-badmin@example.test', 's11-bop@example.test']) e;

insert into public.organization (id, code, name, contact_email) values
  (pg_temp.id('org_a'), 's11-org-a', 'S11 org A', 's11-a@example.test'),
  (pg_temp.id('org_b'), 's11-org-b', 'S11 org B', 's11-b@example.test');

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at) values
  (pg_temp.id('a_admin'), 's11-admin@example.test', 'Admin A', 'admin', pg_temp.id('org_a'), true, now()),
  (pg_temp.id('a_digen'), 's11-digen@example.test', 'DIGEN director', 'operator', pg_temp.id('org_a'), true, now()),
  (pg_temp.id('a_gen_mgr'), 's11-genmgr@example.test', 'GEN manager', 'operator', pg_temp.id('org_a'), true, now()),
  (pg_temp.id('a_gen_op'), 's11-genop@example.test', 'GEN operator', 'operator', pg_temp.id('org_a'), true, now()),
  (pg_temp.id('a_dime'), 's11-dime@example.test', 'DIME director', 'operator', pg_temp.id('org_a'), true, now()),
  (pg_temp.id('b_admin'), 's11-badmin@example.test', 'Admin B', 'admin', pg_temp.id('org_b'), true, now()),
  (pg_temp.id('b_op'), 's11-bop@example.test', 'Operator B', 'operator', pg_temp.id('org_b'), true, now());

insert into public.organization_unit (id, organization_id, code, name, parent_unit_id, active) values
  (pg_temp.id('u_gen'), pg_temp.id('org_a'), 'GEN', 'Dirección General', null, true),
  (pg_temp.id('u_digen'), pg_temp.id('org_a'), 'DIGEN', 'DIGEN', pg_temp.id('u_gen'), true),
  (pg_temp.id('u_dime'), pg_temp.id('org_a'), 'DIME', 'DIME', pg_temp.id('u_digen'), true),
  (pg_temp.id('u_b'), pg_temp.id('org_b'), 'ADORACION', 'Adoración', null, true);

insert into public.organization_unit_member (organization_id, unit_id, operator_access_id, unit_role, active) values
  (pg_temp.id('org_a'), pg_temp.id('u_digen'), pg_temp.id('a_digen'), 'director', true),
  (pg_temp.id('org_a'), pg_temp.id('u_gen'), pg_temp.id('a_gen_mgr'), 'manager', true),
  (pg_temp.id('org_a'), pg_temp.id('u_gen'), pg_temp.id('a_gen_op'), 'operator', true),
  (pg_temp.id('org_a'), pg_temp.id('u_dime'), pg_temp.id('a_dime'), 'director', true),
  (pg_temp.id('org_b'), pg_temp.id('u_b'), pg_temp.id('b_op'), 'director', true);

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.try(p_who text, p_k text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into pg_temp.t_out values (p_who, p_k, 'ok');
exception when others then
  insert into pg_temp.t_out values (p_who, p_k, sqlstate);
end $$;

-- Records, for the current operator, what the legacy helpers and the new permissions say.
create function pg_temp.snapshot(p_who text) returns void language plpgsql as $$
declare a uuid := pg_temp.id('org_a');
begin
  insert into pg_temp.t_out values
    (p_who, 'legacy_leader', private.current_operator_is_gen_or_digen_leader(a)::text),
    (p_who, 'legacy_digen', private.current_operator_is_digen_director(a)::text),
    (p_who, 'perm_calendar', private.current_operator_has_permission(a, 'calendar.manage_all')::text),
    (p_who, 'perm_review', private.current_operator_has_permission(a, 'evaluations.review')::text),
    (p_who, 'perm_read', private.current_operator_has_permission(a, 'management.read_all')::text),
    (p_who, 'perm_issue', private.current_operator_has_permission(a, 'instructions.issue')::text),
    (p_who, 'perm_issue_org_b', private.current_operator_has_permission(pg_temp.id('org_b'), 'instructions.issue')::text);
end $$;
grant execute on all functions in schema pg_temp to authenticated;

create function pg_temp.v(p_who text, p_k text) returns text language sql as $$
  select v from pg_temp.t_out where who = p_who and k = p_k $$;

-- Initial load -------------------------------------------------------------------------------
select is(private.backfill_supervision_permissions(), 10,
  'the initial load grants 10 permissions: 4 to the DIGEN director and 3 to each GEN leader');
select is(private.backfill_supervision_permissions(), 0, 'running the initial load again changes nothing');
select is(
  array(select permission from private.operator_permission where operator_access_id = pg_temp.id('a_digen') order by 1),
  array['calendar.manage_all', 'evaluations.review', 'instructions.issue', 'management.read_all'],
  'the DIGEN director receives all four permissions');
select is(
  array(select permission from private.operator_permission where operator_access_id = pg_temp.id('a_gen_mgr') order by 1),
  array['calendar.manage_all', 'evaluations.review', 'management.read_all'],
  'a GEN leader receives every permission except issuing instructions');
select is((select count(*)::int from private.operator_permission
  where operator_access_id in (pg_temp.id('a_dime'), pg_temp.id('a_admin'), pg_temp.id('b_op'), pg_temp.id('b_admin'))), 0,
  'directors of other units, admins and other organizations receive nothing');

-- Snapshot: the new permissions authorize exactly who the legacy helpers authorize -----------
select pg_temp.act_as('s11-digen@example.test'); set local role authenticated; select pg_temp.snapshot('digen'); reset role;
select pg_temp.act_as('s11-genmgr@example.test'); set local role authenticated; select pg_temp.snapshot('gen_mgr'); reset role;
select pg_temp.act_as('s11-genop@example.test'); set local role authenticated; select pg_temp.snapshot('gen_op'); reset role;
select pg_temp.act_as('s11-dime@example.test'); set local role authenticated; select pg_temp.snapshot('dime'); reset role;
select pg_temp.act_as('s11-admin@example.test'); set local role authenticated; select pg_temp.snapshot('admin'); reset role;

select is(
  array(select who from pg_temp.t_out l where l.k = 'legacy_leader'
    and (l.v is distinct from pg_temp.v(l.who, 'perm_calendar')
      or l.v is distinct from pg_temp.v(l.who, 'perm_review')
      or l.v is distinct from pg_temp.v(l.who, 'perm_read')) order by 1),
  array[]::text[],
  'calendar, review and read permissions match the legacy GEN/DIGEN leader check for every person');
select is(
  array(select who from pg_temp.t_out l where l.k = 'legacy_digen'
    and l.v is distinct from pg_temp.v(l.who, 'perm_issue') order by 1),
  array[]::text[],
  'the instructions permission matches the legacy DIGEN director check for every person');
select is(pg_temp.v('digen', 'perm_issue'), 'true', 'the DIGEN director may issue instructions');
select is(pg_temp.v('gen_op', 'perm_calendar'), 'true', 'a GEN operator keeps calendar supervision, as today');
select is(pg_temp.v('dime', 'perm_calendar'), 'false', 'a leaf-unit director has no supervision permission');
select is(pg_temp.v('digen', 'perm_issue_org_b'), 'false', 'a permission in one organization grants nothing in another');

-- Admin RPCs ---------------------------------------------------------------------------------
select pg_temp.act_as('s11-admin@example.test');
set local role authenticated;
select pg_temp.try('admin', 'set', format('select public.admin_set_operator_permissions(%L, %L, %L)',
  pg_temp.id('org_a'), pg_temp.id('a_dime'), array['calendar.manage_all', 'evaluations.review']));
select pg_temp.try('admin', 'remove', format('select public.admin_set_operator_permissions(%L, %L, %L)',
  pg_temp.id('org_a'), pg_temp.id('a_gen_op'), array[]::text[]));
select pg_temp.try('admin', 'unknown', format('select public.admin_set_operator_permissions(%L, %L, %L)',
  pg_temp.id('org_a'), pg_temp.id('a_dime'), array['calendar.manage_all', 'billing.manage']));
select pg_temp.try('admin', 'foreign_operator', format('select public.admin_set_operator_permissions(%L, %L, %L)',
  pg_temp.id('org_a'), pg_temp.id('b_op'), array['calendar.manage_all']));
insert into pg_temp.t_out
select 'admin', 'listed', (
  select a ->> 'permissions' from jsonb_array_elements(public.admin_list_operator_permissions(pg_temp.id('org_a')) -> 'assignments') a
  where (a ->> 'operator_access_id')::uuid = pg_temp.id('a_dime'));
reset role;

select pg_temp.act_as('s11-dime@example.test');
set local role authenticated;
select pg_temp.try('dime', 'set', format('select public.admin_set_operator_permissions(%L, %L, %L)',
  pg_temp.id('org_a'), pg_temp.id('a_dime'), array['instructions.issue']));
select pg_temp.try('dime', 'list', format('select public.admin_list_operator_permissions(%L)', pg_temp.id('org_a')));
reset role;

select pg_temp.act_as('s11-badmin@example.test');
set local role authenticated;
select pg_temp.try('b_admin', 'set_other_org', format('select public.admin_set_operator_permissions(%L, %L, %L)',
  pg_temp.id('org_a'), pg_temp.id('a_dime'), array['instructions.issue']));
reset role;

select is(pg_temp.v('admin', 'set'), 'ok', 'the tenant admin assigns permissions to a person of its organization');
select is(
  array(select permission from private.operator_permission where operator_access_id = pg_temp.id('a_dime') order by 1),
  array['calendar.manage_all', 'evaluations.review'],
  'the assigned permissions are stored');
select is(pg_temp.v('admin', 'remove'), 'ok', 'the tenant admin removes every permission with an empty list');
select is((select count(*)::int from private.operator_permission where operator_access_id = pg_temp.id('a_gen_op')), 0,
  'an empty list leaves the person without permissions');
select is(pg_temp.v('admin', 'unknown'), '22023', 'an unknown permission is rejected');
select is(pg_temp.v('admin', 'foreign_operator'), 'P0002', 'a person of another organization is rejected');
select is(pg_temp.v('admin', 'listed'), '["calendar.manage_all", "evaluations.review"]', 'the admin lists the permissions of each person');
select is(pg_temp.v('dime', 'set'), '42501', 'a non-admin cannot assign permissions, not even to itself');
select is(pg_temp.v('dime', 'list'), '42501', 'a non-admin cannot list permissions');
select is(pg_temp.v('b_admin', 'set_other_org'), '42501', 'an admin cannot assign permissions in another organization');
select ok(exists(select 1 from private.record_change_log where table_schema = 'private' and table_name = 'operator_permission'
  and operation = 'DELETE' and (old_data ->> 'operator_access_id')::uuid = pg_temp.id('a_gen_op')),
  'every permission change is recorded in record_change_log');

select * from finish();
rollback;
