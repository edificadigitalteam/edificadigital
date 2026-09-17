begin;

select plan(54);

-- Sprint S5 — Member directory (Miembros) and tenant-configurable catalogs
-- (Mantenedores). Four tenant-scoped tables, two of them catalogs the tenant
-- edits itself, plus the per-tenant module label on public.organization.

-- ---------------------------------------------------------------------------
-- Table and column shape
-- ---------------------------------------------------------------------------

select has_table('public', 'organization_member_category', 'the member category catalog exists');
select has_table('public', 'organization_member_relationship_role', 'the relationship role catalog exists');
select has_table('public', 'organization_member', 'the member directory table exists');
select has_table('public', 'organization_member_relationship', 'the member relationship table exists');

select has_column('public', 'organization_member_category', 'applies_to', 'a category declares which member type may use it');
select has_column('public', 'organization_member', 'member_type', 'a member is either a person or an organization');
select has_column('public', 'organization_member', 'member_category_id', 'a member carries its tenant-configured category');
select has_column('public', 'organization_member', 'status', 'a member is deactivated rather than deleted');
select has_column('public', 'organization_member_relationship', 'relationship_role_id', 'a relationship carries its tenant-configured role');

select has_column('public', 'organization', 'members_module_label', 'the tenant can override the module label');
select col_is_null('public', 'organization', 'members_module_label', 'the module label override is optional and falls back to the default');

-- ---------------------------------------------------------------------------
-- Uniqueness
-- ---------------------------------------------------------------------------

select col_is_unique(
  'public', 'organization_member_category', array['organization_id', 'code'],
  'a category code is unique inside one organization'
);
select col_is_unique(
  'public', 'organization_member_relationship_role', array['organization_id', 'code'],
  'a relationship role code is unique inside one organization'
);
select col_is_unique(
  'public', 'organization_member_relationship', array['member_id', 'related_member_id', 'relationship_role_id'],
  'the same person cannot hold the same role twice in the same organization'
);

-- ---------------------------------------------------------------------------
-- Foreign-key indexes (project rule: every foreign key column is indexed)
-- ---------------------------------------------------------------------------

select has_index('public', 'organization_member_category', 'organization_member_category_org_idx', 'the category catalog indexes its tenant column');
select has_index('public', 'organization_member_relationship_role', 'organization_member_relationship_role_org_idx', 'the role catalog indexes its tenant column');
select has_index('public', 'organization_member', 'organization_member_org_idx', 'the member directory indexes its tenant column');
select has_index('public', 'organization_member', 'organization_member_category_idx', 'the member directory indexes its category foreign key');
select has_index('public', 'organization_member_relationship', 'organization_member_relationship_org_idx', 'relationships index their tenant column');
select has_index('public', 'organization_member_relationship', 'organization_member_relationship_member_idx', 'relationships index the person side');
select has_index('public', 'organization_member_relationship', 'organization_member_relationship_related_idx', 'relationships index the organization side');
select has_index('public', 'organization_member_relationship', 'organization_member_relationship_role_idx', 'relationships index the role foreign key');

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_member_category'::regclass),
  'row level security is enabled on the category catalog'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_member_relationship_role'::regclass),
  'row level security is enabled on the role catalog'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_member'::regclass),
  'row level security is enabled on the member directory'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_member_relationship'::regclass),
  'row level security is enabled on member relationships'
);

select ok(
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organization_member_category',
        'organization_member_relationship_role',
        'organization_member',
        'organization_member_relationship'
      )) = 16,
  'every one of the four tables carries a select, insert, update and delete policy'
);

select ok(
  (select bool_and(qual like '%can_access_organization%') from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and tablename in (
        'organization_member_category',
        'organization_member_relationship_role',
        'organization_member',
        'organization_member_relationship'
      )),
  'reading any member table requires access to its organization'
);

