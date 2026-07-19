begin;

select plan(10);

select has_index('public', 'donation_attachment', 'donation_attachment_media_type_idx', 'donation attachment media type is indexed');
select has_index('public', 'donation_detail', 'donation_detail_unit_of_measure_idx', 'donation detail unit is indexed');
select has_index('public', 'impact_event_attachment', 'impact_event_attachment_media_type_idx', 'impact attachment media type is indexed');
select has_index('public', 'inventory_lot', 'inventory_lot_unit_of_measure_idx', 'inventory lot unit is indexed');
select has_index('public', 'inventory_movement', 'inventory_movement_responsible_actor_idx', 'movement actor is indexed');
select has_index('public', 'kit_transformation_attachment', 'kit_transformation_attachment_media_type_idx', 'transformation attachment media type is indexed');
select has_index('public', 'shipment_attachment', 'shipment_attachment_media_type_idx', 'shipment attachment media type is indexed');
select has_index('public', 'shipment_item', 'shipment_item_unit_of_measure_idx', 'shipment item unit is indexed');

select is(
  (select count(*) from pg_policies where schemaname = 'public' and (qual ilike '%auth.role%' or with_check ilike '%auth.role%')),
  0::bigint,
  'public policies avoid per-row auth function calls'
);

select is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual ilike '%auth.role%' or with_check ilike '%auth.role%')),
  0::bigint,
  'attachment policy avoids per-row auth function calls'
);

select * from finish();
rollback;
