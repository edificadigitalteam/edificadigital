begin;

select plan(13);

-- Sprint S6 — two optional dates on a member: the date it celebrates (a
-- founding date for an organization, a birthday for a person) and the date it
-- became part of the tenant. Complete dates only, both optional, no partial
-- representation and no precision column.

select has_column('public', 'organization_member', 'celebration_date', 'a member carries the date it celebrates');
select has_column('public', 'organization_member', 'membership_since', 'a member carries the date it became part of the tenant');

select col_type_is('public', 'organization_member', 'celebration_date', 'date', 'the celebration date is a plain date, with no time component');
select col_type_is('public', 'organization_member', 'membership_since', 'date', 'the affiliation date is a plain date, with no time component');

select col_is_null('public', 'organization_member', 'celebration_date', 'the celebration date is optional');
select col_is_null('public', 'organization_member', 'membership_since', 'the affiliation date is optional');

select col_hasnt_default('public', 'organization_member', 'celebration_date', 'no default: an unknown celebration date stays null rather than becoming today');
select col_hasnt_default('public', 'organization_member', 'membership_since', 'no default: an unknown affiliation date stays null rather than becoming today');

-- Decision 3 of the plan: partial dates are out, so neither column gained a
-- companion precision column. This asserts the absence, because an earlier
-- revision of the plan did carry them.
select hasnt_column('public', 'organization_member', 'celebration_date_precision', 'no precision column: dates are complete or absent');
select hasnt_column('public', 'organization_member', 'membership_since_precision', 'no precision column: dates are complete or absent');

-- A representative tenant and category for the rows below.
insert into public.organization (code, name, contact_email)
values ('pgtap-member-dates', 'pgTAP dates organization', 'pgtap-member-dates@example.test');

create temporary table date_fixture as
select
  organization.id as organization_id,
  (select category.id from public.organization_member_category category
    where category.organization_id = organization.id and category.applies_to = 'person' limit 1) as person_category_id
from public.organization organization
where organization.code = 'pgtap-member-dates';

select lives_ok(
  $$
    insert into public.organization_member (organization_id, member_type, member_category_id, name)
    select organization_id, 'person', person_category_id, 'pgTAP Sin Fechas' from date_fixture
  $$,
  'a member can be registered with neither date, which is the common case'
);

select lives_ok(
  $$
    insert into public.organization_member (organization_id, member_type, name, celebration_date, membership_since)
    select organization_id, 'organization', 'pgTAP Con Fechas', date '1998-03-12', date '2010-01-03' from date_fixture
  $$,
  'both dates are accepted together'
);

-- A 29 February birthday is a real date and has to survive storage; whether a
-- greeting fires on the 28th or the 1st in a common year belongs to the
-- greeting module, not here.
select lives_ok(
  $$
    insert into public.organization_member (organization_id, member_type, name, celebration_date)
    select organization_id, 'person', 'pgTAP Bisiesto', date '2024-02-29' from date_fixture
  $$,
  'a 29 February celebration date is accepted'
);

select * from finish();
rollback;
