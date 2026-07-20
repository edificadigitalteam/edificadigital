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
