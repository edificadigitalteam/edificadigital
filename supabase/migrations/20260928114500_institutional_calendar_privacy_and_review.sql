-- Institutional preliminary calendar: unit privacy, DIGEN oversight, joint-review window,
-- review metadata and tenant-configurable module label.

alter table public.organization
  add column if not exists calendar_module_label text;

alter table public.organization
  drop constraint if exists organization_calendar_module_label_check;
alter table public.organization
  add constraint organization_calendar_module_label_check
  check (calendar_module_label is null or char_length(trim(calendar_module_label)) between 1 and 60);

alter table public.management_period
  add column if not exists calendar_joint_review_enabled boolean not null default false,
  add column if not exists calendar_joint_review_enabled_by uuid references auth.users(id) on delete set null,
  add column if not exists calendar_joint_review_enabled_at timestamptz;

alter table public.unit_work_activity
  add column if not exists modality text not null default 'in_person',
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.unit_work_activity
  drop constraint if exists unit_work_activity_modality_check;
alter table public.unit_work_activity
  add constraint unit_work_activity_modality_check
  check (modality in ('in_person','virtual','hybrid'));

alter table public.unit_work_activity
  drop constraint if exists unit_work_activity_review_status_check;
alter table public.unit_work_activity
  add constraint unit_work_activity_review_status_check
  check (review_status in ('pending','validated','observed'));

create index if not exists unit_work_activity_review_status_idx
  on public.unit_work_activity(organization_id, review_status, start_date);

create or replace function private.current_operator_is_digen(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and exists (
      select 1
      from public.organization_unit u
      join public.organization_unit_member m
        on m.unit_id = u.id
       and m.organization_id = u.organization_id
       and m.active
      where u.organization_id = target_organization_id
        and upper(trim(u.code)) = 'DIGEN'
        and u.active
        and m.operator_access_id = private.current_operator_access_id()
        and m.unit_role in ('director','manager','operator','reviewer')
    );
$$;

create or replace function private.can_manage_calendar_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_authorized_operator()
    and exists (
      select 1
      from public.unit_work_plan p
      join public.organization_unit_member m
        on m.unit_id = p.unit_id
       and m.organization_id = p.organization_id
       and m.active
      where p.id = target_plan_id
        and m.operator_access_id = private.current_operator_access_id()
        and m.unit_role in ('director','manager','operator','reviewer')
    );
$$;

create or replace function private.can_view_calendar_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unit_work_plan p
    join public.management_period mp on mp.id = p.management_period_id
    where p.id = target_plan_id
      and private.can_access_organization(p.organization_id)
      and (
        private.can_manage_calendar_plan(p.id)
        or private.current_operator_is_digen(p.organization_id)
        or (
          mp.calendar_joint_review_enabled
          and exists (
            select 1
            from public.organization_unit_member m
            where m.organization_id = p.organization_id
              and m.operator_access_id = private.current_operator_access_id()
              and m.active
              and m.unit_role in ('director','manager','operator','reviewer')
          )
        )
      )
  );
$$;

create or replace function private.guard_calendar_activity_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_digen boolean;
begin
  caller_is_digen := private.current_operator_is_digen(new.organization_id);

  if tg_op = 'INSERT' then
    if not caller_is_digen then
      new.review_status := 'pending';
      new.review_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  if not caller_is_digen and (
    new.review_status is distinct from old.review_status
    or new.review_note is distinct from old.review_note
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
  ) then
    raise exception using errcode = '42501', message = 'Only DIGEN can change calendar review fields.';
  end if;

  if not caller_is_digen and (
    new.work_plan_id is distinct from old.work_plan_id
    or new.objective_id is distinct from old.objective_id
    or new.indicator_id is distinct from old.indicator_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.status is distinct from old.status
    or new.responsible_name is distinct from old.responsible_name
    or new.modality is distinct from old.modality
  ) then
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists unit_work_activity_review_guard on public.unit_work_activity;
create trigger unit_work_activity_review_guard
before insert or update on public.unit_work_activity
for each row execute function private.guard_calendar_activity_review();

drop policy if exists unit_work_activity_select on public.unit_work_activity;
create policy unit_work_activity_select
on public.unit_work_activity
for select
to authenticated
using ((select private.can_view_calendar_plan(work_plan_id)));

drop policy if exists unit_work_activity_insert on public.unit_work_activity;
create policy unit_work_activity_insert
on public.unit_work_activity
for insert
to authenticated
with check (
  private.can_access_organization(organization_id)
  and (select private.can_manage_calendar_plan(work_plan_id))
);

drop policy if exists unit_work_activity_update on public.unit_work_activity;
create policy unit_work_activity_update
on public.unit_work_activity
for update
to authenticated
using ((select private.can_manage_calendar_plan(work_plan_id)))
with check (
  private.can_access_organization(organization_id)
  and (select private.can_manage_calendar_plan(work_plan_id))
);

