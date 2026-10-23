-- #143/#144: authenticated holds no TRUNCATE, REFERENCES, TRIGGER or MAINTAIN privilege on any table or
-- view in public (MAINTAIN, new in Postgres 17, was added to the guard by #144).
-- edifydb still carried these automatic privileges on 35 tables and the view inventory_lot_balance.
-- PostgREST never exposes them, the app never uses them, and TRUNCATE bypasses RLS.
-- authenticated keeps the DML its creating migration declared (regression). Four objects
-- declared narrower grants than edifydb carried; they are reset to the declared set, which is
-- exactly what their RLS policies allow.
begin;
set local search_path = public, extensions, pg_catalog;

select plan(37);

-- authenticated keeps exactly the privileges its migration declared.
select table_privs_are('public', 'actor', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on actor');
select table_privs_are('public', 'actor_role', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on actor_role');
select table_privs_are('public', 'donation', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on donation');
select table_privs_are('public', 'donation_attachment', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on donation_attachment');
select table_privs_are('public', 'donation_detail', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on donation_detail');
select table_privs_are('public', 'executive_self_evaluation', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'], 'authenticated keeps only its declared privileges on executive_self_evaluation');
select table_privs_are('public', 'impact_detail', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on impact_detail');
select table_privs_are('public', 'impact_donation', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on impact_donation');
select table_privs_are('public', 'impact_event', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on impact_event');
select table_privs_are('public', 'impact_event_attachment', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on impact_event_attachment');
select table_privs_are('public', 'inventory_lot', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on inventory_lot');
select table_privs_are('public', 'inventory_lot_balance', 'authenticated', array['SELECT'], 'authenticated keeps only its declared privileges on inventory_lot_balance');
select table_privs_are('public', 'inventory_movement', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on inventory_movement');
select table_privs_are('public', 'kit_transformation', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on kit_transformation');
select table_privs_are('public', 'kit_transformation_attachment', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on kit_transformation_attachment');
select table_privs_are('public', 'media_type', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on media_type');
select table_privs_are('public', 'monetary_donation_detail', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on monetary_donation_detail');
select table_privs_are('public', 'organization', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on organization');
select table_privs_are('public', 'organization_host', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on organization_host');
select table_privs_are('public', 'organization_member', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on organization_member');
select table_privs_are('public', 'organization_member_category', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on organization_member_category');
select table_privs_are('public', 'organization_member_relationship', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on organization_member_relationship');
select table_privs_are('public', 'organization_member_relationship_role', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on organization_member_relationship_role');
select table_privs_are('public', 'project', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on project');
select table_privs_are('public', 'project_beneficiary_document', 'authenticated', array['SELECT', 'INSERT', 'DELETE'], 'authenticated keeps only its declared privileges on project_beneficiary_document');
select table_privs_are('public', 'project_document', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on project_document');
select table_privs_are('public', 'project_expense', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on project_expense');
select table_privs_are('public', 'project_media_evidence', 'authenticated', array['SELECT', 'INSERT', 'DELETE'], 'authenticated keeps only its declared privileges on project_media_evidence');
select table_privs_are('public', 'project_output', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on project_output');
select table_privs_are('public', 'project_output_evidence', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on project_output_evidence');
select table_privs_are('public', 'shipment', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on shipment');
select table_privs_are('public', 'shipment_attachment', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on shipment_attachment');
select table_privs_are('public', 'shipment_item', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on shipment_item');
select table_privs_are('public', 'unit_of_measure', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on unit_of_measure');
select table_privs_are('public', 'unit_pending_issue', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on unit_pending_issue');
select table_privs_are('public', 'volunteer', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated keeps only DML on volunteer');

-- Guard for every table and view in public, including future ones.
select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and (
        has_table_privilege('authenticated', c.oid, 'TRUNCATE')
        or has_table_privilege('authenticated', c.oid, 'REFERENCES')
        or has_table_privilege('authenticated', c.oid, 'TRIGGER')
        or has_table_privilege('authenticated', c.oid, 'MAINTAIN')
      )
    order by 1
  ),
  array[]::text[],
  'no public table or view grants TRUNCATE, REFERENCES, TRIGGER or MAINTAIN to authenticated'
);

select * from finish();
rollback;
