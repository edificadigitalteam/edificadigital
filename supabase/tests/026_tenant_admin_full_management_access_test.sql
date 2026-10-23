-- SPRINT S10.2 (#136): the tenant admin acts without restrictions in Calendar (delete),
-- Pending issues (DIGEN instructions) and Evaluation (drafts). Every earlier restriction for
-- non-admins is asserted too. Behavioral test with throwaway fixtures, rolled back.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(24);

-- Fixtures -------------------------------------------------------------------------------
create temp table t_ids(k text primary key, id uuid not null);
create temp table t_out(who text, k text, v text);
grant all on t_ids, t_out to authenticated;

insert into t_ids values
  ('org', gen_random_uuid()), ('period', gen_random_uuid()),
  ('u_gen', gen_random_uuid()), ('u_digen', gen_random_uuid()), ('u_dime', gen_random_uuid()),
  ('a_admin', gen_random_uuid()), ('a_digen', gen_random_uuid()), ('a_dime', gen_random_uuid()),
  ('plan_dime', gen_random_uuid()), ('act_1', gen_random_uuid()), ('act_2', gen_random_uuid()),
  ('act_3', gen_random_uuid()), ('instr', gen_random_uuid()), ('eval', gen_random_uuid());

create temp view v_ids as select
  max(id::text) filter (where k='org')::uuid org, max(id::text) filter (where k='period')::uuid period,
  max(id::text) filter (where k='u_gen')::uuid u_gen, max(id::text) filter (where k='u_digen')::uuid u_digen,
  max(id::text) filter (where k='u_dime')::uuid u_dime, max(id::text) filter (where k='plan_dime')::uuid plan_dime,
  max(id::text) filter (where k='act_1')::uuid act_1, max(id::text) filter (where k='act_2')::uuid act_2,
  max(id::text) filter (where k='act_3')::uuid act_3, max(id::text) filter (where k='instr')::uuid instr,
  max(id::text) filter (where k='eval')::uuid eval
from t_ids;
grant select on v_ids to authenticated;

insert into auth.users (id, email)
select gen_random_uuid(), e from unnest(array[
  's102-admin@example.test','s102-digen@example.test','s102-dime@example.test']) e;

insert into public.organization (id, code, name, contact_email)
select org, 's102-test-org', 'S10.2 test org', 's102-contact@example.test' from v_ids;

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at)
select (select id from t_ids where k='a_admin'), 's102-admin@example.test', 'Admin', 'admin', org, true, now() from v_ids
union all select (select id from t_ids where k='a_digen'), 's102-digen@example.test', 'DIGEN director', 'operator', org, true, now() from v_ids
union all select (select id from t_ids where k='a_dime'), 's102-dime@example.test', 'DIME director', 'operator', org, true, now() from v_ids;

insert into public.organization_unit (id, organization_id, code, name, parent_unit_id, active)
select u_gen, org, 'GEN', 'Dirección General', null, true from v_ids
union all select u_digen, org, 'DIGEN', 'DIGEN', u_gen, true from v_ids
union all select u_dime, org, 'DIME', 'DIME', u_digen, true from v_ids;

insert into public.organization_unit_member (organization_id, unit_id, operator_access_id, unit_role, active)
select org, u_digen, (select id from t_ids where k='a_digen'), 'director', true from v_ids
union all select org, u_dime, (select id from t_ids where k='a_dime'), 'director', true from v_ids;

insert into public.management_period (id, organization_id, name, start_date, end_date)
select period, org, 'Gestión test', date '2026-01-01', date '2026-12-31' from v_ids;

insert into public.unit_work_plan (id, organization_id, management_period_id, unit_id, title)
select plan_dime, org, period, u_dime, 'Plan DIME' from v_ids;

insert into public.unit_work_activity (id, organization_id, work_plan_id, title, start_date)
select act_1, org, plan_dime, 'Actividad 1', date '2026-03-01' from v_ids
union all select act_2, org, plan_dime, 'Actividad 2', date '2026-03-02' from v_ids
union all select act_3, org, plan_dime, 'Actividad 3', date '2026-03-03' from v_ids;

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

