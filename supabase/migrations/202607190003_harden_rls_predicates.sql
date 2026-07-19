-- Keep explicit authenticated-user checks while using scalar subqueries so
-- Postgres initializes auth.role() once per statement.

alter policy "Authenticated users manage actors"
on public.actor to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage actor roles"
on public.actor_role to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage media types"
on public.media_type to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage units"
on public.unit_of_measure to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage donations"
on public.donation to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage donation details"
on public.donation_detail to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage donation attachments"
on public.donation_attachment to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage kit transformations"
on public.kit_transformation to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage transformation attachments"
on public.kit_transformation_attachment to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage impact events"
on public.impact_event to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage impact details"
on public.impact_detail to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage impact attachments"
on public.impact_event_attachment to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage shipments"
on public.shipment to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage shipment items"
on public.shipment_item to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage inventory lots"
on public.inventory_lot to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage inventory movements"
on public.inventory_movement to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage shipment attachments"
on public.shipment_attachment to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

alter policy "Authenticated users manage attachment files"
on storage.objects to authenticated
using (
  bucket_id = 'attachments'
  and (select auth.role()) = 'authenticated'
)
with check (
  bucket_id = 'attachments'
  and (select auth.role()) = 'authenticated'
);
