# Sprint S2 — Organization Creation Auto-Provisions Tenant Admin

**Branch:** `feat/organization-tenant-admin-provisioning`

**Status:** Phase 1 (schema + auto-provisioning) done and applied to `edifydb`.
Verified locally (pgTAP green, functional smoke test passed, `pnpm lint`/
`pnpm build` clean, `pnpm test` unaffected pre-existing failure confirmed
unrelated) and applied with explicit user authorization on 2026-07-27.
Post-apply checks: all 4 pre-existing operators confirmed (`email_confirmed_at`
backfilled, none locked out); security/performance advisors show only the
expected `confirm_operator_activation` anon-`security definer` warning (by
design — see RPC section) plus pre-existing, unrelated findings.

## Addendum: invitation email + resend action (Phase 2)

Requested after Phase 1 shipped: (1) actually send an activation email to a
newly-provisioned admin, (2) a "Reenviar invitación" (resend invitation)
button in the operator list for pending/expired confirmations.

**Decisions confirmed with product owner:**
- Email delivery: a dedicated transactional provider (e.g. Resend), not the
  Zoho SMTP relay already used for Supabase Auth's own magic-link email.
- Trigger mechanism: `pg_net` called directly from the SQL functions, so the
  activation token never passes through the calling super_admin's browser.
