-- SPRINT S11 stage 3 (#147): institutional instructions in Pending issues follow the
-- instructions.issue permission, assigned to a person, instead of the DIGEN unit code.
-- The fixture is a tenant with no GEN or DIGEN unit:
--   CENTRAL (top) > PASTORAL; JOVENES and MUJERES are top units too.
--   I directs CENTRAL and PASTORAL (both primary): the issuing unit is the most specific, PASTORAL.
--   M directs JOVENES and has no permissions. The admin belongs to no unit.
-- Behavioral test with throwaway fixtures, rolled back.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(27);

-- Structure ----------------------------------------------------------------------------------
select has_column('public', 'unit_pending_issue', 'issued_by_name',
  'an instruction keeps the name of the person who issued it');
select col_type_is('public', 'unit_pending_issue', 'issued_by_name', 'text', 'the issuer name is text');
select ok(not has_function_privilege('anon', 'private.current_operator_issuing_unit_id(uuid)', 'execute'),
  'anon cannot execute the issuing-unit helper');

-- Fixtures -----------------------------------------------------------------------------------
create temp table t_ids(k text primary key, id uuid not null default gen_random_uuid());
create temp table t_out(who text, k text, v text);
grant all on t_ids, t_out to authenticated;
insert into t_ids(k) values ('org'), ('period'), ('u_central'), ('u_pastoral'), ('u_jovenes'), ('u_mujeres'),
  ('admin'), ('i'), ('m'), ('instr'), ('instr_admin'), ('issue_m');
create function pg_temp.id(p_k text) returns uuid language sql stable as $$ select id from pg_temp.t_ids where k = p_k $$;

insert into auth.users (id, email)
select gen_random_uuid(), e from unnest(array[
  's113-admin@example.test', 's113-i@example.test', 's113-m@example.test']) e;

insert into public.organization (id, code, name, contact_email)
values (pg_temp.id('org'), 's113-org', 'S11.3 tenant without GEN/DIGEN', 's113@example.test');

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at) values
  (pg_temp.id('admin'), 's113-admin@example.test', 'Admin Tenant', 'admin', pg_temp.id('org'), true, now()),
  (pg_temp.id('i'), 's113-i@example.test', 'Issuer Name', 'operator', pg_temp.id('org'), true, now()),
  (pg_temp.id('m'), 's113-m@example.test', 'Director Jovenes', 'operator', pg_temp.id('org'), true, now());

insert into public.organization_unit (id, organization_id, code, name, parent_unit_id, sort_order, active) values
  (pg_temp.id('u_central'), pg_temp.id('org'), 'CENTRAL', 'Central', null, 10, true),
  (pg_temp.id('u_pastoral'), pg_temp.id('org'), 'PASTORAL', 'Pastoral', pg_temp.id('u_central'), 20, true),
  (pg_temp.id('u_jovenes'), pg_temp.id('org'), 'JOVENES', 'Jóvenes', null, 30, true),
  (pg_temp.id('u_mujeres'), pg_temp.id('org'), 'MUJERES', 'Mujeres', null, 40, true);

insert into public.organization_unit_member (organization_id, unit_id, operator_access_id, unit_role, is_primary, active) values
  (pg_temp.id('org'), pg_temp.id('u_central'), pg_temp.id('i'), 'director', true, true),
  (pg_temp.id('org'), pg_temp.id('u_pastoral'), pg_temp.id('i'), 'director', true, true),
  (pg_temp.id('org'), pg_temp.id('u_jovenes'), pg_temp.id('m'), 'director', true, true);

insert into public.management_period (id, organization_id, name, start_date, end_date)
values (pg_temp.id('period'), pg_temp.id('org'), 'Gestión test', date '2026-01-01', date '2026-12-31');

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

-- Sorted unit codes of an id list, to compare targets by name.
create function pg_temp.codes(p_ids jsonb) returns text language sql stable as $$
  select coalesce(string_agg(u.code, ',' order by u.code), '')
  from public.organization_unit u where u.id::text in (select jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb))) $$;

