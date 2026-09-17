-- Sprint S5 — Member directory (Miembros) and tenant-configurable catalogs (Mantenedores).
--
-- A tenant such as a convention keeps a directory of the people and organizations
-- affiliated with it. This is a different domain from public.organization_unit,
-- which models the tenant's own internal structure, and from public.actor, which
-- is the donation-intake counterpart registry and is not tenant scoped.
--
-- Two of the four tables are catalogs the tenant edits itself. Every catalog in
-- the schema before this migration was global and fixed by a check constraint;
-- these are the first per-tenant catalogs, so each organization is seeded with a
-- minimal default set it can then rename, reorder, or deactivate.

-- ---------------------------------------------------------------------------
-- Per-tenant module label
-- ---------------------------------------------------------------------------

alter table public.organization
  add column if not exists members_module_label text;

alter table public.organization
  drop constraint if exists organization_members_module_label_check;
alter table public.organization
  add constraint organization_members_module_label_check
  check (members_module_label is null or length(trim(members_module_label)) > 0);

comment on column public.organization.members_module_label is
  'Tenant override for the member directory module label. Null means the default translated label ("Miembros").';

-- ---------------------------------------------------------------------------
-- Catalogs
-- ---------------------------------------------------------------------------

create table if not exists public.organization_member_category (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  code text not null,
  name_es text not null,
  name_en text not null,
  applies_to text not null default 'both',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (length(trim(code)) > 0),
  check (length(trim(name_es)) > 0),
  check (length(trim(name_en)) > 0),
  check (applies_to in ('person', 'organization', 'both'))
);

create table if not exists public.organization_member_relationship_role (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  code text not null,
  name_es text not null,
  name_en text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (length(trim(code)) > 0),
  check (length(trim(name_es)) > 0),
  check (length(trim(name_en)) > 0)
);

-- ---------------------------------------------------------------------------
-- Member directory
-- ---------------------------------------------------------------------------

create table if not exists public.organization_member (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  member_type text not null,
  member_category_id uuid references public.organization_member_category(id) on delete restrict,
  name text not null,
  email text,
  phone text,
  notes text,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_type in ('person', 'organization')),
  check (status in ('active', 'inactive')),
  check (length(trim(name)) > 0),
  check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create table if not exists public.organization_member_relationship (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  member_id uuid not null references public.organization_member(id) on delete cascade,
  related_member_id uuid not null references public.organization_member(id) on delete cascade,
  relationship_role_id uuid not null references public.organization_member_relationship_role(id) on delete restrict,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, related_member_id, relationship_role_id),
  check (member_id <> related_member_id)
);

-- ---------------------------------------------------------------------------
-- Foreign-key indexes
-- ---------------------------------------------------------------------------

create index if not exists organization_member_category_org_idx
  on public.organization_member_category(organization_id, sort_order, name_es);
create index if not exists organization_member_relationship_role_org_idx
  on public.organization_member_relationship_role(organization_id, sort_order, name_es);
create index if not exists organization_member_org_idx
  on public.organization_member(organization_id, member_type, name);
create index if not exists organization_member_category_idx
  on public.organization_member(member_category_id);
create index if not exists organization_member_relationship_org_idx
  on public.organization_member_relationship(organization_id);
create index if not exists organization_member_relationship_member_idx
  on public.organization_member_relationship(member_id);
create index if not exists organization_member_relationship_related_idx
  on public.organization_member_relationship(related_member_id);
create index if not exists organization_member_relationship_role_idx
  on public.organization_member_relationship(relationship_role_id);

-- ---------------------------------------------------------------------------
-- Integrity rules that need a cross-row lookup
-- ---------------------------------------------------------------------------

-- A category belongs to one tenant and declares which member type may use it.
-- Both rules need a lookup into the catalog, so they live in a trigger rather
-- than a check constraint. They raise check_violation (23514) so a caller sees
-- the same class of error a plain constraint would produce.
create or replace function private.validate_organization_member_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_organization_id uuid;
  category_applies_to text;