- Resend permission: `super_admin` only (not tenant admins, even for their
  own organization's operators).

**Scope split, because sending real email needs an external account this
session cannot create:**

- **Phase 2a (done, this session):** `supabase/migrations/20260727020000_operator_invitation_management.sql`
  - Fixed a real bug found while building this: `admin_save_operator_access`'s
    insert path never set an `activation_token`, so any operator added via the
    plain "add operator" admin form (not organization creation) got
    `email_confirmed_at = null` forever and was permanently locked out by
    Phase 1's confirmation check. Now provisions a token on insert, matching
    `admin_save_organization`.
  - `admin_list_operator_access` now returns `email_confirmed_at` and
    `can_resend_invitation` (true only when the caller is `super_admin` and
    the row is unconfirmed).
  - New `resend_operator_activation(operator_id)` RPC (`super_admin` only):
    rotates `activation_token`/`activation_token_expires_at` for an
    unconfirmed operator; rejects (`22023`) if already confirmed. Does **not**
    send an email yet — see Phase 2b.
  - Frontend: `OperatorAdminPanel.jsx` shows a "Confirmación pendiente" badge
    and a "Reenviar invitación" button (visible only when
    `can_resend_invitation` is true) that calls the new RPC.
  - Tests: `supabase/tests/006_operator_invitation_management_test.sql` (9/9
    green locally), plus a manual functional smoke test (new operator via the
    admin form gets a token; list exposes pending state; resend rotates the
    token; resend on an already-confirmed operator is rejected).

- **Phase 2b (blocked, deferred):** the actual email send.
  - Needs a Resend account, a verified `somosedificadigital.com` domain
    (SPF/DKIM), and an API key — product owner to set up and hand over the
    key; not something this agent can create or pay for.
  - Once available: a new Supabase Edge Function (`supabase/functions/send-operator-invitation/`)
    calls the Resend API; `admin_save_organization`, `admin_save_operator_access`
    (insert path), and `resend_operator_activation` each call it via `pg_net`
    (requires enabling the `pg_net` extension) so the token stays server-side.
  - The email links to a **new frontend page** at
    `somosedificadigital.com/activar?token=...` (bilingual, per interface
    guidance) that calls `confirm_operator_activation(token)` — this page
    does not exist yet either and is part of Phase 2b.
  - Not yet applied to `edifydb`; will need its own migration (`pg_net`
    extension + trigger/call wiring) once the provider is ready.

## Context

**Revised after starting implementation:** `origin/main` was fast-forwarded
between planning and implementation and now already includes everything that
was previously believed to exist only on `feature/demo-access-dashboard`:
`public.organization`, `public.organization_host`, `role`/`organization_id` on
`private.operator_access`, `private.is_super_admin()`,
`private.current_operator_organization_id()`, `private.can_access_organization()`,
tenant-scoped RLS across operational tables, `admin_save_organization`,
`admin_save_organization_host`, `admin_list_operator_access`,
`admin_save_operator_access`, and the dashboard UI
(`OrganizationAdminPanel.jsx`, `OperatorAdminPanel.jsx`, `DashboardApp.jsx`).
**No porting is needed.** This plan is scoped down to the actual remaining gap:

1. `public.admin_save_organization` (`supabase/migrations/20260725233500_project_compliance_foundation.sql:133`)
   only reassigns the **calling super_admin's own** `organization_id` on
   create — it does not provision any `operator_access` row for the new
   organization's `contact_email`. Nothing today makes the org's contact email
   its admin.
2. `public.organization.contact_email` (`supabase/migrations/20260725233000_operations_projects_volunteers.sql:38`)
   is currently **nullable and not unique** — it must be required and unique
   to serve as the organization's access identifier.
3. There is no email-confirmation/activation-token mechanism anywhere.
   `private.operator_access` only has `active` (manual on/off); there is no
   `email_confirmed_at`/`activation_token` column, and
   `private.is_authorized_operator()` does not require confirmation.

## Goals

- Creating an organization always provisions exactly one `operator_access` row
  for that organization's `contact_email`, with `role = 'admin'` and the correct
  `organization_id` — with no separate manual step.
- That new admin cannot operate until they confirm ownership of their email via
  a single-use activation token (independent of Supabase Auth's own magic-link
  verification), and can be independently enabled/disabled via the existing
  `active` flag.
- Only a `super_admin` (an operator with no organization, i.e. a platform host)
  can create organizations.
- No regression to current single-tenant RLS/access behavior for existing
  operators until they are explicitly migrated to a role by the product owner.

## Architecture / Schema Impact

### `public.organization` — tighten `contact_email`

```sql
update public.organization set contact_email = lower(trim(contact_email))
  where contact_email is not null;
-- any existing null/duplicate contact_email must be resolved manually
-- (Task 2) before these constraints can be applied.
alter table public.organization
  alter column contact_email set not null,
  add constraint organization_contact_email_unique unique (contact_email);
```

### `private.operator_access` — additive activation columns

`organization_id` and `role` (`'operator' | 'admin' | 'super_admin'`) already
exist (`202607210001_operator_roles_and_profile.sql`,
`20260726001000_tenant_isolation_and_project_execution.sql`). Add only:

```sql
alter table private.operator_access
  add column activation_token uuid,
  add column activation_token_expires_at timestamptz,
  add column email_confirmed_at timestamptz;
```

- `active` (existing) stays a manual on/off switch, independent of email
  confirmation.
- `email_confirmed_at` is set once, on first successful activation-token
  redemption. Operating requires **both** `active` and
  `email_confirmed_at is not null` — `private.is_authorized_operator()` must be
  updated to check both.
- `activation_token`/`activation_token_expires_at` are cleared (`null`) once
  redeemed.
- Existing operators (all currently pre-dating this column) need
  `email_confirmed_at` backfilled to `created_at` (or `now()`) in the same
  migration so nobody already active gets locked out — this is a backfill of
  the new column's default state, distinct from the Task 2 role review.

### RPC: `public.admin_save_organization` — provision the admin on create

Extend the existing function (`20260725233500_project_compliance_foundation.sql:133`)
rather than adding a parallel one, so the dashboard's existing call site keeps
working. On the **insert** branch only (`target_id is null`), after
`saved` is populated:

```sql
insert into private.operator_access (
  email, display_name, role, organization_id, active,
  activation_token, activation_token_expires_at
) values (
  saved.contact_email, 'Admin', 'admin', saved.id, true,
  gen_random_uuid(), now() + interval '7 days'
);
```

- Runs in the same transaction as the `organization` insert — one rolls back
  if the other fails.
- Relies on `organization.contact_email` and
  `operator_access (lower(email))` uniqueness (existing index) to reject a
  duplicate email atomically.
- **Removes** the existing `update private.operator_access set organization_id
  = saved.id ... where organization_id is null` block that self-assigned the
  calling super_admin to the org they just created. Discovered during
  implementation: this collided with `private.enforce_organization_seat_limit()`
  (`20260726010000_donor_directory_funding_reconciliation_and_billing.sql`) —
  a brand-new organization has no `organization_subscription` row yet, so the
  trigger's fallback seat limit is 1; the self-assign consumed that single
  seat before the new admin could be inserted, so the admin insert always
  failed. A super_admin is a platform/host account, not a tenant seat, so it
  should not occupy one — confirmed with product owner to remove the
  self-assign rather than special-case the seat-limit trigger.
- Continues to require `private.is_super_admin()`, unchanged.

### RPC: `public.confirm_operator_activation(token uuid)`

**Must be `security definer`, granted to `anon`** (not `security invoker` like
the other RPCs) — the caller confirming their email has no Supabase Auth
session yet, so the token itself is the only credential, the same way a
magic-link click is. `set search_path = ''`. Looks up the operator by
`activation_token`, checks `activation_token_expires_at > now()`, sets
`email_confirmed_at = now()`, clears the token columns. Returns success/failure
only (no operator details) so it can't be used to enumerate emails.

### `private.is_authorized_operator()` — updated

Add `and access.email_confirmed_at is not null` to the existing `active`/email
match, and (for future org-scoped RLS) select `role`/`organization_id` so
callers can branch on them. This plan keeps existing RLS policies as
organization-agnostic for now (per "no regression" goal) — organization-scoped
RLS is out of scope for this sprint and tracked as a follow-up.

### Frontend

`OrganizationAdminPanel.jsx` already exists on `main` and already calls
`admin_save_organization` — since we extend that same RPC in place, the
existing form needs **no changes** to trigger auto-provisioning. The only
frontend gap is a activation-confirmation landing page/route (public, takes
`?token=`, calls `confirm_operator_activation`) — net new, small, deferred to
its own follow-up task if time-constrained since it depends on the email
delivery decision below.

### Activation email delivery — open question

`docs/DATABASE.md` notes the current app is passwordless Magic Link via a Zoho
SMTP relay for Supabase Auth's own emails. Sending a **custom** activation
email (with our own token, not a Supabase Auth email) needs its own delivery
path — most likely a Supabase Edge Function invoked by `create_organization`'s
caller (frontend) after the RPC returns, using the same Zoho SMTP relay
credentials server-side. **This needs product-owner confirmation** before
implementation: reuse Zoho relay credentials in an Edge Function, or another
provider. Flagged as a decision, not assumed.

## Step-by-step Tasks

1. **Database notice** — record in this plan (done) and in the PR description:
   `organization.contact_email` becomes `not null unique`; new activation
   columns on `private.operator_access`; `admin_save_organization` extended
   (insert branch only) to provision an `admin` operator; new
   `confirm_operator_activation` RPC; `is_authorized_operator()` gains an
   email-confirmation check. No new tables, no destructive changes.
2. **Review existing `operator_access`/`organization` data with the product
   owner** before applying the `not null unique` constraint on
   `contact_email` and before backfilling `email_confirmed_at` — any existing
   row with a null or duplicate `contact_email` must be resolved by hand
   first (this data-quality check replaces the earlier "assign roles"
   review, since roles already exist and are already assigned on `main`).
3. **pgTAP — red phase** (`supabase/tests/005_organization_admin_provisioning_test.sql`),
   covering:
   - `organization.contact_email` is `not null` with a unique constraint.
   - `operator_access` has `activation_token`, `activation_token_expires_at`,
     `email_confirmed_at` columns.
   - `admin_save_organization` insert path creates a matching
     `operator_access` row: `role = 'admin'`, correct `organization_id`,
     `active = true`, `email_confirmed_at is null`, non-null
     `activation_token`.
   - `admin_save_organization` update path (existing `id` passed) does **not**
     create a duplicate `operator_access` row.
   - `admin_save_organization` still rejects non-`super_admin` callers
     (existing behavior, guard against regression).
   - Duplicate `contact_email` on create is rejected atomically (no partial
     `organization` row without its `operator_access` counterpart, or vice
     versa).
   - `confirm_operator_activation`: valid unexpired token sets
     `email_confirmed_at`, clears token columns, returns success; expired or
     unknown token fails without mutating state.
   - `is_authorized_operator()` returns `false` when `email_confirmed_at is
     null` even if `active = true`; returns `true` once confirmed (guard
     against locking out already-active pre-existing operators after
     backfill).
4. **Migration file** — one new immutable migration
   (`supabase/migrations/<timestamp>_organization_admin_provisioning.sql`)
   implementing: `contact_email` constraint, new `operator_access` columns,
   backfill of `email_confirmed_at` for pre-existing rows, extended
   `admin_save_organization`, new `confirm_operator_activation`, updated
   `is_authorized_operator()`.
5. **Apply migration** to `edifydb` (project `rrqyihsjftlloizsccvi`) through
   Supabase migration history, per the Safe Database Procedure in
   `CLAUDE.md`/`AGENTS.md` — requires explicit user authorization first.
6. **Implementation** — write the SQL to make the red tests pass; resolve the
   activation-email delivery question with the product owner and implement
   the chosen path (see Open Question below) — this can land as a
   follow-up if it blocks the sprint, since the RPC/token mechanism works
   independently of how the email is delivered.
7. **Refactor** — no structural cleanup expected beyond keeping the new SQL
   consistent with existing function style; add the activation-confirmation
   frontend route only if the email delivery path is also decided this
   sprint.
8. **Verification**:
   - `pnpm test`, `pnpm lint`, `pnpm build`.
   - Representative transaction: create an organization as a seeded
     `super_admin`, verify the resulting `operator_access` row, redeem the
     activation token, roll back the transaction.
   - Run Supabase security and performance advisors after migration.
9. **Documentation** — update `docs/DATABASE.md` (contact_email uniqueness,
   activation columns, updated authorization model), update this plan's
   Status to Done.
10. **Pull request** — verification results, explicit database changes,
    screenshots if a frontend page was added, human review before merge, then
    branch deletion per `AGENTS.md`.

## Risks & Open Questions

- **Activation email delivery mechanism is not yet decided** (Edge Function +
  Zoho relay vs. alternative) — blocks the email-sending half of Task 6 only;
  the RPC/token schema itself does not depend on it and can ship first.
- **Existing `organization`/`operator_access` rows may have null or duplicate
  `contact_email`** — must be resolved with the product owner before the
  `not null unique` constraint can be applied (Task 2); cannot be assumed away.
- **Backfill safety**: existing active operators must not be locked out when
  `is_authorized_operator()` starts requiring `email_confirmed_at` — the
  migration must backfill that column for all pre-existing rows in the same
  transaction that adds the check, and a pgTAP test must assert this
  explicitly.
- **RLS remains as currently deployed.** This sprint does not change any
  existing tenant-isolation RLS policy (`private.can_access_organization()`
  etc.) — it only affects who gets auto-provisioned as an org's admin and
  when they may authenticate.
- **Duplicate/racing organization creation**: relies on the new
  `organization.contact_email` unique constraint and the existing
  `operator_access (lower(email))` unique index to fail atomically; pgTAP
  must assert no partial state on conflict.
