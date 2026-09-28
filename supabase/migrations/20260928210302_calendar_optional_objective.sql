-- Calendar activities may be created before a unit has defined annual-plan objectives.
-- Existing objective links remain available for traceability when applicable.

alter table public.unit_work_activity
  alter column objective_id drop not null;

alter table public.unit_work_activity
  drop constraint if exists unit_work_activity_objective_id_fkey;

alter table public.unit_work_activity
  add constraint unit_work_activity_objective_id_fkey
  foreign key (objective_id)
  references public.institutional_objective(id)
  on delete set null;
