-- Preserve authorship while allowing operational records to be edited.

create or replace function private.preserve_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

revoke all on function private.preserve_created_by() from public, anon, authenticated;

drop trigger if exists project_preserve_creator on public.project;
create trigger project_preserve_creator
before update on public.project
for each row execute function private.preserve_created_by();

drop trigger if exists project_output_preserve_creator on public.project_output;
create trigger project_output_preserve_creator
before update on public.project_output
for each row execute function private.preserve_created_by();

drop trigger if exists project_expense_preserve_creator on public.project_expense;
create trigger project_expense_preserve_creator
before update on public.project_expense
for each row execute function private.preserve_created_by();

drop trigger if exists volunteer_preserve_creator on public.volunteer;
create trigger volunteer_preserve_creator
before update on public.volunteer
for each row execute function private.preserve_created_by();

comment on function private.preserve_created_by() is
  'Prevents edits from replacing the authenticated user who originally created an operational record.';