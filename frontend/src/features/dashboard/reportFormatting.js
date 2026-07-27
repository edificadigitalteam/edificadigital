export const outputStatusLabels = {
  planned: 'Planificado',
  in_progress: 'En ejecución',
  completed: 'Completado',
  verified: 'Verificado',
}

export const expenseStatusLabels = {
  reported: 'Reportado',
  verified: 'Verificado',
  rejected: 'Rechazado',
}

export const donationTypeLabels = {
  monetary: 'Monetaria',
  in_kind: 'En especies',
  mixed: 'Mixta',
}

export const donationStatusLabels = {
  draft: 'Borrador',
  announced: 'Anunciada',
  received: 'Recibida',
  verified: 'Verificada',
  closed: 'Cerrada',
}

export function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0))
}

export function formatNumber(value) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(Number(value || 0))
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatBreakdown(values) {
  const entries = Object.entries(values ?? {}).filter(([, amount]) => Number(amount) !== 0)
  if (!entries.length) return '—'
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' · ')
}

export function percentage(value, target) {
  const safeTarget = Number(target || 0)
  if (safeTarget <= 0) return 0
  return Math.min(999, Math.round((Number(value || 0) / safeTarget) * 100))
}

export function buildReportTableOfContents({ hasEvidence }) {
  const entries = [
    { id: 'section-financial', label: 'Cotejo financiero' },
    { id: 'section-physical', label: 'Ejecución física' },
  ]
  if (hasEvidence) entries.push({ id: 'section-evidence', label: 'Soportes multimedia' })
  entries.push({ id: 'section-expenses', label: 'Ejecución financiera' })
  return entries
}

export function donationValue(donation) {
  if (donation.donation_type === 'monetary') {
    return {
      primary: formatMoney(donation.amount, donation.currency || 'USD'),
      secondary: donation.usd_base_amount && donation.currency !== 'USD' ? `${formatMoney(donation.usd_base_amount, 'USD')} base USD` : '',
    }
  }
  const value = donation.in_kind_reference_value && donation.in_kind_reference_currency
    ? formatMoney(donation.in_kind_reference_value, donation.in_kind_reference_currency)
    : 'Valor referencial pendiente'
  return {
    primary: donation.contents_summary || 'Carga en especies',
    secondary: [donation.package_count ? `${formatNumber(donation.package_count)} ${donation.package_unit || 'unidades'}` : '', value].filter(Boolean).join(' · '),
  }
}
