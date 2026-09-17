import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSeries, seriesDate } from './chartSeries.js'

const indicator = { id: 'i1', metric_type: 'count', aggregation_method: 'sum', target_value: 100 }

function row(overrides) {
  return { id: 'r', indicator_id: 'i1', numeric_value: 1, status: 'submitted', created_at: '2026-01-01T00:00:00Z', ...overrides }
}

test('T4 draft rows are excluded from the series and counted for disclosure', () => {
  const series = buildSeries(indicator, [
    row({ id: 'a', numeric_value: 10, reporting_period_end: '2026-01-31' }),
    row({ id: 'b', numeric_value: 20, reporting_period_end: '2026-02-28', status: 'draft' }),
    row({ id: 'c', numeric_value: 30, reporting_period_end: '2026-03-31', status: 'verified' }),
  ])
  assert.deepEqual(series.points.map((point) => point.value), [10, 30])
  assert.equal(series.excludedDrafts, 1)
})

test('T4b rows belonging to another indicator never enter the series', () => {
  const series = buildSeries(indicator, [
    row({ id: 'a', reporting_period_end: '2026-01-31' }),
    row({ id: 'b', indicator_id: 'other', reporting_period_end: '2026-02-28' }),
  ])
  assert.equal(series.points.length, 1)
})

test('T5 points are ordered oldest first by reporting period, falling back to created_at', () => {
  const series = buildSeries(indicator, [
    row({ id: 'c', numeric_value: 3, reporting_period_end: '2026-03-31' }),
    row({ id: 'a', numeric_value: 1, reporting_period_end: '2026-01-31' }),
    row({ id: 'b', numeric_value: 2, reporting_period_end: '2026-02-28' }),
  ])
  assert.deepEqual(series.points.map((point) => point.id), ['a', 'b', 'c'])

  const undated = buildSeries(indicator, [
    row({ id: 'late', created_at: '2026-05-02T00:00:00Z' }),
    row({ id: 'early', created_at: '2026-05-01T00:00:00Z' }),
  ])
  assert.deepEqual(undated.points.map((point) => point.id), ['early', 'late'])
})

test('T5b seriesDate prefers the period end, then the period start, then creation', () => {
  assert.equal(seriesDate(row({ reporting_period_end: '2026-02-28', reporting_period_start: '2026-02-01' })), '2026-02-28')
  assert.equal(seriesDate(row({ reporting_period_start: '2026-02-01' })), '2026-02-01')
  assert.equal(seriesDate(row({})), '2026-01-01T00:00:00Z')
})

test('T5c the cumulative total is monotonic and ends at the sum of the points', () => {
  const series = buildSeries({ ...indicator, aggregation_method: 'unique_people' }, [
    row({ id: 'a', numeric_value: 5, reporting_period_end: '2026-01-31' }),
    row({ id: 'b', numeric_value: 7, reporting_period_end: '2026-02-28' }),
    row({ id: 'c', numeric_value: 2, reporting_period_end: '2026-03-31' }),
  ])
  const cumulative = series.points.map((point) => point.cumulative)
  assert.deepEqual(cumulative, [5, 12, 14])
  for (let index = 1; index < cumulative.length; index += 1) assert.ok(cumulative[index] >= cumulative[index - 1])
})

test('T5d the series carries the target and the average of its own points', () => {
  const series = buildSeries(indicator, [
    row({ id: 'a', numeric_value: 10, reporting_period_end: '2026-01-31' }),
    row({ id: 'b', numeric_value: 20, reporting_period_end: '2026-02-28' }),
  ])
  assert.equal(series.target, 100)
  assert.equal(series.average, 15)
})

test('T5e an empty or missing history returns an empty series instead of throwing', () => {
  for (const input of [[], null, undefined]) {
    const series = buildSeries(indicator, input)
    assert.deepEqual(series.points, [])
    assert.equal(series.excludedDrafts, 0)
    assert.equal(series.average, null)
  }
})

test('T5f text results are carried on the point for the timeline form', () => {
  const series = buildSeries({ ...indicator, metric_type: 'text' }, [
    row({ id: 'a', numeric_value: null, text_value: 'Se firmó el convenio', reporting_period_end: '2026-01-31' }),
  ])
  assert.equal(series.points[0].text, 'Se firmó el convenio')
  assert.equal(series.points[0].value, null)
})
