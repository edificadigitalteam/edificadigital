alter table public.management_indicator
  add column if not exists indicator_kind text not null default 'result';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.management_indicator'::regclass
      and conname='management_indicator_kind_check'
  ) then
    alter table public.management_indicator
      add constraint management_indicator_kind_check
      check (indicator_kind in ('result','output','process','impact'));
  end if;
end $$;

create index if not exists management_indicator_objective_kind_idx
  on public.management_indicator(objective_id, indicator_kind)
  where active;

comment on column public.management_indicator.indicator_kind is
  'Management meaning of the indicator: result, output, process or impact. Separate from metric_type, which defines the data format.';
