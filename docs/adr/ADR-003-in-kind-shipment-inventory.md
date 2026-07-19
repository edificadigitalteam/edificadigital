# ADR-003: Model In-Kind Containers as Shipments with Inventory Lots

**Status:** Implemented and deployed
**Date:** 2026-07-19

## Context

An in-kind contribution may arrive as a container that contains several categories, brands, lots, expiry dates, conditions, and dietary attributes. The donation record identifies the contribution and sender. Logistics, inspection, stock, transformation, and delivery require their own traceable events.

## Decision

Represent the contribution through related records:

`donation → shipment → shipment_item → inventory_lot → inventory_movement`

- `donation` records the in-kind contribution and donor.
- `shipment` records transport, route, dates, customs state, and receipt state.
- `shipment_item` records each declared line of goods.
- `inventory_lot` records the quantity accepted into a warehouse and its safety or condition metadata.
- `inventory_movement` records each stock increase or decrease as an append-only event.

Reference valuation is stored separately from cash. It records currency, amount, method, source, and valuation date when available.

## Consequences

- A mixed container remains one donation and one shipment with many item lines.
- Quantity differences remain auditable from declaration through receipt.
- Gluten-free food is represented as a verified dietary attribute on a food lot.
- Logistics costs remain expenses rather than donation value.
- Transformation and impact can consume identifiable inventory lots in later sprints.
- International reports can separate cash received, in-kind reference value, and logistics expenses.

## Interface direction

The initial workflow uses four short steps, retains draft data, and shows a review before submission. Specialized fields appear when the selected category needs them.

## Deployment record

The schema was deployed to Supabase project `edifydb` on 2026-07-19. It includes authenticated RLS, private evidence Storage, covering foreign-key indexes, scalar authorization predicates, and the security-invoker `inventory_lot_balance` view.

The interface currently retains a browser draft and prepares the submission payload. Authenticated database persistence is the next integration step.
