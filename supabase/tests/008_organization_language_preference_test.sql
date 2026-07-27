begin;

select plan(7);

select has_column('public', 'organization', 'language', 'organization has a language column');

select col_default_is('public', 'organization', 'language', 'en', 'organization language defaults to English');

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization'::regclass
      and conname = 'organization_language_check'
  ),
  'organization language is constrained to a fixed set of values'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_save_organization(jsonb)'::regprocedure) ilike '%target_language%',
  'admin_save_organization accepts and validates a language'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.admin_list_organizations()'::regprocedure) ilike '%organization.language%',
  'admin_list_organizations exposes the organization language'
);

select ok(
  (select prosrc from pg_proc where oid = 'private.notify_operator_invitation(uuid)'::regprocedure) ilike '%language%',
  'notify_operator_invitation forwards the organization language to the email function'
);

-- Regression guard: invalid language values must be rejected, not silently coerced.
select throws_ok(
  $$
    select public.admin_save_organization(jsonb_build_object(
      'code', 'pgtap-lang', 'name', 'PgTAP Lang', 'contact_email', 'pgtap-lang@example.com', 'language', 'fr'
    ))
  $$,
  '42501',
  null,
  'admin_save_organization still requires super_admin before validating language (no bypass)'
);

select * from finish();
rollback;
