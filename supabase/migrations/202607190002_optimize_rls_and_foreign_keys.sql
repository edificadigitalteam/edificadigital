-- Advisor-driven indexes and RLS predicate optimization.

create index if not exists donation_attachment_media_type_idx
  on public.donation_attachment (media_type_id);

create index if not exists donation_detail_unit_of_measure_idx
  on public.donation_detail (unit_of_measure_id)
  where unit_of_measure_id is not null;

create index if not exists impact_event_attachment_media_type_idx
  on public.impact_event_attachment (media_type_id);

create index if not exists inventory_lot_unit_of_measure_idx
  on public.inventory_lot (unit_of_measure_id);

create index if not exists inventory_movement_responsible_actor_idx
  on public.inventory_movement (responsible_actor_id)
  where responsible_actor_id is not null;

create index if not exists kit_transformation_attachment_media_type_idx
  on public.kit_transformation_attachment (media_type_id);

create index if not exists shipment_attachment_media_type_idx
  on public.shipment_attachment (media_type_id)
  where media_type_id is not null;

create index if not exists shipment_item_unit_of_measure_idx
  on public.shipment_item (unit_of_measure_id);

alter policy "Authenticated users manage actors"
on public.actor to authenticated using (true) with check (true);

alter policy "Authenticated users manage actor roles"
on public.actor_role to authenticated using (true) with check (true);

alter policy "Authenticated users manage media types"
on public.media_type to authenticated using (true) with check (true);

alter policy "Authenticated users manage units"
on public.unit_of_measure to authenticated using (true) with check (true);

alter policy "Authenticated users manage donations"
on public.donation to authenticated using (true) with check (true);

alter policy "Authenticated users manage donation details"
on public.donation_detail to authenticated using (true) with check (true);

alter policy "Authenticated users manage donation attachments"
on public.donation_attachment to authenticated using (true) with check (true);

alter policy "Authenticated users manage kit transformations"
on public.kit_transformation to authenticated using (true) with check (true);

alter policy "Authenticated users manage transformation attachments"
on public.kit_transformation_attachment to authenticated using (true) with check (true);

alter policy "Authenticated users manage impact events"
on public.impact_event to authenticated using (true) with check (true);

alter policy "Authenticated users manage impact details"
on public.impact_detail to authenticated using (true) with check (true);

alter policy "Authenticated users manage impact attachments"
on public.impact_event_attachment to authenticated using (true) with check (true);

alter policy "Authenticated users manage shipments"
on public.shipment to authenticated using (true) with check (true);

alter policy "Authenticated users manage shipment items"
on public.shipment_item to authenticated using (true) with check (true);

alter policy "Authenticated users manage inventory lots"
on public.inventory_lot to authenticated using (true) with check (true);

alter policy "Authenticated users manage inventory movements"
on public.inventory_movement to authenticated using (true) with check (true);

alter policy "Authenticated users manage shipment attachments"
on public.shipment_attachment to authenticated using (true) with check (true);

alter policy "Authenticated users manage attachment files"
on storage.objects to authenticated
using (bucket_id = 'attachments')
with check (bucket_id = 'attachments');
