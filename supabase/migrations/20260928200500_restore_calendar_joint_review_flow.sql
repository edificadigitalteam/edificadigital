-- Restore the approved calendar flow after the later privacy-hardening migration.
-- Final model: own-unit editing, DIGEN consolidated oversight, and a temporary
-- joint-review window explicitly enabled by DIGEN.

alter table public.organization
  drop constraint if exists organization_calendar_module_label_check;
alter table public.organization
  add constraint organization_calendar_module_label_check
  check (calendar_module_label is null or char_length(trim(calendar_module_label)) between 1 and 60);

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

revoke all on function public.admin_set_calendar_module_label(uuid,text) from public, anon;
grant execute on function public.admin_set_calendar_module_label(uuid,text) to authenticated;

drop function if exists private.can_view_all_unit_calendar(uuid);
drop function if exists private.can_manage_calendar_unit(uuid);
drop function if exists private.is_digen_member(uuid);
