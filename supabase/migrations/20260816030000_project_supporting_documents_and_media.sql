update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
]
where id = 'project-evidence';

create table if not exists public.project_media_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete restrict,
  project_id uuid not null references public.project(id) on delete cascade,
  evidence_type text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  caption text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint project_media_evidence_type_check check (evidence_type in ('image','video','document')),
  constraint project_media_evidence_mime_check check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/quicktime')),
  constraint project_media_evidence_size_check check (
    (evidence_type = 'video' and file_size_bytes <= 52428800)
    or (evidence_type in ('image','document') and file_size_bytes <= 10485760)
  )
);

create table if not exists public.project_beneficiary_document (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete restrict,
  project_id uuid not null references public.project(id) on delete cascade,
  document_type text not null default 'beneficiary_list',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint project_beneficiary_document_type_check check (document_type in ('beneficiary_list','attendance_list','distribution_list','other')),
  constraint project_beneficiary_document_mime_check check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv')),
  constraint project_beneficiary_document_size_check check (file_size_bytes <= 20971520)
);

create index if not exists project_media_evidence_project_idx on public.project_media_evidence(project_id, created_at desc);
create index if not exists project_beneficiary_document_project_idx on public.project_beneficiary_document(project_id, created_at desc);

create or replace function private.validate_project_supporting_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_record public.project%rowtype;
begin
  select * into project_record from public.project where id = new.project_id;
  if not found then
    raise exception using errcode = '23503', message = 'Project was not found.';
  end if;
  if project_record.organization_id <> new.organization_id then
    raise exception using errcode = '23514', message = 'The file must belong to the same organization as the project.';
  end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

revoke all on function private.validate_project_supporting_file() from public, anon, authenticated;

drop trigger if exists project_media_evidence_validate on public.project_media_evidence;
create trigger project_media_evidence_validate before insert or update on public.project_media_evidence for each row execute function private.validate_project_supporting_file();

drop trigger if exists project_beneficiary_document_validate on public.project_beneficiary_document;
create trigger project_beneficiary_document_validate before insert or update on public.project_beneficiary_document for each row execute function private.validate_project_supporting_file();

alter table public.project_media_evidence enable row level security;
alter table public.project_beneficiary_document enable row level security;

create policy "Tenant operators view project media evidence" on public.project_media_evidence for select to authenticated
using (private.is_authorized_operator() and (private.is_super_admin() or organization_id = private.current_operator_organization_id()));
create policy "Tenant operators create project media evidence" on public.project_media_evidence for insert to authenticated
with check (private.is_authorized_operator() and (private.is_super_admin() or organization_id = private.current_operator_organization_id()) and created_by = auth.uid());
create policy "Tenant operators delete project media evidence" on public.project_media_evidence for delete to authenticated
using (private.is_authorized_operator() and (private.is_super_admin() or organization_id = private.current_operator_organization_id()));

create policy "Tenant operators view beneficiary documents" on public.project_beneficiary_document for select to authenticated
using (private.is_authorized_operator() and (private.is_super_admin() or organization_id = private.current_operator_organization_id()));
create policy "Tenant operators create beneficiary documents" on public.project_beneficiary_document for insert to authenticated
with check (private.is_authorized_operator() and (private.is_super_admin() or organization_id = private.current_operator_organization_id()) and created_by = auth.uid());
create policy "Tenant operators delete beneficiary documents" on public.project_beneficiary_document for delete to authenticated
using (private.is_authorized_operator() and (private.is_super_admin() or organization_id = private.current_operator_organization_id()));

grant select, insert, delete on public.project_media_evidence to authenticated;
grant select, insert, delete on public.project_beneficiary_document to authenticated;
revoke all on public.project_media_evidence from anon;
revoke all on public.project_beneficiary_document from anon;
