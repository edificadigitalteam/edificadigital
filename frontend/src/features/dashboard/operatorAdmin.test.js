import test from 'node:test'
import assert from 'node:assert/strict'

import { accessStatusOptions, filterOperators, isPendingConfirmation } from './operatorAdmin.js'

const operators = [
  { id: '1', display_name: 'Ana Pérez', email: 'ana@org.org', organization_id: 'org-a', organization_name: 'Org A', active: true, email_confirmed_at: '2026-09-01T00:00:00Z' },
  { id: '2', display_name: 'Luis Gómez', email: 'luis@org.org', organization_id: 'org-a', organization_name: 'Org A', active: true, email_confirmed_at: null },
  { id: '3', display_name: 'Marta Ruiz', email: 'marta@otra.org', organization_id: 'org-b', organization_name: 'Org B', active: false, email_confirmed_at: null },
  { id: '4', display_name: 'Pedro Díaz', email: 'pedro@otra.org', organization_id: 'org-b', organization_name: 'Org B', active: false, email_confirmed_at: '2026-09-02T00:00:00Z' },
]

const ids = (rows) => rows.map((row) => row.id)

test('isPendingConfirmation is true only when the email has not been confirmed', () => {
  assert.equal(isPendingConfirmation(operators[0]), false)
  assert.equal(isPendingConfirmation(operators[1]), true)
  assert.equal(isPendingConfirmation({ email_confirmed_at: undefined }), true)
})

test('the "all" status returns every operator', () => {
  assert.deepEqual(ids(filterOperators(operators, { status: 'all' })), ['1', '2', '3', '4'])
  assert.deepEqual(ids(filterOperators(operators)), ['1', '2', '3', '4'])
})

test('the "pending" status keeps only people who still have to confirm their email', () => {
  assert.deepEqual(ids(filterOperators(operators, { status: 'pending' })), ['2', '3'])
})

test('the "confirmed" status keeps only people who already confirmed their email', () => {
  assert.deepEqual(ids(filterOperators(operators, { status: 'confirmed' })), ['1', '4'])
})

test('the "active" and "suspended" statuses follow the access flag', () => {
  assert.deepEqual(ids(filterOperators(operators, { status: 'active' })), ['1', '2'])
  assert.deepEqual(ids(filterOperators(operators, { status: 'suspended' })), ['3', '4'])
})

test('status combines with the organization filter and the text search', () => {
  assert.deepEqual(ids(filterOperators(operators, { status: 'pending', organizationId: 'org-b' })), ['3'])
  assert.deepEqual(ids(filterOperators(operators, { status: 'pending', search: ' LUIS ' })), ['2'])
  assert.deepEqual(ids(filterOperators(operators, { status: 'pending', search: 'org b' })), ['3'])
})

test('an unknown status behaves like "all"', () => {
  assert.deepEqual(ids(filterOperators(operators, { status: 'unexpected' })), ['1', '2', '3', '4'])
})

test('every status option has a Spanish label and a stable value', () => {
  assert.deepEqual(accessStatusOptions.map((option) => option.value), ['all', 'pending', 'confirmed', 'active', 'suspended'])
  for (const option of accessStatusOptions) assert.ok(option.label.trim().length > 0)
})
