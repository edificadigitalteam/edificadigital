import test from 'node:test'
import assert from 'node:assert/strict'
import { filterFinanceMovements, paginateFinanceMovements } from './financeLedger.js'

const movements = [
  { id: '1', occurred_on: '2026-09-01', movement_type: 'income', unit_id: null, fund_id: 'general' },
  { id: '2', occurred_on: '2026-09-02', movement_type: 'expense', unit_id: 'youth', fund_id: 'general' },
  { id: '3', occurred_on: '2026-09-03', movement_type: 'transfer_in', unit_id: 'youth', fund_id: 'activities' },
]

test('filters finance movements by inclusive date range', () => {
  const result = filterFinanceMovements(movements, { dateFrom: '2026-09-02', dateTo: '2026-09-03' })
  assert.deepEqual(result.map(({ id }) => id), ['2', '3'])
})

test('combines movement type, unit, and fund filters', () => {
  const result = filterFinanceMovements(movements, { movementType: 'expense', unitId: 'youth', fundId: 'general' })
  assert.deepEqual(result.map(({ id }) => id), ['2'])
})

test('paginates movements in groups of ten', () => {
  const rows = Array.from({ length: 23 }, (_, index) => ({ id: String(index + 1) }))
  assert.deepEqual(paginateFinanceMovements(rows, 1).items.map(({ id }) => id), ['1','2','3','4','5','6','7','8','9','10'])
  assert.equal(paginateFinanceMovements(rows, 3).items.length, 3)
  assert.equal(paginateFinanceMovements(rows, 3).totalPages, 3)
})
