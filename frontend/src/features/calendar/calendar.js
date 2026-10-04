export const DEFAULT_CALENDAR_MODULE_LABEL = 'Calendario'

export function resolveCalendarModuleLabel(organization) {
  const override = String(organization?.calendar_module_label ?? '').trim()
  return override || DEFAULT_CALENDAR_MODULE_LABEL
}

export function selectDefaultCalendarPeriodId(periods, currentPeriodId = '') {
  const rows = Array.isArray(periods) ? periods : []
  if (currentPeriodId && rows.some((period) => period.id === currentPeriodId)) return currentPeriodId
  return rows[0]?.id || ''
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


export function canOpenCalendarActivityEntry({ canCreate, saving } = {}) {
  return Boolean(canCreate && !saving)
}

export function buildCalendarActivityPayloads({
  organizationId,
  workPlanId,
  userId,
  defaults = {},
  rows = [],
} = {}) {
  const objectiveId = String(defaults.objective_id ?? '').trim() || null
  const indicatorId = objectiveId ? (String(defaults.indicator_id ?? '').trim() || null) : null
  const responsibleName = String(defaults.responsible_name ?? '').trim() || null
  const modality = defaults.modality || 'in_person'
  const status = defaults.status || 'planned'

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.title ?? '').trim())
    .map((row) => ({
      organization_id: organizationId,
      work_plan_id: workPlanId,
      objective_id: objectiveId,
      indicator_id: indicatorId,
      title: String(row.title).trim(),
      description: String(row.description ?? '').trim() || null,
      start_date: row.start_date,
      end_date: row.end_date || null,
      status,
      responsible_name: responsibleName,
      modality,
      updated_by: userId || null,
      created_by: userId || null,
    }))
}
