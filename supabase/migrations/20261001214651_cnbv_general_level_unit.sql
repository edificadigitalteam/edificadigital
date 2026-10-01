-- CNBV general level: places every other top-level unit under GEN and renumbers
-- sort_order in tree preorder so flat lists match the organization chart.
-- Data-only change. Permissions are unaffected.

do $$
declare
  org_id uuid;
  gen_id uuid;
  gen_count integer;
begin
  select id into org_id
  from public.organization
  where lower(code)='cnbv'
  limit 1;

  if org_id is null then
    raise notice 'CNBV organization not found; skipping general level unit adjustment';
    return;
  end if;

  select count(*), min(id::text)::uuid into gen_count, gen_id
  from public.organization_unit
  where organization_id=org_id and upper(trim(code))='GEN';

  if gen_count<>1 then
    raise exception 'Expected exactly one GEN unit in CNBV, found %', gen_count;
  end if;

  update public.organization_unit
  set parent_unit_id=null,
      active=true
  where id=gen_id
    and (parent_unit_id is not null or not active);

  update public.organization_unit
  set parent_unit_id=gen_id
  where organization_id=org_id
    and active
    and parent_unit_id is null
    and id<>gen_id;

  update public.organization_unit u
  set sort_order=o.sort_order
  from (values
    ('GEN',10),('DIGEN',20),('DIAF',30),('DEDEC',40),('DIME',50),('DISES',60),('DICOM',70),
    ('DIPROM',80),('FBCC',90),('STBV',100),('UNJB',110),('UFBMV',120),('UNVBMV',130),('UPBV',140)
  ) as o(code,sort_order)
  where u.organization_id=org_id
    and upper(trim(u.code))=o.code
    and u.sort_order is distinct from o.sort_order;
end $$;
