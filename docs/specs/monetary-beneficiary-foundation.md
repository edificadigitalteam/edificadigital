# Test Specification: Monetary Intake and Protected Beneficiary Foundation

**Status:** Interface and database foundation implemented; human review pending
**Related plan:** `../plans/SPRINT-S1-v1_monetary-beneficiary-foundation.md`

## Monetary frontend behavior

### Donor and receipt

- Donor name, receipt date/time, receipt method, positive origin amount, and three-letter origin currency are required.
- Cash, bank transfer, mobile payment, digital wallet, cryptoasset, and other receipt methods are available in Spanish and English.
- A non-cash receipt requires a transaction reference.
- Bank transfer and mobile payment require sending and receiving institution labels.

### Multi-currency reporting

- The record preserves origin amount and origin currency.
- A positive USD base amount and USD-per-origin-unit rate are required.
- USD receipts use a rate of 1 and equal origin/base amounts.
- Foreign-currency receipts require rate source and rate date.
- The calculated USD preview equals origin amount multiplied by the applied rate within the accepted rounding tolerance.

### Evidence and submission

- At least one payment proof or receipt record is required.
- JPEG, PNG, WebP, and PDF files up to 20 MB use the private attachment bucket.
- Deterministic paths include the authenticated user and submission key.
- Retry keeps the same submission key and creates one donation.
- A successful submission returns a readable monetary reference and clears the local draft.
- Recoverable upload or RPC errors preserve the draft and selected evidence.

### Interaction

- The intake is one continuous page with four short visual groups and one primary submit action.
- Spanish and English cover every visible field, instruction, validation message, evidence type, and success state.
- Language changes preserve the current route and entered values.
- Labels remain visible, focus states are explicit, touch targets meet the repository minimum, and reduced motion is supported.

## Beneficiary database behavior

- Nominal identity exists only in `private.beneficiary`.
- Participation exists only in `private.beneficiary_event` and may link to an existing `impact_event`.
- Privacy acknowledgement and residence area are required.
- Date of birth derives the supported age band; a supplied age band can be used when birth date is unavailable.
- WhatsApp availability requires a phone number.
- Registration returns a non-identifying `BEN-…` code.
- Creator-scoped submission keys make registration idempotent.
- Active authenticated operators may register and manage records under RLS.
- Anonymous and unauthorized sessions cannot read, write, or execute the registration RPC.
- Public reports continue to use aggregate impact data.

## Recorded verification

- The red commits captured missing frontend modules, missing SQL objects, missing evidence enforcement, and uncovered audit foreign keys.
- The current frontend suite passes 34 tests; lint and production build pass.
- pgTAP defines 29 monetary and beneficiary schema assertions.
- Rollback-safe live scenarios pass for USD cash, VES transfer, evidence metadata, idempotent retry, privacy acknowledgement, beneficiary code generation, and authorization rejection.
- Supabase performance review reports only expected unused-index information after covering the new foreign keys.