begin
  if new.member_category_id is null then
    return new;
  end if;

  select category.organization_id, category.applies_to
  into category_organization_id, category_applies_to
  from public.organization_member_category category
  where category.id = new.member_category_id;

  if category_organization_id is null then
    raise exception using errcode = '23514', message = 'The member category does not exist.';
  end if;

  if category_organization_id <> new.organization_id then
    raise exception using errcode = '23514', message = 'The member category belongs to a different organization.';
  end if;

  if category_applies_to <> 'both' and category_applies_to <> new.member_type then
    raise exception using errcode = '23514', message = 'The member category does not apply to this member type.';
  end if;

  return new;
end;
$$;

-- A relationship always reads "this person holds this role in this organization".
-- Both sides, and the role, belong to the same tenant as the relationship row.
create or replace function private.validate_organization_member_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  person_type text;
  person_organization_id uuid;
  organization_type text;
  organization_organization_id uuid;
  role_organization_id uuid;
begin
  select member.member_type, member.organization_id
  into person_type, person_organization_id
  from public.organization_member member
  where member.id = new.member_id;

  select member.member_type, member.organization_id
  into organization_type, organization_organization_id
  from public.organization_member member
  where member.id = new.related_member_id;

  select role.organization_id
  into role_organization_id
  from public.organization_member_relationship_role role
  where role.id = new.relationship_role_id;

  if person_type is distinct from 'person' then
    raise exception using errcode = '23514', message = 'A relationship starts from a person member.';
  end if;

  if organization_type is distinct from 'organization' then
    raise exception using errcode = '23514', message = 'A relationship points to an organization member.';
  end if;

  if person_organization_id <> new.organization_id
    or organization_organization_id <> new.organization_id
    or role_organization_id is distinct from new.organization_id then
    raise exception using errcode = '23514', message = 'Every side of a relationship belongs to the same organization.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_organization_member_category() from public, anon, authenticated;
revoke all on function private.validate_organization_member_relationship() from public, anon, authenticated;

drop trigger if exists organization_member_category_guard on public.organization_member;
create trigger organization_member_category_guard
before insert or update on public.organization_member
for each row execute function private.validate_organization_member_category();

drop trigger if exists organization_member_relationship_guard on public.organization_member_relationship;
create trigger organization_member_relationship_guard
before insert or update on public.organization_member_relationship
for each row execute function private.validate_organization_member_relationship();

drop trigger if exists organization_member_category_updated_at on public.organization_member_category;
create trigger organization_member_category_updated_at
before update on public.organization_member_category
for each row execute function public.set_updated_at();

drop trigger if exists organization_member_relationship_role_updated_at on public.organization_member_relationship_role;
create trigger organization_member_relationship_role_updated_at
before update on public.organization_member_relationship_role
for each row execute function public.set_updated_at();

drop trigger if exists organization_member_updated_at on public.organization_member;
create trigger organization_member_updated_at
before update on public.organization_member
for each row execute function public.set_updated_at();

drop trigger if exists organization_member_relationship_updated_at on public.organization_member_relationship;
create trigger organization_member_relationship_updated_at
before update on public.organization_member_relationship
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.organization_member_category enable row level security;
alter table public.organization_member_relationship_role enable row level security;
alter table public.organization_member enable row level security;
alter table public.organization_member_relationship enable row level security;

create policy organization_member_category_select on public.organization_member_category
  for select to authenticated using (private.can_access_organization(organization_id));
create policy organization_member_category_insert on public.organization_member_category
  for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy organization_member_category_update on public.organization_member_category
  for update to authenticated using (private.can_manage_organization(organization_id))
  with check (private.can_manage_organization(organization_id));
create policy organization_member_category_delete on public.organization_member_category
  for delete to authenticated using (private.can_manage_organization(organization_id));

create policy organization_member_relationship_role_select on public.organization_member_relationship_role
  for select to authenticated using (private.can_access_organization(organization_id));
create policy organization_member_relationship_role_insert on public.organization_member_relationship_role
  for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy organization_member_relationship_role_update on public.organization_member_relationship_role
  for update to authenticated using (private.can_manage_organization(organization_id))
  with check (private.can_manage_organization(organization_id));
create policy organization_member_relationship_role_delete on public.organization_member_relationship_role
  for delete to authenticated using (private.can_manage_organization(organization_id));

create policy organization_member_select on public.organization_member
  for select to authenticated using (private.can_access_organization(organization_id));
