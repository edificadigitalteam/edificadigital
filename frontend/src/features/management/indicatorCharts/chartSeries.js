// Turns `indicator_progress` rows into the points a chart draws.
//
// The rules here match `aggregateIndicator` in ManagementTrackingPage.jsx:
// draft rows never enter a calculation, so they never enter a chart either.
// The count of excluded drafts is returned so the interface can say so in
// words instead of silently dropping them.

export function seriesDate(row) {
  return row?.reporting_period_end || row?.reporting_period_start || row?.created_at || null
}

function time(value) {
  const parsed = value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).getTime() : Number.NaN
  return Number.isNaN(parsed) ? 0 : parsed
}

export function buildSeries(indicator, rows) {
  const history = Array.isArray(rows) ? rows.filter((row) => !indicator?.id || row.indicator_id === indicator.id) : []
  const excludedDrafts = history.filter((row) => row.status === 'draft').length
  const usable = history
    .filter((row) => row.status !== 'draft')
    .sort((a, b) => time(seriesDate(a)) - time(seriesDate(b)) || time(a.created_at) - time(b.created_at))

  let running = 0
  const points = usable.map((row) => {
    const value = row.numeric_value == null ? null : Number(row.numeric_value)
    running += Number.isFinite(value) ? value : 0
    return {
      id: row.id,
      date: seriesDate(row),
      value: Number.isFinite(value) ? value : null,
      cumulative: running,
      text: row.text_value || '',
      status: row.status,
      responsible: row.responsible_name || '',
      notes: row.notes || '',
    }
  })

  const numeric = points.map((point) => point.value).filter((value) => value != null)
  const target = indicator?.target_value == null ? null : Number(indicator.target_value)

  return {
    points,
    excludedDrafts,
    target: Number.isFinite(target) ? target : null,
    average: numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null,
    max: numeric.length ? Math.max(...numeric) : null,
    min: numeric.length ? Math.min(...numeric) : null,
  }
}
