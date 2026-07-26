-- Complete tenant isolation across inventory and delivery tables, then optimize RLS and foreign-key indexes.

create or replace function private.can_access_inventory_lot(target_inventory_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inventory_lot inventory_lot
    join public.shipment_item shipment_item on shipment_item.id = inventory_lot.shipment_item_id
    where inventory_lot.id = target_inventory_lot_id
      and private.can_access_shipment(shipment_item.shipment_id)
  );
$$;

create or replace function private.can_access_impact_event(target_impact_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.impact_event impact_event
    where impact_event.id = target_impact_event_id
      and private.can_access_organization(impact_event.organization_id)
  );
$$;

revoke all on function private.can_access_inventory_lot(uuid) from public, anon;
revoke all on function private.can_access_impact_event(uuid) from public, anon;
grant execute on function private.can_access_inventory_lot(uuid) to authenticated;
grant execute on function private.can_access_impact_event(uuid) to authenticated;

drop policy if exists "Authenticated users manage inventory lots" on public.inventory_lot;
create policy "Tenant operators manage inventory lots"
on public.inventory_lot for all to authenticated
using (
  exists (
    select 1
    from public.shipment_item shipment_item
    where shipment_item.id = inventory_lot.shipment_item_id
      and private.can_access_shipment(shipment_item.shipment_id)
  )
)
with check (
  exists (
    select 1
    from public.shipment_item shipment_item
    where shipment_item.id = inventory_lot.shipment_item_id
      and private.can_access_shipment(shipment_item.shipment_id)
  )
);

drop policy if exists "Authenticated users manage inventory movements" on public.inventory_movement;
create policy "Tenant operators manage inventory movements"
on public.inventory_movement for all to authenticated
using (private.can_access_inventory_lot(inventory_lot_id))
with check (
  private.can_access_inventory_lot(inventory_lot_id)
  and (responsible_actor_id is null or private.can_access_actor(responsible_actor_id))
);

drop policy if exists "Authorized operators manage impact donation links" on public.impact_donation;
create policy "Tenant operators manage impact donation links"
on public.impact_donation for all to authenticated
using (
  private.can_access_impact_event(impact_event_id)
  and private.can_access_donation(donation_id)
)
with check (
  private.can_access_impact_event(impact_event_id)
  and private.can_access_donation(donation_id)
  and exists (
    select 1
    from public.impact_event impact_event
    join public.donation donation on donation.id = impact_donation.donation_id
    where impact_event.id = impact_donation.impact_event_id
      and impact_event.organization_id = donation.organization_id
  )
);

-- Reference catalogues are readable by operators and managed centrally by superadministrators.
drop policy if exists "Authenticated users manage media types" on public.media_type;
create policy "Operators view media types"
on public.media_type for select to authenticated
using (private.is_authorized_operator());
create policy "Superadmins insert media types"
on public.media_type for insert to authenticated
with check (private.is_super_admin());
create policy "Superadmins update media types"
on public.media_type for update to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());
create policy "Superadmins delete media types"
on public.media_type for delete to authenticated
using (private.is_super_admin());

drop policy if exists "Authenticated users manage units" on public.unit_of_measure;
create policy "Operators view units"
on public.unit_of_measure for select to authenticated
using (private.is_authorized_operator());
create policy "Superadmins insert units"
on public.unit_of_measure for insert to authenticated
with check (private.is_super_admin());
create policy "Superadmins update units"
on public.unit_of_measure for update to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());
create policy "Superadmins delete units"
on public.unit_of_measure for delete to authenticated
using (private.is_super_admin());

-- Consolidate overlapping policies into command-specific tenant policies.
drop policy if exists "Operators view their organization" on public.organization;
drop policy if exists "Superadmins manage organizations" on public.organization;
create policy "Tenant operators view organizations"
on public.organization for select to authenticated
using (private.can_access_organization(id));
create policy "Superadmins insert organizations"
on public.organization for insert to authenticated
with check (private.is_super_admin());
create policy "Superadmins update organizations"
on public.organization for update to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());
create policy "Superadmins delete organizations"
on public.organization for delete to authenticated
using (private.is_super_admin());

drop policy if exists "Tenant operators view hosts" on public.organization_host;
drop policy if exists "Superadmins manage hosts" on public.organization_host;
create policy "Tenant operators view organization hosts"
on public.organization_host for select to authenticated
using (private.can_access_organization(organization_id));
create policy "Superadmins insert organization hosts"
on public.organization_host for insert to authenticated
with check (private.is_super_admin());
create policy "Superadmins update organization hosts"
on public.organization_host for update to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());
create policy "Superadmins delete organization hosts"
on public.organization_host for delete to authenticated
using (private.is_super_admin());

drop policy if exists "Operators view organization projects" on public.project;
drop policy if exists "Admins manage organization projects" on public.project;
create policy "Tenant operators view projects"
on public.project for select to authenticated
using (private.can_access_organization(organization_id));
create policy "Tenant admins insert projects"
on public.project for insert to authenticated
with check (
  private.is_authorized_admin()
  and private.can_access_organization(organization_id)
);
create policy "Tenant admins update projects"
on public.project for update to authenticated
using (
  private.is_authorized_admin()
  and private.can_access_organization(organization_id)
)
with check (
  private.is_authorized_admin()
  and private.can_access_organization(organization_id)
);
create policy "Tenant admins delete projects"
on public.project for delete to authenticated
using (
  private.is_authorized_admin()
  and private.can_access_organization(organization_id)
);

drop policy if exists "Operators view organization project expenses" on public.project_expense;
drop policy if exists "Operators manage organization project expenses" on public.project_expense;
create policy "Tenant operators manage project expenses"
on public.project_expense for all to authenticated
using (private.can_access_project(project_id))
with check (private.can_access_project(project_id));

drop policy if exists "Operators view organization project documents" on public.project_document;
drop policy if exists "Operators manage organization project documents" on public.project_document;
create policy "Tenant operators manage project documents"
on public.project_document for all to authenticated
using (private.can_access_project(project_id))
with check (private.can_access_project(project_id));

-- Cover foreign keys used by tenant and reporting queries.
create index if not exists donation_updated_by_idx on public.donation (updated_by) where updated_by is not null;
create index if not exists impact_event_project_idx on public.impact_event (project_id) where project_id is not null;
create index if not exists kit_transformation_project_idx on public.kit_transformation (project_id) where project_id is not null;
create index if not exists kit_transformation_created_by_idx on public.kit_transformation (created_by) where created_by is not null;
create index if not exists project_created_by_idx on public.project (created_by);
create index if not exists project_updated_by_idx on public.project (updated_by) where updated_by is not null;
create index if not exists project_document_created_by_idx on public.project_document (created_by);
create index if not exists project_expense_created_by_idx on public.project_expense (created_by);
create index if not exists project_output_created_by_idx on public.project_output (created_by);
create index if not exists project_output_updated_by_idx on public.project_output (updated_by) where updated_by is not null;
create index if not exists volunteer_created_by_idx on public.volunteer (created_by);
create index if not exists volunteer_updated_by_idx on public.volunteer (updated_by) where updated_by is not null;

comment on function private.can_access_inventory_lot(uuid) is
  'Resolves inventory tenant ownership through lot, shipment item, shipment, and donation.';
comment on function private.can_access_impact_event(uuid) is
  'Validates tenant access to a recorded delivery or impact event.';