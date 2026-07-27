begin;

select plan(9);

-- Bug fix: admin_save_operator_access must also provision an activation token
-- for newly-inserted operators, or they can never confirm their email and are
-- permanently locked out by is_authorized_operator()'s confirmation check.
select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_operator_access(jsonb)'::regprocedure) ilike '%activation_token%',
  'admin_save_operator_access provisions an activation token on insert'
);

-- admin_list_operator_access must expose confirmation state so the UI can
-- show a pending badge and gate the resend-invitation action.
select ok(
  (select prosrc from pg_proc where oid = 'public.admin_list_operator_access()'::regprocedure) ilike '%email_confirmed_at%',
  'admin_list_operator_access exposes email confirmation state'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_list_operator_access()'::regprocedure) ilike '%can_resend_invitation%',
  'admin_list_operator_access exposes whether the caller can resend an invitation'
);

-- New resend RPC.
select has_function(
  'public',
  'resend_operator_activation',
  array['uuid'],
  'resend_operator_activation RPC exists'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.resend_operator_activation(uuid)'::regprocedure),
  true,
  'resend_operator_activation uses security definer (reaches private.operator_access)'
);

select ok(
  has_function_privilege('authenticated', 'public.resend_operator_activation(uuid)', 'EXECUTE'),
  'authenticated sessions can call resend_operator_activation'
);

select ok(
  not has_function_privilege('anon', 'public.resend_operator_activation(uuid)', 'EXECUTE'),
  'anonymous sessions cannot call resend_operator_activation'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.resend_operator_activation(uuid)'::regprocedure) ilike '%super_admin%',
  'resend_operator_activation restricts to super_admin callers'
);

select throws_ok(
  $$ select public.resend_operator_activation(gen_random_uuid()) $$,
  '42501',
  null,
  'resend_operator_activation rejects non-super_admin callers'
);

select * from finish();
rollback;
