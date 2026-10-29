import test from 'node:test'
import assert from 'node:assert/strict'
import { indicatorManageableUnitIds } from './indicatorAccess.js'

const units = [
  { id: 'gen', code: 'GEN' },
  { id: 'digen', code: 'DIGEN' },
  { id: 'dedec', code: 'DEDEC' },
  { id: 'dises', code: 'DISES' },
]

test('a DIGEN-area director only manages their own unit, never other units with directors', () => {
  assert.deepEqual(indicatorManageableUnitIds(units, { unit_ids: ['dedec'] }, 'operator'), ['dedec'])
})

test('tenant admins manage every unit', () => {
  assert.deepEqual(indicatorManageableUnitIds(units, { unit_ids: [] }, 'admin'), ['gen', 'digen', 'dedec', 'dises'])
  assert.deepEqual(indicatorManageableUnitIds(units, null, 'super_admin').length, 4)
})

test('without an access overview an operator manages nothing', () => {
  assert.deepEqual(indicatorManageableUnitIds(units, null, 'operator'), [])
  assert.deepEqual(indicatorManageableUnitIds(units, {}, 'operator'), [])
})

test('unit ids that are not active units of the tenant are ignored', () => {
  assert.deepEqual(indicatorManageableUnitIds(units, { unit_ids: ['dedec', 'archived'] }, 'operator'), ['dedec'])
})

test('tracking and new-indicator pages use the per-person scope, not all tenant memberships', async () => {
  const { readFile } = await import('node:fs/promises')
  for (const file of ['ManagementTrackingPage.jsx', 'ManagementIndicatorFormPage.jsx']) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), 'utf8')
    assert.match(source, /indicatorManageableUnitIds\(/, `${file} must use indicatorManageableUnitIds`)
    assert.match(source, /calendar_access_overview/, `${file} must load the per-person access overview`)
    assert.doesNotMatch(source, /memberships\.filter\(/, `${file} must not derive edit rights from every tenant membership`)
  }
})
