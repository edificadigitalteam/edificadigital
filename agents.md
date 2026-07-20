# Agents and Team

This file contains binding working rules for human contributors and AI coding agents in Edifica Digital.

## Team

| Role | Responsibility | Mode |
|---|---|---|
| Product owners | Product ownership, strategy, scope, and approvals | Human |
| Human developers | Implementation review, security review, and release approval | Human |
| AI coding agents | Planning, tests, implementation, database migrations, documentation, and verification within explicit task scope | AI |

Product owners decide business direction. AI agents may make reversible implementation choices that follow repository decisions and may update external infrastructure only when the user explicitly authorizes that action and identifies the target.

Human review remains required before merge to `main`.

## Mandatory delivery workflow

Every implementation follows this order:

1. **Plan.** State the requested outcome, affected files, risks, and verification method.
2. **Flag database changes.** Identify every table, column, constraint, index, trigger, function, view, RLS policy, Storage rule, seed, or migration before implementation.
3. **Red.** Add or update executable tests that fail for the missing behavior.
4. **Green.** Implement the smallest complete change that passes the tests.
5. **Refactor.** Improve structure while tests remain green.
6. **Verify.** Run relevant tests, lint, build, accessibility checks, schema checks, and security or performance advisors.
7. **Document.** Update architecture, database reference, plans, specs, and ADRs when the implemented truth changes.
8. **Review.** Publish a pull request and obtain human approval.

For urgent work, compress feedback loops while preserving the order above.

## Current product decisions

### Identity and language

- The primary public identity is `somosedificadigital`.
- The landing page and operational application are bilingual in Spanish and English.
- The language switch remains visible, preserves the current task and form values, and changes all visible interface content.
- Database artifacts use English `snake_case` and stable lower-case values.
- Reports intended for international organizations are available in Spanish and English.

### Interaction and writing

- Preserve the existing typography, palette, spacing, and component language unless the product owners approve a new direction.
- Use a restrained, professional, human visual composition. Decorative elements must support content or navigation.
- Design mobile-first with one primary action per step, persistent labels, short instructions, safe defaults, visible progress, and generous touch targets.
- Validation messages state the exact action needed to continue.
- Support keyboard navigation, visible focus, screen readers, sufficient contrast, and reduced motion.
- Product and marketing copy uses direct statements and avoids antitheses, comparisons, and personification of non-human subjects.
- Replace the word “no” with a direct construction when clarity and accuracy remain intact.
- Avoid generic AI-page motifs, excessive gradients, ornamental grids, floating cards without purpose, and filler metrics.
- Use respectful plain language suited to people with varied cognitive and digital literacy.

### Donations, shipments, and budgets

- Donations may be `monetary`, `in_kind`, or `mixed`.
- Monetary receipts include cash, bank transfer, mobile payment, digital wallet, cryptoasset, and other documented methods.
- Preserve origin amount, origin currency, USD base amount, applied rate, rate source/date, and private receipt evidence for multi-currency reporting.
- Monetary value received and in-kind reference value remain separate measures.
- A container is represented by one `in_kind` donation, one shipment, many declared items, received inventory lots, and append-only movements.
- Sender email is optional. A person or organization can be registered with a name and available contact data.
- Dietary information, including `gluten_free`, belongs to item and lot metadata.
- Declared, received, accepted, damaged, and available quantities remain distinct.
- Transport, customs, handling, warehousing, and similar costs are expenses rather than donations.
- Approved budgets, received donations, in-kind reference values, and expenses remain separate reporting domains.
- International reports preserve currencies, valuation methods, sources, dates, and evidence references.
- Nominal beneficiary identity belongs in the private schema. Public and international reports use aggregate impact data and non-identifying codes.
- Beneficiary intake requires privacy acknowledgement and collects only the operational identity and contact fields defined in the protected schema.

## Supabase rules

