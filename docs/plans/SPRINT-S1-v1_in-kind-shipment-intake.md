# Sprint S1 Plan: In-Kind Shipment Intake

**Code:** S1-INKIND  
**Status:** Interface Implemented; Database Deployed
**Owner:** Isaac Delgado, Yang (yangetze)  
**Created:** 2026-07-19  
**Last Updated:** 2026-07-19

## Overview

Build the first operational Edifica Digital workflow for receiving goods transported in a shipment or container. The flow must support an announced shipment from Germany, its arrival in Venezuela, item verification, inventory intake, and later transformation or distribution.

The interface is bilingual and mobile-first. It uses short steps, concrete labels, visible progress, generous touch targets, safe defaults, contextual help, and a final review before submission.

## User outcome

An authenticated team member can register:

1. who sends the goods;
2. how the shipment travels and when it should arrive;
3. which goods it contains;
4. which lots were accepted on arrival; and
5. which evidence supports the receipt.

## Database changes — explicit notice

This plan adds database objects. All names and comments are in English and use snake_case.

### New tables

- `shipment`: logistics record linked to one in-kind donation.
- `shipment_item`: declared goods within a shipment.
- `inventory_lot`: accepted goods with traceable lot, expiry, condition, and dietary attributes.
- `inventory_movement`: append-only stock movements for each lot.
- `shipment_attachment`: shipping, customs, inspection, and receipt evidence.

### Altered tables

- `donation`: add `donation_type`, `status`, `received_at`, and `reference_code`.
- `donation_detail`: add stable item metadata, valuation fields, and an optional shipment-item reference.

### Constraints, indexes, and RLS

- One shipment belongs to one in-kind donation.
- Quantities and reference values must be positive when supplied.
- Actual arrival follows or equals the departure date.
- Accepted and damaged quantities remain within the received quantity.
- Food lots support expiry, allergens, and dietary attributes such as `gluten_free`.
- Inventory balances derive from append-only movements.
- Authenticated users receive MVP access through Row Level Security policies.

## Frontend scope

- Route: `/donations/in-kind/new`
- Four steps: origin, shipment, goods, review.
- Spanish and English content with a persistent language switch.
- Repeatable item cards with food, clothing, hygiene, medical, and other categories.
- Food-specific fields appear only when relevant.
- Draft recovery in the current browser.
- Final review and explicit confirmation.
- Success screen with a human-readable reference.

## TDD sequence

1. Add executable validation tests and SQL pgTAP tests.
2. Run the validation tests in red before implementation.
3. Commit the failing tests as `[TEST]`.
4. Add the minimum validation and interface code required for green tests.
5. Add the SQL migration after its tests exist.
6. Run test, lint, build, and responsive checks.

## Accessibility and cognitive clarity

- One primary action per step.
- Labels remain visible while typing.
- Required fields are identified in words.
- Errors state the action needed to continue.
- Progress is expressed as both text and position.
- Buttons use at least 44 × 44 px touch targets.
- Focus states meet the project design standard.
- Status uses words and symbols together.
- Motion respects the reduced-motion preference.
- Draft data is preserved between reloads.

## Acceptance criteria

- A Germany-to-Venezuela shipment with an August 17 ETA can be captured.
- The same shipment accepts canned food, clothing, scarce goods, and gluten-free food as distinct lines.
- Each line preserves declared quantity, unit, category, and optional reference value.
- Food lines support expiry and dietary attributes.
- The user can move backward without losing entered data.
- The final step summarizes the complete record before submission.
- Spanish and English cover every visible label and message.
- Validation tests, lint, and production build pass.
- Database migration and RLS changes remain visible in the PR description.

## Deferred scope

- Carrier API integrations.
- Customs authority integrations.
- Barcode scanning.
- Offline synchronization across devices.
- Authenticated production submission from the interface to the deployed Supabase schema.
- Atomic upload and persistence retries across actor, donation, shipment, inventory, and evidence records.

## Risks and treatment

| Risk | Treatment |
|---|---|
| Application writes span several related tables | Use an authenticated atomic submission service and retain the draft until confirmation |
| Actual received quantities differ from declarations | Preserve declared, received, accepted, and damaged values separately |
| Valuation may be unavailable at intake | Keep valuation optional with method and source metadata |
| Food safety data may be incomplete | Mark verification state and require expiry where policy applies |
| Users may leave mid-entry | Save a local draft after every meaningful change |

## Deliverables

- [x] Executable frontend validation tests.
- [x] SQL pgTAP specification.
- [x] Supabase migration for shipment and inventory records.
- [x] Bilingual intake workflow.
- [x] Updated architecture and database documentation.
- [x] Draft pull request for review.
- [x] Foundation and shipment migrations deployed to `edifydb`.
- [x] Security and performance advisors reviewed.
- [ ] Authenticated frontend submission connected and verified.
