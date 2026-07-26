create or replace function public.list_project_beneficiaries(target_project_id uuid)
returns table (
  id uuid,
  project_id uuid,
  organization_id uuid,
  full_name text,
  identification_number text,
  email text,
  phone text,
  residence_country text,
  residence_area text,
  age_band text,
  sex text,
  benefit_received text,
  household_members_represented integer,
  notes text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  project_org uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode = '42501', message = 'Operational access is required.';
  end if;

  select project.organization_id
  into project_org
  from public.project project
  where project.id = target_project_id;

  if project_org is null or not private.can_access_organization(project_org) then
    raise exception using errcode = '42501', message = 'Project access is unavailable.';
  end if;

  return query
  select
    beneficiary.id,
    beneficiary.project_id,
    beneficiary.organization_id,
    beneficiary.full_name,
    beneficiary.identification_number,
    beneficiary.email,
    beneficiary.phone,
    beneficiary.residence_country,
    beneficiary.residence_area,
    beneficiary.age_band,
    beneficiary.sex,
    beneficiary.benefit_received,
    coalesce((
      select max(event.household_members_represented)
      from private.beneficiary_event event
      where event.beneficiary_id = beneficiary.id
    ), 1),
    beneficiary.notes,
    beneficiary.active,
    beneficiary.created_at,
    beneficiary.updated_at
  from private.beneficiary beneficiary
  where beneficiary.project_id = target_project_id
    and beneficiary.archived_at is null
  order by beneficiary.created_at desc;
end;
$$;

revoke all on function public.list_project_beneficiaries(uuid) from public, anon;
grant execute on function public.list_project_beneficiaries(uuid) to authenticated;
