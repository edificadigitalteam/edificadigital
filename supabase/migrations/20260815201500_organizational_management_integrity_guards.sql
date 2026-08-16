-- Harden tenant consistency and report approval rules for Organizational Management.

alter table public.project drop constraint if exists project_type_check;
alter table public.project add constraint project_type_check check (project_type in ('funded_project','institutional_project','program','campaign','initiative','other'));
alter table public.project drop constraint if exists project_funding_source_check;
alter table public.project add constraint project_funding_source_check check (funding_source in ('external','own','mixed','none'));

create or replace function private.validate_organization_unit_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_org uuid;
begin
  if new.parent_unit_id is null then return new; end if;
  select unit.organization_id into parent_org from public.organization_unit unit where unit.id = new.parent_unit_id;
  if parent_org is distinct from new.organization_id then raise exception using errcode='23514', message='The parent unit must belong to the same organization.'; end if;
  if new.id is not null and new.parent_unit_id = new.id then raise exception using errcode='23514', message='A unit cannot be its own parent.'; end if;
  return new;
end $$;

create or replace function private.validate_objective_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_org uuid; parent_period uuid;
begin
  if new.parent_objective_id is null then return new; end if;
  select objective.organization_id, objective.management_period_id into parent_org, parent_period from public.institutional_objective objective where objective.id = new.parent_objective_id;
  if parent_org is distinct from new.organization_id or parent_period is distinct from new.management_period_id then raise exception using errcode='23514', message='The parent objective must belong to the same organization and management period.'; end if;
  if new.id is not null and new.parent_objective_id = new.id then raise exception using errcode='23514', message='An objective cannot be its own parent.'; end if;
  return new;
end $$;

create or replace function private.validate_project_unit_relation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_org uuid; unit_org uuid;
begin
  select project.organization_id into project_org from public.project project where project.id = new.project_id;
  select unit.organization_id into unit_org from public.organization_unit unit where unit.id = new.unit_id;
  if project_org is distinct from new.organization_id or unit_org is distinct from new.organization_id then raise exception using errcode='23514', message='Project and organizational unit must belong to the same organization.'; end if;
  return new;
end $$;

create or replace function private.validate_project_objective_relation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_org uuid; objective_org uuid;
begin
  select project.organization_id into project_org from public.project project where project.id = new.project_id;
  select objective.organization_id into objective_org from public.institutional_objective objective where objective.id = new.objective_id;
  if project_org is distinct from new.organization_id or objective_org is distinct from new.organization_id then raise exception using errcode='23514', message='Project and objective must belong to the same organization.'; end if;
  return new;
end $$;

create or replace function private.validate_indicator_tenant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare unit_org uuid; period_org uuid; objective_org uuid; project_org uuid;
begin
  select unit.organization_id into unit_org from public.organization_unit unit where unit.id = new.unit_id;
  select period.organization_id into period_org from public.management_period period where period.id = new.management_period_id;
  if new.objective_id is not null then select objective.organization_id into objective_org from public.institutional_objective objective where objective.id = new.objective_id; end if;
  if new.project_id is not null then select project.organization_id into project_org from public.project project where project.id = new.project_id; end if;
  if unit_org is distinct from new.organization_id or period_org is distinct from new.organization_id or (new.objective_id is not null and objective_org is distinct from new.organization_id) or (new.project_id is not null and project_org is distinct from new.organization_id) then raise exception using errcode='23514', message='Indicator relationships must belong to the same organization.'; end if;
  return new;
end $$;

create or replace function private.validate_progress_tenant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare unit_org uuid; indicator_org uuid; indicator_unit uuid;
begin
  select unit.organization_id into unit_org from public.organization_unit unit where unit.id = new.unit_id;
  select indicator.organization_id, indicator.unit_id into indicator_org, indicator_unit from public.management_indicator indicator where indicator.id = new.indicator_id;
  if unit_org is distinct from new.organization_id or indicator_org is distinct from new.organization_id or indicator_unit is distinct from new.unit_id then raise exception using errcode='23514', message='Progress must use the same organization and unit as its indicator.'; end if;
  return new;
end $$;

create or replace function private.validate_report_tenant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare unit_org uuid; period_org uuid;
begin
  select unit.organization_id into unit_org from public.organization_unit unit where unit.id = new.unit_id;
  select period.organization_id into period_org from public.management_period period where period.id = new.management_period_id;
  if unit_org is distinct from new.organization_id or period_org is distinct from new.organization_id then raise exception using errcode='23514', message='Report unit and period must belong to the same organization.'; end if;
  return new;
end $$;

create or replace function private.guard_unit_report_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('approved','closed') and not private.can_manage_organization(new.organization_id) then raise exception using errcode='42501', message='Only an organization administrator can approve or close a management report.'; end if;
  if new.status = 'submitted' and (tg_op='INSERT' or old.status is distinct from 'submitted') then new.submitted_at := coalesce(new.submitted_at, now()); end if;
  if new.status = 'reviewed' and (tg_op='INSERT' or old.status is distinct from 'reviewed') then new.reviewed_at := coalesce(new.reviewed_at, now()); end if;
  if new.status = 'approved' and (tg_op='INSERT' or old.status is distinct from 'approved') then new.approved_at := coalesce(new.approved_at, now()); end if;
  return new;
end $$;

drop trigger if exists organization_unit_parent_guard on public.organization_unit;
create trigger organization_unit_parent_guard before insert or update on public.organization_unit for each row execute function private.validate_organization_unit_parent();
drop trigger if exists institutional_objective_parent_guard on public.institutional_objective;
create trigger institutional_objective_parent_guard before insert or update on public.institutional_objective for each row execute function private.validate_objective_parent();
drop trigger if exists project_organization_unit_tenant_guard on public.project_organization_unit;
create trigger project_organization_unit_tenant_guard before insert or update on public.project_organization_unit for each row execute function private.validate_project_unit_relation();
drop trigger if exists project_objective_tenant_guard on public.project_objective;
create trigger project_objective_tenant_guard before insert or update on public.project_objective for each row execute function private.validate_project_objective_relation();
drop trigger if exists management_indicator_tenant_guard on public.management_indicator;
create trigger management_indicator_tenant_guard before insert or update on public.management_indicator for each row execute function private.validate_indicator_tenant();
drop trigger if exists indicator_progress_tenant_guard on public.indicator_progress;
create trigger indicator_progress_tenant_guard before insert or update on public.indicator_progress for each row execute function private.validate_progress_tenant();
drop trigger if exists unit_management_report_tenant_guard on public.unit_management_report;
create trigger unit_management_report_tenant_guard before insert or update on public.unit_management_report for each row execute function private.validate_report_tenant();
drop trigger if exists unit_management_report_status_guard on public.unit_management_report;
create trigger unit_management_report_status_guard before insert or update on public.unit_management_report for each row execute function private.guard_unit_report_status();

revoke all on function private.validate_organization_unit_parent() from public, anon, authenticated;
revoke all on function private.validate_objective_parent() from public, anon, authenticated;
revoke all on function private.validate_project_unit_relation() from public, anon, authenticated;
revoke all on function private.validate_project_objective_relation() from public, anon, authenticated;
revoke all on function private.validate_indicator_tenant() from public, anon, authenticated;
revoke all on function private.validate_progress_tenant() from public, anon, authenticated;
revoke all on function private.validate_report_tenant() from public, anon, authenticated;
revoke all on function private.guard_unit_report_status() from public, anon, authenticated;
