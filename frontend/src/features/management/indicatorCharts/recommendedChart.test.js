import test from 'node:test'
import assert from 'node:assert/strict'

import { CHART_FORMS, allowedOverrides, automaticChart, cardForm, resolveChart } from './recommendedChart.js'

const metricTypes = ['count', 'currency', 'percentage', 'ratio', 'boolean', 'text']
const aggregationMethods = ['sum', 'average', 'latest', 'max', 'unique_people', 'calculated', 'non_aggregable']

function indicator(overrides = {}) {
  return { id: 'i1', metric_type: 'count', aggregation_method: 'sum', frequency: 'monthly', target_value: 100, ...overrides }
}

function rows(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index}`,
    indicator_id: 'i1',
    numeric_value: 10 * (index + 1),
    reporting_period_end: `2026-0${index + 1}-01`,
    created_at: `2026-0${index + 1}-01T00:00:00Z`,
    status: 'submitted',
    ...overrides,
  }))
}

test('T1 every metric/aggregation/target combination resolves to a known form', () => {
  for (const metric_type of metricTypes) {
    for (const aggregation_method of aggregationMethods) {
      for (const target_value of [100, null]) {
        for (const count of [0, 1, 2, 5]) {
          const result = automaticChart(indicator({ metric_type, aggregation_method, target_value }), rows(count))
          assert.ok(CHART_FORMS.includes(result.form), `unknown form ${result.form}`)
          assert.ok(CHART_FORMS.includes(result.detailForm), `unknown detail form ${result.detailForm}`)
          assert.equal(typeof result.rule, 'string')
        }
      }
    }
  }
})

test('T1b a missing or malformed indicator falls back instead of throwing', () => {
  assert.equal(automaticChart(null, []).form, 'empty')
  assert.equal(automaticChart(indicator({ metric_type: 'unknown-type' }), rows(4)).form, 'columns')
})

test('T2 a single result is never drawn as a trend', () => {
  assert.equal(automaticChart(indicator({ target_value: null }), rows(0)).form, 'empty')
  assert.equal(automaticChart(indicator({ target_value: null }), rows(1)).form, 'stat')
})

test('T2b two points degrade from trend to columns, three keep the trend', () => {
  const latest = indicator({ aggregation_method: 'latest', target_value: null })
  assert.equal(automaticChart(latest, rows(2)).form, 'columns')
  assert.equal(automaticChart(latest, rows(3)).form, 'trend')
})

test('T2c draft rows do not count towards the point thresholds', () => {
  const latest = indicator({ aggregation_method: 'latest', target_value: null })
  const mixed = [...rows(2), ...rows(2).map((row) => ({ ...row, id: `d${row.id}`, status: 'draft' }))]
  assert.equal(automaticChart(latest, mixed).form, 'columns')
})

test('T2d a text indicator is a timeline and a boolean indicator is a status, whatever the history', () => {
  assert.equal(automaticChart(indicator({ metric_type: 'text' }), rows(9)).form, 'timeline')
  assert.equal(automaticChart(indicator({ metric_type: 'boolean' }), rows(9)).form, 'status')
})

test('T2e a percentage with a target is a gauge on the card and a history chart in the drawer', () => {
  const result = automaticChart(indicator({ metric_type: 'percentage' }), rows(5))
  assert.equal(result.form, 'gauge')
  assert.equal(result.detailForm, 'trend')
})

test('T2f a summed count with a target is a progress meter backed by per-period columns', () => {
  const result = automaticChart(indicator({ metric_type: 'count', aggregation_method: 'sum' }), rows(5))
  assert.equal(result.form, 'progress')
  assert.equal(result.detailForm, 'columns')
})

test('T2g reference lines and the cumulative line follow the aggregation method', () => {
  assert.equal(automaticChart(indicator({ aggregation_method: 'average', target_value: null }), rows(5)).options.referenceLine, 'average')
  assert.equal(automaticChart(indicator({ metric_type: 'ratio', aggregation_method: 'latest' }), rows(5)).options.referenceLine, 'target')
  assert.equal(automaticChart(indicator({ aggregation_method: 'unique_people', target_value: null }), rows(5)).options.cumulativeLine, true)
})

test('T3 a valid override wins over the automatic form', () => {
  const subject = indicator({ aggregation_method: 'latest', target_value: null, preferred_chart: 'columns' })
  const result = resolveChart(subject, rows(5))
  assert.equal(result.form, 'columns')
  assert.equal(result.overridden, true)
})

test('T3b an incompatible or unknown override falls back to the automatic form', () => {
  const textIndicator = indicator({ metric_type: 'text', preferred_chart: 'gauge' })
  assert.equal(resolveChart(textIndicator, rows(5)).form, 'timeline')
  assert.equal(resolveChart(textIndicator, rows(5)).overridden, false)

  const scarce = indicator({ aggregation_method: 'latest', target_value: null, preferred_chart: 'trend' })
  assert.equal(resolveChart(scarce, rows(2)).form, 'columns')

  const nonsense = indicator({ preferred_chart: 'pie-of-two-slices' })
  assert.equal(resolveChart(nonsense, rows(5)).form, automaticChart(nonsense, rows(5)).form)
})

test('T3c only forms the data supports are offered as overrides', () => {
  assert.deepEqual(allowedOverrides(indicator({ metric_type: 'text' }), rows(5)), ['timeline'])
  assert.deepEqual(allowedOverrides(indicator(), rows(0)), [])

  const scarce = allowedOverrides(indicator({ target_value: null }), rows(2))
  assert.ok(!scarce.includes('trend'))
  assert.ok(!scarce.includes('gauge'))

  const rich = allowedOverrides(indicator({ metric_type: 'percentage' }), rows(4))
  assert.ok(rich.includes('trend'))
  assert.ok(rich.includes('gauge'))
  for (const form of rich) assert.ok(CHART_FORMS.includes(form))
})

test('T8 the card carries the headline meter, never a duplicate of the numbers beside it', () => {
  assert.equal(cardForm('gauge'), 'gauge')
  assert.equal(cardForm('progress'), 'progress')
  assert.equal(cardForm('trend'), 'sparkline')
  assert.equal(cardForm('columns'), 'sparkline')
  assert.equal(cardForm('status'), 'status')
  assert.equal(cardForm('stat'), 'none')
  assert.equal(cardForm('timeline'), 'none')
  assert.equal(cardForm('empty'), 'none')
  assert.equal(cardForm('nonsense'), 'none')
})

test('T8b every form the heuristic can return has a card treatment', () => {
  for (const form of CHART_FORMS) assert.ok(['gauge', 'progress', 'sparkline', 'status', 'none'].includes(cardForm(form)), form)
})
