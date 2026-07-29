begin;

select plan(9);

-- request_login_access(email) must exist, be security definer, and be
-- callable by anon (caller has no session yet when requesting login) as
-- well as authenticated.
select has_function(
  'public',
  'request_login_access',
  array['text'],
  'request_login_access RPC exists'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.request_login_access(text)'::regprocedure),
  true,
  'request_login_access is security definer'
);

select ok(
  has_function_privilege('anon', 'public.request_login_access(text)', 'EXECUTE'),
  'anonymous sessions can call request_login_access (no session exists yet at login time)'
);

select ok(
  has_function_privilege('authenticated', 'public.request_login_access(text)', 'EXECUTE'),
  'authenticated sessions can also call request_login_access'
);

-- Unknown email: generic not-ready response, no enumeration, no row created.
select is(
  (select public.request_login_access('nobody-' || gen_random_uuid()::text || '@example.test')),
  '{"ready": false}'::jsonb,
  'unknown email returns a generic not-ready response'
);

-- Seed one organization per operator (each seat-limited to 1 active user by
-- default with no subscription row) so the three test operators don't
-- compete for the same organization's single default seat.
insert into public.organization (id, code, name, contact_email, language)
values
  ('44444444-4444-4444-4444-444444444401', 'login-gate-test-1', 'Login Gate Test Org 1', 'logingatetestorg1@example.test', 'es'),
  ('44444444-4444-4444-4444-444444444405', 'login-gate-test-2', 'Login Gate Test Org 2', 'logingatetestorg2@example.test', 'es'),
  ('44444444-4444-4444-4444-444444444406', 'login-gate-test-3', 'Login Gate Test Org 3', 'logingatetestorg3@example.test', 'es');

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at, activation_token, activation_token_expires_at, updated_at)
values (
  '44444444-4444-4444-4444-444444444402', 'confirmed-operator@example.test', 'Confirmed Operator', 'admin',
  '44444444-4444-4444-4444-444444444401', true, now(), null, null, now()
);

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at, activation_token, activation_token_expires_at, updated_at)
values (
  '44444444-4444-4444-4444-444444444403', 'unconfirmed-operator@example.test', 'Unconfirmed Operator', 'admin',
  '44444444-4444-4444-4444-444444444405', true, null, null, null, now() - interval '10 minutes'
);

insert into private.operator_access (id, email, display_name, role, organization_id, active, email_confirmed_at, activation_token, activation_token_expires_at, updated_at)
values (
  '44444444-4444-4444-4444-444444444404', 'inactive-operator@example.test', 'Inactive Operator', 'admin',
  '44444444-4444-4444-4444-444444444406', false, null, null, null, now() - interval '10 minutes'
);

-- Confirmed + active: ready, no mutation.
select is(
  (select public.request_login_access('confirmed-operator@example.test')),
  '{"ready": true}'::jsonb,
  'confirmed, active operator is ready to receive a real magic link'
);

-- Inactive: generic not-ready, matching the unknown-email response (no enumeration signal).
select is(
  (select public.request_login_access('inactive-operator@example.test')),
  '{"ready": false}'::jsonb,
  'inactive operator returns the same generic not-ready response'
);

-- Unconfirmed + active: not-ready, but rotates the activation token (self-service resend)
-- since the row's last rotation is well outside the 5-minute rate-limit window.
-- Split into two statements: the rotation happens inside the function call's
-- own command, and a sibling subquery in the *same* statement would still
-- see the pre-update snapshot, so the follow-up check must be a separate
-- top-level statement to observe the write.
select is(
  (select public.request_login_access('unconfirmed-operator@example.test')),
  '{"ready": false}'::jsonb,
  'unconfirmed, active operator gets a generic not-ready response'
);

select ok(
  (select activation_token from private.operator_access where id = '44444444-4444-4444-4444-444444444403') is not null,
  'unconfirmed, active operator gets a rotated activation token as a side effect'
);

select * from finish();

rollback;
