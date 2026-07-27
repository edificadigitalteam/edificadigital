# ADR-006: Multi-Tenant Operator/Organization Infrastructure Decisions

**Status:** Implemented and deployed
**Date:** 2026-07-27

## Context

Building organization creation with automatic tenant-admin provisioning
(`docs/plans/SPRINT-S2-v1_organization-tenant-admin-provisioning.md`) required
a series of infrastructure decisions that reach beyond that one feature and
will keep affecting the project as multi-tenant operations grow: how
transactional email is sent, how server-side code calls other server-side
services without exposing secrets, and how an organization's language
preference is modeled. This ADR is a living record of those standing
decisions — the same way ADR-005 established SEO/AI-discoverability as an
ongoing requirement, not a one-time fix. New infrastructure decisions of this
kind should be appended here (or given their own ADR if large enough) rather
than left undocumented in a migration file or PR description.

## Decision

1. **Resend is the transactional email provider**, not the existing Zoho SMTP
   relay used for Supabase Auth's own magic-link email. Reasons: it needs to
   be triggered by application logic (a custom activation token), not by
   Supabase Auth's built-in flows, and mixing high-volume transactional
   traffic into the same sending identity as normal business email
   (`contacto@somosedificadigital.com`) risks deliverability for both.
2. **A dedicated sending subdomain, `mail.somosedificadigital.com`**, is used
   for all Resend-sent mail (SPF/DKIM verified there, not on the root
   domain). This isolates transactional-email reputation from the root
   domain's Zoho MX records — no mailbox exists or is needed at
   `mail.somosedificadigital.com`, since the current sender
   (`no-responder@mail.somosedificadigital.com`) is one-way only.
3. **Secrets for service-to-service calls live in Supabase Vault, set up
   directly in the Dashboard by the product owner — never in a migration,
   an Edge Function's source, or committed anywhere in this repository.**
   Established secrets: `project_url`, `service_role_key` (used by SQL
   functions to call Edge Functions via `pg_net`), and `RESEND_API_KEY` (an
   Edge Function secret, used only inside the Edge Function, never read by
   SQL). Any future external API key follows this same pattern.
4. **`pg_net` triggers Edge Functions from SQL, not the frontend.** When a
   database function needs to call out to an Edge Function (e.g. to send an
   email containing a value that must never reach a browser, like an
   activation token), it does so directly via `pg_net.http_post`, reading
   `project_url`/`service_role_key` from Vault. The frontend never sees or
   relays the sensitive payload.
5. **`pg_net` must live in the `extensions` schema, not `public`** (it does
   not support `ALTER EXTENSION ... SET SCHEMA`, so this requires a
   drop-and-recreate if it was ever installed elsewhere first). This clears
   the Supabase security advisor's "extension in public" warning and matches
   where `pgcrypto`/`uuid-ossp` already live.
6. **Server-to-server Edge Function calls stay `verify_jwt: true`** (the
   secure default) and are authenticated with the project's own
   `service_role` key from Vault — not a custom shared secret, and not
   `--no-verify-jwt`.
7. **Any cross-service notification (email now, others later) must be
   best-effort and never block the transaction that triggered it.** If Vault
   secrets are missing or the Edge Function call fails, the calling SQL
   function catches the error and returns normally — organization/operator
   creation must never fail because notification delivery failed.
8. **Each organization has one default language (`public.organization.language`,
   `'es' | 'en'`, defaulting to `'en'`), set by a super_admin from a
   dropdown when creating or editing the organization.** System-generated
   email to that organization's operators is sent in that single language —
   not bilingual ES/EN in the same message, which was the initial (Phase 2b)
   approach for the activation email and is superseded by this decision.
   Operators without an organization yet (rare — e.g. a super_admin's own
   account) default to `'en'`, matching the column default.

## Consequences

- Any future outbound email (receipts, digests, notifications) should reuse
  the same Resend account/subdomain and the Vault-based secret pattern
  established here, rather than introducing a new provider or exposing
  another secret in source, unless a specific new decision documented here
  says otherwise.
- Any future case where SQL needs to call an external HTTP service follows
  the `pg_net` + Vault + best-effort-exception-handling pattern from item 4/7
  — this is now the standard shape for that kind of integration in this
  codebase.
- Organization-facing copy generation (email templates, and eventually any
  other organization-facing generated text) should read
  `organization.language` rather than assuming Spanish or rendering both
  languages at once.
- Adding a new external secret (a new provider's API key, a new webhook
  signing secret, etc.) means adding it to Vault or as an Edge Function
  secret directly in the Dashboard, documented here by name and purpose —
  never inline in a migration or committed file.

## Deployment record

Implemented across three migrations on `edifydb`
(`20260727030000_operator_invitation_email_delivery.sql`,
`20260727031500_move_pg_net_to_extensions_schema.sql`,
`20260727040000_organization_language_preference.sql`) and the
`send-operator-invitation` Edge Function, per
`docs/plans/SPRINT-S2-v1_organization-tenant-admin-provisioning.md`. Verified
end-to-end against production with a real (later deleted) test organization;
the product owner confirmed the email arrived correctly.
