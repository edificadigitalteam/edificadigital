begin;
set local search_path = public, extensions, pg_catalog;

select plan(25);

-- Fixture: GEN > DIGEN > (DIAF, DIME) and GEN > FBCC.
-- Each person sees their own unit and everything below it; admin sees everything.

insert into public.organization (id, code, name, contact_email)
values ('00000000-0000-4000-8000-000000002000', 'pgtap-unit-scope', 'Unit Scope', 'scope@example.com');

insert into public.organization_unit (id, organization_id, parent_unit_id, code, name, unit_type, sort_order)
values
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000002000', null, 'GEN', 'General', 'directorate', 10),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002001', 'DIGEN', 'Dirección General', 'directorate', 20),
  ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002002', 'DIAF', 'Finanzas', 'directorate', 30),
  ('00000000-0000-4000-8000-000000002004', '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002002', 'DIME', 'Misiones', 'directorate', 40),
  ('00000000-0000-4000-8000-000000002005', '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002001', 'FBCC', 'Fundación', 'foundation', 50);

insert into private.operator_access (id, email, display_name, role, active, organization_id, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000002011', 'pgtap-scope-gen@example.com', 'Gen', 'operator', true, '00000000-0000-4000-8000-000000002000', now()),
  ('00000000-0000-4000-8000-000000002012', 'pgtap-scope-digen@example.com', 'Digen', 'operator', true, '00000000-0000-4000-8000-000000002000', now()),
  ('00000000-0000-4000-8000-000000002013', 'pgtap-scope-diaf@example.com', 'Diaf', 'operator', true, '00000000-0000-4000-8000-000000002000', now()),
  ('00000000-0000-4000-8000-000000002014', 'pgtap-scope-dime@example.com', 'Dime', 'operator', true, '00000000-0000-4000-8000-000000002000', now()),
  ('00000000-0000-4000-8000-000000002015', 'pgtap-scope-fbcc@example.com', 'Fbcc', 'operator', true, '00000000-0000-4000-8000-000000002000', now()),
  ('00000000-0000-4000-8000-000000002016', 'pgtap-scope-admin@example.com', 'Admin', 'admin', true, '00000000-0000-4000-8000-000000002000', now());

insert into auth.users (id, email)
select id, email from private.operator_access
where organization_id = '00000000-0000-4000-8000-000000002000';

insert into public.organization_unit_member (organization_id, unit_id, operator_access_id, unit_role, is_primary)
values
  ('00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000002011', 'director', true),
  ('00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000002012', 'director', true),
  ('00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000002013', 'director', true),
  ('00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002004', '00000000-0000-4000-8000-000000002014', 'director', true),
  ('00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002005', '00000000-0000-4000-8000-000000002015', 'director', true);

insert into public.management_period (id, organization_id, name, start_date, end_date)
values ('00000000-0000-4000-8000-000000002020', '00000000-0000-4000-8000-000000002000', 'Periodo prueba', '2026-01-01', '2026-12-31');

insert into public.unit_work_plan (id, organization_id, management_period_id, unit_id, title)
select ('00000000-0000-4000-8000-00000000203' || n)::uuid, '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002020',
       ('00000000-0000-4000-8000-00000000200' || n)::uuid, 'Plan ' || n
from generate_series(1,5) n;

insert into public.management_indicator (id, organization_id, management_period_id, unit_id, name)
select ('00000000-0000-4000-8000-00000000204' || n)::uuid, '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002020',
       ('00000000-0000-4000-8000-00000000200' || n)::uuid, 'Indicador ' || n
from generate_series(1,5) n;

insert into public.unit_pending_issue (id, organization_id, management_period_id, unit_id, title, description)
select ('00000000-0000-4000-8000-00000000205' || n)::uuid, '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002020',
       ('00000000-0000-4000-8000-00000000200' || n)::uuid, 'Asunto ' || n, 'Detalle ' || n
from generate_series(1,5) n;

insert into public.unit_work_activity (id, organization_id, work_plan_id, title, start_date)
select ('00000000-0000-4000-8000-00000000206' || n)::uuid, '00000000-0000-4000-8000-000000002000',
       ('00000000-0000-4000-8000-00000000203' || n)::uuid, 'Actividad ' || n, '2026-03-01'
from generate_series(1,5) n;

insert into public.unit_management_report (id, organization_id, management_period_id, unit_id)
select ('00000000-0000-4000-8000-00000000207' || n)::uuid, '00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-000000002020',
       ('00000000-0000-4000-8000-00000000200' || n)::uuid
from generate_series(1,5) n;

create temporary view scope_indicators with (security_invoker = true) as
  select array_agg(u.code order by u.sort_order) codes
  from public.management_indicator i join public.organization_unit u on u.id = i.unit_id
  where i.organization_id = '00000000-0000-4000-8000-000000002000';
create temporary view scope_plans with (security_invoker = true) as
  select array_agg(u.code order by u.sort_order) codes
  from public.unit_work_plan p join public.organization_unit u on u.id = p.unit_id
  where p.organization_id = '00000000-0000-4000-8000-000000002000';
create temporary view scope_issues with (security_invoker = true) as
  select array_agg(u.code order by u.sort_order) codes
  from public.unit_pending_issue i join public.organization_unit u on u.id = i.unit_id
  where i.organization_id = '00000000-0000-4000-8000-000000002000';
create temporary view scope_activities with (security_invoker = true) as
  select array_agg(u.code order by u.sort_order) codes
  from public.unit_work_activity a
  join public.unit_work_plan p on p.id = a.work_plan_id
  join public.organization_unit u on u.id = p.unit_id
  where a.organization_id = '00000000-0000-4000-8000-000000002000';
create temporary view scope_reports with (security_invoker = true) as
  select array_agg(u.code order by u.sort_order) codes
  from public.unit_management_report r join public.organization_unit u on u.id = r.unit_id
  where r.organization_id = '00000000-0000-4000-8000-000000002000';
grant select on scope_indicators, scope_plans, scope_issues, scope_activities, scope_reports to authenticated;

set local role authenticated;

-- DIME: only DIME.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002014","email":"pgtap-scope-dime@example.com","role":"authenticated"}', true);
select is((select codes from scope_indicators), array['DIME'], 'DIME sees only DIME indicators');
select is((select codes from scope_plans), array['DIME'], 'DIME sees only the DIME work plan');
select is((select codes from scope_issues), array['DIME'], 'DIME sees only DIME pending issues');
select is((select codes from scope_activities), array['DIME'], 'DIME sees only DIME calendar activities');
select is((select codes from scope_reports), array['DIME'], 'DIME sees only DIME management reports');
select throws_ok(
  $$select public.review_calendar_activity('00000000-0000-4000-8000-000000002064', 'validated', null)$$,
  '42501', null, 'DIME cannot review calendar activities, including its own'
);

-- DIAF: only DIAF in pending issues and calendar; it keeps reading every unit
-- indicator because it reviews the management reports the other units submit.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002013","email":"pgtap-scope-diaf@example.com","role":"authenticated"}', true);
select is((select codes from scope_activities), array['DIAF'], 'DIAF sees only DIAF calendar activities');
select is((select codes from scope_indicators), array['GEN','DIGEN','DIAF','DIME','FBCC'], 'DIAF keeps reading every unit indicators to review submitted reports');
select is((select codes from scope_issues), array['DIAF'], 'DIAF sees only DIAF pending issues');

-- FBCC: only FBCC.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002015","email":"pgtap-scope-fbcc@example.com","role":"authenticated"}', true);
select is((select codes from scope_indicators), array['FBCC'], 'FBCC sees only FBCC indicators');
select is((select codes from scope_activities), array['FBCC'], 'FBCC sees only FBCC calendar activities');

-- DIGEN: DIGEN and the units below it, never FBCC or GEN.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002012","email":"pgtap-scope-digen@example.com","role":"authenticated"}', true);
select is((select codes from scope_indicators), array['DIGEN','DIAF','DIME'], 'DIGEN sees DIGEN and its directorates indicators');
select is((select codes from scope_issues), array['DIGEN','DIAF','DIME'], 'DIGEN sees DIGEN and its directorates pending issues');
select is((select codes from scope_activities), array['DIGEN','DIAF','DIME'], 'DIGEN sees DIGEN and its directorates calendar');
select is((select codes from scope_reports), array['DIGEN','DIAF','DIME'], 'DIGEN sees DIGEN and its directorates reports');
select is(
  (select count(*)::int from public.unit_pending_issue
   where id = '00000000-0000-4000-8000-000000002054'
     and organization_id = '00000000-0000-4000-8000-000000002000'),
  1, 'DIGEN can read a DIME pending issue'
);
update public.unit_pending_issue set title = 'Cambio DIGEN' where id = '00000000-0000-4000-8000-000000002054';
select is(
  (select title from public.unit_pending_issue where id = '00000000-0000-4000-8000-000000002054'),
  'Asunto 4', 'DIGEN cannot edit a DIME pending issue'
);
select lives_ok(
  $$select public.review_calendar_activity('00000000-0000-4000-8000-000000002064', 'validated', null)$$,
  'DIGEN can review a DIME calendar activity'
);
select throws_ok(
  $$select public.review_calendar_activity('00000000-0000-4000-8000-000000002065', 'validated', null)$$,
  '42501', null, 'DIGEN cannot review an FBCC calendar activity'
);
select throws_ok(
  $$select public.set_calendar_joint_review('00000000-0000-4000-8000-000000002020', true)$$,
  '42501', null, 'DIGEN cannot open the organization-wide joint calendar review'
);
select is(
  (public.pending_issue_access_overview('00000000-0000-4000-8000-000000002000') -> 'visible_unit_ids') @>
    '["00000000-0000-4000-8000-000000002002","00000000-0000-4000-8000-000000002003","00000000-0000-4000-8000-000000002004"]'::jsonb
  and jsonb_array_length(public.pending_issue_access_overview('00000000-0000-4000-8000-000000002000') -> 'visible_unit_ids') = 3,
  true, 'pending issue overview exposes the caller visible units'
);

-- GEN: everything.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002011","email":"pgtap-scope-gen@example.com","role":"authenticated"}', true);
select is((select codes from scope_indicators), array['GEN','DIGEN','DIAF','DIME','FBCC'], 'GEN sees every unit indicators');
select is((select codes from scope_issues), array['GEN','DIGEN','DIAF','DIME','FBCC'], 'GEN sees every unit pending issues');
select lives_ok(
  $$select public.set_calendar_joint_review('00000000-0000-4000-8000-000000002020', false)$$,
  'GEN can control the organization-wide joint calendar review'
);

-- Tenant admin without a unit: everything.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002016","email":"pgtap-scope-admin@example.com","role":"authenticated"}', true);
select is((select codes from scope_issues), array['GEN','DIGEN','DIAF','DIME','FBCC'], 'tenant admin sees every unit pending issues');

select * from finish();
rollback;
