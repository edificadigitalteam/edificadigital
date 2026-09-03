create or replace function private.guard_unit_report_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('reviewed','approved','closed')
     and (tg_op='INSERT' or old.status is distinct from new.status)
     and not private.can_review_management_reports(new.organization_id) then
    raise exception using errcode='42501', message='Only DIAF or an organization administrator can review, approve, or close a management report.';
  end if;
  if new.status = 'submitted' and (tg_op='INSERT' or old.status is distinct from 'submitted') then new.submitted_at := coalesce(new.submitted_at, now()); end if;
  if new.status = 'reviewed' and (tg_op='INSERT' or old.status is distinct from 'reviewed') then new.reviewed_at := coalesce(new.reviewed_at, now()); end if;
  if new.status = 'approved' and (tg_op='INSERT' or old.status is distinct from 'approved') then new.approved_at := coalesce(new.approved_at, now()); end if;
  return new;
end;
$$;

update public.unit_management_report report
set submitted_to_unit_id = (
  select u.id
  from public.organization_unit u
  where u.organization_id = report.organization_id
    and upper(trim(u.code)) = 'DIAF'
    and u.active
  order by u.sort_order nulls last, u.created_at
  limit 1
)
where report.submitted_to_unit_id is null
  and report.status in ('submitted','reviewed','approved','closed')
  and exists (
    select 1 from public.organization_unit u
    where u.organization_id = report.organization_id
      and upper(trim(u.code)) = 'DIAF'
      and u.active
  );
