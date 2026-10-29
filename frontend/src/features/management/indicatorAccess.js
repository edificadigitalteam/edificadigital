// Units where the signed-in person can create or edit indicators and results.
// Must match RLS (private.can_manage_unit): tenant admins manage every unit,
// everyone else only the units where they themselves hold an active role.
// `overview.unit_ids` comes from calendar_access_overview and is already
// limited to the current person, unlike the organization_unit_member rows,
// which every operator in the tenant can read.
const adminRoles = new Set(['admin', 'super_admin'])

export function indicatorManageableUnitIds(units = [], overview = null, role = 'operator') {
  if (adminRoles.has(role)) return units.map((unit) => unit.id)
  const own = new Set(Array.isArray(overview?.unit_ids) ? overview.unit_ids : [])
  return units.filter((unit) => own.has(unit.id)).map((unit) => unit.id)
}
