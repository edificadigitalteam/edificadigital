-- Organizational Management foundation for conventions, churches, ministries, and other tenant organizations.
-- Extends Edifica without replacing donations, billing, auth, or existing project execution.

alter table public.organization add column if not exists organization_type text not null default 'organization';
alter table public.project alter column funding_partner drop not null;
alter table public.project add column if not exists project_type text not null default 'funded_project';
alter table public.project add column if not exists funding_source text not null default 'external';

create table if not exists public.organization_unit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  parent_unit_id uuid references public.organization_unit(id) on delete set null,
  code text not null,
  name text not null,
  unit_type text not null default 'department',
  description text,
  manager_name text,
  manager_email text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (length(trim(code)) > 0),
  check (length(trim(name)) > 0),
  check (unit_type in ('directorate','department','ministry','committee','auxiliary','academy','foundation','campus','church_area','other'))
);

create table if not exists public.organization_unit_member (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  operator_access_id uuid not null references private.operator_access(id) on delete cascade,
  unit_role text not null default 'operator',
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, operator_access_id),
  check (unit_role in ('director','manager','operator','reviewer','member'))
);

create table if not exists public.management_period (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planning',
  reporting_due_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  check (end_date >= start_date),
  check (status in ('planning','active','reporting','closed'))
);

create table if not exists public.institutional_objective (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  management_period_id uuid not null references public.management_period(id) on delete cascade,
  parent_objective_id uuid references public.institutional_objective(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  objective_level text not null default 'specific',
  weight numeric(7,2),
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, management_period_id, code),
  check (length(trim(title)) > 0),
  check (objective_level in ('general','specific','operational')),
  check (weight is null or (weight >= 0 and weight <= 100)),
  check (status in ('draft','active','completed','cancelled'))
);

create table if not exists public.objective_unit_assignment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  objective_id uuid not null references public.institutional_objective(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  assignment_type text not null default 'responsible',
  created_at timestamptz not null default now(),
  unique (objective_id, unit_id),
  check (assignment_type in ('responsible','supporting'))
);

create table if not exists public.project_organization_unit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  project_id uuid not null references public.project(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  relationship text not null default 'participant',
  created_at timestamptz not null default now(),
  unique (project_id, unit_id),
  check (relationship in ('responsible','participant'))
);

create unique index if not exists project_one_responsible_unit_idx
  on public.project_organization_unit(project_id)
  where relationship = 'responsible';

create table if not exists public.project_objective (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  project_id uuid not null references public.project(id) on delete cascade,
  objective_id uuid not null references public.institutional_objective(id) on delete cascade,
  relationship text not null default 'supporting',
  created_at timestamptz not null default now(),
  unique (project_id, objective_id),
  check (relationship in ('primary','supporting'))
);

create table if not exists public.management_indicator (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  management_period_id uuid not null references public.management_period(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  objective_id uuid references public.institutional_objective(id) on delete set null,
  project_id uuid references public.project(id) on delete set null,
  name text not null,
  description text,
  metric_type text not null default 'count',
  unit_label text,
  aggregation_method text not null default 'sum',
  target_value numeric,
  target_text text,
  currency char(3),
  frequency text not null default 'annual',
  source_note text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) > 0),
  check (metric_type in ('count','currency','percentage','ratio','boolean','text')),
  check (aggregation_method in ('sum','average','latest','max','unique_people','calculated','non_aggregable')),
  check (frequency in ('monthly','quarterly','semiannual','annual','ad_hoc')),
  check (currency is null or currency ~ '^[A-Z]{3}$')
);

create table if not exists public.indicator_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  indicator_id uuid not null references public.management_indicator(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  reporting_period_start date,
  reporting_period_end date,
  numeric_value numeric,
  text_value text,
  numerator numeric,
  denominator numeric,
  notes text,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporting_period_end is null or reporting_period_start is null or reporting_period_end >= reporting_period_start),
  check (status in ('draft','submitted','verified'))
);