create function pg_temp.overview(p_who text) returns void language plpgsql as $$
declare o jsonb;
begin
  o := public.pending_issue_access_overview(pg_temp.id('org'));
  perform pg_temp.keep(p_who, 'can_issue', o ->> 'can_issue_instructions');
  perform pg_temp.keep(p_who, 'targets', pg_temp.codes(o -> 'instruction_target_unit_ids'));
end $$;

create function pg_temp.insert_instruction(p_id uuid, p_unit uuid, p_title text) returns text language sql as $$
  select format(
    'insert into public.unit_pending_issue (id, organization_id, management_period_id, unit_id, title, description, origin, issued_by_unit_id, issued_by_name) values (%L, %L, %L, %L, %L, %L, %L, %L, %L)',
    p_id, pg_temp.id('org'), pg_temp.id('period'), p_unit, p_title, 'Detalle', 'digen_instruction', pg_temp.id('u_jovenes'), 'Nombre falso') $$;
grant execute on all functions in schema pg_temp to authenticated;

create function pg_temp.v(p_who text, p_k text) returns text language sql as $$
  select v from pg_temp.t_out where who = p_who and k = p_k order by ctid desc limit 1 $$;
create function pg_temp.col(p_id uuid, p_col text) returns text language plpgsql as $$
declare r text;
begin
  execute format('select %I::text from public.unit_pending_issue where id = %L', p_col, p_id) into r;
  return r;
end $$;

-- Before the permission: the issuer cannot issue -----------------------------------------------
select pg_temp.act_as('s113-i@example.test'); set local role authenticated;
select pg_temp.overview('i_before');
select pg_temp.try('i_before', 'issue', pg_temp.insert_instruction(pg_temp.id('instr'), pg_temp.id('u_jovenes'), 'Antes'));
reset role;

-- The tenant admin grants instructions.issue --------------------------------------------------
select pg_temp.act_as('s113-admin@example.test'); set local role authenticated;
select public.admin_set_operator_permissions(pg_temp.id('org'), pg_temp.id('i'), array['instructions.issue']);
select pg_temp.overview('admin');
select pg_temp.try('admin', 'issue', pg_temp.insert_instruction(pg_temp.id('instr_admin'), pg_temp.id('u_central'), 'Del admin'));
reset role;

-- The issuer: issues to a unit it does not belong to, never to its own units --------------------
select pg_temp.act_as('s113-i@example.test'); set local role authenticated;
select pg_temp.overview('i');
select pg_temp.try('i', 'issue', pg_temp.insert_instruction(pg_temp.id('instr'), pg_temp.id('u_jovenes'), 'Instrucción a Jóvenes'));
select pg_temp.try('i', 'own_unit', pg_temp.insert_instruction(gen_random_uuid(), pg_temp.id('u_central'), 'A su propia unidad'));
select pg_temp.try('i', 'move_to_own', format(
  'update public.unit_pending_issue set unit_id = %L where id = %L', pg_temp.id('u_pastoral'), pg_temp.id('instr')));
select pg_temp.try('i', 'rewrite', format(
  'update public.unit_pending_issue set title = %L, issued_by_name = %L, issued_by_unit_id = %L where id = %L',
  'Instrucción reescrita', 'Otro nombre', pg_temp.id('u_mujeres'), pg_temp.id('instr')));
reset role;

-- The assigned unit: answers with the status only --------------------------------------------
select pg_temp.act_as('s113-m@example.test'); set local role authenticated;
select pg_temp.overview('m');
select pg_temp.keep('m', 'sees_instr', (select count(*)::text from public.unit_pending_issue where id = pg_temp.id('instr')));
select pg_temp.try('m', 'issue', pg_temp.insert_instruction(gen_random_uuid(), pg_temp.id('u_mujeres'), 'Sin permiso'));
select pg_temp.try('m', 'status', format(
  'update public.unit_pending_issue set status = %L where id = %L', 'in_progress', pg_temp.id('instr')));
select pg_temp.try('m', 'rename_issuer', format(
  'update public.unit_pending_issue set issued_by_name = %L where id = %L', 'Cambiado', pg_temp.id('instr')));
