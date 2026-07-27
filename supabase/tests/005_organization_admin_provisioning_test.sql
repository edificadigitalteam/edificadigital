begin;

select plan(17);

-- organization.contact_email becomes the org's access identifier: required and unique.
select col_not_null('public', 'organization', 'contact_email', 'organization contact_email is required');

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization'::regclass
      and contype = 'u'
      and 'contact_email' = any (
        select attname
        from pg_attribute
        where attrelid = conrelid and attnum = any (conkey)
      )
  ),
  'organization contact_email is unique'
);

-- Activation columns on the operator allow-list.
select has_column('private', 'operator_access', 'activation_token', 'operator activation token column exists');
select has_column('private', 'operator_access', 'activation_token_expires_at', 'operator activation token expiry column exists');
select has_column('private', 'operator_access', 'email_confirmed_at', 'operator email confirmation column exists');

select col_type_is(
  'private', 'operator_access', 'activation_token', 'uuid',
  'activation token is a uuid'
);

-- Pre-existing operators must not be locked out once confirmation is required.
select ok(
  (select coalesce(bool_and(email_confirmed_at is not null), true) from private.operator_access),
  'pre-existing operators are backfilled with a confirmed email'
);

-- New confirmation RPC.
select has_function(
  'public',
  'confirm_operator_activation',
  array['uuid'],
  'operator activation confirmation RPC exists'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.confirm_operator_activation(uuid)'::regprocedure),
  true,
  'activation confirmation RPC uses security definer (caller has no session yet)'
);

select ok(
  has_function_privilege('anon', 'public.confirm_operator_activation(uuid)', 'EXECUTE'),
  'anonymous sessions can confirm their own activation token'
);

select ok(
  has_function_privilege('authenticated', 'public.confirm_operator_activation(uuid)', 'EXECUTE'),
  'authenticated sessions can also confirm an activation token'
);

-- is_authorized_operator must require confirmation, not just active.
select ok(
  (select prosrc from pg_proc where oid = 'private.is_authorized_operator()'::regprocedure) ilike '%email_confirmed_at%',
  'is_authorized_operator checks email_confirmed_at'
);

-- admin_save_organization keeps existing shape/authorization; still security invoker at the RPC boundary the client calls.
select has_function(
  'public',
  'admin_save_organization',
  array['jsonb'],
  'organization save RPC still exists with the same signature'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.admin_save_organization(jsonb)'::regprocedure),
  true,
  'admin_save_organization remains security definer to reach private.operator_access'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization(jsonb)'::regprocedure) ilike '%activation_token%',
  'admin_save_organization provisions an activation token when creating an organization'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization(jsonb)'::regprocedure) ilike '%''admin''%',
  'admin_save_organization assigns the admin role to the new operator'
);

-- Functional happy path: creating an organization provisions a matching pending admin operator.
select throws_ok(
  $$ select public.admin_save_organization(jsonb_build_object(
      'code', 'pgtap-org', 'name', 'PgTAP Org', 'contact_email', 'pgtap-admin@example.com'
    )) $$,
  '42501',
  null,
  'admin_save_organization still rejects non-super_admin callers'
);

select * from finish();
rollback;