The authorized Edifica Digital project is `edifydb`, reference `rrqyihsjftlloizsccvi`. Other visible Supabase projects are outside scope unless the user explicitly identifies them.

Current deployed baseline:

- 18 public operational tables, 2 private beneficiary tables, and one security-invoker view;
- RLS enabled on every public operational and private beneficiary table, with forced RLS on beneficiary data;
- operator allow-list authorization on every operational table and private attachment object;
- anonymous table privileges revoked;
- private `attachments` bucket with a 20 MB limit and approved image/PDF MIME types;
- six bilingual units and eight bilingual evidence types;
- foundation, in-kind shipment, foreign-key/RLS optimization, policy hardening, authenticated submission, monetary/beneficiary foundation, and new foreign-key optimization migrations applied.

Database work must follow these rules:

1. Inspect the selected project and current schema before DDL.
2. Put every DDL change in a timestamped repository migration.
3. Add pgTAP coverage before the migration.
4. Apply DDL through Supabase migration history, never as an untracked ad hoc statement.
5. Keep applied migration files immutable; corrective work gets a later migration.
6. Use generated IDs and conflict-safe catalog inserts.
7. Exercise writes inside a transaction and roll them back when validating production structure.
8. Run security and performance advisors after schema or policy changes.
9. Keep service-role keys, database passwords, and secrets outside source control and client bundles.
10. Document the resulting schema and application integration boundary.

The detailed reference is `docs/DATABASE.md`. The in-kind frontend uses allow-listed Magic Link access, deterministic private uploads, and the idempotent `submit_in_kind_shipment` RPC. The continuous monetary frontend uses the same access and evidence boundary with `submit_monetary_donation`. The protected `register_beneficiary` RPC and private tables are deployed; their dedicated interface follows as a separately reviewed module. Inventory receipt remains a distinct later workflow because accepted, damaged, warehouse, and verification quantities require physical inspection.

## Git and release rules

### Branches

- `main` contains production-ready code.
- Create every work branch from an up-to-date `main`.
- Use `feature/`, `bugfix/`, `docs/`, or another descriptive prefix.
- Never commit directly to `main`.
- Never mix unrelated user changes into an agent commit.
- Delete the branch as the final step once its pull request merges.

### Commits

Use `[TYPE] Brief description`.

Accepted types include `[PLAN]`, `[TEST]`, `[FEAT]`, `[FIX]`, `[SECURITY]`, `[PERF]`, `[REFACTOR]`, `[DOCS]`, and `[CHORE]`.

Keep plan, red tests, implementation, and later corrections in reviewable commits when the workflow permits.

### Pull requests

Every pull request includes:

- linked plan or issue;
- test evidence and the observed red-to-green sequence;
- explicit database-change notice;
- security and accessibility implications;
- verification commands and results;
- screenshots for visible interface changes;
- documentation updates;
- rollback or recovery considerations for external changes.

### Deployment

Merges to `main` publish automatically to `edificadigital.vercel.app` and `somosedificadigital.com`. Pull-request review is the production release gate. See `docs/adr/ADR-001-manual-production-promotion.md` before changing this model.

## Review checklist

### Behavior

- [ ] Requirements and edge cases have executable tests.
- [ ] Spanish and English remain complete and equivalent.
- [ ] Drafts and entered values survive language changes and backward navigation.
- [ ] Errors tell the user what action enables progress.

### Data and security

- [ ] Database changes were planned, tested, migrated, and documented.
- [ ] RLS, grants, Storage rules, and secrets were reviewed.
- [ ] Monetary, in-kind, budget, and expense figures retain their distinct meaning.
- [ ] Verification data was rolled back or intentionally labeled.

### Quality and release

- [ ] Relevant tests, lint, and production build pass.
- [ ] Accessibility and responsive states were checked.
- [ ] Existing design language is preserved.
- [ ] The PR is focused and ready for human review.

---

**Version:** 2.1
**Last updated:** 2026-07-19
**Maintained by:** Product owners and project contributors
