-- Lets an indicator override the chart form the heuristic would choose.
--
-- Nullable with no default: null means automatic, so every existing indicator
-- keeps behaving exactly as it does today. The allowed values mirror the forms
-- in frontend/src/features/management/indicatorCharts/recommendedChart.js; the
-- interface only ever offers the subset an indicator's own data supports, and
-- falls back to the automatic form when a stored value stops being valid.

alter table public.management_indicator
  add column if not exists preferred_chart text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.management_indicator'::regclass
      and conname='management_indicator_preferred_chart_check'
  ) then
    alter table public.management_indicator
      add constraint management_indicator_preferred_chart_check
      check (preferred_chart is null or preferred_chart in
        ('progress','gauge','trend','columns','stat','timeline','status'));
  end if;
end $$;

comment on column public.management_indicator.preferred_chart is
  'Optional visualization override. Null means the chart form is derived from metric_type, aggregation_method and the presence of a target.';