-- Runs a statement; records 'ok' or its SQLSTATE.
create function pg_temp.try(p_who text, p_k text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into pg_temp.t_out values (p_who, p_k, 'ok');
exception when others then
  insert into pg_temp.t_out values (p_who, p_k, sqlstate);
end $$;

-- Records a value computed while acting as the operator.
create function pg_temp.keep(p_who text, p_k text, p_v text) returns void language sql as $$
  insert into pg_temp.t_out values (p_who, p_k, p_v) $$;
grant execute on all functions in schema pg_temp to authenticated;

-- DIME director: writes an evaluation draft and checks its own instruction rights.
select pg_temp.act_as('s102-dime@example.test');
set local role authenticated;
select pg_temp.try('dime', 'eval_draft', format(
  'insert into public.executive_self_evaluation (id, organization_id, management_period_id, unit_id, director_name) values (%L, %L, %L, %L, %L)',
  (select eval from pg_temp.v_ids), (select org from pg_temp.v_ids), (select period from pg_temp.v_ids), (select u_dime from pg_temp.v_ids), 'DIME director'));
select pg_temp.keep('dime', 'can_issue', (public.pending_issue_access_overview((select org from pg_temp.v_ids)) ->> 'can_issue_instructions'));
select pg_temp.try('dime', 'issue', format(
  'insert into public.unit_pending_issue (organization_id, management_period_id, unit_id, title, description, origin) values (%L, %L, %L, %L, %L, %L)',
  (select org from pg_temp.v_ids), (select period from pg_temp.v_ids), (select u_dime from pg_temp.v_ids), 'x', 'x', 'digen_instruction'));
reset role;

-- Tenant admin without unit membership.
select pg_temp.act_as('s102-admin@example.test');
set local role authenticated;
select pg_temp.keep('admin', 'can_issue', (public.pending_issue_access_overview((select org from pg_temp.v_ids)) ->> 'can_issue_instructions'));
select pg_temp.keep('admin', 'targets', (public.pending_issue_access_overview((select org from pg_temp.v_ids)) -> 'instruction_target_unit_ids')::text);
select pg_temp.try('admin', 'issue', format(
  'insert into public.unit_pending_issue (id, organization_id, management_period_id, unit_id, title, description, origin) values (%L, %L, %L, %L, %L, %L, %L)',
  (select instr from pg_temp.v_ids), (select org from pg_temp.v_ids), (select period from pg_temp.v_ids), (select u_dime from pg_temp.v_ids),
  'Instrucción del admin', 'Detalle', 'digen_instruction'));
select pg_temp.try('admin', 'rewrite', format(
  'update public.unit_pending_issue set title = %L where id = %L', 'Instrucción reescrita', (select instr from pg_temp.v_ids)));
select pg_temp.keep('admin', 'del_flag', (public.calendar_access_overview((select org from pg_temp.v_ids), (select period from pg_temp.v_ids)) ->> 'can_delete_consolidated'));
delete from public.unit_work_activity where id = (select act_1 from pg_temp.v_ids);
select pg_temp.keep('admin', 'eval_rows', (select count(*)::text from public.executive_self_evaluation where id = (select eval from pg_temp.v_ids)));
select pg_temp.keep('admin', 'eval_drafts_flag', (public.evaluation_access_overview((select org from pg_temp.v_ids)) ->> 'can_read_draft_evaluations'));
select pg_temp.keep('admin', 'eval_all_flag', (public.evaluation_access_overview((select org from pg_temp.v_ids)) ->> 'can_review_all_evaluations'));
update public.executive_self_evaluation set director_name = 'Cambiado por admin' where id = (select eval from pg_temp.v_ids);
reset role;

-- DIME director again: the assigned unit only changes the instruction status.
select pg_temp.act_as('s102-dime@example.test');
set local role authenticated;
select pg_temp.try('dime', 'status', format(
  'update public.unit_pending_issue set status = %L where id = %L', 'in_progress', (select instr from pg_temp.v_ids)));
select pg_temp.try('dime', 'rewrite', format(
  'update public.unit_pending_issue set title = %L where id = %L', 'Cambio no permitido', (select instr from pg_temp.v_ids)));
delete from public.unit_pending_issue where id = (select instr from pg_temp.v_ids);
delete from public.unit_work_activity where id = (select act_2 from pg_temp.v_ids);
reset role;
select pg_temp.keep('check', 'instr_after_dime_delete', (select count(*)::text from public.unit_pending_issue where id = (select instr from pg_temp.v_ids)));

-- DIGEN director: edits every unit but deletes only in its own units; reads submitted evaluations only.
select pg_temp.act_as('s102-digen@example.test');
set local role authenticated;
delete from public.unit_work_activity where id = (select act_3 from pg_temp.v_ids);
select pg_temp.keep('digen', 'del_flag', (public.calendar_access_overview((select org from pg_temp.v_ids), (select period from pg_temp.v_ids)) ->> 'can_delete_consolidated'));
select pg_temp.keep('digen', 'eval_rows', (select count(*)::text from public.executive_self_evaluation where id = (select eval from pg_temp.v_ids)));
select pg_temp.keep('digen', 'eval_drafts_flag', (public.evaluation_access_overview((select org from pg_temp.v_ids)) ->> 'can_read_draft_evaluations'));
select pg_temp.keep('digen', 'can_issue', (public.pending_issue_access_overview((select org from pg_temp.v_ids)) ->> 'can_issue_instructions'));
reset role;

-- Tenant admin deletes the instruction.
select pg_temp.act_as('s102-admin@example.test');
set local role authenticated;
delete from public.unit_pending_issue where id = (select instr from pg_temp.v_ids);
reset role;

-- Assertions -----------------------------------------------------------------------------
create function pg_temp.flag(p_who text, p_k text) returns text language sql as $$
  select v from pg_temp.t_out where who = p_who and k = p_k $$;

-- Pending issues: DIGEN instructions.
select is(pg_temp.flag('admin','can_issue'), 'true', 'admin may issue DIGEN instructions');
select ok(pg_temp.flag('admin','targets')::jsonb ? (select u_dime::text from pg_temp.v_ids)
  and not (pg_temp.flag('admin','targets')::jsonb ? (select u_digen::text from pg_temp.v_ids))
  and not (pg_temp.flag('admin','targets')::jsonb ? (select u_gen::text from pg_temp.v_ids)),
  'admin instruction targets exclude GEN and DIGEN, as for the DIGEN director');
select is(pg_temp.flag('admin','issue'), 'ok', 'admin issues a DIGEN instruction');
select is(pg_temp.flag('admin','rewrite'), 'ok', 'admin rewrites a DIGEN instruction');
select is(pg_temp.flag('digen','can_issue'), 'true', 'DIGEN director keeps issuing instructions');
select is(pg_temp.flag('dime','can_issue'), 'false', 'a unit director cannot issue instructions');
select is(pg_temp.flag('dime','issue'), '42501', 'a unit director inserting an instruction is rejected');
select is(pg_temp.flag('dime','status'), 'ok', 'the assigned unit still changes the instruction status');
select is(pg_temp.flag('dime','rewrite'), '42501', 'the assigned unit still cannot rewrite the instruction');
select is(pg_temp.flag('check','instr_after_dime_delete'), '1', 'the assigned unit still cannot delete the instruction');
select is((select count(*)::int from public.unit_pending_issue where id = (select instr from pg_temp.v_ids)), 0,
  'admin deletes a DIGEN instruction');

-- Calendar: delete.
select is(pg_temp.flag('admin','del_flag'), 'true', 'admin is offered calendar deletion in every unit');
select is((select count(*)::int from public.unit_work_activity where id = (select act_1 from pg_temp.v_ids)), 0,
  'admin deletes an activity of a unit it does not belong to');
select is((select count(*)::int from public.unit_work_activity where id = (select act_2 from pg_temp.v_ids)), 0,
  'a unit member still deletes its own unit activities');
select is((select count(*)::int from public.unit_work_activity where id = (select act_3 from pg_temp.v_ids)), 1,
  'the DIGEN director still cannot delete another unit activities');
select is(pg_temp.flag('digen','del_flag'), 'false', 'the DIGEN director is not offered cross-unit deletion');

-- Evaluation: drafts.
select is(pg_temp.flag('dime','eval_draft'), 'ok', 'a unit director writes a draft');
select is(pg_temp.flag('admin','eval_rows'), '1', 'admin reads the director draft');
select is(pg_temp.flag('admin','eval_drafts_flag'), 'true', 'admin is told it reads drafts');
select is(pg_temp.flag('admin','eval_all_flag'), 'true', 'admin is offered the evaluation collection');
select is((select director_name from public.executive_self_evaluation where id = (select eval from pg_temp.v_ids)),
  'DIME director', 'admin still cannot change a director evaluation');
select is(pg_temp.flag('digen','eval_rows'), '0', 'the DIGEN director still reads submitted evaluations only');
select is(pg_temp.flag('digen','eval_drafts_flag'), 'false', 'the DIGEN director is not told it reads drafts');

select ok(not has_function_privilege('anon', 'private.can_issue_digen_instructions(uuid)', 'execute'),
  'anon cannot execute can_issue_digen_instructions');

select * from finish();
rollback;
