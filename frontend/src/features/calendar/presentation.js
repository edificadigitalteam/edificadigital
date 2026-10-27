/** Helpers for the accessible, one-month-at-a-time calendar presentation. */
export function presentationMonthActivities(activities = [], monthIndex, year = null) {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return []
  const month = String(monthIndex + 1).padStart(2, '0')
  return (activities || [])
    .filter((activity) => {
      const date = String(activity?.start_date || '')
      return date.slice(5, 7) === month && (year === null || date.slice(0, 4) === String(year))
    })
    .sort((left, right) =>
      String(left.start_date).localeCompare(String(right.start_date))
      || String(left.title || '').localeCompare(String(right.title || '')))
}

export function nextPresentationMonth(current, direction) {
  return Math.max(0, Math.min(11, current + direction))
}

/** Use ISO YYYY-MM-DD strings to avoid timezone conversion and local DST skew. */
export function validatePresentationEdit(draft, period) {
  if (!String(draft?.title || '').trim() || !draft?.start_date) return 'missing'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.start_date) ||
      (draft.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(draft.end_date))) return 'dates'
  if (draft.end_date && draft.end_date < draft.start_date) return 'dates'
  if (period?.start_date && draft.start_date < period.start_date) return 'dates'
  if (period?.end_date && draft.start_date > period.end_date) return 'dates'
  if (draft.end_date && period?.end_date && draft.end_date > period.end_date) return 'dates'
  return ''
}

/** All twelve months are visible together in the CNBV-style institutional table. */
export function presentationYearSections(activities = [], year = null) {
  return Array.from({ length: 12 }, (_, index) => ({
    index,
    activities: presentationMonthActivities(activities,index,year),
  }))
}

/** Render PDF-style compact day ranges; use ISO strings (no timezone conversion). */
export function presentationDayRange(startDate, endDate, language = 'es') {
  if (!startDate) return '—'
  const d = (iso) => Number(String(iso).slice(8,10))
  const m = (iso) => Number(String(iso).slice(5,7))
  if (!endDate || startDate === endDate) return String(d(startDate))
  if (startDate.slice(0,7) === endDate.slice(0,7)) return `${d(startDate)}–${d(endDate)}`
  const separator = language === 'en' ? '–' : ' – '
  return `${d(startDate)}/${m(startDate)}${separator}${d(endDate)}/${m(endDate)}`
}

/** Maps existing persisted review states to accessible labels and row colors. */
export function presentationReviewState(reviewStatus, language = 'es') {
  const states = {
    es: { pending:'Pendiente de revisión',validated:'Validada',observed:'Observada' },
    en: { pending:'Pending review',validated:'Validated',observed:'Observed' },
  }
  const tone = ['validated','observed'].includes(reviewStatus) ? reviewStatus : 'pending'
  return { tone, label:(states[language] || states.es)[tone] }
}
