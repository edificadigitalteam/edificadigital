begin;
set local search_path = public, extensions, pg_catalog;
select plan(2);
select has_index('public','executive_self_evaluation','executive_evaluation_evaluator_idx',
  array['evaluator_user_id'],'Evaluator foreign key has a covering index');
select ok(
  (select indexrelid::regclass::text from pg_index i
    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
   where i.indrelid='public.executive_self_evaluation'::regclass
     and a.attname='evaluator_user_id' limit 1) is not null,
  'An index leads with evaluator_user_id'
);
select * from finish();
rollback;
