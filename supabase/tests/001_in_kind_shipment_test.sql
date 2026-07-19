begin;

select plan(20);

select has_table('public', 'shipment', 'shipment table exists');
select has_table('public', 'shipment_item', 'shipment_item table exists');
select has_table('public', 'inventory_lot', 'inventory_lot table exists');
select has_table('public', 'inventory_movement', 'inventory_movement table exists');
select has_table('public', 'shipment_attachment', 'shipment_attachment table exists');
select has_view('public', 'inventory_lot_balance', 'inventory balance view exists');

select col_type_is('public', 'shipment', 'status', 'text', 'shipment status uses text with a check constraint');
select col_type_is('public', 'shipment_item', 'declared_quantity', 'numeric(14,3)', 'declared quantity preserves three decimals');
select col_type_is('public', 'inventory_lot', 'dietary_attributes', 'text[]', 'dietary attributes use a text array');
select col_type_is('public', 'inventory_movement', 'quantity', 'numeric(14,3)', 'movement quantity preserves three decimals');

select has_check('public', 'shipment', 'shipment_status_check', 'shipment lifecycle is constrained');
select has_check('public', 'shipment', 'shipment_arrival_after_departure_check', 'arrival follows departure');
select has_check('public', 'shipment_item', 'shipment_item_declared_quantity_check', 'declared quantity is positive');
select has_check('public', 'inventory_lot', 'inventory_lot_quantity_check', 'received quantity is positive');
select has_check('public', 'inventory_lot', 'inventory_lot_accepted_damaged_check', 'accepted and damaged quantities reconcile');
select has_check('public', 'inventory_movement', 'inventory_movement_quantity_check', 'inventory movement rejects zero');

select policies_are(
  'public',
  'shipment',
  array['Authenticated users manage shipments'],
  'shipment has the MVP authenticated policy'
);
select policies_are(
  'public',
  'shipment_item',
  array['Authenticated users manage shipment items'],
  'shipment_item has the MVP authenticated policy'
);
select policies_are(
  'public',
  'inventory_lot',
  array['Authenticated users manage inventory lots'],
  'inventory_lot has the MVP authenticated policy'
);
select policies_are(
  'public',
  'inventory_movement',
  array['Authenticated users manage inventory movements'],
  'inventory_movement has the MVP authenticated policy'
);

select * from finish();
rollback;
