-- Add explicit human accountability to indicator progress entries.
-- Existing rows are marked as historical so the migration remains safe.

alter table public.indicator_progress
  add column if not exists responsible_name text;

update public.indicator_progress
set responsible_name = 'Registro histórico (antes de trazabilidad)'
where responsible_name is null or length(trim(responsible_name)) = 0;

alter table public.indicator_progress
  alter column responsible_name set not null;

alter table public.indicator_progress
  drop constraint if exists indicator_progress_responsible_name_not_blank;

alter table public.indicator_progress
  add constraint indicator_progress_responsible_name_not_blank
  check (length(trim(responsible_name)) > 0);
