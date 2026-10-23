-- SPRINT S11 stage 2 (#147): Calendar and Evaluation follow permissions assigned to people.
-- The fixture is a tenant with no GEN or DIGEN unit: before this stage nobody could supervise it.
-- Three flat units: A (supervisor S), B (reviewer R) and C (director M, no permissions).
-- Behavioral test with throwaway fixtures, rolled back.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(33);

-- Structure ----------------------------------------------------------------------------------
select has_column('public', 'organization', 'evaluation_reviewers_can_self_evaluate',
  'organizations have the reviewers-may-self-evaluate setting');
select col_default_is('public', 'organization', 'evaluation_reviewers_can_self_evaluate', 'true',
  'by default reviewers may fill in their own unit evaluation, as before');
select ok(not has_function_privilege('anon', 'public.admin_set_evaluation_reviewers_can_self_evaluate(uuid,boolean)', 'execute'),
  'anon cannot change the setting');

-- Fixtures -----------------------------------------------------------------------------------
create temp table t_ids(k text primary key, id uuid not null default gen_random_uuid());
create temp table t_out(who text, k text, v text);
grant all on t_ids, t_out to authenticated;
insert into t_ids(k) values ('org'), ('period'), ('u_a'), ('u_b'), ('u_c'),
  ('admin'), ('s'), ('r'), ('m'), ('plan_c'), ('act_c'), ('obj_c'), ('ind_c'), ('eval_m_sub'), ('eval_r');
create function pg_temp.id(p_k text) returns uuid language sql stable as $$ select id from pg_temp.t_ids where k = p_k $$;
grant execute on function pg_temp.id(text) to authenticated;

insert into auth.users (id, email)
select gen_random_uuid(), e from unnest(array[
  's112-admin@example.test', 's112-s@example.test', 's112-r@example.test', 's112-m@example.test']) e;

insert into public.organization (id, code, name, contact_email)
values (pg_temp.id('org'), 's112-org', 'S11.2 tenant without GEN/DIGEN', 's112@example.test');

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at) values
  (pg_temp.id('admin'), 's112-admin@example.test', 'Admin', 'admin', pg_temp.id('org'), true, now()),
  (pg_temp.id('s'), 's112-s@example.test', 'Supervisor', 'operator', pg_temp.id('org'), true, now()),
  (pg_temp.id('r'), 's112-r@example.test', 'Reviewer', 'operator', pg_temp.id('org'), true, now()),
  (pg_temp.id('m'), 's112-m@example.test', 'Director C', 'operator', pg_temp.id('org'), true, now());

insert into public.organization_unit (id, organization_id, code, name, parent_unit_id, active) values
  (pg_temp.id('u_a'), pg_temp.id('org'), 'ADORACION', 'Adoración', null, true),
  (pg_temp.id('u_b'), pg_temp.id('org'), 'JOVENES', 'Jóvenes', null, true),
  (pg_temp.id('u_c'), pg_temp.id('org'), 'MUJERES', 'Mujeres', null, true);

insert into public.organization_unit_member (organization_id, unit_id, operator_access_id, unit_role, active) values
  (pg_temp.id('org'), pg_temp.id('u_a'), pg_temp.id('s'), 'director', true),
  (pg_temp.id('org'), pg_temp.id('u_b'), pg_temp.id('r'), 'director', true),
  (pg_temp.id('org'), pg_temp.id('u_c'), pg_temp.id('m'), 'director', true);

insert into public.management_period (id, organization_id, name, start_date, end_date)
values (pg_temp.id('period'), pg_temp.id('org'), 'Gestión test', date '2026-01-01', date '2026-12-31');
insert into public.unit_work_plan (id, organization_id, management_period_id, unit_id, title)
values (pg_temp.id('plan_c'), pg_temp.id('org'), pg_temp.id('period'), pg_temp.id('u_c'), 'Plan C');
insert into public.unit_work_activity (id, organization_id, work_plan_id, title, start_date)
values (pg_temp.id('act_c'), pg_temp.id('org'), pg_temp.id('plan_c'), 'Actividad C', date '2026-03-01');
insert into public.institutional_objective (id, organization_id, management_period_id, work_plan_id, code, title)
values (pg_temp.id('obj_c'), pg_temp.id('org'), pg_temp.id('period'), pg_temp.id('plan_c'), 'OC1', 'Objetivo C');
insert into public.management_indicator (id, organization_id, management_period_id, unit_id, name)
values (pg_temp.id('ind_c'), pg_temp.id('org'), pg_temp.id('period'), pg_temp.id('u_c'), 'Indicador C');

-- A complete, submitted evaluation by the director of C.
insert into public.executive_self_evaluation (id, organization_id, management_period_id, unit_id, evaluator_user_id,
  director_name, year_joined, period_number, location, competencies, status)