create table if not exists public.unit_management_report (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  management_period_id uuid not null references public.management_period(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  status text not null default 'draft',
  executive_summary text,
  achievements text,
  challenges text,
  next_steps text,
  reviewer_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (management_period_id, unit_id),
  check (status in ('draft','submitted','reviewed','approved','closed'))
);

create index if not exists organization_unit_org_sort_idx on public.organization_unit(organization_id, sort_order, name);
create index if not exists organization_unit_member_operator_idx on public.organization_unit_member(operator_access_id, active);
create index if not exists management_period_org_status_idx on public.management_period(organization_id, status);
create index if not exists institutional_objective_period_idx on public.institutional_objective(management_period_id, objective_level, code);
create index if not exists objective_unit_assignment_unit_idx on public.objective_unit_assignment(unit_id, objective_id);
create index if not exists project_organization_unit_unit_idx on public.project_organization_unit(unit_id, project_id);
create index if not exists project_objective_objective_idx on public.project_objective(objective_id, project_id);
create index if not exists management_indicator_unit_period_idx on public.management_indicator(unit_id, management_period_id, active);
create index if not exists indicator_progress_indicator_date_idx on public.indicator_progress(indicator_id, reporting_period_end desc, created_at desc);
create index if not exists unit_management_report_period_status_idx on public.unit_management_report(management_period_id, status, unit_id);

create or replace function private.current_operator_access_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select access.id
  from private.operator_access access
  where access.active
    and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  limit 1;
$$;

create or replace function private.can_manage_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.operator_access access
    where access.active
      and lower(access.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      and access.role in ('admin','super_admin')
      and (access.role = 'super_admin' or access.organization_id = target_organization_id)
  );
$$;

create or replace function private.can_manage_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_unit unit
    where unit.id = target_unit_id
      and (
        private.can_manage_organization(unit.organization_id)
        or exists (
          select 1
          from public.organization_unit_member membership
          where membership.unit_id = unit.id
            and membership.active
            and membership.operator_access_id = private.current_operator_access_id()
            and membership.unit_role in ('director','manager','operator','reviewer')
        )
      )
  );
$$;

create or replace function private.guard_unit_report_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('approved','closed') and not private.can_manage_organization(new.organization_id) then
    raise exception using errcode = '42501', message = 'Only an organization administrator can approve or close a management report.';
  end if;
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;
  if new.status = 'reviewed' and old.status is distinct from 'reviewed' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
end;
$$;

revoke all on function private.current_operator_access_id() from public, anon;
revoke all on function private.can_manage_organization(uuid) from public, anon;
revoke all on function private.can_manage_unit(uuid) from public, anon;
grant execute on function private.current_operator_access_id() to authenticated;
grant execute on function private.can_manage_organization(uuid) to authenticated;
grant execute on function private.can_manage_unit(uuid) to authenticated;

create trigger organization_unit_updated_at before update on public.organization_unit for each row execute function public.set_updated_at();
create trigger organization_unit_member_updated_at before update on public.organization_unit_member for each row execute function public.set_updated_at();
create trigger management_period_updated_at before update on public.management_period for each row execute function public.set_updated_at();
create trigger institutional_objective_updated_at before update on public.institutional_objective for each row execute function public.set_updated_at();
create trigger management_indicator_updated_at before update on public.management_indicator for each row execute function public.set_updated_at();
create trigger indicator_progress_updated_at before update on public.indicator_progress for each row execute function public.set_updated_at();
create trigger unit_management_report_updated_at before update on public.unit_management_report for each row execute function public.set_updated_at();
create trigger unit_management_report_status_guard before update on public.unit_management_report for each row execute function private.guard_unit_report_status();

alter table public.organization_unit enable row level security;
alter table public.organization_unit_member enable row level security;
alter table public.management_period enable row level security;
alter table public.institutional_objective enable row level security;
alter table public.objective_unit_assignment enable row level security;
alter table public.project_organization_unit enable row level security;
alter table public.project_objective enable row level security;
alter table public.management_indicator enable row level security;
alter table public.indicator_progress enable row level security;
alter table public.unit_management_report enable row level security;

create policy organization_unit_select on public.organization_unit for select to authenticated using (private.can_access_organization(organization_id));
create policy organization_unit_insert on public.organization_unit for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy organization_unit_update on public.organization_unit for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
create policy organization_unit_delete on public.organization_unit for delete to authenticated using (private.can_manage_organization(organization_id));

create policy organization_unit_member_select on public.organization_unit_member for select to authenticated using (private.can_access_organization(organization_id));
create policy organization_unit_member_insert on public.organization_unit_member for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy organization_unit_member_update on public.organization_unit_member for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
create policy organization_unit_member_delete on public.organization_unit_member for delete to authenticated using (private.can_manage_organization(organization_id));

create policy management_period_select on public.management_period for select to authenticated using (private.can_access_organization(organization_id));
create policy management_period_insert on public.management_period for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy management_period_update on public.management_period for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
create policy management_period_delete on public.management_period for delete to authenticated using (private.can_manage_organization(organization_id));

create policy institutional_objective_select on public.institutional_objective for select to authenticated using (private.can_access_organization(organization_id));
create policy institutional_objective_insert on public.institutional_objective for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy institutional_objective_update on public.institutional_objective for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
create policy institutional_objective_delete on public.institutional_objective for delete to authenticated using (private.can_manage_organization(organization_id));

create policy objective_unit_assignment_select on public.objective_unit_assignment for select to authenticated using (private.can_access_organization(organization_id));
create policy objective_unit_assignment_insert on public.objective_unit_assignment for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy objective_unit_assignment_update on public.objective_unit_assignment for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
create policy objective_unit_assignment_delete on public.objective_unit_assignment for delete to authenticated using (private.can_manage_organization(organization_id));

