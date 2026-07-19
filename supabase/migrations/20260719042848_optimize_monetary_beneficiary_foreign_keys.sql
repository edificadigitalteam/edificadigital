-- Cover foreign keys reported by the Supabase performance advisor.

create index monetary_donation_reconciled_by_idx
  on public.monetary_donation_detail (reconciled_by)
  where reconciled_by is not null;

create index beneficiary_updated_by_idx
  on private.beneficiary (updated_by)
  where updated_by is not null;

create index beneficiary_event_updated_by_idx
  on private.beneficiary_event (updated_by)
  where updated_by is not null;
