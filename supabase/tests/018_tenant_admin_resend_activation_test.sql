begin;

select plan(9);

-- A tenant 'admin' can resend the activation link to unconfirmed people in
-- their own organization; super_admin keeps cross-tenant resend. Any other
-- caller, or a target in another organization, is rejected.

insert into public.organization (id, code, name, contact_email)
values
  ('00000000-0000-4000-8000-0000000018a1', 'pgtap-resend-a', 'Resend A', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000018b1', 'pgtap-resend-b', 'Resend B', 'b@example.com');

insert into private.operator_access (id, email, display_name, role, active, organization_id, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000001801', 'pgtap-resend-admin-a@example.com', 'Admin A', 'admin', true, '00000000-0000-4000-8000-0000000018a1', now()),
  ('00000000-0000-4000-8000-000000001802', 'pgtap-resend-pending-a@example.com', 'Pending A', 'operator', true, '00000000-0000-4000-8000-0000000018a1', null),
  ('00000000-0000-4000-8000-000000001803', 'pgtap-resend-pending-b@example.com', 'Pending B', 'operator', true, '00000000-0000-4000-8000-0000000018b1', null),
  ('00000000-0000-4000-8000-000000001804', 'pgtap-resend-operator-a@example.com', 'Operator A', 'operator', true, '00000000-0000-4000-8000-0000000018a1', now()),
  ('00000000-0000-4000-8000-000000001805', 'pgtap-resend-super@example.com', 'Super', 'super_admin', true, null, now());

set local role authenticated;

-- Tenant admin of organization A.
select set_config('request.jwt.claims', '{"email":"pgtap-resend-admin-a@example.com","role":"authenticated"}', true);

select is(
  (select can_resend_invitation from public.admin_list_operator_access() where id = '00000000-0000-4000-8000-000000001802'),
  true,
  'admin_list_operator_access offers resend to a tenant admin for an unconfirmed person in their organization'
);

select is(
  (select can_resend_invitation from public.admin_list_operator_access() where id = '00000000-0000-4000-8000-000000001804'),
  false,
  'admin_list_operator_access hides resend for a person who already confirmed'
);

select lives_ok(
  $$ select public.resend_operator_activation('00000000-0000-4000-8000-000000001802') $$,
  'a tenant admin can resend the activation link inside their own organization'
);

select throws_ok(
  $$ select public.resend_operator_activation('00000000-0000-4000-8000-000000001803') $$,
  '42501',
  null,
  'a tenant admin cannot resend the activation link to another organization'
);

select throws_ok(
  $$ select public.resend_operator_activation('00000000-0000-4000-8000-000000001804') $$,
  '22023',
  null,
  'resending to a person who already confirmed is rejected'
);

-- Operator (non-admin) caller.
select set_config('request.jwt.claims', '{"email":"pgtap-resend-operator-a@example.com","role":"authenticated"}', true);

select throws_ok(
  $$ select public.resend_operator_activation('00000000-0000-4000-8000-000000001802') $$,
  '42501',
  null,
  'an operator cannot resend activation links'
);

-- Super admin keeps cross-tenant resend.
select set_config('request.jwt.claims', '{"email":"pgtap-resend-super@example.com","role":"authenticated"}', true);

select lives_ok(
  $$ select public.resend_operator_activation('00000000-0000-4000-8000-000000001803') $$,
  'a super_admin can resend the activation link in any organization'
);

reset role;

select isnt(
  (select activation_token_expires_at from private.operator_access where id = '00000000-0000-4000-8000-000000001802'),
  null,
  'resending issues a fresh activation token expiry'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.resend_operator_activation(uuid)'::regprocedure) ilike '%notify_operator_invitation%',
  'resend_operator_activation still delivers the email after rotating the token'
);

select * from finish();

rollback;