create policy project_organization_unit_select on public.project_organization_unit for select to authenticated using (private.can_access_organization(organization_id));
create policy project_organization_unit_insert on public.project_organization_unit for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy project_organization_unit_update on public.project_organization_unit for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
create policy project_organization_unit_delete on public.project_organization_unit for delete to authenticated using (private.can_manage_organization(organization_id));

create policy project_objective_select on public.project_objective for select to authenticated using (private.can_access_organization(organization_id));
create policy project_objective_insert on public.project_objective for insert to authenticated with check (private.can_manage_organization(organization_id));
create policy project_objective_update on public.project_objective for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id));
create policy project_objective_delete on public.project_objective for delete to authenticated using (private.can_manage_organization(organization_id));

create policy management_indicator_select on public.management_indicator for select to authenticated using (private.can_access_organization(organization_id));
create policy management_indicator_insert on public.management_indicator for insert to authenticated with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
create policy management_indicator_update on public.management_indicator for update to authenticated using (private.can_manage_unit(unit_id)) with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
create policy management_indicator_delete on public.management_indicator for delete to authenticated using (private.can_manage_unit(unit_id));

create policy indicator_progress_select on public.indicator_progress for select to authenticated using (private.can_access_organization(organization_id));
create policy indicator_progress_insert on public.indicator_progress for insert to authenticated with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
create policy indicator_progress_update on public.indicator_progress for update to authenticated using (private.can_manage_unit(unit_id)) with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
create policy indicator_progress_delete on public.indicator_progress for delete to authenticated using (private.can_manage_unit(unit_id));

create policy unit_management_report_select on public.unit_management_report for select to authenticated using (private.can_access_organization(organization_id));
create policy unit_management_report_insert on public.unit_management_report for insert to authenticated with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
create policy unit_management_report_update on public.unit_management_report for update to authenticated using (private.can_manage_unit(unit_id)) with check (private.can_access_organization(organization_id) and private.can_manage_unit(unit_id));
create policy unit_management_report_delete on public.unit_management_report for delete to authenticated using (private.can_manage_organization(organization_id));

grant select, insert, update, delete on public.organization_unit to authenticated;
grant select, insert, update, delete on public.organization_unit_member to authenticated;
grant select, insert, update, delete on public.management_period to authenticated;
grant select, insert, update, delete on public.institutional_objective to authenticated;
grant select, insert, update, delete on public.objective_unit_assignment to authenticated;
grant select, insert, update, delete on public.project_organization_unit to authenticated;
grant select, insert, update, delete on public.project_objective to authenticated;
grant select, insert, update, delete on public.management_indicator to authenticated;
grant select, insert, update, delete on public.indicator_progress to authenticated;
grant select, insert, update, delete on public.unit_management_report to authenticated;

-- Seed the current CNBV tenant from the management model supplied for the demo.
insert into public.organization_unit (organization_id, code, name, unit_type, sort_order)
select organization.id, seed.code, seed.name, seed.unit_type, seed.sort_order
from public.organization organization
cross join (values
  ('DIAF','Dirección de Administración y Finanzas','directorate',10),
  ('FBCC','Fundación Bautista Campo de Carabobo','foundation',20),
  ('STBV','Seminario Teológico Bautista de Venezuela','academy',30),
  ('DEDEC','Dirección de Educación Cristiana','directorate',40),
  ('DIME','Dirección de Misiones y Evangelismo','directorate',50),
  ('DISES','Dirección de Servicio Social','directorate',60),
  ('DICOM','Dirección de Comunicaciones','directorate',70),
  ('DIPROM','Dirección de Promoción','directorate',80),
  ('UNJB','Unión Nacional de Jóvenes Bautistas','auxiliary',90),
  ('UFBMV','Unión Femenil Bautista Misionera de Venezuela','auxiliary',100),
  ('UNVBMV','Unión Nacional de Varones Bautistas Misioneros de Venezuela','auxiliary',110),
  ('UPBV','Unión de Pastores Bautistas de Venezuela','auxiliary',120)
) as seed(code,name,unit_type,sort_order)
where organization.code = 'cnbv'
on conflict (organization_id, code) do nothing;

insert into public.management_period (organization_id, name, start_date, end_date, status, reporting_due_date)
select id, 'Gestión 2026', date '2026-01-01', date '2026-12-31', 'active', date '2027-01-31'
from public.organization
where code = 'cnbv'
on conflict (organization_id, name) do nothing;

insert into public.organization_unit_member (organization_id, unit_id, operator_access_id, unit_role, is_primary)
select unit.organization_id, unit.id, access.id, 'director', true
from public.organization_unit unit
join public.organization organization on organization.id = unit.organization_id and organization.code = 'cnbv'
join private.operator_access access on lower(access.email) = 'dipromcnbv@gmail.com'
where unit.code = 'DIPROM'
on conflict (unit_id, operator_access_id) do nothing;
