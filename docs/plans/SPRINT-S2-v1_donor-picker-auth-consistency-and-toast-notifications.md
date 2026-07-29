# Sprint S2 — Donor/Actor Creation Auth Consistency + Toast Notification System

**Branch:** `fix/donor-picker-auth-consistency-and-toasts`

**Status:** Phase 1 (backend consistency: `current_operator_profile()` vs
`is_authorized_operator()`) done and applied to `edifydb` on 2026-07-29,
with explicit user authorization. pgTAP 009 verified red (2/6 failing against
a local reset before the migration) then green (158/158, all suites) after
`supabase db reset` applied it locally; then applied to `edifydb` directly
and re-verified (`has_check`/`has_field` both `true`); security/performance
advisors show only pre-existing findings, no new ones.

Phase 1.5 (block login pre-confirmation, see Addendum below) also done and
applied to `edifydb` on 2026-07-29, with explicit user authorization. New
RPC `public.request_login_access(text)` — pgTAP 010 verified red (function
did not exist) then green (167/167, all 11 suites, after two local fixes:
seeding one organization per test operator to avoid the default 1-seat
subscription limit, and splitting one assertion into two statements after
discovering the rotation side-effect and its read-back must be separate
top-level commands to be visible within the same transaction — Postgres
snapshot behavior, not a bug in the function itself). Applied directly to
`edifydb` and spot-checked (`{"ready": false}` for an unknown email,
`anon`/`authenticated` both grant EXECUTE). Security advisors show the
expected `anon_security_definer_function_executable` warning for this
function (by design, same pattern as `confirm_operator_activation` and
`resolve_tenant_host`), no unexpected new findings.

Frontend wiring done: `useOperatorAccess.js`'s `requestMagicLink` now calls
`request_login_access` first and only sends the real magic link when
`ready: true`; `DashboardApp.jsx`'s `LoginCard` renders the new
`confirmation_sent` status (copy later simplified per product owner request
to "Correo de activación de cuenta enviado a {email}."). Verified in the
browser preview against a temporary local Supabase instance (`.env.local`,
removed after testing, never committed) seeded with three cases: unknown
email, confirmed+active operator, unconfirmed+active operator — all three
produced the expected UI. `pnpm lint`/`pnpm build` clean.

Phase 1.5 is fully done.

## Phase 2: toast notifications — done, plus a critical discovery

Built `frontend/src/features/notifications/ToastProvider.jsx` (context +
`useToast()` hook) and `notifications.css`, mounted once in `main.jsx`
wrapping `RootApplication`. Wired into `DonorPicker.jsx`'s `saveQuick`
(error toast with a `42501`→friendly-message mapping, success toast) and
into the three flows' top-level submit handlers (`UnifiedMonetaryDonationFlow.jsx`,
`SimplifiedInKindDonationFlow.jsx`, `ProjectsPanel.jsx` — same `42501`
mapping; success toast added to `ProjectsPanel.jsx`, skipped for the other
two since they already show a full-screen success card with the reference
code, making a duplicate toast redundant).

