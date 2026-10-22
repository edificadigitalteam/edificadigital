begin;

select plan(8);

-- The visualization override is stored on the indicator itself. It must stay
-- optional: a null value means "choose the chart automatically", which is what
-- every indicator created before this migration carries.

select has_column(
  'public',
  'management_indicator',
  'preferred_chart',
  'management_indicator carries a preferred_chart column'
);

select col_type_is(
  'public',
  'management_indicator',
  'preferred_chart',
  'text',
  'preferred_chart is stored as text, matching the chart form identifiers'
);

select col_is_null(
  'public',
  'management_indicator',
  'preferred_chart',
  'preferred_chart is nullable, so automatic stays the default behavior'
);

select col_hasnt_default(
  'public',
  'management_indicator',
  'preferred_chart',
  'preferred_chart has no default, so existing rows keep choosing automatically'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.management_indicator'::regclass
      and conname = 'management_indicator_preferred_chart_check'
  ),
  'a check constraint guards the allowed chart forms'
);

-- A self-contained tenant for the accept/reject cases below, so the test also
-- runs on an empty database (CI replays migrations from scratch).
insert into public.organization (id, code, name, contact_email)
values ('00000000-0000-4000-8000-000000001300', 'pgtap-preferred-chart', 'pgTAP preferred chart', 'pgtap-preferred-chart@example.test');

insert into public.management_period (id, organization_id, name, start_date, end_date)
values ('00000000-0000-4000-8000-000000001301', '00000000-0000-4000-8000-000000001300', 'pgTAP period', '2026-01-01', '2026-12-31');

insert into public.organization_unit (id, organization_id, code, name, unit_type, sort_order)
values ('00000000-0000-4000-8000-000000001302', '00000000-0000-4000-8000-000000001300', 'PGTAP', 'pgTAP unit', 'directorate', 10);

create temporary table preferred_chart_fixture as
select
  '00000000-0000-4000-8000-000000001300'::uuid as organization_id,
  '00000000-0000-4000-8000-000000001301'::uuid as management_period_id,
  '00000000-0000-4000-8000-000000001302'::uuid as unit_id;

select lives_ok(
  $$
    insert into public.management_indicator (organization_id, management_period_id, unit_id, name, preferred_chart)
    select organization_id, management_period_id, unit_id, 'pgTAP preferred_chart accepted', 'trend'
    from preferred_chart_fixture
  $$,
  'an allowed chart form is accepted'
);

select lives_ok(
  $$
    insert into public.management_indicator (organization_id, management_period_id, unit_id, name, preferred_chart)
    select organization_id, management_period_id, unit_id, 'pgTAP preferred_chart automatic', null
    from preferred_chart_fixture
  $$,
  'a null chart form is accepted and means automatic'
);

select throws_ok(
  $$
    insert into public.management_indicator (organization_id, management_period_id, unit_id, name, preferred_chart)
    select organization_id, management_period_id, unit_id, 'pgTAP preferred_chart rejected', 'pie-of-two-slices'
    from preferred_chart_fixture
  $$,
  '23514',
  null,
  'an unknown chart form is rejected by the check constraint'
);

select * from finish();
rollback;
