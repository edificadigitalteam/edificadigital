begin;
set local search_path = public, extensions, pg_catalog;

select plan(5);

create temporary table cnbv_tree on commit drop as
with recursive org as (
  select id from public.organization where lower(code)='cnbv' limit 1
), tree as (
  select u.id, upper(trim(u.code)) as code, u.sort_order, 1 as lvl, array[u.sort_order] as path
  from public.organization_unit u
  join org on org.id=u.organization_id
  where u.parent_unit_id is null and u.active
  union all
  select c.id, upper(trim(c.code)), c.sort_order, tree.lvl+1, tree.path||c.sort_order
  from public.organization_unit c
  join tree on c.parent_unit_id=tree.id
  where c.active
)
select code, sort_order, lvl, path from tree;

select skip('CNBV organization is absent from this database', 5)
where not exists (select 1 from public.organization where lower(code)='cnbv');

select is(
  (select array_agg(code order by code) from cnbv_tree where lvl=1),
  array['GEN'],
  'GEN is the only active top-level CNBV unit'
) where exists (select 1 from public.organization where lower(code)='cnbv');

select is(
  (select array_agg(code order by sort_order) from cnbv_tree where lvl=2),
  array['DIGEN','FBCC','STBV','UNJB','UFBMV','UNVBMV','UPBV'],
  'DIGEN and the peer units hang from GEN in the approved order'
) where exists (select 1 from public.organization where lower(code)='cnbv');

select is(
  (select array_agg(code order by sort_order) from cnbv_tree where lvl=3),
  array['DIAF','DEDEC','DIME','DISES','DICOM','DIPROM'],
  'DIGEN keeps its internal directorates'
) where exists (select 1 from public.organization where lower(code)='cnbv');

select is(
  (select array_agg(code||':'||sort_order order by path) from cnbv_tree),
  array['GEN:10','DIGEN:20','DIAF:30','DEDEC:40','DIME:50','DISES:60','DICOM:70','DIPROM:80',
        'FBCC:90','STBV:100','UNJB:110','UFBMV:120','UNVBMV:130','UPBV:140'],
  'sort_order follows the approved tree preorder numbering'
) where exists (select 1 from public.organization where lower(code)='cnbv');

select is(
  (select array_agg(code order by path) from cnbv_tree),
  (select array_agg(code order by sort_order, code) from cnbv_tree),
  'flat sort_order order matches the organization chart order'
) where exists (select 1 from public.organization where lower(code)='cnbv');

select * from finish();
rollback;
