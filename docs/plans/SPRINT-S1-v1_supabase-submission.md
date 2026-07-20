# Sprint S1 Plan: Authenticated Supabase Submission

**Code:** S1-SYNC
**Status:** Complete — merged in PR #16
**Owner:** Product owners
**Created:** 2026-07-19
**Last Updated:** 2026-07-19

## Outcome

Connect the bilingual in-kind shipment form to the deployed `edifydb` Supabase project. A confirmed form submission must create one persisted donation and shipment with all declared items and evidence metadata, return the database reference, and preserve the draft whenever completion requires another attempt.

## Existing information used

- Supabase project: `edifydb` (`rrqyihsjftlloizsccvi`).
- Initial operators: authorized accounts provisioned directly in the protected Supabase environment.
- Public client configuration: `VITE_SUPABASE_URL` and a Supabase publishable key, with legacy `VITE_SUPABASE_ANON_KEY` compatibility.
- Existing bilingual form, validation behavior, 17-table operational schema, private attachment bucket, and international-reporting boundaries.

## Database changes — explicit notice

This milestone adds database objects and changes access policies.

### Access control

- Create a private operator allow-list; provision operator identities directly in the protected environment so personal addresses stay outside Git history.
- Add a protected authorization function that requires an authenticated user and an active allow-list entry.
- Replace deprecated `auth.role()` RLS predicates on all operational tables and Storage with the operator authorization predicate.
- Add a public, authenticated-only access-check function for the application gate.

### Idempotency and audit

- Add `donation.submission_key` to identify repeated attempts safely.
- Add `donation.created_by` linked to the authenticated Supabase user.
- Add unique and lookup indexes for the submission key and creator.

### Atomic submission

- Add `public.submit_in_kind_shipment(payload jsonb)` as a `security invoker` RPC.
- Revoke execution from `public` and `anon`; grant execution to `authenticated`.
- Validate the authenticated operator, payload shape, unit codes, values, categories, dates, and attachment metadata.
- Create or reuse the sender actor, assign the donor role, create the in-kind donation, details, shipment, items, and shipment attachment metadata in one database transaction.
- Return an existing result when the same operator retries the same `submission_key`.

Inventory lots and movements begin at physical receipt because the current announcement form lacks verified warehouse, received, accepted, and damaged quantities.

## Frontend changes

- Add a pinned `@supabase/supabase-js` dependency and client configuration.
- Add a bilingual magic-link access gate with persistent sessions and an authorization check.
- Add evidence selection for JPEG, PNG, WebP, and PDF files up to 20 MB.
- Upload evidence to deterministic per-user and per-submission paths in the private bucket.
- Map the form draft to the RPC payload without using local records as proof of persistence.
- Preserve the local draft and selected evidence state after recoverable errors.
- Clear the local draft only after Supabase returns a persisted reference.
- Provide bilingual progress, retry, access, and success states.

## TDD sequence

1. Commit this plan and database notice.
2. Add failing frontend tests for payload mapping, evidence validation, deterministic upload paths, idempotent retry behavior, and database error handling.
3. Add failing pgTAP tests for operator authorization, audit fields, RPC security, and deprecated predicate removal.
4. Implement the migration and frontend integration.
5. Apply the migration to `edifydb` and run a rollback-safe functional scenario.
6. Run security and performance advisors.
7. Run frontend test, lint, build, and responsive interaction checks.
8. Update documentation and the draft pull request.

## Publication gates

- Authorized users can establish a session through the production redirect URL.
- Unauthorized authenticated users cannot read, write, upload, or call the submission RPC.
- Repeated submission attempts create one donation and one shipment.
- Evidence metadata references successfully uploaded private objects.
- A success screen uses the reference returned by Supabase.
- Frontend tests, lint, build, database assertions, advisors, and Vercel preview pass.
- The branch remains a draft until the production interaction is verified through an authorized email account.

## Verification result

- Frontend: 18 tests pass; lint and production build pass.
- Supabase migration `authenticated_submission` is applied in `edifydb`.
- Structural validation confirms the active operator configuration, 17 protected public policies, one protected Storage policy, security-invoker RPC, authenticated execution, anonymous denial, and the idempotency index.
- A rollback-safe authorized scenario created one donation, one shipment, and three linked item rows.
- Repeating the same submission key returned the existing record and kept all row counts at one shipment with three items.
- A rollback-safe authenticated session outside the private allow-list returned `false` from the access check and the submission RPC rejected its payload.
- The functional transaction rolled back; Auth, donation, and shipment tables returned to zero rows.
- Supabase security advisor returned zero findings.
- Performance advisor returned only unused-index informational notices on the empty operational schema.
- Production configuration build passes with the active Supabase project URL and modern publishable key.
- The Vercel branch deployment completed successfully; its preview requires team access through Vercel SSO.

PR #16 received approval and was merged to `main` on 2026-07-19. The merge publishes the authenticated in-kind persistence boundary through the production Vercel project. Authorized Magic Link interaction remains part of every production smoke check because it depends on a protected operator mailbox.

## Rollback

- Revert the application commit to restore the browser-only draft flow.
- Apply a later corrective migration for database changes; applied migrations remain immutable.
- Deactivate an operator by changing the private allow-list entry.
