# AI Coding Agent Working Guide

This guide applies to Claude, Codex, and any AI coding agent working in the Edifica Digital repository. Read `agents.md` first; its rules are binding.

## Mission

Help the team deliver a bilingual, auditable donation-traceability platform with clear workflows for people with varied cognitive and digital literacy. Work through plans, executable tests, focused implementation, verification, and accurate documentation.

The primary identity is `somosedificadigital`. Preserve the existing design system and the product decisions recorded in the repository.

## Operating contract

An AI agent may:

- inspect the repository and connected systems within the user’s stated scope;
- design schemas and application flows;
- write and refactor production code;
- create and apply tested Supabase migrations after explicit user authorization;
- run tests, lint, builds, database validation, and advisors;
- update documentation and ADRs;
- prepare commits and pull requests on a feature branch.

An AI agent must:

- keep product ownership with the designated human product owners;
- ask for direction when a missing choice materially changes business behavior or external scope;
- preserve unrelated work in a dirty worktree;
- keep secrets out of logs, source control, client code, and documentation;
- avoid direct commits to `main`;
- leave every external change traceable through migrations, commits, and documentation;
- require human review before merge.

## Required implementation order

```text
plan → database notice → failing tests → implementation → refactor → verification → documentation → pull request
```

### Plan

Record the outcome, assumptions, affected files, database impact, risks, and verification. A concise plan in `docs/plans/` is required for a feature or schema change.

### Red

Add executable tests before implementation. Tests describe observable behavior, edge cases, bilingual parity, accessibility-critical states, and database constraints.

For SQL changes, add pgTAP assertions for tables, columns, constraints, RLS, policies, grants, indexes, functions, views, Storage configuration, and relevant rejection cases.

### Green and refactor

Implement the smallest complete behavior, then improve structure while tests stay green. Keep data access separate from presentation and keep translation dictionaries centralized.

### Verify

Run the narrowest relevant checks first, followed by the broader suite:

```bash
pnpm test
pnpm lint
pnpm build
```

Also verify responsive layouts, keyboard flow, focus states, language switching, draft preservation, and reduced motion for interface work.

For database work, verify the live schema only after confirming the exact Supabase project. Use rollback-safe transactions for functional scenarios and run Supabase security and performance advisors after migrations.

## Current Supabase baseline

The Edifica Digital database is `edifydb`, project reference `rrqyihsjftlloizsccvi`.

It contains:

- 12 foundation tables for actors, donations, transformations, impact, catalogs, and evidence;
- 5 shipment and inventory tables;
- one public multi-currency monetary extension table;
- two private beneficiary identity and participation tables;
- the security-invoker `inventory_lot_balance` view;
- RLS on all 18 public operational tables and both private beneficiary tables;
- a private `attachments` Storage bucket;
- bilingual unit and media catalogs.

Applied migrations establish the foundation, in-kind shipment model, foreign-key indexes, operator authorization, idempotent in-kind and monetary submission, protected beneficiary registration, and private evidence uploads.

### Safe database procedure

1. Confirm project name and reference.
2. Inspect tables and migration history.
3. Document the database change in the plan and pull request.
4. Add failing pgTAP tests.
5. Add a new immutable migration file.
6. Apply the migration through Supabase migration history.
7. Verify schema shape, constraints, policies, grants, and indexes.
8. Execute a representative transaction and roll it back.
9. Run security and performance advisors.
10. Update `docs/DATABASE.md`, architecture, plan status, and any affected ADR.

Use application-facing publishable credentials only in the client. Service-role and database credentials stay in protected server environments.

## Current domain rules

### Donation intake

- Actor name is required. Email, phone, and country are optional.
- Roles are `donor`, `supplier`, `manager`, and `beneficiary`.
- Donation types are `monetary`, `in_kind`, and `mixed`.
- A monetary detail requires a positive origin amount and uppercase ISO currency.
- Operational monetary receipts preserve the USD base amount, applied USD-per-origin-unit rate, rate source/date for foreign currency, receipt method, transaction details, and private evidence.
- USD uses a rate of 1 with equal origin and base amounts.
- Cash, bank transfer, mobile payment, digital wallet, cryptoasset, and other documented methods are supported.
- An in-kind detail requires a description, positive quantity, and unit.
- A reference valuation is optional and remains separate from cash received.