drop policy if exists unit_work_activity_delete on public.unit_work_activity;
create policy unit_work_activity_delete
on public.unit_work_activity
for delete
to authenticated
using ((select private.can_manage_calendar_plan(work_plan_id)));

create or replace function public.calendar_access_overview(
  target_organization_id uuid default null,
  target_period_id uuid default null
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
  joint_enabled boolean := false;
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
  where m.organization_id = org_id
    and m.operator_access_id = private.current_operator_access_id()
    and m.active
    and m.unit_role in ('director','manager','operator','reviewer');

  is_digen := private.current_operator_is_digen(org_id);

  if target_period_id is not null then
    select mp.calendar_joint_review_enabled into joint_enabled
    from public.management_period mp
    where mp.id = target_period_id and mp.organization_id = org_id;
    joint_enabled := coalesce(joint_enabled, false);
  end if;

  return jsonb_build_object(
    'organization_id', org_id,
    'digen_unit_id', digen_id,
    'is_digen', is_digen,
    'unit_ids', membership_unit_ids,
    'joint_review_enabled', joint_enabled,
    'can_view_consolidated', is_digen or joint_enabled
  );
end;
$$;

create or replace function public.review_calendar_activity(
  target_activity_id uuid,
  target_status text,
  target_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;

  if target_status not in ('pending','validated','observed') then
    raise exception using errcode='23514', message='Invalid calendar review status';
  end if;

  select a.organization_id into org_id
  from public.unit_work_activity a
  where a.id = target_activity_id;

  if org_id is null then
    raise exception using errcode='P0002', message='Calendar activity not found';
  end if;

  if not private.current_operator_is_digen(org_id) then
    raise exception using errcode='42501', message='Only DIGEN can review calendar activities';
  end if;

  update public.unit_work_activity
  set review_status = target_status,
      review_note = nullif(trim(coalesce(target_note,'')), ''),
      reviewed_by = case when target_status = 'pending' then null else auth.uid() end,
      reviewed_at = case when target_status = 'pending' then null else now() end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = target_activity_id;

  return target_activity_id;
end;
$$;

create or replace function public.set_calendar_joint_review(
  target_period_id uuid,
  enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if not private.is_authorized_operator() then
    raise exception using errcode='42501', message='Unauthorized';
  end if;

  select mp.organization_id into org_id
  from public.management_period mp
  where mp.id = target_period_id;

  if org_id is null then
    raise exception using errcode='P0002', message='Management period not found';
  end if;

  if not private.current_operator_is_digen(org_id) then
    raise exception using errcode='42501', message='Only DIGEN can change joint calendar visibility';
  end if;

  update public.management_period
  set calendar_joint_review_enabled = enabled,
      calendar_joint_review_enabled_by = case when enabled then auth.uid() else null end,
      calendar_joint_review_enabled_at = case when enabled then now() else null end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = target_period_id;

  return enabled;
end;
$$;

create or replace function public.admin_set_calendar_module_label(
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
    raise exception using errcode='42501', message='Only an organization administrator can change the module label.';
  end if;

  cleaned_label := nullif(trim(coalesce(new_label,'')), '');

  if cleaned_label is not null and char_length(cleaned_label) > 60 then
    raise exception using errcode='22001', message='The module label may contain at most 60 characters.';
  end if;

  update public.organization
  set calendar_module_label = cleaned_label
  where id = target_organization_id;

  if not found then
    raise exception using errcode='P0002', message='The organization does not exist.';
  end if;

  return cleaned_label;
end;
$$;

revoke all on function private.current_operator_is_digen(uuid) from public, anon;
revoke all on function private.can_manage_calendar_plan(uuid) from public, anon;
revoke all on function private.can_view_calendar_plan(uuid) from public, anon;
revoke all on function private.guard_calendar_activity_review() from public, anon, authenticated;

grant execute on function private.current_operator_is_digen(uuid) to authenticated;
grant execute on function private.can_manage_calendar_plan(uuid) to authenticated;
grant execute on function private.can_view_calendar_plan(uuid) to authenticated;

revoke all on function public.calendar_access_overview(uuid,uuid) from public, anon;
revoke all on function public.review_calendar_activity(uuid,text,text) from public, anon;
revoke all on function public.set_calendar_joint_review(uuid,boolean) from public, anon;
revoke all on function public.admin_set_calendar_module_label(uuid,text) from public, anon;

grant execute on function public.calendar_access_overview(uuid,uuid) to authenticated;
grant execute on function public.review_calendar_activity(uuid,text,text) to authenticated;
grant execute on function public.set_calendar_joint_review(uuid,boolean) to authenticated;
grant execute on function public.admin_set_calendar_module_label(uuid,text) to authenticated;
