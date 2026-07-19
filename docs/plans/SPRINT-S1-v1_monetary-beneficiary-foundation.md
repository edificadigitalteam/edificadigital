# Sprint S1 Plan: Monetary Donations and Protected Beneficiary Foundation

**Code:** S1-MONEY-PEOPLE
**Status:** Implemented — Review Required
**Owner:** Product owners
**Created:** 2026-07-19
**Last Updated:** 2026-07-19

## Outcome

Add a bilingual, continuous monetary-donation intake at `/donations/monetary/new` and the first protected nominal beneficiary data foundation. Monetary records preserve the amount and currency received, the USD reporting base, the applied exchange rate, evidence, payment method, reconciliation state, and authenticated creator. Beneficiary identity stays in the private schema while institutional reports continue to use aggregate impact data.

## Decisions carried forward

- A donation remains a master record with one or more typed detail lines.
- Cash, bank transfer, mobile payment, digital wallet, and cryptocurrency are monetary receipt methods.
- USD, EUR, and VES are initial interface choices; the database accepts valid three-letter ISO currency codes.
- Multi-currency reporting keeps four explicit measures: origin amount, origin currency, USD base amount, and exchange rate applied.
- Monetary receipts, in-kind reference values, approved budgets, and operating expenses remain separate reporting domains.
- Payment evidence uses the existing private `attachments` bucket.
- The monetary form is one continuous page with short visual groups and a final review statement.
- Beneficiary records collect the minimum operational identity fields requested: name, date of birth or age band, residence area, phone, and WhatsApp availability.
- Nominal beneficiary data stays outside the public schema. Public and international reports use aggregate impact totals.
- Database names remain English `snake_case`; interface copy remains Spanish and English.

## Database changes — explicit notice

This milestone changes the deployed `edifydb` database.

### Monetary traceability

- Create `public.monetary_donation_detail` as a one-to-one extension of a monetary `donation_detail`.
- Store `payment_method`, `usd_base_amount`, `exchange_rate_to_usd`, `exchange_rate_source`, `exchange_rate_date`, transaction and institution references, and reconciliation audit fields.
- Keep `donation_detail.amount` and `donation_detail.currency` as the origin amount and currency.
- Add constraints for positive amounts, valid exchange rates, USD identity conversion, required non-USD rate evidence, payment references, and reconciliation timestamps.
- Add covering indexes, RLS, explicit Data API grants, and the existing private operator authorization predicate.
- Replace the current donation timestamp constraint because `received_at` is the business receipt time and may precede the system `recorded_at` timestamp.
- Add `public.submit_monetary_donation(payload jsonb)` as an authenticated, security-invoker, idempotent RPC.
- Reuse `donation.submission_key`, `donation.created_by`, actor/donor records, donation attachments, and private Storage.

### Protected beneficiary data

- Create `private.beneficiary` with a non-identifying public code, nominal identity, date of birth or age band, residence area, contact fields, privacy acknowledgement, archive state, and creator/updater audit values.
- Create `private.beneficiary_event` to link one protected beneficiary to an existing `impact_event`, record attendance, represented household size, and authenticated audit values.
- Use client-generated submission keys and per-creator unique indexes for retry safety.
- Enable RLS on both private tables and grant authenticated access only through the active operator predicate.
- Revoke access from `public` and `anon`.
- Add `public.register_beneficiary(payload jsonb)` as a security-invoker RPC that validates privacy acknowledgement and writes into the private schema under RLS.
- Keep nominal beneficiary rows unavailable to public reporting endpoints.

### Storage

- Reuse the private `attachments` bucket with deterministic paths under `donations/<user>/<submission>/`.
- Accept the existing JPEG, PNG, WebP, and PDF limits.
- Store proof-of-payment and receipt metadata in `donation_attachment` only after successful upload.

## Frontend changes

- Add a bilingual continuous form at `/donations/monetary/new`.
- Reuse the Magic Link operator gate and preserve the requested route through authentication.
- Capture donor name, available contact, anonymity, receipt time, payment method, origin amount and currency, USD base amount, exchange rate, source/date, institutions, transaction reference, notes, and evidence.
- Show conditional bank, wallet, and exchange-rate fields only when they are relevant.
- Calculate the USD base preview from origin amount and rate while retaining operator control of the confirmed reporting value.
- Preserve the complete draft and evidence selection after recoverable errors.
- Clear the draft after Supabase returns the persisted reference.
- Use one primary submit action and a concise final verification statement.

The beneficiary interface follows after the protected schema and RPC pass their database tests. This milestone establishes the safe data boundary first.

## TDD sequence

1. Commit this plan and database notice.
2. Add failing frontend tests for monetary validation, currency conversion, reference generation, evidence paths, payload mapping, and retry behavior.
3. Add failing pgTAP specifications for monetary extension, private beneficiary tables, RLS, grants, RPC security, idempotency, and timestamp semantics.
4. Implement the migration and monetary interface.
5. Apply the migration to `edifydb` after rollback-safe validation.
6. Exercise USD cash, VES transfer, unauthorized access, duplicate retry, and protected beneficiary registration inside rollback-safe transactions.
7. Run Supabase security and performance advisors.
8. Run frontend tests, lint, production build, responsive checks, and Vercel preview.
9. Update architecture, database, agent, Claude, plan, specification, and pull-request documentation.

## Publication gates

- USD cash records use a rate of 1 and the same origin/base amount.
- A VES or EUR receipt preserves origin and USD reporting amounts with rate source and date.
- Non-cash methods require a traceable transaction reference.
- Repeated submission keys create one monetary donation.
- Unauthorized sessions cannot read, write, or call either new RPC.
- Beneficiary identity is absent from the public schema and anonymous roles have zero access.
- An authorized registration requires privacy acknowledgement and returns a non-identifying beneficiary code.
- Frontend tests, lint, build, database assertions, advisors, and Vercel preview pass.
- Human review is required before merge to `main`.

## Verification record

- Frontend: 34 Vitest tests pass.
- Static quality: ESLint and the Vite production build pass.
- Database: both immutable migrations are applied to `edifydb` through Supabase migration history.
- Functional database scenarios: USD cash, VES bank transfer, evidence metadata, retry idempotency, protected beneficiary registration, privacy acknowledgement, and unauthorized rejection pass inside rollback-safe transactions.
- Security: 18 public operational policies and 2 private beneficiary policies enforce the active-operator predicate; anonymous access and function execution are revoked.
- Performance: the three new audit foreign keys have covering indexes; the advisor reports only expected unused-index information on new or empty data structures.
- Auth: the advisor reports leaked-password protection as disabled. The current application entrypoint is passwordless Magic Link.
- Persistence: all verification records were rolled back. Existing operational records were preserved.

## Implemented boundary

The monetary form and its Supabase persistence are complete for review. The beneficiary schema, RLS policies, retry-safe RPC, and optional impact-event link are deployed. The dedicated beneficiary interface remains the next application milestone so its collection experience can receive separate accessibility and privacy review.

## Rollback

- Revert the application commit to remove the monetary route.
- Applied migrations remain immutable; database corrections use a later migration.
- Archive beneficiary records instead of deleting operational history.
