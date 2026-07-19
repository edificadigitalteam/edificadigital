# Sprint S1 Plan: Supabase Foundation and Operational Database

**Code:** S1-DB
**Status:** Complete
**Owner:** Isaac Delgado, Yang (yangetze)
**Created:** 2026-07-19
**Last Updated:** 2026-07-19

## Overview

Deploy the foundational Edifica Digital donation schema to the connected Supabase project `edifydb`, then deploy the approved in-kind shipment and inventory extension.

The production project is identified by reference `rrqyihsjftlloizsccvi`. Its `public` schema and migration history were empty before this work. The unrelated active project containing personal finance tables remains outside scope.

## Product decisions confirmed

- Supabase project `edifydb` is the operational database for Edifica Digital.
- Database artifacts use English and snake_case.
- The platform is bilingual at the interface and reporting layers.
- Donations may be monetary, in-kind, or mixed.
- A container is an in-kind donation linked to one shipment with many declared items.
- Physical receipt creates inventory lots and append-only inventory movements.
- In-kind reference value remains separate from cash received.
- Logistics and customs costs remain project expenses.
- Sender email is optional; organizations and individuals may be registered with a name and optional contact data.
- Operational tables use authenticated-user RLS for the MVP.
- Attachments use a private Supabase Storage bucket.
- International reports present cash, in-kind reference value, and operating expenses as separate totals.

## Database changes — explicit notice

### Foundation migration

Creates:

- `actor`
- `actor_role`
- `media_type`
- `unit_of_measure`
- `donation`
- `donation_detail`
- `donation_attachment`
- `kit_transformation`
- `kit_transformation_attachment`
- `impact_event`
- `impact_detail`
- `impact_event_attachment`

Also creates constraints, indexes, timestamps, RLS policies, catalog seed values, and the private `attachments` Storage bucket.

### Shipment migration

Applies the already planned migration for:

- `shipment`
- `shipment_item`
- `inventory_lot`
- `inventory_movement`
- `shipment_attachment`
- `inventory_lot_balance`

## TDD and deployment sequence

1. Document this plan and the exact schema behaviors.
2. Add pgTAP tests for the foundational schema.
3. Confirm the connected database is in the red state because the expected tables are absent.
4. Apply the foundational migration through Supabase migration history.
5. Validate foundation tables, constraints, policies, catalogs, and Storage.
6. Apply the shipment and inventory migration.
7. Validate tables, view, triggers, policies, and migration history.
8. Run Supabase security and performance advisors.
9. Update architecture, database reference, agent rules, and Claude guidance.

All nine steps were completed on 2026-07-19.

## Safety controls

- Both migrations are additive.
- The project began with an empty `public` schema, so existing application records remain untouched.
- Foreign keys use restrictive deletion for operational history and cascading deletion only for owned detail records.
- RLS is enabled before application access.
- The attachment bucket is private.
- Reference catalogs use conflict-safe inserts without fixed generated IDs.

## Definition of done

- Supabase migration history contains foundation and shipment migrations.
- Seventeen operational tables and one balance view are available.
- RLS is enabled on every operational table.
- Security and performance advisors are reviewed after deployment.
- Repository documentation identifies `edifydb` and the implemented schema accurately.
- `agents.md` and `claude.md` reflect the latest product, database, bilingual, accessibility, and deployment decisions.

## Completion evidence

- Four migrations are present in Supabase history: foundation, shipment and inventory, RLS/foreign-key optimization, and policy hardening.
- All 17 operational tables have RLS and explicit authenticated-user policies.
- The private `attachments` bucket enforces the 20 MB and MIME allow-list rules.
- A rollback-safe Germany-to-Venezuela container scenario verified 250 units of gluten-free food through receipt and inventory balance.
- A shipment linked to a monetary donation was rejected as expected.
- Verification rows were rolled back, leaving the operational tables empty.
- Supabase security advisor returned zero findings.
- Performance review returned only expected unused-index informational notices for a new empty schema.
