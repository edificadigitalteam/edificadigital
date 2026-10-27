-- Association dates are independent of unit work plans. All fixtures roll back.
begin;
set local search_path=public,extensions,pg_catalog;
select plan(18);

select has_table('public','association_calendar_notice','association notices have their own table');
select has_column('public','association_calendar_notice','association_name','association is a first-class responsible entity');
select has_column('public','association_calendar_notice','management_period_id','notices belong to a management period');
select has_column('public','association_calendar_notice','start_date','notices carry calendar dates');
select has_index('public','association_calendar_notice','association_calendar_notice_period_idx','period foreign key is indexed');
select has_function('private','can_manage_association_calendar',array['uuid'],'central administrative authorization');
select ok((select relrowsecurity from pg_class where oid='public.association_calendar_notice'::regclass),'RLS enabled');
select ok(not has_table_privilege('anon','public.association_calendar_notice','SELECT') and not has_table_privilege('anon','public.association_calendar_notice','INSERT'),'anonymous users have no table grants');
select ok(not has_function_privilege('anon','private.can_manage_association_calendar(uuid)','execute'),'authorization helper not callable by anonymous');
select ok((select qual from pg_policies where schemaname='public' and tablename='association_calendar_notice' and policyname='association_calendar_notice_select') ilike '%can_access_organization%','authorized tenant members can read notices');
select ok((select with_check from pg_policies where schemaname='public' and tablename='association_calendar_notice' and policyname='association_calendar_notice_insert') ilike '%can_manage_association_calendar%','writes require institutional administrative permission');

create temp table t034_ids(k text primary key,id uuid default gen_random_uuid());
create temp table t034_out(who text,k text,v text);
grant all on t034_ids,t034_out to authenticated;
insert into t034_ids(k) values ('org'),('period'),('admin'),('supervisor'),('member'),('unit'),('notice');
create function pg_temp.id(k text) returns uuid language sql stable as $$ select id from pg_temp.t034_ids where t034_ids.k=$1 $$;
grant execute on function pg_temp.id(text) to authenticated;
insert into auth.users(id,email) select gen_random_uuid(),email from unnest(array['s114-admin@example.test','s114-supervisor@example.test','s114-member@example.test']) email;
insert into public.organization(id,code,name,contact_email) values(pg_temp.id('org'),'s114-org','S11.4 test tenant','s114@example.test');
insert into public.management_period(id,organization_id,name,start_date,end_date)
values(pg_temp.id('period'),pg_temp.id('org'),'Gestión 2027',date '2027-01-01',date '2027-12-31');
insert into private.operator_access(id,email,display_name,role,organization_id,active,email_confirmed_at) values
(pg_temp.id('admin'),'s114-admin@example.test','Admin','admin',pg_temp.id('org'),true,now()),
(pg_temp.id('supervisor'),'s114-supervisor@example.test','Supervisor','operator',pg_temp.id('org'),true,now()),
(pg_temp.id('member'),'s114-member@example.test','Member','operator',pg_temp.id('org'),true,now());
insert into public.organization_unit(id,organization_id,code,name) values(pg_temp.id('unit'),pg_temp.id('org'),'DIPROM','Promoción');
insert into public.organization_unit_member(organization_id,unit_id,operator_access_id,unit_role) values
(pg_temp.id('org'),pg_temp.id('unit'),pg_temp.id('member'),'director');
insert into public.association_calendar_notice(id,organization_id,management_period_id,association_name,title,start_date)
values(pg_temp.id('notice'),pg_temp.id('org'),pg_temp.id('period'),'ASIBEB','Asamblea regional de Barinas',date '2027-01-10');

create function pg_temp.act_as(email text) returns void language plpgsql as $$
declare uid uuid;
begin
 select id into uid from auth.users where auth.users.email=act_as.email;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'email',email,'role','authenticated')::text,true);
end $$;
create function pg_temp.try_change(actor text,kind text,query text) returns void language plpgsql as $$
declare rows_changed integer;
begin
 execute query;
 get diagnostics rows_changed=row_count;
 insert into pg_temp.t034_out values(actor,kind,rows_changed::text);
exception when others then
 insert into pg_temp.t034_out values(actor,kind,SQLSTATE);
end $$;
grant execute on all functions in schema pg_temp to authenticated;

select pg_temp.act_as('s114-member@example.test'); set local role authenticated;
select is((select count(*)::text from public.association_calendar_notice where id=pg_temp.id('notice')),'1','ordinary director can see institution-wide association date');
select pg_temp.try_change('member','insert',format('insert into public.association_calendar_notice(organization_id,management_period_id,association_name,title,start_date) values(%L,%L,%L,%L,%L)',pg_temp.id('org'),pg_temp.id('period'),'ASIBET','Another association','2027-04-12'));
select pg_temp.try_change('member','update',format('update public.association_calendar_notice set title=%L where id=%L','Unauthorized rewrite',pg_temp.id('notice')));
reset role;
select is((select v from pg_temp.t034_out where who='member' and k='insert'),'42501','ordinary unit director cannot insert association notices');
select is((select v from pg_temp.t034_out where who='member' and k='update'),'0','ordinary unit director cannot update association notices');

select pg_temp.act_as('s114-supervisor@example.test'); set local role authenticated;
select pg_temp.try_change('supervisor','pre',format('insert into public.association_calendar_notice(organization_id,management_period_id,association_name,title,start_date) values(%L,%L,%L,%L,%L)',pg_temp.id('org'),pg_temp.id('period'),'ASIBEY','Regional event','2027-06-01'));
reset role;
select is((select v from pg_temp.t034_out where who='supervisor' and k='pre'),'42501','operator without institutional permission cannot create informational entries');

select pg_temp.act_as('s114-admin@example.test'); set local role authenticated;
select public.admin_set_operator_permissions(pg_temp.id('org'),pg_temp.id('supervisor'),array['calendar.manage_all']);
reset role;
select pg_temp.act_as('s114-supervisor@example.test'); set local role authenticated;
select pg_temp.try_change('supervisor','after',format('insert into public.association_calendar_notice(organization_id,management_period_id,association_name,title,start_date) values(%L,%L,%L,%L,%L)',pg_temp.id('org'),pg_temp.id('period'),'ASIBEY','Regional event','2027-06-01'));
reset role;
select is((select v from pg_temp.t034_out where who='supervisor' and k='after'),'1','GEN/DIGEN-style calendar supervisor can insert');

select pg_temp.act_as('s114-admin@example.test'); set local role authenticated;
select pg_temp.try_change('admin','edit',format('update public.association_calendar_notice set title=%L where id=%L','Asamblea confirmada',pg_temp.id('notice')));
reset role;
select is((select v from pg_temp.t034_out where who='admin' and k='edit'),'1','tenant admin can edit association information');
select is((select title from public.association_calendar_notice where id=pg_temp.id('notice')),'Asamblea confirmada','admin change persists');

select throws_ok(format('insert into public.association_calendar_notice(organization_id,management_period_id,association_name,title,start_date) values(%L,%L,%L,%L,%L)',pg_temp.id('org'),pg_temp.id('period'),'ASIBEY','Out of year','2028-01-01'),'23514','Association activity dates must be within the selected management period','cannot place an association event outside its management year');

select * from finish();
rollback;
