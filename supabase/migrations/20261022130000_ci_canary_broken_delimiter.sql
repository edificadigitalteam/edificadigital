-- TEMPORARY CI canary. Must fail to apply. Removed in the next commit.
create or replace function public.ci_canary_broken()
returns integer
language sql
as $
  select 1;
$;
