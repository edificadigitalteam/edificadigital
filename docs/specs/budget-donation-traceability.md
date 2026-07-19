# Test Specification: Budget and Donation Traceability

**Status:** Draft — tests must be implemented before schema migrations  
**Related plan:** `SPRINT-S1-v1_budget-donation-traceability.md`

## Propósito (ES)

Esta especificación define las pruebas que deben fallar antes de implementar el esquema de presupuesto, financiamiento, donaciones, compras, kits e impacto.

## Purpose (EN)

This specification defines the tests that must fail before implementing the budget, funding, donation, procurement, kit, and impact schema.

## Database changes covered

New tables and alterations listed in the related plan. This file specifies behavior only; it contains no production migration.

## 1. Project and budget version tests

- A project code is unique.
- A budget belongs to exactly one project.
- Budget version is unique within a project.
- Currency uses a three-letter ISO code.
- Approved amount is positive.
- An approved budget requires `approved_at` and approval evidence.
- Approved budget header amounts are immutable; amendments create a new version.

## 2. Budget line tests

- `line_code` is stored as text and preserves values such as `2.3.1`.
- A line code is unique within a budget version.
- Unit price, quantity, and total are non-negative.
- `UNIT_X_QTY` requires unit price and quantity.
- `UNIT_X_QTY` total equals unit price multiplied by quantity.
- `PERCENT_OF_BASE` requires percentage rate and base amount.
- `PERCENT_OF_BASE` total equals rate multiplied by base amount.
- A blocked or review line cannot be marked load-ready.
- Spanish and English names are required for externally reported lines.

## 3. Funding reconciliation tests

- A funding source belongs to an actor or organization record.
- Funding commitments are positive.
- A budget becomes `funding_confirmed` only when committed sources equal the approved amount.
- FORM 205 remains pending while organization contribution and BWAid request are empty.
- Over-allocation is rejected.
- Under-allocation remains visible as a reconciliation delta.

## 4. Donation tests

- A donation records funds or goods actually received.
- Creating a budget never creates a donation.
- Monetary donation details require amount and currency.
- In-kind donation details require item, quantity, and unit.
- A donation allocation cannot exceed the unallocated amount of its donation detail.
- A donation allocation references a project and optionally a budget version.
- Payment proof is required before a monetary donation reaches verified status.

## 5. Procurement and expense tests

- An expense belongs to one project and one budget line.
- Expense amount and currency are required.
- Paid status requires payment evidence.
- Medical procurement requires lot and expiration metadata when applicable.
- Asset purchases require an asset record reference.
- Budget-versus-actual totals derive from expense records.
- Actual spending never changes the approved budget amount.

## 6. Kit definition and transformation tests

- Kit definitions are versioned.
- Each kit definition has Spanish and English names.
- Component codes are text.
- Component cost supports at least three decimal places.
- Approved kit price supports two decimal places.
- The food basket may store component cost USD 75.265 and approved price USD 75.27.
- Coverage days are required before a kit definition becomes active.
- A transformation references one active kit definition version.
- Quantity generated is positive.
- Transformation evidence is required before closing the record.

## 7. Impact tests

- An impact event belongs to one project.
- Start date is on or before end date.
- Delivered quantity is positive.
- Delivered quantity cannot exceed available transformed quantity.
- Aggregate demographics remain non-negative.
- Closed events require delivery evidence.

## 8. Reporting tests

- A report snapshot belongs to a project and reporting period.
- Report language is `es` or `en`.
- Spanish and English report snapshots may reference the same data cutoff.
- Published snapshots are immutable.
- Report totals reconcile to verified donations, paid expenses, transformations, and impact events as of the cutoff.

## 9. RLS tests

- Authenticated users may read records within the approved MVP policy.
- Anonymous users cannot read private attachments.
- Authenticated users may create draft records.
- Verified, approved, paid, closed, and published status transitions require authorized roles in the later role-permission sprint.

## Acceptance criteria

- All tests exist and fail before migration code.
- Every proposed constraint has at least one positive and one negative test.
- Reconciliation tests cover exact, underfunded, and overfunded cases.
- FORM 205 fixture reproduces USD 244,997.90 and the USD 16,027.90 administration line.
- Test fixtures preserve bilingual names and text line codes.
