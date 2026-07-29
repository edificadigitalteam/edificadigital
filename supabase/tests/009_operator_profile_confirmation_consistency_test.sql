begin;

select plan(6);

-- Bug: current_operator_profile() computed `authorized` from `active` alone,
-- while private.is_authorized_operator() (the check that actually gates
-- save_donor_directory/list_donor_directory) also requires
-- email_confirmed_at is not null. An active-but-unconfirmed operator could
-- reach the donation/project forms (gated on current_operator_profile) and
-- then have every write silently rejected. This migration aligns the two.

select ok(
  (select prosrc from pg_proc where oid = 'public.current_operator_profile()'::regprocedure) ilike '%email_confirmed_at%',
  'current_operator_profile checks email_confirmed_at, matching is_authorized_operator'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.current_operator_profile()'::regprocedure) ilike '%email_confirmed%',
  'current_operator_profile exposes an email_confirmed field so the frontend can distinguish inactive from unconfirmed'
);

-- Function shape/signature must be unaffected (existing dashboard call site keeps working).
select has_function(
  'public',
  'current_operator_profile',
  array[]::text[],
  'current_operator_profile RPC still exists with the same (no-argument) signature'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.current_operator_profile()'::regprocedure),
  true,
  'current_operator_profile remains security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.current_operator_profile()', 'EXECUTE'),
  'authenticated sessions can still call current_operator_profile'
);

select ok(
  not has_function_privilege('anon', 'public.current_operator_profile()', 'EXECUTE'),
  'anonymous sessions still cannot call current_operator_profile'
);

select * from finish();

rollback;
