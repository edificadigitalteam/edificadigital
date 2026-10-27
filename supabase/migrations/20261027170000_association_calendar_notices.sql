-- S11.4: Information-only dates owned by regional associations, not work-plan units.
-- Access uses the existing tenant admin or calendar.manage_all institutional permission.
create table public.association_calendar_notice (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organization(id) on delete cascade,
 management_period_id uuid not null references public.management_period(id) on delete cascade,
 association_name text not null,
 title text not null,
 description text,
 start_date date not null,
 end_date date,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint association_calendar_notice_association_name_ck check (length(trim(association_name)) between 1 and 200),
 constraint association_calendar_notice_title_ck check (length(trim(title)) between 1 and 300),
 constraint association_calendar_notice_date_ck check (end_date is null or end_date >= start_date)
);

create index association_calendar_notice_org_period_date_idx
 on public.association_calendar_notice (organization_id,management_period_id,start_date);
create index association_calendar_notice_period_idx
 on public.association_calendar_notice (management_period_id,start_date);
create index association_calendar_notice_created_by_idx
 on public.association_calendar_notice (created_by) where created_by is not null;
create index association_calendar_notice_updated_by_idx
 on public.association_calendar_notice (updated_by) where updated_by is not null;

create or replace function private.can_manage_association_calendar(target_org_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select private.is_authorized_operator()
   and private.can_access_organization(target_org_id)
   and (
     private.can_manage_organization(target_org_id)
     or private.current_operator_has_permission(target_org_id,'calendar.manage_all')
   )
$$;
revoke all on function private.can_manage_association_calendar(uuid) from public,anon;
grant execute on function private.can_manage_association_calendar(uuid) to authenticated;

create or replace function private.guard_association_calendar_notice()
returns trigger language plpgsql security definer set search_path=''
as $$
declare period_row record;
begin
  select p.organization_id,p.start_date,p.end_date into period_row
  from public.management_period p where p.id=new.management_period_id;
  if not found or new.organization_id is distinct from period_row.organization_id then
    raise exception using errcode='23514',message='Association activity must belong to the same organization and period';
  end if;
  if new.start_date<period_row.start_date or new.start_date>period_row.end_date
     or (new.end_date is not null and new.end_date>period_row.end_date) then
    raise exception using errcode='23514',message='Association activity dates must be within the selected management period';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_association_calendar_notice() from public,anon,authenticated;

create trigger association_calendar_notice_guard
before insert or update on public.association_calendar_notice
for each row execute function private.guard_association_calendar_notice();

create trigger association_calendar_notice_updated_at
before update on public.association_calendar_notice
for each row execute function public.set_updated_at();

alter table public.association_calendar_notice enable row level security;

create policy association_calendar_notice_select
on public.association_calendar_notice for select to authenticated
using (private.is_authorized_operator() and private.can_access_organization(organization_id));

create policy association_calendar_notice_insert
on public.association_calendar_notice for insert to authenticated
with check (private.can_manage_association_calendar(organization_id));

create policy association_calendar_notice_update
on public.association_calendar_notice for update to authenticated
using (private.can_manage_association_calendar(organization_id))
with check (private.can_manage_association_calendar(organization_id));

create policy association_calendar_notice_delete
on public.association_calendar_notice for delete to authenticated
using (private.can_manage_association_calendar(organization_id));

revoke all on table public.association_calendar_notice from public,anon;
grant select,insert,update,delete on table public.association_calendar_notice to authenticated;
grant select,insert,update,delete on table public.association_calendar_notice to service_role;
