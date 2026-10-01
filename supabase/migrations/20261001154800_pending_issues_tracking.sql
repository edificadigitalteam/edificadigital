-- Pending issues tracking per organizational unit with DIGEN consolidated oversight.

create table if not exists public.unit_pending_issue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  management_period_id uuid not null references public.management_period(id) on delete cascade,
  unit_id uuid not null references public.organization_unit(id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'pending',
  urgency text not null default 'medium',
  due_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_pending_issue_title_check check (char_length(trim(title)) between 1 and 180),
  constraint unit_pending_issue_description_check check (char_length(trim(description)) between 1 and 4000),
  constraint unit_pending_issue_status_check check (status in ('pending','in_progress','completed')),
  constraint unit_pending_issue_urgency_check check (urgency in ('low','medium','high','critical'))
);

create index if not exists unit_pending_issue_org_period_unit_status_idx
  on public.unit_pending_issue(organization_id, management_period_id, unit_id, status);

create index if not exists unit_pending_issue_org_period_urgency_due_idx
  on public.unit_pending_issue(organization_id, management_period_id, urgency, due_date)
  where status <> 'completed';

create index if not exists unit_pending_issue_created_by_idx
  on public.unit_pending_issue(created_by)
  where created_by is not null;

create index if not exists unit_pending_issue_updated_by_idx
  on public.unit_pending_issue(updated_by)
  where updated_by is not null;

create or replace function private.can_access_pending_issue_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and exists (
      select 1
      from public.organization_unit_member m
      join public.organization_unit u
        on u.id = m.unit_id
       and u.organization_id = m.organization_id
       and u.active
      where m.unit_id = target_unit_id
        and m.operator_access_id = private.current_operator_access_id()
        and m.active
        and m.unit_role in ('director','manager','operator','reviewer')
    );
$$;

create or replace function private.guard_pending_issue_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organization_unit u
    where u.id = new.unit_id
      and u.organization_id = new.organization_id
      and u.active
  ) then
    raise exception using errcode='23514', message='Pending issue unit must belong to the same organization.';
  end if;

  if not exists (
    select 1
    from public.management_period mp
    where mp.id = new.management_period_id
      and mp.organization_id = new.organization_id
  ) then
    raise exception using errcode='23514', message='Pending issue period must belong to the same organization.';
  end if;

  new.updated_at := now();

  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists unit_pending_issue_scope_guard on public.unit_pending_issue;
create trigger unit_pending_issue_scope_guard
before insert or update on public.unit_pending_issue
for each row execute function private.guard_pending_issue_scope();

alter table public.unit_pending_issue enable row level security;

drop policy if exists unit_pending_issue_select on public.unit_pending_issue;
create policy unit_pending_issue_select
on public.unit_pending_issue
for select
to authenticated
using (
  private.can_access_organization(organization_id)
  and (
    (select private.can_access_pending_issue_unit(unit_id))
    or (select private.current_operator_is_digen(organization_id))
  )
);

drop policy if exists unit_pending_issue_insert on public.unit_pending_issue;
create policy unit_pending_issue_insert
on public.unit_pending_issue
for insert
to authenticated
with check (
  private.can_access_organization(organization_id)
  and (select private.can_access_pending_issue_unit(unit_id))
);

drop policy if exists unit_pending_issue_update on public.unit_pending_issue;
create policy unit_pending_issue_update
on public.unit_pending_issue
for update
to authenticated
using ((select private.can_access_pending_issue_unit(unit_id)))
with check (
  private.can_access_organization(organization_id)
  and (select private.can_access_pending_issue_unit(unit_id))
);

drop policy if exists unit_pending_issue_delete on public.unit_pending_issue;
create policy unit_pending_issue_delete
on public.unit_pending_issue
for delete
to authenticated
using ((select private.can_access_pending_issue_unit(unit_id)));

create or replace function public.pending_issue_access_overview(
  target_organization_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  digen_id uuid;
  membership_unit_ids jsonb;
  is_digen boolean := false;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;

  org_id := case
    when private.is_super_admin() and target_organization_id is not null then target_organization_id
    else private.current_operator_organization_id()
  end;

  if org_id is null or not private.can_access_organization(org_id) then
    raise exception using errcode='42501', message='Organization access denied';
  end if;

  select u.id into digen_id
  from public.organization_unit u
  where u.organization_id = org_id
    and upper(trim(u.code)) = 'DIGEN'
    and u.active
  limit 1;

  select coalesce(jsonb_agg(m.unit_id order by m.created_at), '[]'::jsonb)
  into membership_unit_ids
  from public.organization_unit_member m
  join public.organization_unit u
    on u.id = m.unit_id
   and u.organization_id = m.organization_id
   and u.active
  where m.organization_id = org_id
    and m.operator_access_id = private.current_operator_access_id()
    and m.active
    and m.unit_role in ('director','manager','operator','reviewer');

  is_digen := private.current_operator_is_digen(org_id);

  return jsonb_build_object(
    'organization_id', org_id,
    'digen_unit_id', digen_id,
    'is_digen', is_digen,
    'unit_ids', membership_unit_ids,
    'can_view_consolidated', is_digen
  );
end;
$$;

revoke all on table public.unit_pending_issue from anon;
grant select, insert, update, delete on table public.unit_pending_issue to authenticated;

revoke all on function private.can_access_pending_issue_unit(uuid) from public, anon;
grant execute on function private.can_access_pending_issue_unit(uuid) to authenticated;

revoke all on function private.guard_pending_issue_scope() from public, anon, authenticated;

revoke all on function public.pending_issue_access_overview(uuid) from public, anon;
grant execute on function public.pending_issue_access_overview(uuid) to authenticated;
