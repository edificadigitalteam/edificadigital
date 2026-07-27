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

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.shipment'::regclass
      and conname = 'shipment_status_check'
      and contype = 'c'
  ),
  'shipment lifecycle is constrained'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.shipment'::regclass
      and conname = 'shipment_arrival_after_departure_check'
      and contype = 'c'
  ),
  'arrival follows departure'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.shipment_item'::regclass
      and conname = 'shipment_item_declared_quantity_check'
      and contype = 'c'
  ),
  'declared quantity is positive'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_lot'::regclass
      and conname = 'inventory_lot_quantity_check'
      and contype = 'c'
  ),
  'received quantity is positive'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_lot'::regclass
      and conname = 'inventory_lot_accepted_damaged_check'
      and contype = 'c'
  ),
  'accepted and damaged quantities reconcile'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_movement'::regclass
      and conname = 'inventory_movement_quantity_check'
      and contype = 'c'
  ),
  'inventory movement rejects zero'
);

select policies_are(
  'public',
  'shipment',
  array['Tenant operators manage shipments'],
  'shipment has the MVP authenticated policy'
);
select policies_are(
  'public',
  'shipment_item',
  array['Tenant operators manage shipment items'],
  'shipment_item has the MVP authenticated policy'
);
select policies_are(
  'public',
  'inventory_lot',
  array['Tenant operators manage inventory lots'],
  'inventory_lot has the MVP authenticated policy'
);
select policies_are(
  'public',
  'inventory_movement',
  array['Tenant operators manage inventory movements'],
  'inventory_movement has the MVP authenticated policy'
);

select * from finish();
rollback;
