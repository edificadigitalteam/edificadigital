-- SPRINT S10.1/S10.2 (#136): calendar_access_overview flags match what the review RPCs allow.
-- Since 20261022150000 the tenant admin edits, reviews and controls the shared view of every
-- unit; GEN/DIGEN leaders and supervising units keep reviewing; a leaf-unit director does not.
-- Behavioral test with throwaway fixtures, rolled back.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(24);

-- Fixtures -------------------------------------------------------------------------------
create temp table t_ids(k text primary key, id uuid not null);
create temp table t_out(who text, k text, v text);
grant all on t_ids, t_out to authenticated;

insert into t_ids values
  ('org', gen_random_uuid()), ('period', gen_random_uuid()),
  ('u_gen', gen_random_uuid()), ('u_digen', gen_random_uuid()),
  ('u_dime', gen_random_uuid()), ('u_fbcc', gen_random_uuid()),
  ('a_admin', gen_random_uuid()), ('a_digen', gen_random_uuid()),
  ('a_gen', gen_random_uuid()), ('a_dime', gen_random_uuid()),
  ('plan_dime', gen_random_uuid()), ('plan_fbcc', gen_random_uuid()),
  ('act_dime', gen_random_uuid()), ('act_fbcc', gen_random_uuid());

create temp view v_ids as select
  max(id::text) filter (where k='org')::uuid org, max(id::text) filter (where k='period')::uuid period,
  max(id::text) filter (where k='u_gen')::uuid u_gen, max(id::text) filter (where k='u_digen')::uuid u_digen,
  max(id::text) filter (where k='u_dime')::uuid u_dime, max(id::text) filter (where k='u_fbcc')::uuid u_fbcc,
  max(id::text) filter (where k='plan_dime')::uuid plan_dime, max(id::text) filter (where k='plan_fbcc')::uuid plan_fbcc,
  max(id::text) filter (where k='act_dime')::uuid act_dime, max(id::text) filter (where k='act_fbcc')::uuid act_fbcc
from t_ids;
grant select on v_ids to authenticated;

insert into auth.users (id, email)
select gen_random_uuid(), e from unnest(array[
  's101-admin@example.test','s101-digen@example.test','s101-gen@example.test','s101-dime@example.test']) e;

insert into public.organization (id, code, name, contact_email)
select org, 's101-test-org', 'S10.1 test org', 's101-contact@example.test' from v_ids;

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at)
select (select id from t_ids where k='a_admin'), 's101-admin@example.test', 'Admin', 'admin', org, true, now() from v_ids
union all select (select id from t_ids where k='a_digen'), 's101-digen@example.test', 'DIGEN director', 'operator', org, true, now() from v_ids
union all select (select id from t_ids where k='a_gen'), 's101-gen@example.test', 'GEN reviewer', 'operator', org, true, now() from v_ids
union all select (select id from t_ids where k='a_dime'), 's101-dime@example.test', 'DIME director', 'operator', org, true, now() from v_ids;

insert into public.organization_unit (id, organization_id, code, name, parent_unit_id, active)
select u_gen, org, 'GEN', 'Dirección General', null, true from v_ids
union all select u_digen, org, 'DIGEN', 'DIGEN', u_gen, true from v_ids
union all select u_dime, org, 'DIME', 'DIME', u_digen, true from v_ids
union all select u_fbcc, org, 'FBCC', 'FBCC', u_gen, true from v_ids;

insert into public.organization_unit_member (organization_id, unit_id, operator_access_id, unit_role, active)
select org, u_digen, (select id from t_ids where k='a_digen'), 'director', true from v_ids
union all select org, u_gen, (select id from t_ids where k='a_gen'), 'reviewer', true from v_ids
union all select org, u_dime, (select id from t_ids where k='a_dime'), 'director', true from v_ids;

insert into public.management_period (id, organization_id, name, start_date, end_date)
select period, org, 'Gestión test', date '2026-01-01', date '2026-12-31' from v_ids;

insert into public.unit_work_plan (id, organization_id, management_period_id, unit_id, title)
select plan_dime, org, period, u_dime, 'Plan DIME' from v_ids
union all select plan_fbcc, org, period, u_fbcc, 'Plan FBCC' from v_ids;

insert into public.unit_work_activity (id, organization_id, work_plan_id, title, start_date)
select act_dime, org, plan_dime, 'Actividad DIME', date '2026-03-01' from v_ids
union all select act_fbcc, org, plan_fbcc, 'Actividad FBCC', date '2026-03-02' from v_ids;

-- Acts as one operator: authenticated role plus the JWT claims auth.uid()/auth.jwt() read.
create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

-- Records the overview flags, or the SQLSTATE of an RPC call, for one operator.
create function pg_temp.capture(p_who text) returns void language plpgsql as $$
declare o jsonb; ids record;
begin
  select * into ids from pg_temp.v_ids;
  o := public.calendar_access_overview(ids.org, ids.period);
  insert into pg_temp.t_out select p_who, key, value::text from jsonb_each(o)
    where key in ('can_review','can_manage_joint_review','can_review_consolidated','can_edit_consolidated','can_view_consolidated');
