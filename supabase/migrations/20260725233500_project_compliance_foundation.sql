-- Project compliance foundation: expenses, documents, and first-organization assignment.

create table if not exists public.project_expense (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project(id) on delete restrict,
  expense_date date not null,
  supplier_name text not null,
  category text not null,
  description text not null,
  amount numeric(16,2) not null,
  currency char(3) not null default 'USD',
  payment_reference text,
  invoice_number text,
  status text not null default 'reported',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_expense_supplier_check check (length(trim(supplier_name)) > 0),
  constraint project_expense_category_check check (length(trim(category)) > 0),
  constraint project_expense_description_check check (length(trim(description)) > 0),
  constraint project_expense_amount_check check (amount > 0),
  constraint project_expense_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint project_expense_status_check check (status in ('reported', 'verified', 'rejected'))
);

create index if not exists project_expense_project_date_idx
  on public.project_expense (project_id, expense_date desc);

create trigger project_expense_set_updated_at
before update on public.project_expense
for each row execute function public.set_updated_at();

create table if not exists public.project_document (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project(id) on delete restrict,
  document_type text not null,
  title text not null,
  storage_path text not null,
  file_name text not null,
  document_date date,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint project_document_type_check check (
    document_type in ('proposal', 'agreement', 'budget', 'invoice', 'receipt', 'report', 'evidence', 'other')
  ),
  constraint project_document_title_check check (length(trim(title)) > 0),
  constraint project_document_storage_check check (length(trim(storage_path)) > 0)
);

create index if not exists project_document_project_type_idx
  on public.project_document (project_id, document_type, created_at desc);

alter table public.project_expense enable row level security;
alter table public.project_document enable row level security;

create policy "Operators view organization project expenses"
on public.project_expense for select to authenticated
using (
  private.is_authorized_operator()
  and exists (
    select 1
    from public.project project
    where project.id = project_expense.project_id
      and (private.is_super_admin() or project.organization_id = private.current_operator_organization_id())
  )
);

create policy "Operators manage organization project expenses"
on public.project_expense for all to authenticated
using (
  private.is_authorized_operator()
  and exists (
    select 1
    from public.project project
    where project.id = project_expense.project_id
      and (private.is_super_admin() or project.organization_id = private.current_operator_organization_id())
  )
)
with check (
  private.is_authorized_operator()
  and exists (
    select 1
    from public.project project
    where project.id = project_expense.project_id
      and (private.is_super_admin() or project.organization_id = private.current_operator_organization_id())
  )
);

create policy "Operators view organization project documents"
on public.project_document for select to authenticated
using (
  private.is_authorized_operator()
  and exists (
    select 1
    from public.project project
    where project.id = project_document.project_id
      and (private.is_super_admin() or project.organization_id = private.current_operator_organization_id())
  )
);

create policy "Operators manage organization project documents"
on public.project_document for all to authenticated
using (
  private.is_authorized_operator()
  and exists (
    select 1
    from public.project project
    where project.id = project_document.project_id
      and (private.is_super_admin() or project.organization_id = private.current_operator_organization_id())
  )
)
with check (
  private.is_authorized_operator()
  and exists (
    select 1
    from public.project project
    where project.id = project_document.project_id
      and (private.is_super_admin() or project.organization_id = private.current_operator_organization_id())
  )
);

grant select, insert, update, delete on table
  public.project_expense,
  public.project_document
to authenticated;

revoke all on table
  public.project_expense,
  public.project_document
from anon;

create or replace function public.admin_save_organization(payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  saved public.organization%rowtype;
begin
  if not private.is_super_admin() then
    raise exception using errcode = '42501', message = 'Superadministrator access is required.';
  end if;

  begin
    target_id := nullif(payload ->> 'id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid organization identifier.';
  end;

  if target_id is null then
    insert into public.organization (
      code, name, legal_name, tax_id, country, city,
      contact_email, contact_phone, subscription_status, active
    ) values (
      lower(trim(payload ->> 'code')),
      trim(payload ->> 'name'),
      nullif(trim(payload ->> 'legal_name'), ''),
      nullif(trim(payload ->> 'tax_id'), ''),
      nullif(trim(payload ->> 'country'), ''),
      nullif(trim(payload ->> 'city'), ''),
      nullif(lower(trim(payload ->> 'contact_email')), ''),
      nullif(trim(payload ->> 'contact_phone'), ''),
      coalesce(nullif(payload ->> 'subscription_status', ''), 'trial'),
      coalesce((payload ->> 'active')::boolean, true)
    ) returning * into saved;
  else
    update public.organization
    set code = lower(trim(payload ->> 'code')),
        name = trim(payload ->> 'name'),
        legal_name = nullif(trim(payload ->> 'legal_name'), ''),
        tax_id = nullif(trim(payload ->> 'tax_id'), ''),
        country = nullif(trim(payload ->> 'country'), ''),
        city = nullif(trim(payload ->> 'city'), ''),
        contact_email = nullif(lower(trim(payload ->> 'contact_email')), ''),
        contact_phone = nullif(trim(payload ->> 'contact_phone'), ''),
        subscription_status = coalesce(nullif(payload ->> 'subscription_status', ''), 'trial'),
        active = coalesce((payload ->> 'active')::boolean, true),
        updated_at = now()
    where id = target_id
    returning * into saved;
  end if;

  if saved.id is null then
    raise exception using errcode = 'P0002', message = 'Organization was not found.';
  end if;

  update private.operator_access
  set organization_id = saved.id,
      updated_at = now()
  where lower(email) = caller_email
    and organization_id is null;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.admin_save_organization(jsonb) from public, anon;
grant execute on function public.admin_save_organization(jsonb) to authenticated;