**Critical discovery during verification, not present in the original
plan:** testing `DonorPicker`'s create flow inside `ProjectsPanel` (a real
click on "Guardar y seleccionar", not just code review) produced zero
network request and React's dev console showed: `In HTML, <form> cannot be
a descendant of <form>. This will cause a hydration error.` /
`<form> cannot contain a nested <form>.` `DonorPicker` renders its own
`<form className="donor-quick-form" onSubmit={saveQuick}>` — but it is
always used *inside* another form (monetary donation, in-kind donation, and
project forms all wrap it in their own `<form>`). Browsers do not fire a
submit event for a `<form>` nested inside another `<form>`, so clicking
"Guardar y seleccionar" did **nothing** in those three contexts — no error,
no RPC call, just silence. This is very likely the actual, primary cause of
the user's original bug report (creation "not working" in monetary/in-kind/
project), independent of and more fundamental than the email-confirmation
auth bug fixed in Phase 1/1.5 (which only affected unconfirmed accounts;
this affected every account, confirmed or not). It did not manifest on the
"Aliados y donantes" admin page because that page's create form is not
nested inside another form.

**Fix applied** (`DonorPicker.jsx`): the quick-create block now renders as
a `<div>` instead of a `<form>`; the save button is `type="button"` calling
`saveQuick` directly via `onClick` (made `event` optional in `saveQuick`
since there's no longer a submit event to prevent-default).

**Verified end-to-end** against a temporary local Supabase instance (real
magic-link login via Mailpit, real session, real RPC calls, `.env.local`
removed after testing):
- Before the fix: clicking save inside `ProjectsPanel`'s "Nuevo proyecto"
  form produced no `save_donor_directory` network request at all.
- After the fix: the RPC fires (200 OK), the created donor is selected in
  the picker, and a success toast (`"Aliado creado y seleccionado."`)
  renders and auto-dismisses after 5s.
- `pnpm lint`/`pnpm build` clean after the fix.

**Re-verified end-to-end in the monetary and in-kind donation flows too**
(same local Supabase instance, same authenticated session, real clicks):
`UnifiedMonetaryDonationFlow.jsx` and `SimplifiedInKindDonationFlow.jsx` both
produced a `save_donor_directory` 200 OK, the created donor appeared
selected in `.donor-picker-summary`, and the success toast rendered
identically to the `ProjectsPanel` case. All three previously-broken flows
(monetary, in-kind, project) confirmed fixed.

Phase 2 is fully done. This plan (backend auth consistency + login gate +
toast system + the nested-form fix) is ready for PR.

## Addendum: block login before confirmation, not after (Phase 1.5)

Revised after Phase 1 shipped, before starting the pending-confirmation UI
work: product owner decided the unconfirmed-email case should never reach an
authenticated session at all. Original Phase 1 plan (below, superseded)
called for a `pending_confirmation` in-app screen shown *after* Supabase
Auth's magic-link session was already established. Instead:

**Decision confirmed with product owner:**
- The magic-link request itself (`useOperatorAccess.js`'s `requestMagicLink`)
  must not call `supabase.auth.signInWithOtp` at all for an operator whose
  `email_confirmed_at` is `null` — no session is ever established pre-
  confirmation.
- Reuses the existing activation-token/email mechanism (`activation_token`,
  `email_confirmed_at`, `private.notify_operator_invitation`, the
  `send-operator-invitation` Edge Function) rather than inventing a second
  confirmation concept — only *when* it fires changes (self-service, at
  login-request time, instead of only at admin-invite time).
- To avoid enumerating registered emails, the gating RPC returns a generic
  `ready: boolean` only — the frontend shows one identical message
  ("revisa tu correo para continuar") whether the email is unknown, inactive,
  or a real unconfirmed operator; only a confirmed+active operator gets
  `ready: true` and proceeds to the real magic-link send.
- Self-service resend is rate-limited (skip rotating/sending if the row's
  `activation_token` was already rotated within the last 5 minutes, reusing
  the existing `updated_at` column) since this endpoint is anon-callable and
  a naive version would let anyone spam an operator's inbox.

### New RPC: `public.request_login_access(target_email text)`

`security definer`, `set search_path = ''`, granted to **`anon`** (caller has
no session at this point) and `authenticated`. Logic:

```sql
select * into target from private.operator_access
where lower(email) = lower(target_email);

if target.id is null or not target.active then
  return jsonb_build_object('ready', false);
end if;

if target.email_confirmed_at is not null then
  return jsonb_build_object('ready', true);
end if;

-- unconfirmed + active: self-service resend, rate-limited
if target.activation_token is null or target.updated_at < now() - interval '5 minutes' then
  update private.operator_access
  set activation_token = gen_random_uuid(),
      activation_token_expires_at = now() + interval '7 days',
      updated_at = now()
  where id = target.id;
  perform private.notify_operator_invitation(target.id);
end if;

