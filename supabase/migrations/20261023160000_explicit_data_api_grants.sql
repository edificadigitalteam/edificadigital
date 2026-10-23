-- Explicit Data API grants.
--
-- From 2026-10-30 Supabase stops granting anon, authenticated and service_role
-- access to new tables in `public` automatically. Existing projects keep their
-- grants, but any database built from migrations (db reset, preview branches,
-- new projects) only gets the privileges the migrations state.
--
-- These eight tables were created without explicit grants and relied on the
-- automatic ones. This migration states the intended privileges so a rebuilt
-- database matches edifydb. In edifydb it also drops the unused automatic
-- privileges (anon access, TRUNCATE/REFERENCES/TRIGGER, finance table writes);
-- every RLS policy targets authenticated and finance writes go through
-- security-definer RPCs, so application behavior is unchanged.

-- Finance: read through the Data API, written through RPCs only.
revoke all on table
  public.finance_fund,
  public.finance_submission,
  public.finance_transaction,
  public.finance_submission_attachment
from public, anon, authenticated;

grant select on table
  public.finance_fund,
  public.finance_submission,
  public.finance_transaction,
  public.finance_submission_attachment
to authenticated;

-- Report items, work plans, activities and report windows: edited under RLS.
revoke all on table
  public.unit_management_report_item,
  public.unit_work_plan,
  public.unit_work_activity,
  public.management_report_window
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.unit_management_report_item,
  public.unit_work_plan,
  public.unit_work_activity,
  public.management_report_window
to authenticated;

-- service_role: no migration granted it explicitly. Restate the access
-- edifydb already has on every table and view in public.
grant select, insert, update, delete on all tables in schema public to service_role;
