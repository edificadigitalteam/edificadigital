# System Architecture

## Product surface

Edifica Digital combines a public bilingual landing page with an authenticated operational application for donation traceability.

| Surface | Purpose | Current state |
|---|---|---|
| `/` | Present the proposal, methodology, and international reporting capability | Bilingual landing experience |
| `/donations/in-kind/new` | Register containers and other in-kind shipments | Bilingual mobile-first workflow with local draft |
| Receive, Transform, Impact | Record the complete operational cycle | Database foundation deployed; interface integration proceeds by module |
| Reports and dashboard | Summarize resources, operations, and impact | Reporting model defined; application views proceed by module |

The product name shown on the primary page and production domain is `somosedificadigital`.

## Runtime architecture

```mermaid
flowchart TD
    A["React + Vite on Vercel"] --> B["Supabase client"]
    B --> C["Supabase Auth"]
    B --> D["Postgres: 17 RLS tables"]
    B --> E["Private attachment Storage"]
    D --> F["Bilingual operational reports"]
```

Production publishes from `main` to `edificadigital.vercel.app` and `somosedificadigital.com`. Pull-request review is the release gate.

The connected Supabase project is `edifydb` (`rrqyihsjftlloizsccvi`). Database identifiers use English `snake_case`; the interface and reporting layers provide Spanish and English.

### Domain, DNS, and email

- DNS for `somosedificadigital.com` is managed on Cloudflare (`brett.ns.cloudflare.com`, `selah.ns.cloudflare.com`). The site (Vercel) and mail (Zoho) records stay DNS-only; Cloudflare's orange-cloud proxy is not enabled for either, since Vercel manages its own TLS/edge for the site and MX/TXT records cannot be proxied regardless.
- Mail is hosted on Zoho Mail (`mx.zoho.com`, `mx2.zoho.com`, `mx3.zoho.com`), with SPF, DKIM, and DMARC (`p=none`, monitor mode) published for the domain.
- Supabase Auth sends transactional email (magic links) through Zoho's SMTP relay via custom SMTP (`Authentication > Emails > SMTP Settings`), using `contacto@somosedificadigital.com` as the sender. This replaces Supabase's rate-limited built-in relay (2 emails/hour) with Zoho's higher send limit.

## Operational flow

### Receive

```mermaid
flowchart TD
    A["Actor"] --> B["Donation"]
    B --> C["Monetary detail"]
    B --> D["In-kind detail"]
    B --> E["Evidence"]
    D --> F["Shipment"]
    F --> G["Declared items"]
    G --> H["Inventory lots and movements"]
```

Donations accept monetary, in-kind, and mixed headers. Each detail line records one resource type. Reference valuation for donated goods remains separate from cash received.

For a shipment or container, the application records the donor, origin, route, transport reference, estimated arrival, declared items, dietary and expiry information, physical receipt, accepted or damaged quantities, inventory movements, and supporting evidence.

### Transform

One `kit_transformation` represents one kit type and the quantity prepared. Evidence belongs to the transformation record. Inventory consumption is represented by negative `transformation` movements in the lot ledger.

### Impact

An `impact_event` records its responsible actor, dates, target population, operational status, aggregate demographics, delivered kit quantities, and evidence. Current demographic storage is aggregate to reduce sensitive personal data.

## Budget, donations, and international reporting

The reporting architecture preserves four separate measures:

| Measure | Meaning |
|---|---|
| Cash received | Monetary donation details |
| In-kind reference value | Evidence-backed estimate of donated goods |
| Approved budget | Spending authority defined by the approved budget module |
| Operating expenses | Logistics, customs, handling, warehousing, procurement, and related execution |

International organizations may request bilingual reports built from these measures, shipment evidence, inventory movements, transformations, distribution events, and aggregate impact. Currency, valuation method, valuation source, valuation date, and evidence references must remain available for audit.

The budget module requires a dedicated schema and migration. Operational donation and shipment records remain independent from budget records.

## Interaction principles

- Spanish and English cover every visible label, instruction, validation message, status, and report heading.
- A persistent language switch keeps the user on the same task and preserves entered values.
- Workflows use short steps, visible progress, familiar field names, and one primary action per step.
- Required information is stated in words, and errors identify the action that enables progress.
- Touch targets are at least 44 × 44 px, labels stay visible, keyboard focus is clear, and reduced-motion preferences are honored.
- Product and marketing copy uses direct statements. It avoids antitheses, comparisons, personification of non-human subjects, and decorative patterns associated with generic AI-generated pages. The word “no” is replaced with a direct construction when meaning remains precise.
- The established type, color, spacing, and component language remains the visual source of truth.

## Security and data access

- Supabase Auth supplies authenticated sessions. Magic-link sign-in is the current planned entry method.
- All 17 operational tables use RLS backed by a private active-operator allow-list.
- Anonymous table access is revoked.
- Attachments live in a private bucket with file-size and MIME restrictions.
- The balance view uses security-invoker behavior.
- Granular permissions by organization and role remain a subsequent milestone.
- Service-role keys and database secrets stay outside client code and source control.

## Observability

Uncaught client errors, unhandled promise rejections, React render errors, and failed in-kind donation submissions are reported from the browser to a small Vercel Serverless Function (`frontend/api/log.js`), which logs a sanitized, size-capped JSON line. Those lines appear directly in Vercel's built-in Runtime Logs — no log drain, third-party service, or extra cost is required. Reporting never blocks the UI and never includes donor data, only error messages, stack traces, and the originating URL. See `docs/plans/SPRINT-S1-v1_vercel-observability.md`.

## Current integration boundary

The in-kind interface now provides magic-link access, validates operator authorization, preserves a browser draft, uploads private evidence to deterministic paths, and persists the announcement through the idempotent `submit_in_kind_shipment` RPC. One RPC transaction creates or reuses the sender actor, donor role, donation, details, shipment, declared items, and evidence metadata.

Inventory lots and movements begin after physical receipt. This boundary preserves declared quantities until a team member records warehouse, accepted, damaged, condition, and verification data from inspection.

## Repository map

```text
frontend/                 React + Vite application
supabase/migrations/      Ordered, immutable database changes
supabase/tests/           pgTAP behavior and safeguard specifications
docs/adr/                 Architecture decisions
docs/plans/               TDD plans and delivery status
docs/specs/               Executable behavior descriptions
```

## Release model

1. Create a branch from `main`.
2. Document the plan and flag database changes.
3. Commit failing tests.
4. Implement the smallest passing change and refactor under test coverage.
5. Validate tests, lint, build, schema, RLS, and relevant Supabase advisors.
6. Open a pull request for human review.
7. Merge to `main` to publish both production domains.

See `docs/adr/ADR-001-manual-production-promotion.md` for the production-domain history and `docs/adr/ADR-003-in-kind-shipment-inventory.md` for the shipment model.

---

**Version:** 2.0
**Last updated:** 2026-07-19