### Containers and inventory

- A shipment belongs to one `in_kind` donation.
- Goods are declared as separate shipment items.
- Food supports expiry, allergens, and dietary attributes such as `gluten_free`.
- Arrival creates inventory lots that preserve received, accepted, and damaged quantities.
- Inventory changes are append-only movements.
- Transport, customs, handling, and warehousing are expenses.

### Budgets and international reports

- Approved budget, cash received, in-kind reference value, and expenses are separate measures.
- The current production schema covers donations, shipments, transformations, and impact.
- The budget module still requires a dedicated tested migration before approved budget rows are loaded.
- International reports preserve currencies, valuation basis, sources, dates, evidence, inventory flow, and aggregate impact.
- Every report label and explanatory passage is available in Spanish and English.

### Protected beneficiary data

- Minimum nominal identity belongs in `private.beneficiary`; participation belongs in `private.beneficiary_event`.
- Records require privacy acknowledgement and return a non-identifying `BEN-…` code.
- Names, dates of birth, phone numbers, email addresses, and nominal participation stay outside public reporting endpoints.
- Public and international reports use aggregate impact data.
- Archive operational beneficiary history instead of deleting it.

## Interface guidance

- Preserve the established typography, color, spacing, and component system.
- Use a persistent Spanish/English switch and retain the current route, step, and entered values.
- Present one primary action per step.
- Keep labels visible and identify required fields in words.
- Use short instructions and concrete field names.
- Make touch targets at least 44 × 44 px.
- Provide keyboard access, clear focus, sufficient contrast, and reduced-motion support.
- Show a final review before an irreversible submission.
- Preserve drafts and provide explicit retry states around network operations.
- Use direct copy. Avoid antitheses, comparisons, personification of non-human subjects, and generic AI-page decoration.
- Replace the word “no” with a direct construction when the result stays precise.

## Current integration boundary

The in-kind workflow now initializes the Supabase client, establishes an allow-listed magic-link session, uploads private evidence, and calls `submit_in_kind_shipment` for atomic and idempotent persistence. It clears the local draft only after Supabase returns the persisted reference.

The monetary workflow uses one continuous bilingual form. It retains its draft, requires payment or receipt evidence, uploads to deterministic private paths, and calls `submit_monetary_donation`. The beneficiary foundation is deployed through `register_beneficiary`; its dedicated interface follows after a focused accessibility and privacy review.

The next operational workflow begins at physical receipt. It must collect warehouse, received, accepted, damaged, condition, verification, expiry, and responsible-actor information before creating inventory lots and movements. Preserve the announcement record and declared quantities as the comparison baseline.

## Git and release

- Branch from an up-to-date `main`.
- Keep plan, tests, implementation, and corrective migrations reviewable.
- Use commit subjects in the form `[TYPE] Brief description`.
- Open a pull request with verification results, explicit database changes, and screenshots for interface work.
- Merging `main` publishes both `edificadigital.vercel.app` and `somosedificadigital.com`.

## Canonical references

- `agents.md` — binding repository workflow and product decisions
- `docs/ARCHITECTURE.md` — runtime and domain boundaries
- `docs/DATABASE.md` — deployed schema and security baseline
- `docs/adr/ADR-003-in-kind-shipment-inventory.md` — shipment model decision
- `docs/adr/ADR-004-protected-beneficiary-identity.md` — protected beneficiary data boundary
- `docs/plans/` — implementation order and delivery status
- `docs/specs/` — executable behavior descriptions

When code and documentation differ, verify deployed behavior and update both in the same scoped change.

---

**Version:** 2.1
**Last updated:** 2026-07-19
