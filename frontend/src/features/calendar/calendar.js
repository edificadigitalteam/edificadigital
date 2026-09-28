export const DEFAULT_CALENDAR_MODULE_LABEL = 'Calendario'

export function resolveCalendarModuleLabel(organization) {
  const override = String(organization?.calendar_module_label ?? '').trim()
  return override || DEFAULT_CALENDAR_MODULE_LABEL
}

export function visibleCalendarActivities(activities, access) {
  const rows = Array.isArray(activities) ? activities : []
  const own = new Set(access?.ownUnitIds ?? [])
  if (access?.isDigen || access?.jointReviewEnabled) return rows
  return rows.filter((activity) => own.has(activity.unit_id))
}

export function canEditCalendarActivity(activity, access) {
  const own = new Set(access?.ownUnitIds ?? [])
  return Boolean(activity?.unit_id && own.has(activity.unit_id))
}

export function reviewStatusLabel(status, language = 'es') {
  const labels = language === 'en'
    ? { pending: 'Pending', validated: 'Validated', observed: 'Observed' }
    : { pending: 'Pendiente', validated: 'Validada', observed: 'Observada' }
  return labels[status] || labels.pending
}