select ok(
  (select bool_and(coalesce(qual, with_check) like '%can_manage_organization%') from pg_policies
    where schemaname = 'public'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and tablename in (
        'organization_member_category',
        'organization_member_relationship_role',
        'organization_member',
        'organization_member_relationship'
      )),
  'writing to any member table requires management rights over its organization'
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.organization_member', 'SELECT')
    and has_table_privilege('authenticated', 'public.organization_member', 'INSERT')
    and has_table_privilege('authenticated', 'public.organization_member', 'UPDATE')
    and has_table_privilege('authenticated', 'public.organization_member', 'DELETE'),
  'authenticated sessions can operate the member directory through RLS'
);
select ok(
  not has_table_privilege('anon', 'public.organization_member', 'SELECT'),
  'anonymous sessions cannot read the member directory'
);
select ok(
  not has_table_privilege('anon', 'public.organization_member_category', 'SELECT'),
  'anonymous sessions cannot read the tenant category catalog'
);
select ok(
  not has_table_privilege('anon', 'public.organization_member_relationship_role', 'SELECT'),
  'anonymous sessions cannot read the tenant role catalog'
);
select ok(
  not has_table_privilege('anon', 'public.organization_member_relationship', 'SELECT'),
  'anonymous sessions cannot read member relationships'
);

-- ---------------------------------------------------------------------------
-- The module label RPC
-- ---------------------------------------------------------------------------

select has_function(
  'public', 'admin_set_members_module_label', array['uuid', 'text'],
  'the module label is written through a dedicated RPC'
);
select ok(
  (select prosrc from pg_proc where oid = 'public.admin_set_members_module_label(uuid, text)'::regprocedure)
    ilike '%can_manage_organization%',
  'the module label RPC checks management rights over the target organization'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_set_members_module_label(uuid, text)', 'EXECUTE'),
  'authenticated sessions can execute the module label RPC'
);
select ok(
  not has_function_privilege('anon', 'public.admin_set_members_module_label(uuid, text)', 'EXECUTE'),
  'anonymous sessions cannot execute the module label RPC'
);

-- ---------------------------------------------------------------------------
-- Default catalog seed
-- ---------------------------------------------------------------------------

select ok(
  (select count(*) from public.organization_member_category category
    join public.organization organization on organization.id = category.organization_id
    where organization.code = 'cnbv') >= 3,
  'the existing cnbv tenant was backfilled with the default categories'
);
select ok(
  (select count(*) from public.organization_member_relationship_role role
    join public.organization organization on organization.id = role.organization_id
    where organization.code = 'cnbv') >= 3,
  'the existing cnbv tenant was backfilled with the default relationship roles'
);

-- contact_email is required and unique since organization_admin_provisioning.
insert into public.organization (code, name, contact_email)
values ('pgtap-member-seed', 'pgTAP seed organization', 'pgtap-member-seed@example.test');

select ok(
  (select count(*) from public.organization_member_category category
    join public.organization organization on organization.id = category.organization_id
    where organization.code = 'pgtap-member-seed') = 3,
  'a newly created organization is seeded with the three default categories'
);
select ok(
  (select count(*) from public.organization_member_relationship_role role
    join public.organization organization on organization.id = role.organization_id
    where organization.code = 'pgtap-member-seed') = 3,
  'a newly created organization is seeded with the three default relationship roles'
);
select ok(
  (select bool_and(name_es is not null and name_en is not null)
    from public.organization_member_category category
    join public.organization organization on organization.id = category.organization_id
    where organization.code = 'pgtap-member-seed'),
  'seeded categories carry both Spanish and English labels'
);

-- ---------------------------------------------------------------------------
-- Data integrity rules
-- ---------------------------------------------------------------------------

create temporary table member_fixture as
select
  organization.id as organization_id,
  (select id from public.organization_member_category
    where organization_id = organization.id and applies_to = 'person' limit 1) as person_category_id,
  (select id from public.organization_member_category
    where organization_id = organization.id and applies_to = 'organization' limit 1) as organization_category_id,
  (select id from public.organization_member_relationship_role
    where organization_id = organization.id limit 1) as role_id
