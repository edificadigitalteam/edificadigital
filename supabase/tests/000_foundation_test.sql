begin;

select plan(37);

select has_table('public', 'actor', 'actor table exists');
select has_table('public', 'actor_role', 'actor_role table exists');
select has_table('public', 'media_type', 'media_type table exists');
select has_table('public', 'unit_of_measure', 'unit_of_measure table exists');
select has_table('public', 'donation', 'donation table exists');
select has_table('public', 'donation_detail', 'donation_detail table exists');
select has_table('public', 'donation_attachment', 'donation_attachment table exists');
select has_table('public', 'kit_transformation', 'kit_transformation table exists');
select has_table('public', 'kit_transformation_attachment', 'kit transformation evidence table exists');
select has_table('public', 'impact_event', 'impact_event table exists');
select has_table('public', 'impact_detail', 'impact_detail table exists');
select has_table('public', 'impact_event_attachment', 'impact event evidence table exists');

select col_type_is('public', 'actor', 'id', 'uuid', 'actor primary identity uses UUID');
select col_not_null('public', 'actor', 'name', 'actor name is required');
select col_is_null('public', 'actor', 'email', 'actor email is optional');
select has_index('public', 'actor', 'actor_email_unique', 'present actor emails are unique case-insensitively');

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.donation'::regclass
      and conname = 'donation_type_check'
      and contype = 'c'
  ),
  'donation type is constrained'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.donation_detail'::regclass
      and conname = 'donation_detail_type_fields_check'
      and contype = 'c'
  ),
  'donation detail fields match their type'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.kit_transformation'::regclass
      and conname = 'kit_transformation_quantity_check'
      and contype = 'c'
  ),
  'generated kit quantity is positive'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.impact_event'::regclass
      and conname = 'impact_event_date_check'
      and contype = 'c'
  ),
  'impact dates are ordered'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.impact_event'::regclass
      and conname = 'impact_event_demographics_check'
      and contype = 'c'
  ),
  'demographics are non-negative'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.impact_detail'::regclass
      and conname = 'impact_detail_quantity_check'
      and contype = 'c'
  ),
  'delivered quantity is positive'
);

select policies_are('public', 'actor', array['Tenant operators manage actors'], 'actor has MVP RLS');
select policies_are('public', 'actor_role', array['Tenant operators manage actor roles'], 'actor_role has MVP RLS');
select policies_are(
  'public',
  'media_type',
  array[
    'Operators view media types',
    'Superadmins insert media types',
    'Superadmins update media types',
    'Superadmins delete media types'
  ],
  'media_type has MVP RLS'
);
select policies_are(
  'public',
  'unit_of_measure',
  array[
    'Operators view units',
    'Superadmins insert units',
    'Superadmins update units',
    'Superadmins delete units'
  ],
  'unit_of_measure has MVP RLS'
);
select policies_are('public', 'donation', array['Tenant operators manage donations'], 'donation has MVP RLS');
select policies_are('public', 'donation_detail', array['Tenant operators manage donation details'], 'donation_detail has MVP RLS');
select policies_are('public', 'donation_attachment', array['Tenant operators manage donation attachments'], 'donation attachment has MVP RLS');
select policies_are('public', 'kit_transformation', array['Tenant operators manage kit transformations'], 'kit transformation has MVP RLS');
select policies_are('public', 'kit_transformation_attachment', array['Tenant operators manage transformation attachments'], 'transformation attachment has MVP RLS');
select policies_are('public', 'impact_event', array['Tenant operators manage impact events'], 'impact event has MVP RLS');
select policies_are('public', 'impact_detail', array['Tenant operators manage impact details'], 'impact detail has MVP RLS');
select policies_are('public', 'impact_event_attachment', array['Tenant operators manage impact attachments'], 'impact attachment has MVP RLS');

select is((select count(*) from public.unit_of_measure), 13::bigint, 'thirteen required units are seeded');
select is((select count(*) from public.media_type), 15::bigint, 'fifteen required media types are seeded');
select is((select count(*) from storage.buckets where id = 'attachments' and public = false), 1::bigint, 'private attachments bucket exists');

select * from finish();
rollback;
