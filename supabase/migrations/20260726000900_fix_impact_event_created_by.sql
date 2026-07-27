-- Corrective migration: 20260726001000_tenant_isolation_and_project_execution.sql backfills
-- impact_event.created_by, but no prior migration ever added that column, so the migration
-- history cannot be replayed from scratch (fails with "column impact.created_by does not exist").
-- This adds the missing column so fresh environments (local dev, CI) match the deployed schema.

alter table public.impact_event
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists impact_event_created_by_idx
  on public.impact_event (created_by)
  where created_by is not null;
