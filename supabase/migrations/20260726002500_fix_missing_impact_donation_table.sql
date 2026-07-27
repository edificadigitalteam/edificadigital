-- Corrective migration: public.impact_donation exists in the deployed edifydb project
-- (created outside of a versioned migration) but no migration in this history creates it,
-- so 20260726003000_complete_tenant_isolation_and_indexes.sql's policy on it fails on
-- fresh environments (local dev, CI). Recreated here to match the deployed schema exactly.

create table if not exists public.impact_donation (
  id uuid primary key default gen_random_uuid(),
  impact_event_id uuid not null references public.impact_event(id) on delete cascade,
  donation_id uuid not null references public.donation(id) on delete restrict,
  delivered_summary text not null,
  quantity_delivered numeric,
  unit_of_measure_id uuid references public.unit_of_measure(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint impact_donation_event_donation_unique unique (impact_event_id, donation_id),
  constraint impact_donation_summary_check check (length(trim(delivered_summary)) > 0),
  constraint impact_donation_quantity_check check (
    (quantity_delivered is null and unit_of_measure_id is null)
    or (quantity_delivered > 0 and unit_of_measure_id is not null)
  )
);

create index if not exists impact_donation_donation_idx on public.impact_donation (donation_id);
create index if not exists impact_donation_unit_idx on public.impact_donation (unit_of_measure_id) where unit_of_measure_id is not null;
create index if not exists impact_donation_created_by_idx on public.impact_donation (created_by);

alter table public.impact_donation enable row level security;

revoke all on table public.impact_donation from public, anon;
grant select, insert, update, delete on table public.impact_donation to authenticated;
