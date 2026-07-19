# Test Specification: In-Kind Shipment Intake

**Status:** In Progress — tests precede implementation  
**Related plan:** `../plans/SPRINT-S1-v1_in-kind-shipment-intake.md`

## Frontend validation

### Origin

- A sender name is required.
- The origin country is required.
- The destination country defaults to Venezuela and remains editable.
- A shipment can be saved with an organization or individual sender.

### Shipment

- Transport mode accepts sea, air, road, and other.
- A sea shipment accepts a container identifier.
- Estimated arrival is required.
- Arrival may be recorded later while the shipment remains in transit.
- Actual arrival cannot precede departure.
- Reference and tracking fields accept international letters, numbers, spaces, slashes, and hyphens.

### Goods

- At least one item is required.
- Every item requires a description, category, quantity, and unit.
- Quantity must be greater than zero.
- Reference value is optional and must be greater than zero when supplied.
- A food item accepts `gluten_free`, allergens, lot code, and expiry date.
- Clothing fields stay outside food validation.
- Removing the only item creates a clear validation message.

### Review and submission

- Submission is blocked while any required field is incomplete.
- Errors identify the step and field that needs attention.
- The review contains sender, route, ETA, item count, quantities, and dietary attributes.
- Submission returns a readable shipment reference.
- The form resets only after successful submission.

### Interaction and accessibility

- Forward and backward navigation preserves entered values.
- Reload restores the local draft.
- The language switch updates labels and validation messages.
- Step buttons expose the current step to assistive technology.
- Focus moves to the step heading after navigation.
- Keyboard users can add, edit, remove, review, and submit goods.

## SQL pgTAP specification

- Shipment tables exist after the migration.
- Every shipment belongs to a donation.
- The linked donation must have type `in_kind`.
- `shipment_item.declared_quantity` is positive.
- `inventory_lot.received_quantity` is positive.
- Accepted plus damaged quantity stays within received quantity.
- Inventory movements reject zero quantities.
- Inventory balance is available through a view grouped by lot.
- Shipment status uses the approved lifecycle.
- Authenticated RLS policies exist on every new table.
- Anonymous access is excluded from operational shipment records.

## Required red state

Before implementation, the frontend tests import functions that are still absent and therefore fail. SQL tests reference tables that are still absent and therefore fail. The red-state command and result are recorded in the implementation commit history and PR.