select pg_temp.id('eval_m_sub'), pg_temp.id('org'), pg_temp.id('period'), pg_temp.id('u_c'),
  (select id from auth.users where email = 's112-m@example.test'), 'Director C', 2020, 1, 'Sede',
  (select jsonb_object_agg(i::text, 'strength_high') from generate_series(1, 18) i), 'submitted';

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

create function pg_temp.keep(p_who text, p_k text, p_v text) returns void language sql as $$
  insert into pg_temp.t_out values (p_who, p_k, p_v) $$;

-- Records what one operator sees and may do.
create function pg_temp.snapshot(p_who text) returns void language plpgsql as $$
declare o jsonb; e jsonb;
begin
  o := public.calendar_access_overview(pg_temp.id('org'), pg_temp.id('period'));
  e := public.evaluation_access_overview(pg_temp.id('org'));
  perform pg_temp.keep(p_who, 'edit_all', o ->> 'can_edit_consolidated');
  perform pg_temp.keep(p_who, 'review_all', o ->> 'can_review_consolidated');
  perform pg_temp.keep(p_who, 'manage_plan_c', private.can_manage_calendar_plan(pg_temp.id('plan_c'))::text);
  perform pg_temp.keep(p_who, 'sees_plan_c', (select count(*)::text from public.unit_work_plan where id = pg_temp.id('plan_c')));
  perform pg_temp.keep(p_who, 'sees_obj_c', (select count(*)::text from public.institutional_objective where id = pg_temp.id('obj_c')));
  perform pg_temp.keep(p_who, 'sees_ind_c', (select count(*)::text from public.management_indicator where id = pg_temp.id('ind_c')));
  perform pg_temp.keep(p_who, 'sees_eval_m', (select count(*)::text from public.executive_self_evaluation where id = pg_temp.id('eval_m_sub')));
  perform pg_temp.keep(p_who, 'review_evals', e ->> 'can_review_all_evaluations');
  perform pg_temp.keep(p_who, 'is_reviewer', e ->> 'is_evaluation_reviewer');
  perform pg_temp.keep(p_who, 'director_units', (e -> 'director_unit_ids')::text);
end $$;
grant execute on all functions in schema pg_temp to authenticated;

create function pg_temp.v(p_who text, p_k text) returns text language sql as $$
  select v from pg_temp.t_out where who = p_who and k = p_k order by ctid desc limit 1 $$;

-- Before any permission: in a tenant without GEN/DIGEN nobody supervises -----------------------
select pg_temp.act_as('s112-s@example.test'); set local role authenticated;
select pg_temp.snapshot('s_before');
reset role;

-- The tenant admin assigns permissions --------------------------------------------------------
select pg_temp.act_as('s112-admin@example.test'); set local role authenticated;
select public.admin_set_operator_permissions(pg_temp.id('org'), pg_temp.id('s'), array['calendar.manage_all', 'management.read_all']);
select public.admin_set_operator_permissions(pg_temp.id('org'), pg_temp.id('r'), array['evaluations.review']);
reset role;

-- Supervisor S: calendar of every unit.
select pg_temp.act_as('s112-s@example.test'); set local role authenticated;
select pg_temp.snapshot('s');
select pg_temp.try('s', 'review', format('select public.review_calendar_activity(%L, %L)', pg_temp.id('act_c'), 'validated'));
select pg_temp.try('s', 'joint', format('select public.set_calendar_joint_review(%L, true)', pg_temp.id('period')));
select pg_temp.try('s', 'edit', format('update public.unit_work_activity set title = %L where id = %L', 'Editada por S', pg_temp.id('act_c')));
reset role;

-- Reviewer R: reads submitted evaluations, no calendar supervision.
select pg_temp.act_as('s112-r@example.test'); set local role authenticated;
select pg_temp.snapshot('r');
select pg_temp.try('r', 'review', format('select public.review_calendar_activity(%L, %L)', pg_temp.id('act_c'), 'observed'));
select pg_temp.try('r', 'own_draft', format(
  'insert into public.executive_self_evaluation (id, organization_id, management_period_id, unit_id, director_name) values (%L, %L, %L, %L, %L)',
  pg_temp.id('eval_r'), pg_temp.id('org'), pg_temp.id('period'), pg_temp.id('u_b'), 'Reviewer'));
reset role;

-- Director M: its own unit only.
select pg_temp.act_as('s112-m@example.test'); set local role authenticated;
select pg_temp.snapshot('m');
select pg_temp.try('m', 'review', format('select public.review_calendar_activity(%L, %L)', pg_temp.id('act_c'), 'validated'));
reset role;