end $$;

create function pg_temp.try(p_who text, p_k text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into pg_temp.t_out values (p_who, p_k, 'ok');
exception when others then
  insert into pg_temp.t_out values (p_who, p_k, sqlstate);
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- Tenant admin without unit membership.
select pg_temp.act_as('s101-admin@example.test');
set local role authenticated;
select pg_temp.capture('admin');
select pg_temp.try('admin', 'review', format('select public.review_calendar_activity(%L, %L)', (select act_dime from pg_temp.v_ids), 'validated'));
select pg_temp.try('admin', 'joint', format('select public.set_calendar_joint_review(%L, true)', (select period from pg_temp.v_ids)));
update public.unit_work_activity set title = 'Editada por admin' where id = (select act_fbcc from pg_temp.v_ids);
reset role;

-- DIGEN director: reviews FBCC, outside its hierarchy, as an institutional supervisor.
select pg_temp.act_as('s101-digen@example.test');
set local role authenticated;
select pg_temp.capture('digen');
select pg_temp.try('digen', 'review', format('select public.review_calendar_activity(%L, %L)', (select act_fbcc from pg_temp.v_ids), 'validated'));
reset role;

-- GEN reviewer: controls the shared view.
select pg_temp.act_as('s101-gen@example.test');
set local role authenticated;
select pg_temp.capture('gen');
select pg_temp.try('gen', 'joint', format('select public.set_calendar_joint_review(%L, true)', (select period from pg_temp.v_ids)));
reset role;

-- DIME director: own unit only.
select pg_temp.act_as('s101-dime@example.test');
set local role authenticated;
select pg_temp.capture('dime');
reset role;

-- Assertions -----------------------------------------------------------------------------
create function pg_temp.flag(p_who text, p_k text) returns text language sql as $$
  select v from pg_temp.t_out where who = p_who and k = p_k $$;

select is(pg_temp.flag('admin','can_edit_consolidated'), 'true', 'admin keeps cross-unit calendar editing');
select is(pg_temp.flag('admin','can_view_consolidated'), 'true', 'admin keeps the consolidated view');
select is(pg_temp.flag('admin','can_review'), 'true', 'admin without unit membership is offered review');
select is(pg_temp.flag('admin','can_manage_joint_review'), 'true', 'admin is offered the shared-view switch');
select is(pg_temp.flag('admin','can_review_consolidated'), 'true', 'admin reviews every unit');
select is(pg_temp.flag('admin','review'), 'ok', 'review_calendar_activity accepts the admin');
select is(pg_temp.flag('admin','joint'), 'ok', 'set_calendar_joint_review accepts the admin');
select is((select title from public.unit_work_activity where id = (select act_fbcc from pg_temp.v_ids)),
  'Editada por admin', 'admin still edits another unit''s activity (20261008145936 preserved)');

select is(pg_temp.flag('digen','can_review'), 'true', 'DIGEN director is offered review');
select is(pg_temp.flag('digen','can_review_consolidated'), 'true', 'DIGEN director reviews every unit');
select is(pg_temp.flag('digen','can_manage_joint_review'), 'true', 'DIGEN director controls the shared view');
select is(pg_temp.flag('digen','can_edit_consolidated'), 'true', 'DIGEN director edits every unit');
select is(pg_temp.flag('digen','review'), 'ok', 'DIGEN director validates an activity outside its hierarchy');
select is((select review_status from public.unit_work_activity where id = (select act_fbcc from pg_temp.v_ids)),
  'validated', 'the DIGEN review was stored');

select is(pg_temp.flag('gen','can_review_consolidated'), 'true', 'GEN reviewer reviews every unit');
select is(pg_temp.flag('gen','can_manage_joint_review'), 'true', 'GEN reviewer controls the shared view');
select is(pg_temp.flag('gen','joint'), 'ok', 'GEN reviewer enables the shared view');

select is(pg_temp.flag('dime','can_review'), 'false', 'a leaf-unit director is not offered review');
select is(pg_temp.flag('dime','can_review_consolidated'), 'false', 'a leaf-unit director is not an institutional reviewer');
select is(pg_temp.flag('dime','can_edit_consolidated'), 'false', 'a leaf-unit director edits only its own unit');
select is(pg_temp.flag('dime','can_manage_joint_review'), 'false', 'a leaf-unit director cannot switch the shared view');

select ok(not has_function_privilege('anon', 'public.calendar_access_overview(uuid,uuid)', 'execute'),
  'anon cannot execute calendar_access_overview');
select ok(has_function_privilege('authenticated', 'public.calendar_access_overview(uuid,uuid)', 'execute'),
  'authenticated can execute calendar_access_overview');
select ok((select prosecdef from pg_proc where oid = 'public.calendar_access_overview(uuid,uuid)'::regprocedure),
  'calendar_access_overview stays security definer');

select * from finish();
rollback;
