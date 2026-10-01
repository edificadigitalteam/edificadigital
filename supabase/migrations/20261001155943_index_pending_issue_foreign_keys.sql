-- Cover pending-issue foreign keys used by period and unit filters.
create index if not exists unit_pending_issue_management_period_id_idx
  on public.unit_pending_issue(management_period_id);

create index if not exists unit_pending_issue_unit_id_idx
  on public.unit_pending_issue(unit_id);