-- The tenant switches the setting off: reviewers only receive results.
select pg_temp.act_as('s112-m@example.test'); set local role authenticated;
select pg_temp.try('m', 'setting', format('select public.admin_set_evaluation_reviewers_can_self_evaluate(%L, false)', pg_temp.id('org')));
reset role;
select pg_temp.act_as('s112-admin@example.test'); set local role authenticated;
select pg_temp.try('admin', 'setting', format('select public.admin_set_evaluation_reviewers_can_self_evaluate(%L, false)', pg_temp.id('org')));
reset role;
select pg_temp.act_as('s112-r@example.test'); set local role authenticated;
select pg_temp.snapshot('r_off');
select pg_temp.try('r', 'own_draft_off', format(
  'update public.executive_self_evaluation set director_name = %L where id = %L', 'Reviewer edited', pg_temp.id('eval_r')));
select pg_temp.keep('r', 'draft_after_off', (select director_name from public.executive_self_evaluation where id = pg_temp.id('eval_r')));
reset role;
select pg_temp.act_as('s112-m@example.test'); set local role authenticated;
select pg_temp.snapshot('m_off');
reset role;

-- Removing the permission removes the supervision.
select pg_temp.act_as('s112-admin@example.test'); set local role authenticated;
select public.admin_set_operator_permissions(pg_temp.id('org'), pg_temp.id('s'), array[]::text[]);
reset role;
select pg_temp.act_as('s112-s@example.test'); set local role authenticated;
select pg_temp.snapshot('s_removed');
reset role;

-- Assertions ---------------------------------------------------------------------------------
select is(pg_temp.v('s_before', 'edit_all'), 'false', 'without permissions nobody edits every unit calendar');
select is(pg_temp.v('s_before', 'sees_plan_c'), '0', 'without permissions another unit plan stays hidden');

select is(pg_temp.v('s', 'edit_all'), 'true', 'calendar.manage_all edits every unit calendar');
select is(pg_temp.v('s', 'review_all'), 'true', 'calendar.manage_all reviews every unit calendar');
select is(pg_temp.v('s', 'manage_plan_c'), 'true', 'calendar.manage_all manages another unit plan');
select is(pg_temp.v('s', 'review'), 'ok', 'calendar.manage_all validates another unit activity');
select is(pg_temp.v('s', 'joint'), 'ok', 'calendar.manage_all switches the shared view');
select is((select title from public.unit_work_activity where id = pg_temp.id('act_c')), 'Editada por S',
  'calendar.manage_all edits another unit activity');
select is(pg_temp.v('s', 'sees_plan_c'), '1', 'calendar.manage_all reads another unit plan');
select is(pg_temp.v('s', 'sees_obj_c'), '1', 'management.read_all reads another unit objective');
select is(pg_temp.v('s', 'sees_ind_c'), '1', 'management.read_all reads another unit indicator');
select is(pg_temp.v('s', 'sees_eval_m'), '0', 'calendar supervision alone does not read evaluations');

select is(pg_temp.v('r', 'review_evals'), 'true', 'evaluations.review receives the evaluations');
select is(pg_temp.v('r', 'is_reviewer'), 'true', 'the overview flags the reviewer');
select is(pg_temp.v('r', 'sees_eval_m'), '1', 'evaluations.review reads a submitted evaluation of another unit');
select is(pg_temp.v('r', 'edit_all'), 'false', 'evaluations.review alone does not edit the calendar');
select is(pg_temp.v('r', 'review'), '42501', 'evaluations.review alone does not validate activities');
select is(pg_temp.v('r', 'own_draft'), 'ok', 'with the default setting a reviewer still fills in its own unit evaluation');

select is(pg_temp.v('m', 'edit_all'), 'false', 'a director without permissions edits only its unit');
select is(pg_temp.v('m', 'review'), '42501', 'a leaf director without permissions does not validate');
select is(pg_temp.v('m', 'sees_eval_m'), '1', 'the author reads its own submitted evaluation');

select is(pg_temp.v('m', 'setting'), '42501', 'only the tenant admin changes the setting');
select is(pg_temp.v('admin', 'setting'), 'ok', 'the tenant admin changes the setting');
select is(pg_temp.v('r_off', 'director_units'), '[]', 'with the setting off a reviewer is offered no unit to evaluate');
select is(pg_temp.v('r_off', 'review_evals'), 'true', 'with the setting off a reviewer still receives evaluations');
select is(pg_temp.v('r', 'draft_after_off'), null, 'with the setting off a reviewer no longer reads or edits its own draft');
select is((select director_name from public.executive_self_evaluation where id = pg_temp.id('eval_r')), 'Reviewer',
  'with the setting off the reviewer draft stays unchanged');
select is(pg_temp.v('m_off', 'director_units'), format('["%s"]', pg_temp.id('u_c')),
  'the setting does not affect directors without the review permission');

select is(pg_temp.v('s_removed', 'edit_all'), 'false', 'removing calendar.manage_all removes calendar supervision');
select is(pg_temp.v('s_removed', 'sees_plan_c'), '0', 'removing the permissions hides another unit plan again');

select * from finish();
rollback;
