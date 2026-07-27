begin;

select plan(9);

select has_extension('pg_net', 'pg_net extension is enabled for outbound HTTP calls');

select has_function(
  'private',
  'notify_operator_invitation',
  array['uuid'],
  'notify_operator_invitation helper exists'
);

select is(
  (select prosecdef from pg_proc where oid = 'private.notify_operator_invitation(uuid)'::regprocedure),
  true,
  'notify_operator_invitation uses security definer to reach vault and private.operator_access'
);

select ok(
  not has_function_privilege('authenticated', 'private.notify_operator_invitation(uuid)', 'EXECUTE'),
  'notify_operator_invitation is not directly callable by authenticated (internal use only)'
);

select ok(
  not has_function_privilege('anon', 'private.notify_operator_invitation(uuid)', 'EXECUTE'),
  'notify_operator_invitation is not directly callable by anon'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization(jsonb)'::regprocedure) ilike '%notify_operator_invitation%',
  'admin_save_organization notifies on the new admin operator'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_operator_access(jsonb)'::regprocedure) ilike '%notify_operator_invitation%',
  'admin_save_operator_access notifies on new operator insert'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.resend_operator_activation(uuid)'::regprocedure) ilike '%notify_operator_invitation%',
  'resend_operator_activation notifies after rotating the token'
);

-- Critical regression guard: email delivery must be best-effort. In this test
-- environment the 'project_url'/'service_role_key' Vault secrets do not exist,
-- so notify_operator_invitation must no-op quietly rather than raising and
-- aborting the organization-creation transaction.
select lives_ok(
  $$
    do $inner$
    begin
      insert into private.operator_access (email, display_name, role, active, email_confirmed_at)
      values ('pgtap-notify-super@example.com', 'Super', 'super_admin', true, now());
      perform private.notify_operator_invitation(
        (select id from private.operator_access where email = 'pgtap-notify-super@example.com')
      );
    end;
    $inner$;
  $$,
  'notify_operator_invitation does not raise when Vault secrets are absent'
);

select * from finish();
rollback;
