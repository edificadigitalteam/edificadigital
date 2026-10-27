/** Association information belongs to the institution, not a Directorate work plan. */
export function isAssociationNotice(activity) {
  return activity?.activity_type === 'association_notice'
}

export function canManageAssociationNotices(access, calendarAccess = {}) {
  return access?.role === 'admin' || (access?.role === 'operator' && calendarAccess?.can_edit_consolidated === true)
}

export function associationNoticeToActivity(notice) {
  return {
    ...notice,
    activity_type: 'association_notice',
    unit_id: null,
    work_plan_id: null,
    association_name: notice.association_name,
    responsible_name: notice.association_name,
    review_status: 'informational',
    status: 'informational',
    modality: null,
  }
}

export function mergeCalendarActivities(regularActivities = [], notices = [], periodId) {
  return [...regularActivities, ...notices
    .filter((notice) => notice.management_period_id === periodId)
    .map(associationNoticeToActivity)]
    .sort((left,right)=>String(left.start_date).localeCompare(String(right.start_date)) || String(left.title).localeCompare(String(right.title)))
}

export function validateAssociationNotice(value, period) {
  if (!String(value?.title || '').trim() || !String(value?.association_name || '').trim() || !value?.start_date) return 'missing'
  if (String(value.title).trim().length > 300 || String(value.association_name).trim().length > 200 || String(value.description || '').length > 2000) return 'length'
  const start=String(value.start_date)
  const end=String(value.end_date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || (end && !/^\d{4}-\d{2}-\d{2}$/.test(end))) return 'dates'
  if (end && end < start) return 'dates'
  if (period?.start_date && start < period.start_date) return 'dates'
  if (period?.end_date && (start > period.end_date || (end && end > period.end_date))) return 'dates'
  return ''
}

export function associationNoticePayload(value,{organizationId,periodId,userId}={}) {
  return {
    organization_id: organizationId,
    management_period_id: periodId,
    title: String(value.title || '').trim(),
    association_name: String(value.association_name || '').trim(),
    description: String(value.description || '').trim() || null,
    start_date: value.start_date,
    end_date: value.end_date || null,
    updated_by: userId || null,
    created_by: userId || null,
  }
}
