import { isAssociationNotice } from './associationNotices.js'

/** Match current DELETE RLS: own active unit member or tenant administrator. */
export function canDeleteCalendarActivity(activity, access = {}, canManageNotices = false) {
  if (!activity?.id) return false
  if (isAssociationNotice(activity)) return canManageNotices === true
  return Boolean(access?.can_delete_consolidated === true ||
    (Array.isArray(access?.unit_ids) && access.unit_ids.includes(activity.unit_id)))
}

/** Changing a Directorate owner must never carry another unit's objective into the new plan. */
export function resolveCalendarResponsibilityUpdate(activity, draft, plans = [], periodId, canReassign = false) {
  const currentUnit=String(activity?.unit_id || '')
  const targetUnit=String(draft?.unit_id || currentUnit)
  const responsibleName=String(draft?.responsible_name || '').trim() || null
  if (!targetUnit) throw new Error('Missing Directorate.')
  if (targetUnit === currentUnit) {
    return {work_plan_id:activity.work_plan_id,responsible_name:responsibleName}
  }
  if (!canReassign) throw new Error('Your current permissions do not allow changing the Directorate.')
  const destination=plans.find(p=>p.unit_id===targetUnit && p.management_period_id===periodId)
  if(!destination?.id) throw new Error('No annual work plan exists for that Directorate in this period.')
  return {
    work_plan_id:destination.id,
    responsible_name:responsibleName,
    objective_id:null,indicator_id:null,
    review_status:'pending',review_note:null,reviewed_at:null,reviewed_by:null,
  }
}

export function calendarPdfFilename(period,language='es'){
  const year=String(period?.start_date || period?.name || 'anual').match(/\d{4}/)?.[0] || 'anual'
  return `${language==='en'?'Institutional-Calendar':'Calendario-Institucional'}-${year}.pdf`
}
