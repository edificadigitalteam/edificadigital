// Shared number, date and metric formatting for indicators.
//
// Extracted from ManagementTrackingPage.jsx so the charts and the page speak
// the same language and the same locale. Behavior is unchanged.

export function formatNumber(value, language) {
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { maximumFractionDigits: 2 }).format(Number(value || 0))
}

export function formatDate(value, language) {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { dateStyle: 'medium' }).format(date)
}

export function formatShortDate(value, language) {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { month: 'short', year: '2-digit' }).format(date)
}

export function metricDisplay(value, indicator, language) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  if (indicator.metric_type === 'currency') {
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { style: 'currency', currency: indicator.currency || 'USD', maximumFractionDigits: 2 }).format(Number(value))
  }
  if (indicator.metric_type === 'percentage') return `${formatNumber(value, language)}%`
  if (indicator.metric_type === 'boolean') return Number(value) ? (language === 'en' ? 'Yes' : 'Sí') : 'No'
  return `${formatNumber(value, language)}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}
