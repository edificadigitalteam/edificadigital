alter table public.project_output
  add column if not exists output_type text not null default 'delivery';

alter table public.project_output
  drop constraint if exists project_output_type_check;
alter table public.project_output
  add constraint project_output_type_check
  check (output_type in ('delivery','beneficiary_documentation','reporting_requirement'));

alter table public.project_output_evidence
  drop constraint if exists project_output_evidence_mime_check;
alter table public.project_output_evidence
  add constraint project_output_evidence_mime_check
  check (mime_type in (
    'image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/quicktime',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel','text/csv'
  ));

alter table public.project_output_evidence
  drop constraint if exists project_output_evidence_type_check;
alter table public.project_output_evidence
  add constraint project_output_evidence_type_check
  check (evidence_type in ('image','video','document','beneficiary_list'));

alter table public.project_output_evidence
  drop constraint if exists project_output_evidence_size_check;
alter table public.project_output_evidence
  add constraint project_output_evidence_size_check
  check (
    (evidence_type = 'video' and file_size_bytes <= 52428800)
    or (evidence_type in ('image','document') and file_size_bytes <= 10485760)
    or (evidence_type = 'beneficiary_list' and file_size_bytes <= 20971520)
  );

create or replace function public.admin_save_organization_unit_v2(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  caller_role text;
  caller_organization_id uuid;
  target_organization_id uuid;
  target_unit_id uuid;
  parent_id uuid;
  unit_code text;
  unit_name text;
  unit_kind text;
  unit_description text;
  unit_sort integer;
  unit_active boolean;
  leader jsonb;
  leader_name text;
  leader_email text;
  leader_access private.operator_access%rowtype;
  member jsonb;
  member_name text;
  member_email text;
  member_role text;
  member_access private.operator_access%rowtype;
  member_count integer := 0;
  invited_emails jsonb := '[]'::jsonb;
  is_new boolean;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select access.role, access.organization_id
    into caller_role, caller_organization_id
  from private.operator_access access
  where access.active and lower(access.email) = caller_email
  limit 1;

  if caller_role not in ('admin','super_admin') then
    raise exception using errcode = '42501', message = 'Administrative access is required.';
  end if;

  begin
    target_organization_id := nullif(payload ->> 'organization_id','')::uuid;
    target_unit_id := nullif(payload ->> 'id','')::uuid;
    parent_id := nullif(payload ->> 'parent_unit_id','')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid identifier.';
  end;

  if caller_role = 'admin' then
    target_organization_id := caller_organization_id;
  end if;

  if target_organization_id is null or not exists (
    select 1 from public.organization o where o.id = target_organization_id
  ) then
    raise exception using errcode = '22023', message = 'Organization was not found.';
  end if;

  if target_unit_id is not null and not exists (
    select 1 from public.organization_unit u
    where u.id = target_unit_id and u.organization_id = target_organization_id
  ) then
    raise exception using errcode = '42501', message = 'The unit does not belong to this organization.';
  end if;

  if parent_id is not null and not exists (
    select 1 from public.organization_unit u
    where u.id = parent_id
      and u.organization_id = target_organization_id
      and u.id is distinct from target_unit_id
  ) then
    raise exception using errcode = '22023', message = 'The parent unit is invalid.';
  end if;

  unit_code := upper(trim(coalesce(payload ->> 'code','')));
  unit_name := trim(coalesce(payload ->> 'name',''));
  unit_kind := coalesce(nullif(payload ->> 'unit_type',''),'department');
  unit_description := nullif(trim(coalesce(payload ->> 'description','')), '');
  unit_sort := coalesce(nullif(payload ->> 'sort_order','')::integer,0);
  unit_active := coalesce((payload ->> 'active')::boolean,true);

  if unit_code = '' or unit_name = '' then
    raise exception using errcode = '22023', message = 'Unit code and name are required.';
  end if;
  if unit_kind not in ('directorate','department','ministry','committee','auxiliary','academy','foundation','campus','church_area','other') then
    raise exception using errcode = '22023', message = 'Invalid unit type.';
  end if;

  leader := coalesce(payload -> 'leader','{}'::jsonb);
  leader_name := trim(coalesce(leader ->> 'display_name',''));
  leader_email := lower(trim(coalesce(leader ->> 'email','')));
  if leader_name = '' or leader_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Leader name and a valid email are required.';
  end if;

  select * into leader_access
  from private.operator_access a
  where lower(a.email) = leader_email
  limit 1;
  is_new := leader_access.id is null;

  if is_new then
    insert into private.operator_access (
      email, display_name, role, active, organization_id,
      activation_token, activation_token_expires_at
    ) values (
      leader_email, leader_name, 'operator', true, target_organization_id,
      gen_random_uuid(), now() + interval '7 days'
    ) returning * into leader_access;
    perform private.notify_operator_invitation(leader_access.id);
    invited_emails := invited_emails || to_jsonb(leader_email);
  else
    if leader_access.organization_id is distinct from target_organization_id then
      raise exception using errcode = '23505', message = 'The leader email is already assigned to another organization.';
    end if;
    update private.operator_access
      set display_name = leader_name, active = true, updated_at = now()
    where id = leader_access.id
    returning * into leader_access;
    if leader_access.email_confirmed_at is null and leader_access.activation_token is null then
      update private.operator_access
        set activation_token = gen_random_uuid(),
            activation_token_expires_at = now() + interval '7 days',
            updated_at = now()
      where id = leader_access.id
      returning * into leader_access;
      perform private.notify_operator_invitation(leader_access.id);
      invited_emails := invited_emails || to_jsonb(leader_email);
    end if;
  end if;

  if target_unit_id is null then
    insert into public.organization_unit (
      organization_id,parent_unit_id,code,name,unit_type,description,
      manager_name,manager_email,sort_order,active,created_by,updated_by
    ) values (
      target_organization_id,parent_id,unit_code,unit_name,unit_kind,unit_description,
      leader_name,leader_email,unit_sort,unit_active,current_user_id,current_user_id
    ) returning id into target_unit_id;
  else
    update public.organization_unit
      set parent_unit_id = parent_id,
          code = unit_code,
          name = unit_name,
          unit_type = unit_kind,
          description = unit_description,
          manager_name = leader_name,
          manager_email = leader_email,
          sort_order = unit_sort,
          active = unit_active,
          updated_by = current_user_id,
          updated_at = now()
    where id = target_unit_id and organization_id = target_organization_id;
  end if;

  update public.organization_unit_member
    set active = false, is_primary = false, updated_at = now()
  where organization_id = target_organization_id and unit_id = target_unit_id;

  insert into public.organization_unit_member (
    organization_id,unit_id,operator_access_id,unit_role,is_primary,active
  ) values (
    target_organization_id,target_unit_id,leader_access.id,'director',true,true
  )
  on conflict (unit_id,operator_access_id) do update
    set unit_role='director',is_primary=true,active=true,updated_at=now();
  member_count := 1;

  for member in select value from jsonb_array_elements(coalesce(payload -> 'members','[]'::jsonb))
  loop
    member_name := trim(coalesce(member ->> 'display_name',''));
    member_email := lower(trim(coalesce(member ->> 'email','')));
    member_role := coalesce(nullif(member ->> 'unit_role',''),'operator');

    if member_email = '' or member_email = leader_email then
      continue;
    end if;
    if member_name = '' or member_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception using errcode = '22023', message = 'Each team member requires a name and valid email.';
    end if;
    if member_role not in ('manager','operator','reviewer','member') then
      raise exception using errcode = '22023', message = 'Invalid unit role for a team member.';
    end if;

    select * into member_access
    from private.operator_access a
    where lower(a.email) = member_email
    limit 1;
    is_new := member_access.id is null;

    if is_new then
      insert into private.operator_access (
        email, display_name, role, active, organization_id,
        activation_token, activation_token_expires_at
      ) values (
        member_email, member_name, 'operator', true, target_organization_id,
        gen_random_uuid(), now() + interval '7 days'
      ) returning * into member_access;
      perform private.notify_operator_invitation(member_access.id);
      invited_emails := invited_emails || to_jsonb(member_email);
    else
      if member_access.organization_id is distinct from target_organization_id then
        raise exception using errcode = '23505', message = 'A team member email is already assigned to another organization.';
      end if;
      update private.operator_access
        set display_name = member_name, active = true, updated_at = now()
      where id = member_access.id
      returning * into member_access;
      if member_access.email_confirmed_at is null and member_access.activation_token is null then
        update private.operator_access
          set activation_token = gen_random_uuid(),
              activation_token_expires_at = now() + interval '7 days',
              updated_at = now()
        where id = member_access.id
        returning * into member_access;
        perform private.notify_operator_invitation(member_access.id);
        invited_emails := invited_emails || to_jsonb(member_email);
      end if;
    end if;

    insert into public.organization_unit_member (
      organization_id,unit_id,operator_access_id,unit_role,is_primary,active
    ) values (
      target_organization_id,target_unit_id,member_access.id,member_role,false,true
    )
    on conflict (unit_id,operator_access_id) do update
      set unit_role=excluded.unit_role,is_primary=false,active=true,updated_at=now();
    member_count := member_count + 1;
  end loop;

  return jsonb_build_object(
    'id', target_unit_id,
    'organization_id', target_organization_id,
    'leader_operator_id', leader_access.id,
    'member_count', member_count,
    'invited_emails', invited_emails
  );
end;
$$;

revoke all on function public.admin_save_organization_unit_v2(jsonb) from public, anon;
grant execute on function public.admin_save_organization_unit_v2(jsonb) to authenticated;