select pg_temp.try('m', 'unit_issue', format(
  'insert into public.unit_pending_issue (id, organization_id, management_period_id, unit_id, title, description, issued_by_name) values (%L, %L, %L, %L, %L, %L, %L)',
  pg_temp.id('issue_m'), pg_temp.id('org'), pg_temp.id('period'), pg_temp.id('u_jovenes'), 'Asunto propio', 'Detalle', 'Falso'));
reset role;

-- The issuer's name is a snapshot: renaming the person keeps the instruction as issued.
update private.operator_access set display_name = 'Issuer Renamed' where id = pg_temp.id('i');

-- Removing the permission removes the right to rewrite.
select pg_temp.act_as('s113-admin@example.test'); set local role authenticated;
select public.admin_set_operator_permissions(pg_temp.id('org'), pg_temp.id('i'), array[]::text[]);
reset role;
select pg_temp.act_as('s113-i@example.test'); set local role authenticated;
select pg_temp.overview('i_removed');
update public.unit_pending_issue set title = 'Sin permiso ya' where id = pg_temp.id('instr');
reset role;

-- Assertions ---------------------------------------------------------------------------------
select is(pg_temp.v('i_before', 'can_issue'), 'false', 'without instructions.issue a director cannot issue instructions');
select is(pg_temp.v('i_before', 'issue'), '42501', 'without instructions.issue inserting an instruction is rejected');

select is(pg_temp.v('i', 'can_issue'), 'true', 'instructions.issue lets a person issue instructions');
select is(pg_temp.v('i', 'targets'), 'JOVENES,MUJERES', 'the issuer is offered every active unit except its own units');
select is(pg_temp.v('i', 'issue'), 'ok', 'the issuer assigns an instruction to another unit');
select is(pg_temp.v('i', 'own_unit'), '23514', 'an instruction to one of the issuer''s own units is rejected');
select is(pg_temp.v('i', 'move_to_own'), '23514', 'an instruction cannot be moved to one of the issuer''s own units');
select is(pg_temp.v('i', 'rewrite'), 'ok', 'the issuer rewrites its instruction');
select is(pg_temp.col(pg_temp.id('instr'), 'title'), 'Instrucción reescrita', 'the rewrite is stored');
select is(pg_temp.col(pg_temp.id('instr'), 'issued_by_unit_id'), pg_temp.id('u_pastoral')::text,
  'the issuing unit is the issuer''s most specific primary unit, and it cannot be overwritten');
select is(pg_temp.col(pg_temp.id('instr'), 'issued_by_name'), 'Issuer Name',
  'the issuer name is recorded by the database, cannot be overwritten, and survives a rename');

select is(pg_temp.v('m', 'can_issue'), 'false', 'a director without the permission cannot issue');
select is(pg_temp.v('m', 'targets'), '', 'a director without the permission is offered no targets');
select is(pg_temp.v('m', 'issue'), '42501', 'a director without the permission inserting an instruction is rejected');
select is(pg_temp.v('m', 'sees_instr'), '1', 'the assigned unit sees the instruction');
select is(pg_temp.v('m', 'status'), 'ok', 'the assigned unit updates the instruction status');
select is(pg_temp.v('m', 'rename_issuer'), '42501', 'the assigned unit cannot change who issued the instruction');
select is(pg_temp.col(pg_temp.id('issue_m'), 'issued_by_name'), null, 'a unit''s own pending issue carries no issuer name');

select is(pg_temp.v('admin', 'targets'), 'CENTRAL,JOVENES,MUJERES,PASTORAL',
  'a tenant admin outside every unit is offered every active unit');
select is(pg_temp.v('admin', 'issue'), 'ok', 'the tenant admin issues instructions without the permission');
select is(pg_temp.col(pg_temp.id('instr_admin'), 'issued_by_unit_id'), null, 'an issuer without units records no issuing unit');
select is(pg_temp.col(pg_temp.id('instr_admin'), 'issued_by_name'), 'Admin Tenant', 'the admin is recorded as the issuer');

select is(pg_temp.v('i_removed', 'can_issue'), 'false', 'removing instructions.issue removes the right to issue');
select is(pg_temp.col(pg_temp.id('instr'), 'title'), 'Instrucción reescrita', 'without the permission the former issuer cannot rewrite');

select * from finish();
rollback;
