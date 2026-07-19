# Database Reference

## Current state

The Edifica Digital operational database is deployed in Supabase project `edifydb` (`rrqyihsjftlloizsccvi`). The schema currently contains 17 operational tables, one security-invoker balance view, protected catalog data, and a private attachment bucket.

All database identifiers and stored enum-like values use English `snake_case`. Spanish and English belong in interface content, catalog display names, exports, and reports.

## Applied migrations

| Order | Repository migration | Supabase migration | Purpose |
|---|---|---|---|
| 1 | `202607190000_foundation_schema.sql` | `foundation_schema` | Actors, donations, transformations, impact, catalogs, evidence, RLS, and Storage |
| 2 | `202607190001_in_kind_shipment.sql` | `in_kind_shipment_inventory` | Containers, declared goods, received lots, movements, and shipment evidence |
| 3 | `202607190002_optimize_rls_and_foreign_keys.sql` | `optimize_rls_and_foreign_keys` | Foreign-key indexes and scalar RLS predicates |
| 4 | `202607190003_harden_rls_predicates.sql` | `harden_rls_predicates` | Explicit authenticated-user predicates for every operational table |
| 5 | `20260719031418_authenticated_submission.sql` | `authenticated_submission` | Operator allow-list, audit fields, idempotent RPC, evidence access, and current RLS predicates |

DDL changes must be added as new migration files and applied through Supabase migration history. Existing applied migrations remain immutable.

## Operational model

### Catalogs and actors

| Table | Purpose | Important decisions |
|---|---|---|
| `actor` | People and organizations that participate in operations | `name` required; `email`, `phone`, and `country` optional; organization and anonymity flags supported |
| `actor_role` | Many-to-many actor roles | Values: `donor`, `supplier`, `manager`, `beneficiary` |
| `media_type` | Bilingual evidence catalog | Stable `code`, `name_es`, `name_en` |
| `unit_of_measure` | Bilingual unit catalog | Stable `code`, bilingual names, abbreviation |

Actor email uniqueness is case-insensitive and applies only when an email exists. This permits organizations and senders whose first record arrives with limited contact data.

### Receive: monetary and in-kind donations

| Table | Purpose |
|---|---|
| `donation` | Donation header linked to one donor actor |
| `donation_detail` | Monetary or in-kind lines |
| `donation_attachment` | Payment, receipt, and supporting evidence |

`donation.donation_type` accepts `monetary`, `in_kind`, or `mixed`. Its lifecycle accepts `draft`, `announced`, `received`, `verified`, and `closed`.

Each detail line has exactly one form:

- `monetary`: positive `amount` plus a three-letter uppercase `currency`.
- `in_kind`: description, positive `quantity`, and `unit_of_measure_id`.

An in-kind line can also carry item metadata, dietary attributes, allergens, expiry data, and an optional reference valuation. `reference_value` records an informative valuation and remains separate from cash received.

### Shipments, containers, and inventory

| Table or view | Purpose |
|---|---|
| `shipment` | Logistics record for one in-kind donation |
| `shipment_item` | One declared product line in a shipment |
| `inventory_lot` | Physical receipt, inspection, accepted quantity, damage, expiry, and warehouse |
| `inventory_movement` | Append-only stock movement ledger |
| `shipment_attachment` | Packing, carrier, customs, inspection, receipt, and photographic evidence |
| `inventory_lot_balance` | Security-invoker balance derived from movements |

A container follows this sequence:

1. Register an actor with the `donor` role.
2. Create an `in_kind` donation.
3. Add the shipment route, container or tracking reference, departure, and estimated arrival.
4. Add declared goods as separate `shipment_item` rows.
5. On arrival, create one or more `inventory_lot` rows from each declared item.
6. Add a positive `receipt` movement for accepted inventory.
7. Record later reservations, transformations, distributions, transfers, and damage as movements.

The database rejects shipments linked to monetary or mixed donations. Declared, received, accepted, damaged, and available quantities remain distinct.

Food items support `expiry_date`, `dietary_attributes`, and `allergens`. A value such as `gluten_free` belongs in `dietary_attributes`.

### Transform and impact

| Table | Purpose |
|---|---|
| `kit_transformation` | One prepared kit type and quantity per transformation record |
| `kit_transformation_attachment` | Transformation evidence |
| `impact_event` | Distribution event, dates, manager, target population, and aggregate demographics |
| `impact_detail` | Quantity from a transformation delivered at an impact event |
| `impact_event_attachment` | Delivery and participation evidence |

Impact data stays aggregate. Personally identifiable beneficiary lists are outside the current schema.

## Budget and reporting boundary

The approved budget and donations are related reporting domains with different accounting meaning:

- Donations record resources received.
- In-kind reference value records an evidence-backed estimate of donated goods.
- Shipment, customs, transport, handling, and warehousing costs are project expenses.
- Budget lines record approved spending authority and later execution.

Reports for international organizations must present cash received, in-kind reference value, approved budget, and operating expenses as separate totals. The budget schema remains a planned module and must receive its own tested migration before budget data is loaded. Donation or shipment tables must never be used as a substitute for budget lines.

## Security model

- RLS is enabled on all 17 operational tables.
- Every operational policy requires an authenticated identity whose email appears as active in `private.operator_access`.
- Operator identities are provisioned directly in the protected Supabase environment; personal addresses stay outside Git history.
- `private.is_authorized_operator()` is a protected security-definer function in a non-exposed schema and begins with an authenticated-user check.
- `public.current_operator_access()` lets the authenticated application verify access without exposing the allow-list.
- `anon` has no table privileges on operational data.
- `inventory_lot_balance` uses `security_invoker` and inherits access from its source tables.
- The `attachments` bucket is private, limited to 20 MB per object, and accepts JPEG, PNG, WebP, and PDF files.
- Storage access requires an authenticated session and the `attachments` bucket identifier.
- The MVP grants authenticated team members operational access. Granular role permissions remain a later security milestone.

Client code may use the Supabase project URL and publishable client key. Service-role credentials and database secrets belong only in protected server environments.

## Verification baseline

The deployment was verified on 2026-07-19 with:

- schema assertions for all tables, constraints, policies, catalogs, and Storage;
- a transactional Germany-to-Venezuela container scenario with canned food, clothing, and gluten-free goods;
- inventory receipt and a calculated balance of 250 units;
- rejection of a shipment linked to a monetary donation;
- rejection of an authenticated submission from an identity outside the private operator allow-list;
- rollback of all verification records, leaving operational tables empty;
- Supabase security advisor result with zero findings;
- performance advisor review, with only expected unused-index informational notices on the empty schema.

The repository pgTAP specifications are in `supabase/tests/`. Run them against an isolated database or inside a rollback-safe transaction.

## Authenticated submission

`donation.submission_key` and `donation.created_by` provide retry identity and submission audit data. The unique `(created_by, submission_key)` index prevents repeated client attempts from creating duplicate donations.

`public.submit_in_kind_shipment(payload jsonb)` is a security-invoker RPC available only to `authenticated`. It verifies the active operator and creates or reuses:

1. sender actor and donor role;
2. in-kind donation and audit values;
3. shipment route and lifecycle;
4. donation details and linked declared shipment items; and
5. metadata for successfully uploaded private evidence.

The application uploads evidence before the RPC using deterministic paths scoped by user and submission key. A retry uses the same object paths and the same submission key.

Inventory lots and movements stay outside this announcement RPC. They require physical receipt data such as warehouse, received quantity, accepted quantity, damage, condition, and verification status.

---

**Version:** 2.0
**Last updated:** 2026-07-19