return jsonb_build_object('ready', false);
```

### Frontend: `useOperatorAccess.js`'s `requestMagicLink`

Call `request_login_access` first. If `ready === true`, proceed exactly as
today (`supabase.auth.signInWithOtp`, status `link_sent`). If `ready ===
false`, **do not** call `signInWithOtp` — set a new status
`confirmation_sent` with a generic bilingual message; `DashboardApp.jsx`'s
`LoginCard` renders it identically to `link_sent` but with copy that doesn't
promise a login link ("Si tu cuenta existe y está activa, te enviamos
instrucciones para continuar.").

### Revised Step-by-step Tasks (Phase 1.5)

1. pgTAP red phase — `supabase/tests/010_login_confirmation_gate_test.sql`:
   function exists with the right signature/grants (`anon` **and**
   `authenticated` can execute, unlike every other operator RPC which is
   `authenticated`-only); returns `ready: false` for an unknown email, an
   inactive operator, and an active-unconfirmed operator (and in the last
   case, rotates `activation_token`/`activation_token_expires_at` and bumps
   `updated_at` — but only once within a 5-minute window, asserting a second
   call inside that window does not rotate again); returns `ready: true` for
   an active-confirmed operator without mutating anything.
2. Migration — one new file,
   `supabase/migrations/<timestamp>_login_confirmation_gate.sql`, adding
   `request_login_access`.
3. Apply to `edifydb` — requires explicit user authorization.
4. Frontend — update `useOperatorAccess.js` (`requestMagicLink`,
   `confirmation_sent` status) and `DashboardApp.jsx`'s `LoginCard`.
5. Verification — `pnpm test`/`lint`/`build`; manual check in the browser
   preview for all four cases (unknown, inactive, unconfirmed, confirmed);
   confirm the unconfirmed case receives the activation email end-to-end
   (via the existing Resend delivery path) and the confirmed case still
   receives a real magic link and can log in.
6. Documentation — update `docs/DATABASE.md` with the new RPC; update this
   plan's status.

This makes the original Phase 1 "pending_confirmation in-app screen" task
(further down in this document) unnecessary — an unconfirmed operator now
never reaches an authenticated session, so there is nothing to gate inside
the app itself. That section is left below for the historical record but is
superseded by this Addendum.

## Original Phase 1 status (superseded)

## Context

Reported by product owner: clicking "Guardar y seleccionar" in the inline
"crear aliado o donante" quick-form fails silently inside the monetary
donation, in-kind donation, and new-project flows (`DonorPicker.jsx`, shared
by `UnifiedMonetaryDonationFlow.jsx`, `SimplifiedInKindDonationFlow.jsx`, and
`ProjectsPanel.jsx`), while the same creation action works from the
"Aliados y donantes" admin page (`DonorDirectoryPanel.jsx`).

### Root cause (confirmed against `edifydb`, project `rrqyihsjftlloizsccvi`)

Both code paths call the same RPC, `public.save_donor_directory`
(`supabase/migrations/20260726010000_donor_directory_funding_reconciliation_and_billing.sql`),
which — like `list_donor_directory` — requires
`private.is_authorized_operator()` to return `true`. That function
(`supabase/migrations/20260727010000_organization_admin_provisioning.sql:20-36`)
requires **both** `access.active` and `access.email_confirmed_at is not null`.

The frontend, however, decides whether to show the donation/project forms at
all using a **different** RPC, `public.current_operator_profile()`
(`supabase/migrations/20260725233000_operations_projects_volunteers.sql:227-275`),
which computes `authorized` from `access.active` **only** — it never checks
`email_confirmed_at`. So an operator whose email is not yet confirmed passes
the frontend gate, reaches the form and the `DonorPicker`, and only then hits
the stricter backend check — which throws `42501 Operational access is
required.` `DonorPicker.jsx` does catch this (`setError(requestError.message)`,
line 124-125) but the raw Postgres error message is easy to miss inside the
cramped inline quick-form, and nothing else on screen signals that anything
went wrong. Confirmed with a live query against `private.operator_access`:
one real row (`ORGANIZACION 3 TEST`, `role = 'admin'`, `active = true`,
`email_confirmed_at = null`) is in exactly this stuck state today.

This is a two-part problem:
1. A **backend consistency bug** — two RPCs disagree about what "authorized"
   means, so the UI over-promises access it can't back up.
2. A **missing feedback mechanism** — even after the RPCs agree, any future
   RPC failure (network, validation, permission) needs a visible, consistent
   way to tell the user something went wrong, instead of a silent no-op or an
   easy-to-miss inline paragraph. Product owner asked for this to become the
   project's standard error/success feedback pattern (toast notifications),
   not a one-off fix.

## Goals

- `current_operator_profile()` and `is_authorized_operator()` agree on what
  "authorized" means, so a user is never shown a form they cannot actually
  submit against.
- An operator with `active = true` but unconfirmed email sees a clear,
  actionable state (not a working-looking form that silently fails).
- A single, reusable toast notification component exists for the whole app
  (success / error / info), replacing ad hoc inline error paragraphs for
  submit-level (not per-field) feedback, starting with `DonorPicker.jsx` and
  extended to the monetary, in-kind, and project flows' own submit handlers.
- This becomes documented, standing practice in `CLAUDE.md` — not just a fix
  applied once.

## Database Notice

- **Change:** `public.current_operator_profile()` — add
  `and access.email_confirmed_at is not null` to its `authorized` computation,
  matching `private.is_authorized_operator()`. Read-only function
  (`security definer`, existing grants unchanged); no schema/table change, no
  data migration, no RLS change.
- No new tables, no destructive changes, no column changes.
- Affects one existing live row (`ORGANIZACION 3 TEST`) which will now
  correctly see an "email not confirmed" state instead of a form that fails
  on submit — this is the intended fix, not a regression, but is called out
  here per the Safe Database Procedure since it changes observed behavior for
  a real tenant.

## Architecture / Schema Impact

### `public.current_operator_profile()` — align with `is_authorized_operator()`

Locate the function
(`supabase/migrations/20260725233000_operations_projects_volunteers.sql:227-275`);
change:

```sql
'authorized', access.active,
```

to:

```sql
'authorized', access.active and access.email_confirmed_at is not null,
```

Add `access.email_confirmed_at is not null` (aliased, e.g.
`email_confirmed`) to the returned JSON so the frontend can distinguish
"not authorized because inactive" from "not authorized because email
unconfirmed" and show the right message, instead of one generic blocked
state.

### Frontend: pending-confirmation state

`useOperatorAccess.js` / the flows that gate on `access.status ===
'authorized'` (`UnifiedMonetaryDonationFlow.jsx:159`,
`SimplifiedInKindDonationFlow.jsx`, `DashboardApp.jsx`) need a distinct
`status` value (e.g. `'pending_confirmation'`) when `active` is true but
`email_confirmed` is false, rendering a bilingual explanatory message
("Tu cuenta está activa pero tu correo no ha sido confirmado. Revisa tu
bandeja de entrada o contacta al administrador.") instead of the form.

### Toast notification system (new, frontend-only)

- New shared component: `frontend/src/features/notifications/Toast.jsx` +
  `ToastProvider` (React context) + `useToast()` hook, mounted once near the
  app root (`App.jsx` / `main.jsx`) so any feature can call
  `const { notify } = useToast(); notify({ type: 'error' | 'success' | 'info', message })`.
- New `frontend/src/features/notifications/notifications.css`: fixed-position
  stack (bottom-right on desktop, full-width bottom on mobile per the
  existing responsive patterns), auto-dismiss after ~5s with a manual close
  button, color per type reusing existing design tokens (`--ed-purple` for
  info/success accent, existing error red for `error`), respects
  reduced-motion (no slide animation when `prefers-reduced-motion`).
- Bilingual: callers pass already-translated strings from their own `copy`
  dictionaries (no new centralized copy needed, consistent with existing
  per-feature `copy` objects).
- `DonorPicker.jsx`'s `saveQuick` error branch calls `notify({ type: 'error',
  message: friendlyMessage(requestError) })`, where `friendlyMessage` maps
  the `42501 Operational access is required.` Postgres error to a specific
  bilingual explanation ("No tienes acceso para esta acción. Confirma tu
  correo o contacta al administrador.") and falls back to the raw message
  for anything unrecognized. Success path also fires a brief success toast
  ("Aliado creado y seleccionado.").
- Apply the same pattern to the top-level submit handlers of
  `UnifiedMonetaryDonationFlow.jsx`, `SimplifiedInKindDonationFlow.jsx`, and
  `ProjectsPanel.jsx` (their existing `message`/`form-error` paragraphs stay
  as a secondary inline detail if useful, but the toast becomes the primary,
  hard-to-miss signal).

### `CLAUDE.md` update (standing practice)

Add to "## Interface guidance": a rule that any user-triggered action calling
Supabase (RPC, insert, upload) must surface success/failure via the shared
toast system, not only inline text or a silent state change — with a link to
this plan and the concrete component path once it exists in-repo.

## Step-by-step Tasks

1. **Plan** — this document (done).
2. **Database notice** — recorded above; will also go in the PR description.
3. **Red phase (pgTAP)** —
   `supabase/tests/009_operator_profile_confirmation_consistency_test.sql`:
   - `current_operator_profile()` returns `authorized = false` for an
     `active = true`, `email_confirmed_at = null` operator (regression guard
     for today's bug).
   - Returns `authorized = true` once `email_confirmed_at` is set, `active`
     stays true.
   - Returns `authorized = false` when `active = false` regardless of
     confirmation (no regression).
   - New `email_confirmed` field in the returned JSON matches
     `email_confirmed_at is not null`.
4. **Migration** — one new immutable file,
   `supabase/migrations/<timestamp>_operator_profile_confirmation_consistency.sql`,
   updating only `current_operator_profile()`.
5. **Apply migration** to `edifydb` (`rrqyihsjftlloizsccvi`) through Supabase
   migration history — requires explicit user authorization first, per the
   Safe Database Procedure.
6. **Frontend implementation**:
   - `useOperatorAccess.js` (or equivalent shared hook): add
     `pending_confirmation` status branch.
   - Render the pending-confirmation message in the three gated flows.
   - Build `ToastProvider`/`Toast.jsx`/`useToast`/`notifications.css`.
   - Wire `DonorPicker.jsx` save/error paths to `useToast`.
   - Wire the three flows' top-level submit success/error paths to
     `useToast`.
7. **Refactor** — remove now-redundant inline error paragraphs that the toast
   fully replaces; keep field-level (`field-error`) validation messages as is
   (those stay inline, next to the field — only submit-level/system feedback
   moves to toast).
8. **Verification**:
   - `pnpm test`, `pnpm lint`, `pnpm build`.
   - Representative transaction: confirm `current_operator_profile()`
     behavior against a seeded unconfirmed operator row, roll back.
   - Manual functional check in the browser preview: trigger a
     `save_donor_directory` failure (simulate via an unconfirmed test
     operator or by temporarily revoking access) and confirm the error toast
     appears with the friendly message; confirm a successful creation shows
     a success toast and the donor becomes selected.
   - Run Supabase security and performance advisors after migration.
9. **Documentation**:
   - Update `docs/DATABASE.md` (`current_operator_profile` behavior).
   - Update `CLAUDE.md` "Interface guidance" with the standing toast
     requirement.
   - Mark this plan's Status as Done with verification results.
10. **Pull request** — verification results, explicit database change,
    screenshots of the pending-confirmation state and both toast types,
    human review before merge.

## Out of Scope (this plan)

- The "Aliados y donantes" admin page's cramped layout and orange/purple
  color inconsistency — tracked separately, not a blocking bug, purely
  cosmetic.
- Deduplicating `DonorPicker.jsx` and `DonorDirectoryPanel.jsx`'s create
  logic into one shared component — worth doing, but independent of this
  auth fix and the toast system; can follow once toasts land everywhere.
- Fixing already-existing unconfirmed operator rows in production data (the
  `ORGANIZACION 3 TEST` row) — once the pending-confirmation state exists,
  that operator needs an invitation resend, which is already handled by the
  existing `resend_operator_activation`/"Reenviar invitación" flow
  (`SPRINT-S2-v1_organization-tenant-admin-provisioning.md`, Phase 2a) — no
  new mechanism needed, just using the existing one for that specific row.

## Risks & Open Questions

- **Behavior change for the one live unconfirmed operator row**: they will
  now see a blocking "confirm your email" message instead of a form that
  silently fails — this is the intended fix; flagged for explicit
  acknowledgement before applying, per the database notice above.
- **Toast auto-dismiss timing and stacking** for multiple rapid errors —
  default to a small max-visible-count with queueing, standard pattern, no
  open question expected but worth confirming visually during verification.
- **Scope of toast rollout**: this plan wires toasts into `DonorPicker` and
  the three gated flows' top-level submit handlers only, matching the
  reported bug; broader retrofitting of every existing form across the app
  is explicitly deferred, tracked only as the new standing rule in
  `CLAUDE.md` for future work.
