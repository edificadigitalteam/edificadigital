-- Multi-tenant host resolution, strict tenant isolation, and tangible project execution reporting.

create table if not exists public.organization_host (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  hostname text not null,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_host_format_check check (
    hostname = lower(hostname)
    and hostname ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  constraint organization_host_unique unique (hostname)
);

create unique index if not exists organization_host_primary_unique
  on public.organization_host (organization_id)
  where is_primary and active;

create index if not exists organization_host_org_active_idx
  on public.organization_host (organization_id, active);

create trigger organization_host_set_updated_at
before update on public.organization_host
for each row execute function public.set_updated_at();

create table if not exists public.project_output (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete restrict,
  project_id uuid not null references public.project(id) on delete cascade,
  name text not null,
  unit_label text not null,
  target_quantity numeric(16,3) not null default 0,
  produced_quantity numeric(16,3) not null default 0,
  delivered_quantity numeric(16,3) not null default 0,
  beneficiary_count integer not null default 0,
  status text not null default 'in_progress',
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_output_name_check check (length(trim(name)) > 0),
  constraint project_output_unit_check check (length(trim(unit_label)) > 0),
  constraint project_output_quantities_check check (
    target_quantity >= 0 and produced_quantity >= 0 and delivered_quantity >= 0
  ),
  constraint project_output_beneficiaries_check check (beneficiary_count >= 0),
  constraint project_output_status_check check (
    status in ('planned', 'in_progress', 'completed', 'verified')
  )
);

create index if not exists project_output_project_idx
  on public.project_output (project_id, created_at);
create index if not exists project_output_org_idx
  on public.project_output (organization_id, project_id);

create trigger project_output_set_updated_at
before update on public.project_output
for each row execute function public.set_updated_at();

alter table public.actor
  add column if not exists organization_id uuid references public.organization(id) on delete restrict;

alter table public.kit_transformation
  add column if not exists organization_id uuid references public.organization(id) on delete restrict,
  add column if not exists project_id uuid references public.project(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.impact_event
  add column if not exists organization_id uuid references public.organization(id) on delete restrict,
  add column if not exists project_id uuid references public.project(id) on delete set null;

-- Backfill tenant ownership from the authenticated operator that created each record.
update public.donation donation
set organization_id = access.organization_id
from auth.users auth_user
join private.operator_access access
  on lower(access.email) = lower(auth_user.email)
where donation.organization_id is null
  and donation.created_by = auth_user.id
  and access.organization_id is not null;

update public.actor actor
set organization_id = source.organization_id
from (
  select donation.actor_id, min(donation.organization_id::text)::uuid as organization_id
  from public.donation donation
  where donation.organization_id is not null
  group by donation.actor_id
) source
where actor.id = source.actor_id
  and actor.organization_id is null;

update public.impact_event impact
set organization_id = access.organization_id
from auth.users auth_user
join private.operator_access access
  on lower(access.email) = lower(auth_user.email)
where impact.organization_id is null
  and impact.created_by = auth_user.id
  and access.organization_id is not null;

create index if not exists actor_organization_idx on public.actor (organization_id, created_at desc);
create index if not exists impact_event_organization_idx on public.impact_event (organization_id, created_at desc);
create index if not exists kit_transformation_organization_idx on public.kit_transformation (organization_id, created_at desc);

create or replace function private.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and target_organization_id is not null
    and (
      private.is_super_admin()
      or target_organization_id = private.current_operator_organization_id()
    );
$$;

create or replace function private.can_access_actor(target_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actor actor
    where actor.id = target_actor_id
      and private.can_access_organization(actor.organization_id)
  );
$$;

create or replace function private.can_access_donation(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.donation donation
    where donation.id = target_donation_id
      and private.can_access_organization(donation.organization_id)
  );
$$;

create or replace function private.can_access_donation_detail(target_detail_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.donation_detail detail
    where detail.id = target_detail_id
      and private.can_access_donation(detail.donation_id)
  );
$$;

create or replace function private.can_access_shipment(target_shipment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shipment shipment
    where shipment.id = target_shipment_id
      and private.can_access_donation(shipment.donation_id)
  );
$$;

create or replace function private.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project project
    where project.id = target_project_id
      and private.can_access_organization(project.organization_id)
  );
$$;

create or replace function private.assign_current_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'actor' and new.organization_id is null then
    new.organization_id := private.current_operator_organization_id();
  elsif tg_table_name = 'donation' and new.organization_id is null then
    new.organization_id := private.current_operator_organization_id();
  elsif tg_table_name = 'kit_transformation' then
    if new.organization_id is null then new.organization_id := private.current_operator_organization_id(); end if;
    if new.created_by is null then new.created_by := (select auth.uid()); end if;
  elsif tg_table_name = 'impact_event' and new.organization_id is null then
    new.organization_id := private.current_operator_organization_id();
  end if;
  return new;
end;
$$;

create or replace function private.enforce_project_output_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_organization_id uuid;
begin
  select project.organization_id
  into project_organization_id
  from public.project project
  where project.id = new.project_id;

  if project_organization_id is null then
    raise exception using errcode = '23503', message = 'Project was not found.';
  end if;

  if new.organization_id is null then
    new.organization_id := project_organization_id;
  elsif new.organization_id <> project_organization_id then
    raise exception using errcode = '23514', message = 'Project output must belong to the project organization.';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_by := (select auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function private.can_access_organization(uuid) from public, anon;
revoke all on function private.can_access_actor(uuid) from public, anon;
revoke all on function private.can_access_donation(uuid) from public, anon;
revoke all on function private.can_access_donation_detail(uuid) from public, anon;
revoke all on function private.can_access_shipment(uuid) from public, anon;
revoke all on function private.can_access_project(uuid) from public, anon;
revoke all on function private.assign_current_tenant() from public, anon, authenticated;
revoke all on function private.enforce_project_output_tenant() from public, anon, authenticated;
grant execute on function private.can_access_organization(uuid) to authenticated;
grant execute on function private.can_access_actor(uuid) to authenticated;
grant execute on function private.can_access_donation(uuid) to authenticated;
grant execute on function private.can_access_donation_detail(uuid) to authenticated;
grant execute on function private.can_access_shipment(uuid) to authenticated;
grant execute on function private.can_access_project(uuid) to authenticated;

drop trigger if exists actor_assign_tenant on public.actor;
create trigger actor_assign_tenant
before insert on public.actor
for each row execute function private.assign_current_tenant();

drop trigger if exists donation_assign_organization on public.donation;
create trigger donation_assign_organization
before insert on public.donation
for each row execute function private.assign_current_tenant();

drop trigger if exists kit_transformation_assign_tenant on public.kit_transformation;
create trigger kit_transformation_assign_tenant
before insert on public.kit_transformation
for each row execute function private.assign_current_tenant();

drop trigger if exists impact_event_assign_tenant on public.impact_event;
create trigger impact_event_assign_tenant
before insert on public.impact_event
for each row execute function private.assign_current_tenant();

drop trigger if exists project_output_enforce_tenant on public.project_output;
create trigger project_output_enforce_tenant
before insert or update on public.project_output
for each row execute function private.enforce_project_output_tenant();

alter table public.organization_host enable row level security;
alter table public.project_output enable row level security;

-- Replace broad authenticated policies with tenant-bound policies.
drop policy if exists "Authenticated users manage actors" on public.actor;
create policy "Tenant operators manage actors"
on public.actor for all to authenticated
using (private.can_access_organization(organization_id))
with check (private.can_access_organization(organization_id));

drop policy if exists "Authenticated users manage actor roles" on public.actor_role;
create policy "Tenant operators manage actor roles"
on public.actor_role for all to authenticated
using (private.can_access_actor(actor_id))
with check (private.can_access_actor(actor_id));

drop policy if exists "Authenticated users manage donations" on public.donation;
create policy "Tenant operators manage donations"
on public.donation for all to authenticated
using (private.can_access_organization(organization_id))
with check (
  private.can_access_organization(organization_id)
  and (project_id is null or private.can_access_project(project_id))
);

drop policy if exists "Authenticated users manage donation details" on public.donation_detail;
create policy "Tenant operators manage donation details"
on public.donation_detail for all to authenticated
using (private.can_access_donation(donation_id))
with check (private.can_access_donation(donation_id));

drop policy if exists "Authorized operators manage monetary donation details" on public.monetary_donation_detail;
create policy "Tenant operators manage monetary donation details"
on public.monetary_donation_detail for all to authenticated
using (private.can_access_donation_detail(donation_detail_id))
with check (private.can_access_donation_detail(donation_detail_id));

drop policy if exists "Authenticated users manage donation attachments" on public.donation_attachment;
create policy "Tenant operators manage donation attachments"
on public.donation_attachment for all to authenticated
using (private.can_access_donation(donation_id))
with check (private.can_access_donation(donation_id));

drop policy if exists "Authenticated users manage shipments" on public.shipment;
create policy "Tenant operators manage shipments"
on public.shipment for all to authenticated
using (private.can_access_donation(donation_id))
with check (private.can_access_donation(donation_id));

drop policy if exists "Authenticated users manage shipment items" on public.shipment_item;
create policy "Tenant operators manage shipment items"
on public.shipment_item for all to authenticated
using (private.can_access_shipment(shipment_id))
with check (private.can_access_shipment(shipment_id));

drop policy if exists "Authenticated users manage shipment attachments" on public.shipment_attachment;
create policy "Tenant operators manage shipment attachments"
on public.shipment_attachment for all to authenticated
using (private.can_access_shipment(shipment_id))
with check (private.can_access_shipment(shipment_id));

drop policy if exists "Authenticated users manage kit transformations" on public.kit_transformation;
create policy "Tenant operators manage kit transformations"
on public.kit_transformation for all to authenticated
using (private.can_access_organization(organization_id))
with check (
  private.can_access_organization(organization_id)
  and (project_id is null or private.can_access_project(project_id))
);

drop policy if exists "Authenticated users manage transformation attachments" on public.kit_transformation_attachment;
create policy "Tenant operators manage transformation attachments"
on public.kit_transformation_attachment for all to authenticated
using (
  exists (
    select 1 from public.kit_transformation transformation
    where transformation.id = kit_transformation_attachment.kit_transformation_id
      and private.can_access_organization(transformation.organization_id)
  )
)
with check (
  exists (
    select 1 from public.kit_transformation transformation
    where transformation.id = kit_transformation_attachment.kit_transformation_id
      and private.can_access_organization(transformation.organization_id)
  )
);

drop policy if exists "Authenticated users manage impact events" on public.impact_event;
create policy "Tenant operators manage impact events"
on public.impact_event for all to authenticated
using (private.can_access_organization(organization_id))
with check (
  private.can_access_organization(organization_id)
  and (project_id is null or private.can_access_project(project_id))
);

drop policy if exists "Authenticated users manage impact details" on public.impact_detail;
create policy "Tenant operators manage impact details"
on public.impact_detail for all to authenticated
using (
  exists (
    select 1 from public.impact_event event
    where event.id = impact_detail.impact_event_id
      and private.can_access_organization(event.organization_id)
  )
)
with check (
  exists (
    select 1 from public.impact_event event
    where event.id = impact_detail.impact_event_id
      and private.can_access_organization(event.organization_id)
  )
);

drop policy if exists "Authenticated users manage impact attachments" on public.impact_event_attachment;
create policy "Tenant operators manage impact attachments"
on public.impact_event_attachment for all to authenticated
using (
  exists (
    select 1 from public.impact_event event
    where event.id = impact_event_attachment.impact_event_id
      and private.can_access_organization(event.organization_id)
  )
)
with check (
  exists (
    select 1 from public.impact_event event
    where event.id = impact_event_attachment.impact_event_id
      and private.can_access_organization(event.organization_id)
  )
);

create policy "Tenant operators view hosts"
on public.organization_host for select to authenticated
using (private.can_access_organization(organization_id));

create policy "Superadmins manage hosts"
on public.organization_host for all to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy "Tenant operators manage project outputs"
on public.project_output for all to authenticated
using (private.can_access_project(project_id))
with check (
  private.can_access_project(project_id)
  and private.can_access_organization(organization_id)
);

grant select, insert, update, delete on public.organization_host, public.project_output to authenticated;
revoke all on public.organization_host, public.project_output from anon;

create or replace function public.resolve_tenant_host(host_input text)
returns table (
  organization_id uuid,
  organization_code text,
  organization_name text,
  hostname text,
  subscription_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organization.id,
    organization.code,
    organization.name,
    host.hostname,
    organization.subscription_status
  from public.organization_host host
  join public.organization organization on organization.id = host.organization_id
  where host.active
    and organization.active
    and organization.subscription_status in ('trial', 'active')
    and host.hostname = lower(split_part(trim(coalesce(host_input, '')), ':', 1))
  limit 1;
$$;

revoke all on function public.resolve_tenant_host(text) from public;
grant execute on function public.resolve_tenant_host(text) to anon, authenticated;

create or replace function public.admin_list_organization_hosts()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  hostname text,
  is_primary boolean,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  return query
  select host.id, host.organization_id, organization.name, host.hostname,
         host.is_primary, host.active, host.created_at, host.updated_at
  from public.organization_host host
  join public.organization organization on organization.id = host.organization_id
  order by lower(organization.name), host.is_primary desc, lower(host.hostname);
end;
$$;

create or replace function public.admin_save_organization_host(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_organization_id uuid;
  target_hostname text;
  target_primary boolean;
  target_active boolean;
  saved public.organization_host%rowtype;
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  target_id := nullif(payload ->> 'id', '')::uuid;
  target_organization_id := nullif(payload ->> 'organization_id', '')::uuid;
  target_hostname := lower(split_part(trim(coalesce(payload ->> 'hostname', '')), ':', 1));
  target_primary := coalesce((payload ->> 'is_primary')::boolean, false);
  target_active := coalesce((payload ->> 'active')::boolean, true);

  if target_organization_id is null then
    raise exception using errcode = '22023', message = 'Organization is required.';
  end if;

  if target_hostname !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then
    raise exception using errcode = '22023', message = 'A valid hostname is required.';
  end if;

  if target_primary and target_active then
    update public.organization_host
    set is_primary = false, updated_at = now()
    where organization_id = target_organization_id
      and id is distinct from target_id;
  end if;

  if target_id is null then
    insert into public.organization_host (organization_id, hostname, is_primary, active)
    values (target_organization_id, target_hostname, target_primary, target_active)
    returning * into saved;
  else
    update public.organization_host
    set organization_id = target_organization_id,
        hostname = target_hostname,
        is_primary = target_primary,
        active = target_active,
        updated_at = now()
    where id = target_id
    returning * into saved;
  end if;

  if saved.id is null then
    raise exception using errcode = 'P0002', message = 'Host record was not found.';
  end if;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.admin_list_organization_hosts() from public, anon;
revoke all on function public.admin_save_organization_host(jsonb) from public, anon;
grant execute on function public.admin_list_organization_hosts() to authenticated;
grant execute on function public.admin_save_organization_host(jsonb) to authenticated;

create or replace function private.storage_object_in_current_tenant(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
  owner_user_id uuid;
  owner_organization_id uuid;
begin
  if private.is_super_admin() then return true; end if;

  folders := storage.foldername(object_name);
  if coalesce(array_length(folders, 1), 0) < 2 then return false; end if;

  begin
    owner_user_id := folders[2]::uuid;
  exception when others then
    return false;
  end;

  select access.organization_id
  into owner_organization_id
  from auth.users auth_user
  join private.operator_access access
    on lower(access.email) = lower(auth_user.email)
  where auth_user.id = owner_user_id
    and access.active
  limit 1;

  return owner_organization_id is not null
    and owner_organization_id = private.current_operator_organization_id();
end;
$$;

revoke all on function private.storage_object_in_current_tenant(text) from public, anon;
grant execute on function private.storage_object_in_current_tenant(text) to authenticated;

drop policy if exists "Authenticated users manage attachment files" on storage.objects;
create policy "Tenant operators manage attachment files"
on storage.objects for all to authenticated
using (
  bucket_id = 'attachments'
  and private.is_authorized_operator()
  and private.storage_object_in_current_tenant(name)
)
with check (
  bucket_id = 'attachments'
  and private.is_authorized_operator()
  and private.storage_object_in_current_tenant(name)
);

comment on table public.organization_host is 'Maps custom domains and subdomains to one Edifica tenant organization.';
comment on table public.project_output is 'Stores planned, produced, delivered, and beneficiary quantities for tangible project compliance.';
comment on function public.resolve_tenant_host(text) is 'Resolves a public hostname to an active Edifica tenant without exposing private data.';