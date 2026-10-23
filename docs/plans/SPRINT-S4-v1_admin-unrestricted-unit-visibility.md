# Admin unrestricted unit visibility and editing

**Status:** Implemented

## Outcome

A tenant `admin` (and `super_admin`) sees **and edits** every unit/area of the organization
in the unit-scoped modules without belonging to a unit. Before this change the Calendar and
Pending issues pages built their unit selector from the caller's own unit memberships,
so an admin outside the organization chart saw an empty selector and the
"not assigned to a unit" warning.

## Scope

- `frontend/src/features/management/unitScope.js` — new `canViewAllUnits`,
  `selectableUnits`, `defaultSelectableUnitId`, `editableUnitIds` helpers.
- `frontend/src/features/calendar/ManagementCalendarPage.jsx` — unit selector lists
  every unit for an admin; admin-specific access copy; no missing-unit warning.
- `frontend/src/features/management/ManagementPendingIssuesPage.jsx` — same.

Annual plan, tracking, indicators, reports and finance already gave admins every unit.

- Calendar and Pending issues enable create/edit/delete/clear for an admin on every unit.
- `supabase/migrations/20261008145936_admin_unit_edit_access.sql` and
  `supabase/tests/022_admin_unit_edit_access_test.sql`.

## Rules kept

- Issuing or rewriting DIGEN instructions stays with the DIGEN Director General.
  An admin can update the status of an instruction, like the assigned unit.
- Calendar review (validate/observe) stays with the supervising units.
- An admin never writes to another organization.

## Database impact

Visibility needed no change: `can_manage_organization` already grants admins
organization-wide SELECT, and the access overview RPCs already return every unit.

Editing required a migration: `private.can_manage_calendar_plan` and
`private.can_access_pending_issue_unit` now also accept
`private.can_manage_organization(organization_id)`. The write policies use these helpers.

## Verification

- `node --test src/features/management/unitScope.test.js` — new cases for admin vs. member.
- `pnpm test`, `pnpm lint`, `pnpm build`.
- Local `supabase start` cannot replay the migration history (a data migration requires the
  CNBV organization), so the migration was validated on `edifydb` inside a rolled-back
  transaction with a real admin that has no unit membership: both helpers went from
  `false` to `true` for every plan/unit of its organization and stayed `false` for other
  organizations. Nothing was persisted.
- Applied to `edifydb` as `20261008145936` (`admin_unit_edit_access`). pgTAP 022: 4/4. Post-apply check:
  admin without membership manages every plan/unit of its organization and none of other
  organizations; `anon` cannot execute the helpers. Security and performance advisors: no new findings.
