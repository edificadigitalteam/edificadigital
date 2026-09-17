// Chooses the visual form for an indicator.
//
// The create form never asks "what chart do you want?": the indicator already
// declares its metric type, how several results consolidate, how often it is
// updated, and whether it carries a target. Those four facts determine the
// honest form. A stored `preferred_chart` may override the result later, but
// only among forms the indicator's own data supports.
//
// See docs/plans/SPRINT-S5-v1_indicator-visualization-system.md.

export const CHART_FORMS = ['empty', 'stat', 'status', 'timeline', 'gauge', 'progress', 'trend', 'columns']

// A line through two points reads as a trend the data does not support.
const MINIMUM_TREND_POINTS = 3

function usableRows(indicator, rows) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => row.status !== 'draft' && (!indicator?.id || row.indicator_id === indicator.id))
}

function hasTarget(indicator) {
  const target = Number(indicator?.target_value)
  return Number.isFinite(target) && target > 0
}

// The card shows the headline form; the drawer shows how the indicator moved.
function detailFor(form, pointCount) {
  if (form === 'gauge') return pointCount >= MINIMUM_TREND_POINTS ? 'trend' : 'columns'
  if (form === 'progress') return 'columns'
  return form
}

function degrade(form, pointCount) {
  return form === 'trend' && pointCount < MINIMUM_TREND_POINTS ? 'columns' : form
}

function describe(form, rule, indicator, pointCount, options = {}) {
  const resolved = degrade(form, pointCount)
  const detailForm = degrade(detailFor(resolved, pointCount), pointCount)
  return {
    form: resolved,
    detailForm,
    rule,
    options: {
      referenceLine: options.referenceLine ?? (hasTarget(indicator) ? 'target' : null),
      cumulativeLine: options.cumulativeLine ?? false,
    },
  }
}

export function automaticChart(indicator, rows) {
  const points = usableRows(indicator, rows)
  const count = points.length
  const metric = indicator?.metric_type
  const method = indicator?.aggregation_method === 'calculated' ? 'latest' : indicator?.aggregation_method

  if (metric === 'text') return describe('timeline', 'text', indicator, count, { referenceLine: null })
  if (count === 0) return describe('empty', 'no-results', indicator, count, { referenceLine: null })
  if (count === 1) return describe('stat', 'single-result', indicator, count)
  if (metric === 'boolean') return describe('status', 'boolean', indicator, count, { referenceLine: null })
  if (metric === 'percentage' && hasTarget(indicator)) return describe('gauge', 'percentage-with-target', indicator, count)
  if ((metric === 'count' || metric === 'currency') && hasTarget(indicator) && method === 'sum') {
    return describe('progress', 'summed-towards-target', indicator, count)
  }
  if (method === 'latest' || method === 'non_aggregable') return describe('trend', 'latest-value', indicator, count)
  if (method === 'average') return describe('trend', 'average', indicator, count, { referenceLine: 'average' })
  if (method === 'unique_people') return describe('columns', 'unique-people', indicator, count, { cumulativeLine: true })
  if (metric === 'ratio') return describe('trend', 'ratio', indicator, count)
  if (!hasTarget(indicator)) return describe('columns', 'no-target', indicator, count, { referenceLine: null })
  return describe('columns', 'fallback', indicator, count)
}

// Only the forms this indicator's own data can carry honestly.
export function allowedOverrides(indicator, rows) {
  const count = usableRows(indicator, rows).length
  if (indicator?.metric_type === 'text') return ['timeline']
  if (count === 0) return []
  if (indicator?.metric_type === 'boolean') return ['status', 'timeline']

  const forms = ['stat', 'columns', 'timeline']
  if (count >= MINIMUM_TREND_POINTS) forms.push('trend')
  if (hasTarget(indicator)) forms.push('progress')
  if (hasTarget(indicator) && indicator?.metric_type === 'percentage') forms.push('gauge')
  return CHART_FORMS.filter((form) => forms.includes(form))
}

export function resolveChart(indicator, rows) {
  const automatic = automaticChart(indicator, rows)
  const preferred = indicator?.preferred_chart
  if (!preferred || !allowedOverrides(indicator, rows).includes(preferred)) {
    return { ...automatic, overridden: false }
  }
  const count = usableRows(indicator, rows).length
  return { ...describe(preferred, 'override', indicator, count, automatic.options), overridden: true }
}

// What the card shows. The card already prints the target, the achieved value
// and what is pending, so forms that would only repeat those numbers get no
// mark at all.
const CARD_FORMS = { gauge: 'gauge', progress: 'progress', trend: 'sparkline', columns: 'sparkline', status: 'status' }

export function cardForm(form) {
  return CARD_FORMS[form] || 'none'
}
