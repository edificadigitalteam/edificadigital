create index if not exists management_period_calendar_joint_review_enabled_by_idx
  on public.management_period(calendar_joint_review_enabled_by)
  where calendar_joint_review_enabled_by is not null;

create index if not exists unit_work_activity_reviewed_by_idx
  on public.unit_work_activity(reviewed_by)
  where reviewed_by is not null;