from public.organization organization
where organization.code = 'pgtap-member-seed';

select lives_ok(
  $$
    insert into public.organization_member (organization_id, member_type, member_category_id, name)
    select organization_id, 'person', person_category_id, 'pgTAP Pastor' from member_fixture
  $$,
  'a person member using a person category is accepted'
);

select lives_ok(
  $$
    insert into public.organization_member (organization_id, member_type, member_category_id, name)
    select organization_id, 'organization', organization_category_id, 'pgTAP Iglesia' from member_fixture
  $$,
  'an organization member using an organization category is accepted'
);

select throws_ok(
  $$
    insert into public.organization_member (organization_id, member_type, member_category_id, name)
    select organization_id, 'person', organization_category_id, 'pgTAP Mismatch' from member_fixture
  $$,
  '23514',
  null,
  'a member whose category does not apply to its member type is rejected'
);

select throws_ok(
  $$
    insert into public.organization_member (organization_id, member_type, name)
    select organization_id, 'person', '   ' from member_fixture
  $$,
  '23514',
  null,
  'a member without a real name is rejected'
);

select throws_ok(
  $$
    insert into public.organization_member (organization_id, member_type, member_category_id, name)
    select organization_id, 'person',
      (select category.id from public.organization_member_category category
        join public.organization organization on organization.id = category.organization_id
        where organization.code = 'cnbv' and category.applies_to = 'person' limit 1),
      'pgTAP Cross Tenant'
    from member_fixture
  $$,
  '23514',
  null,
  'a member cannot borrow a category from another tenant'
);

select lives_ok(
  $$
    insert into public.organization_member_relationship (organization_id, member_id, related_member_id, relationship_role_id)
    select fixture.organization_id,
      (select id from public.organization_member where name = 'pgTAP Pastor'),
      (select id from public.organization_member where name = 'pgTAP Iglesia'),
      fixture.role_id
    from member_fixture fixture
  $$,
  'linking a person member to an organization member through a role is accepted'
);

select throws_ok(
  $$
    insert into public.organization_member_relationship (organization_id, member_id, related_member_id, relationship_role_id)
    select fixture.organization_id,
      (select id from public.organization_member where name = 'pgTAP Iglesia'),
      (select id from public.organization_member where name = 'pgTAP Pastor'),
      fixture.role_id
    from member_fixture fixture
  $$,
  '23514',
  null,
  'a relationship with the person and organization sides swapped is rejected'
);

select throws_ok(
  $$
    insert into public.organization_member_relationship (organization_id, member_id, related_member_id, relationship_role_id)
    select fixture.organization_id,
      (select id from public.organization_member where name = 'pgTAP Pastor'),
      (select id from public.organization_member where name = 'pgTAP Iglesia'),
      fixture.role_id
    from member_fixture fixture
  $$,
  '23505',
  null,
  'the same person, organization and role cannot be linked twice'
);

select throws_ok(
  $$
    insert into public.organization_member_category (organization_id, code, name_es, name_en, applies_to)
    select organization_id, 'pgtap-bad-applies-to', 'Inválido', 'Invalid', 'building' from member_fixture
  $$,
  '23514',
  null,
  'a category may only apply to a person, an organization, or both'
);

select throws_ok(
  $$
    insert into public.organization_member (organization_id, member_type, name)
    select organization_id, 'ministry', 'pgTAP Unknown Type' from member_fixture
  $$,
  '23514',
  null,
  'a member type outside person and organization is rejected'
);

select throws_ok(
  $$ update public.organization set members_module_label = '   ' where code = 'pgtap-member-seed' $$,
  '23514',
  null,
  'a blank module label is rejected; clearing the override means storing null'
);

select * from finish();
rollback;
