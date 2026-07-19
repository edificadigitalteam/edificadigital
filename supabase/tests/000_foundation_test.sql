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

select has_check('public', 'donation', 'donation_type_check', 'donation type is constrained');
select has_check('public', 'donation_detail', 'donation_detail_type_fields_check', 'donation detail fields match their type');
select has_check('public', 'kit_transformation', 'kit_transformation_quantity_check', 'generated kit quantity is positive');
select has_check('public', 'impact_event', 'impact_event_date_check', 'impact dates are ordered');
select has_check('public', 'impact_event', 'impact_event_demographics_check', 'demographics are non-negative');
select has_check('public', 'impact_detail', 'impact_detail_quantity_check', 'delivered quantity is positive');

select policies_are('public', 'actor', array['Authenticated users manage actors'], 'actor has MVP RLS');
select policies_are('public', 'actor_role', array['Authenticated users manage actor roles'], 'actor_role has MVP RLS');
select policies_are('public', 'media_type', array['Authenticated users manage media types'], 'media_type has MVP RLS');
select policies_are('public', 'unit_of_measure', array['Authenticated users manage units'], 'unit_of_measure has MVP RLS');
select policies_are('public', 'donation', array['Authenticated users manage donations'], 'donation has MVP RLS');
select policies_are('public', 'donation_detail', array['Authenticated users manage donation details'], 'donation_detail has MVP RLS');
select policies_are('public', 'donation_attachment', array['Authenticated users manage donation attachments'], 'donation attachment has MVP RLS');
select policies_are('public', 'kit_transformation', array['Authenticated users manage kit transformations'], 'kit transformation has MVP RLS');
select policies_are('public', 'kit_transformation_attachment', array['Authenticated users manage transformation attachments'], 'transformation attachment has MVP RLS');
select policies_are('public', 'impact_event', array['Authenticated users manage impact events'], 'impact event has MVP RLS');
select policies_are('public', 'impact_detail', array['Authenticated users manage impact details'], 'impact detail has MVP RLS');
select policies_are('public', 'impact_event_attachment', array['Authenticated users manage impact attachments'], 'impact attachment has MVP RLS');

select is((select count(*) from public.unit_of_measure), 6::bigint, 'six required units are seeded');
select is((select count(*) from public.media_type), 8::bigint, 'eight required media types are seeded');
select is((select count(*) from storage.buckets where id = 'attachments' and public = false), 1::bigint, 'private attachments bucket exists');

select * from finish();
rollback;
