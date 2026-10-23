-- Revoke anon table privileges (#141).
--
-- These 14 tables kept the automatic Data API grants: anon had SELECT and, on
-- 13 of them, INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER. No migration
-- revoked them. RLS blocked the rows because every policy targets
-- authenticated, but TRUNCATE bypasses RLS and the grants contradicted the
-- baseline ("anonymous table privileges revoked").
--
-- authenticated keeps exactly what each table's creating migration declared:
-- - 20260815194500: select, insert, update, delete on the management tables;
-- - 20260726010000: select on the subscription tables (writes go through
--   SECURITY DEFINER admin RPCs; RLS has select policies only);
-- - 20260903013000: select on finance_resource_request (writes through RPCs).
-- The unused automatic TRUNCATE/REFERENCES/TRIGGER privileges, and writes on
-- the select-only tables, are dropped. service_role is unchanged.

revoke all on table
  public.finance_resource_request,
  public.indicator_progress,
  public.institutional_objective,
  public.management_indicator,
  public.management_period,
  public.objective_unit_assignment,
  public.organization_subscription,
  public.organization_unit,
  public.organization_unit_member,
  public.project_objective,
  public.project_organization_unit,
  public.subscription_payment,
  public.subscription_plan,
  public.unit_management_report
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.indicator_progress,
  public.institutional_objective,
  public.management_indicator,
  public.management_period,
  public.objective_unit_assignment,
  public.organization_unit,
  public.organization_unit_member,
  public.project_objective,
  public.project_organization_unit,
  public.unit_management_report
to authenticated;

grant select on table
  public.finance_resource_request,
  public.organization_subscription,
  public.subscription_payment,
  public.subscription_plan
to authenticated;
