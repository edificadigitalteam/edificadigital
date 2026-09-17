# ADR-004: Keep Nominal Beneficiary Identity in a Protected Schema

**Status:** Implemented and deployed
**Date:** 2026-07-19

## Context

Edifica Digital needs enough beneficiary information to verify assistance, prevent accidental duplicate registration, contact participants when operationally required, and support accountable distribution records. Names, birth dates, phone numbers, email addresses, and participation history require a stricter boundary than aggregate impact reporting.

## Decision

Store minimum nominal identity in `private.beneficiary` and event participation in `private.beneficiary_event`.

- Require an authenticated active operator and recorded privacy acknowledgement.
- Use RLS and forced RLS on both private tables.
- Revoke anonymous and public table access.
- Register through the security-invoker `public.register_beneficiary(jsonb)` RPC.
- Return a non-identifying `BEN-…` public code for operational references.
- Use creator-scoped submission keys for retry safety.
- Collect residence area instead of an exact street address in the initial model.
- Keep public and international reporting on aggregate impact records.

## Consequences

- Nominal beneficiary data remains available for authorized operations and audit.
- Public reports exclude direct identity and contact fields.
- Participation can link to an existing impact event while aggregate demographic totals retain their reporting role.
- Historical records use archival state instead of destructive deletion.
- The beneficiary interface requires a dedicated accessibility and privacy review before release.

## Deployment record

The boundary was deployed to Supabase project `edifydb` on 2026-07-19. Rollback-safe validation covered authorized registration, privacy acknowledgement, idempotent retry, non-identifying code generation, optional event linkage structure, and rejection of unauthorized access.

## Scope boundary: members are not beneficiaries (2026-09-17)

This ADR governs **beneficiaries** — people a project serves. Its rule that
dates of birth belong in the `private` schema is written for that subject, and
it does not extend to every person the platform records.

`public.organization_member` (Sprint S5) records the people and organizations
affiliated with a tenant: a pastor, an auxiliary president, a member church.
These are institutional contacts, registered so the organization can reach and
greet them, not people whose participation in a programme must stay
unidentifiable. Sprint S5 placed them in `public` at the same exposure level as
`public.actor`, and Sprint S6 added `organization_member.celebration_date`,
which for a person is a complete date of birth.

That column therefore sits in `public` by decision, not by oversight. What
holds the line:

- RLS scopes every member row to its own tenant, through
  `private.can_access_organization` for reads and
  `private.can_manage_organization` for writes. `anon` has no access.
- The celebration date never reaches a public or international reporting
  endpoint. Those continue to use aggregate impact data, exactly as this ADR
  requires.
- The date is stored complete or not at all. Partial dates were considered and
  dropped, so there is no half-recorded identity to reason about.

Two changes reopen this decision rather than inherit it:

- A member gaining a link to `public.actor` or to a beneficiary record. Both
  are listed as out of scope in the S5 plan precisely because they would merge
  two subjects this ADR keeps apart.
- Any member field reaching a public reporting surface.

Full reasoning: `docs/plans/SPRINT-S6-v1_member-dates-and-tenure.md`.
