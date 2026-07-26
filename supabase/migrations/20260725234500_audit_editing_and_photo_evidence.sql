-- Preserve accountability when operational records are edited.

insert into public.media_type (code, name_es, name_en, description)
values ('photo', 'Fotografía', 'Photo', 'General photographic evidence linked to an operational record.')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  description = excluded.description,
  active = true;

create table if not exists private.record_change_log (
  id uuid primary key default gen_random_uuid(),
  table_schema text not null,
  table_name text not null,
  row_id uuid,
  operation text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text,
  changed_at timestamptz not null default now(),
  constraint record_change_log_operation_check check (operation in ('INSERT', 'UPDATE', 'DELETE'))
);

create index if not exists record_change_log_record_idx
  on private.record_change_log (table_schema, table_name, row_id, changed_at desc);
create index if not exists record_change_log_user_idx
  on private.record_change_log (changed_by, changed_at desc)
  where changed_by is not null;

revoke all on table private.record_change_log from public, anon, authenticated;

create or replace function private.audit_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_record jsonb;
  new_record jsonb;
  record_id uuid;
begin
  old_record := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_record := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  begin
    record_id := coalesce((new_record ->> 'id')::uuid, (old_record ->> 'id')::uuid);
  exception when others then
    record_id := null;
  end;

  if tg_op = 'UPDATE' and old_record = new_record then
    return new;
  end if;

  insert into private.record_change_log (
    table_schema,
    table_name,
    row_id,
    operation,
    old_data,
    new_data,
    changed_by,
    changed_by_email
  ) values (
    tg_table_schema,
    tg_table_name,
    record_id,
    tg_op,
    old_record,
    new_record,
    (select auth.uid()),
    nullif(lower(coalesce((select auth.jwt()) ->> 'email', '')), '')
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_record_change() from public, anon, authenticated;

create or replace function private.preserve_record_creator()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

revoke all on function private.preserve_record_creator() from public, anon, authenticated;

alter table public.project add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.volunteer add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.donation add column if not exists updated_by uuid references auth.users(id) on delete set null;

create or replace function private.set_operational_updated_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke all on function private.set_operational_updated_by() from public, anon, authenticated;

drop trigger if exists project_preserve_creator on public.project;
create trigger project_preserve_creator
before update on public.project
for each row execute function private.preserve_record_creator();

drop trigger if exists volunteer_preserve_creator on public.volunteer;
create trigger volunteer_preserve_creator
before update on public.volunteer
for each row execute function private.preserve_record_creator();

drop trigger if exists project_set_updated_by on public.project;
create trigger project_set_updated_by
before update on public.project
for each row execute function private.set_operational_updated_by();

drop trigger if exists volunteer_set_updated_by on public.volunteer;
create trigger volunteer_set_updated_by
before update on public.volunteer
for each row execute function private.set_operational_updated_by();

drop trigger if exists donation_set_updated_by on public.donation;
create trigger donation_set_updated_by
before update on public.donation
for each row execute function private.set_operational_updated_by();

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'organization',
    'project',
    'project_expense',
    'project_document',
    'volunteer',
    'donation',
    'donation_detail',
    'monetary_donation_detail',
    'shipment'
  ] loop
    execute format('drop trigger if exists %I_audit_change on public.%I', target_table, target_table);
    execute format(
      'create trigger %I_audit_change after insert or update or delete on public.%I for each row execute function private.audit_record_change()',
      target_table,
      target_table
    );
  end loop;
end
$$;

create or replace function public.donation_change_history(target_donation_id uuid)
returns table (
  id uuid,
  table_name text,
  operation text,
  changed_by_email text,
  changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  donation_record public.donation%rowtype;
begin
  select * into donation_record
  from public.donation
  where donation.id = target_donation_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Donation record was not found.';
  end if;

  if donation_record.created_by is distinct from (select auth.uid())
     and not private.is_authorized_admin() then
    raise exception using errcode = '42501', message = 'You cannot view this change history.';
  end if;

  return query
  select
    log.id,
    log.table_name,
    log.operation,
    log.changed_by_email,
    log.changed_at
  from private.record_change_log log
  where (
      log.table_name = 'donation'
      and log.row_id = target_donation_id
    )
    or (
      log.table_name = 'shipment'
      and coalesce(log.new_data ->> 'donation_id', log.old_data ->> 'donation_id') = target_donation_id::text
    )
    or (
      log.table_name = 'donation_detail'
      and coalesce(log.new_data ->> 'donation_id', log.old_data ->> 'donation_id') = target_donation_id::text
    )
  order by log.changed_at desc;
end;
$$;

revoke all on function public.donation_change_history(uuid) from public, anon;
grant execute on function public.donation_change_history(uuid) to authenticated;
