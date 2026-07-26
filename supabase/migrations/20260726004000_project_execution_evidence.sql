-- Multimedia evidence for project execution records.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-evidence',
  'project-evidence',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.project_output_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete restrict,
  project_id uuid not null references public.project(id) on delete cascade,
  project_output_id uuid not null references public.project_output(id) on delete cascade,
  evidence_type text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  caption text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint project_output_evidence_type_check check (evidence_type in ('image', 'video', 'document')),
  constraint project_output_evidence_mime_check check (
    mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime'
    )
  ),
  constraint project_output_evidence_size_check check (
    (evidence_type = 'video' and file_size_bytes <= 52428800)
    or (evidence_type in ('image', 'document') and file_size_bytes <= 10485760)
  )
);

create index if not exists project_output_evidence_output_idx
  on public.project_output_evidence (project_output_id, created_at desc);
create index if not exists project_output_evidence_project_idx
  on public.project_output_evidence (project_id, created_at desc);
create index if not exists project_output_evidence_org_idx
  on public.project_output_evidence (organization_id, created_at desc);

create or replace function private.validate_project_output_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  output_record public.project_output%rowtype;
begin
  select * into output_record
  from public.project_output
  where id = new.project_output_id;

  if not found then
    raise exception using errcode = '23503', message = 'Project execution record was not found.';
  end if;

  if output_record.project_id <> new.project_id or output_record.organization_id <> new.organization_id then
    raise exception using errcode = '23514', message = 'Evidence must belong to the same organization, project, and execution record.';
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

revoke all on function private.validate_project_output_evidence() from public, anon, authenticated;

drop trigger if exists project_output_evidence_validate on public.project_output_evidence;
create trigger project_output_evidence_validate
before insert or update on public.project_output_evidence
for each row execute function private.validate_project_output_evidence();

alter table public.project_output_evidence enable row level security;

drop policy if exists "Tenant operators view project output evidence" on public.project_output_evidence;
drop policy if exists "Tenant operators create project output evidence" on public.project_output_evidence;
drop policy if exists "Tenant operators update project output evidence" on public.project_output_evidence;
drop policy if exists "Tenant operators delete project output evidence" on public.project_output_evidence;

create policy "Tenant operators view project output evidence"
on public.project_output_evidence for select to authenticated
using (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
);

create policy "Tenant operators create project output evidence"
on public.project_output_evidence for insert to authenticated
with check (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
  and created_by = auth.uid()
);

create policy "Tenant operators update project output evidence"
on public.project_output_evidence for update to authenticated
using (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
)
with check (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
);

create policy "Tenant operators delete project output evidence"
on public.project_output_evidence for delete to authenticated
using (
  private.is_authorized_operator()
  and (private.is_super_admin() or organization_id = private.current_operator_organization_id())
);

grant select, insert, update, delete on public.project_output_evidence to authenticated;
revoke all on public.project_output_evidence from anon;

drop policy if exists "Tenant operators read project evidence files" on storage.objects;
drop policy if exists "Tenant operators upload project evidence files" on storage.objects;
drop policy if exists "Tenant operators update project evidence files" on storage.objects;
drop policy if exists "Tenant operators delete project evidence files" on storage.objects;

create policy "Tenant operators read project evidence files"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-evidence'
  and private.is_authorized_operator()
  and (
    private.is_super_admin()
    or (storage.foldername(name))[1] = private.current_operator_organization_id()::text
  )
);

create policy "Tenant operators upload project evidence files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-evidence'
  and private.is_authorized_operator()
  and (
    private.is_super_admin()
    or (storage.foldername(name))[1] = private.current_operator_organization_id()::text
  )
);

create policy "Tenant operators update project evidence files"
on storage.objects for update to authenticated
using (
  bucket_id = 'project-evidence'
  and private.is_authorized_operator()
  and (
    private.is_super_admin()
    or (storage.foldername(name))[1] = private.current_operator_organization_id()::text
  )
)
with check (
  bucket_id = 'project-evidence'
  and private.is_authorized_operator()
  and (
    private.is_super_admin()
    or (storage.foldername(name))[1] = private.current_operator_organization_id()::text
  )
);

create policy "Tenant operators delete project evidence files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-evidence'
  and private.is_authorized_operator()
  and (
    private.is_super_admin()
    or (storage.foldername(name))[1] = private.current_operator_organization_id()::text
  )
);
