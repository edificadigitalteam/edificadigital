// Unit visibility follows the organization chart: a person sees their own units and
// every unit below them. The access overview RPCs return the resolved id lists.

const idSet = (ids) => new Set(Array.isArray(ids) ? ids : [])

export function visibleUnits(units = [], access = {}) {
  if (!Array.isArray(access?.visible_unit_ids)) return units
  const visible = idSet(access.visible_unit_ids)
  return units.filter((unit) => visible.has(unit.id))
}

export function supervisedUnits(units = [], access = {}) {
  const own = idSet(access?.unit_ids)
  return visibleUnits(units, access).filter((unit) => !own.has(unit.id))
}

export function defaultOwnUnitId(units = [], access = {}) {
  const own = idSet(access?.unit_ids)
  if (access?.digen_unit_id && own.has(access.digen_unit_id)) return access.digen_unit_id
  return units.find((unit) => own.has(unit.id))?.id || ''
}

export function canReviewUnitActivity(activity, access = {}) {
  return Boolean(activity?.unit_id && idSet(access?.supervised_unit_ids).has(activity.unit_id))
}

// Tenant admins see every unit of the organization without belonging to one.
// Editing still requires unit membership; the database enforces it.
export function canViewAllUnits(role) {
  return role === 'admin' || role === 'super_admin'
}

// Units offered in a unit selector: every unit for an admin, own units for everyone else.
export function selectableUnits(units = [], access = {}, { viewAll = false } = {}) {
  if (viewAll) return units
  const own = idSet(access?.unit_ids)
  return units.filter((unit) => own.has(unit.id))
}

export function defaultSelectableUnitId(units = [], access = {}, options = {}) {
  return defaultOwnUnitId(units, access) || selectableUnits(units, access, options)[0]?.id || ''
}
