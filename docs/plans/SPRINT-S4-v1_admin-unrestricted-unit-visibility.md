# Admin unrestricted unit visibility

**Status:** Implemented

## Outcome

A tenant `admin` (and `super_admin`) sees every unit/area of the organization in the
unit-scoped modules without belonging to a unit. Before this change the Calendar and
Pending issues pages built their unit selector from the caller's own unit memberships,
so an admin outside the organization chart saw an empty selector and the
"not assigned to a unit" warning.

## Scope

- `frontend/src/features/management/unitScope.js` — new `canViewAllUnits`,
  `selectableUnits`, `defaultSelectableUnitId` helpers.
- `frontend/src/features/calendar/ManagementCalendarPage.jsx` — unit selector lists
  every unit for an admin; admin-specific access copy; no missing-unit warning.
- `frontend/src/features/management/ManagementPendingIssuesPage.jsx` — same.

Annual plan, tracking, indicators, reports and finance already gave admins every unit.

## Assumptions

- The request covers **viewing**. Creating/editing calendar activities and pending
  issues still requires unit membership (`can_manage_calendar_plan` and the pending
  issue write policies). Admins see those screens read-only unless they belong to the unit.

## Database impact

None. `can_manage_organization` already grants admins organization-wide SELECT on
`unit_work_plan`, `unit_work_activity` and `unit_pending_issue`, and the access
overview RPCs already return every unit in `visible_unit_ids` and
`can_view_consolidated = true` for admins.

## Verification

- `node --test src/features/management/unitScope.test.js` — new cases for admin vs. member.
- `pnpm test`, `pnpm lint`, `pnpm build`.