create policy organization_member_insert on public.organization_member
  for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy organization_member_update on public.organization_member
  for update to authenticated using (private.can_manage_organization(organization_id))
  with check (private.can_manage_organization(organization_id));
create policy organization_member_delete on public.organization_member
  for delete to authenticated using (private.can_manage_organization(organization_id));

create policy organization_member_relationship_select on public.organization_member_relationship
  for select to authenticated using (private.can_access_organization(organization_id));
create policy organization_member_relationship_insert on public.organization_member_relationship
  for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy organization_member_relationship_update on public.organization_member_relationship
  for update to authenticated using (private.can_manage_organization(organization_id))
  with check (private.can_manage_organization(organization_id));
create policy organization_member_relationship_delete on public.organization_member_relationship
  for delete to authenticated using (private.can_manage_organization(organization_id));

revoke all on public.organization_member_category from anon;
revoke all on public.organization_member_relationship_role from anon;
revoke all on public.organization_member from anon;
revoke all on public.organization_member_relationship from anon;

grant select, insert, update, delete on public.organization_member_category to authenticated;
grant select, insert, update, delete on public.organization_member_relationship_role to authenticated;
grant select, insert, update, delete on public.organization_member to authenticated;
grant select, insert, update, delete on public.organization_member_relationship to authenticated;

-- ---------------------------------------------------------------------------
-- Default catalog seed
-- ---------------------------------------------------------------------------

create or replace function private.seed_organization_member_catalogs(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_member_category (organization_id, code, name_es, name_en, applies_to, sort_order)
  select target_organization_id, seed.code, seed.name_es, seed.name_en, seed.applies_to, seed.sort_order
  from (values
    ('organizacion', 'Organización', 'Organization', 'organization', 10),
    ('iglesia', 'Iglesia', 'Church', 'organization', 20),
    ('persona', 'Persona', 'Person', 'person', 30)
  ) as seed(code, name_es, name_en, applies_to, sort_order)
  on conflict (organization_id, code) do nothing;

  insert into public.organization_member_relationship_role (organization_id, code, name_es, name_en, sort_order)
  select target_organization_id, seed.code, seed.name_es, seed.name_en, seed.sort_order
  from (values
    ('pastor_principal', 'Pastor Principal', 'Lead Pastor', 10),
    ('miembro', 'Miembro', 'Member', 20),
    ('presidente', 'Presidente', 'President', 30)
  ) as seed(code, name_es, name_en, sort_order)
  on conflict (organization_id, code) do nothing;
end;
$$;

create or replace function private.seed_new_organization_member_catalogs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_organization_member_catalogs(new.id);
  return new;
end;
$$;

revoke all on function private.seed_organization_member_catalogs(uuid) from public, anon, authenticated;
revoke all on function private.seed_new_organization_member_catalogs() from public, anon, authenticated;

drop trigger if exists organization_seed_member_catalogs on public.organization;
create trigger organization_seed_member_catalogs
after insert on public.organization
for each row execute function private.seed_new_organization_member_catalogs();

-- Existing tenants, cnbv included, get the same starting set.
do $$
declare
  existing_organization_id uuid;
begin
  for existing_organization_id in select id from public.organization loop
    perform private.seed_organization_member_catalogs(existing_organization_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Module label RPC
-- ---------------------------------------------------------------------------

-- public.organization only accepts super_admin updates. The organization's own
-- admin still owns this one presentation field, so it is written through a
-- narrow RPC instead of widening the table policy over code, subscription
-- status, and the rest of the billing surface.
create or replace function public.admin_set_members_module_label(
  target_organization_id uuid,
  new_label text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_label text;
begin
  if not private.can_manage_organization(target_organization_id) then
    raise exception using errcode = '42501', message = 'Only an organization administrator can change the module label.';
  end if;

  cleaned_label := nullif(trim(coalesce(new_label, '')), '');

  update public.organization
  set members_module_label = cleaned_label
  where id = target_organization_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'The organization does not exist.';
  end if;

  return cleaned_label;
end;
$$;

revoke all on function public.admin_set_members_module_label(uuid, text) from public, anon;
grant execute on function public.admin_set_members_module_label(uuid, text) to authenticated;
