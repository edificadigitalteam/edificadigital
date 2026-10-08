import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleUnits, supervisedUnits, defaultOwnUnitId, canReviewUnitActivity, selectableUnits, defaultSelectableUnitId, canViewAllUnits } from './unitScope.js'

const units = [
  { id: 'gen', code: 'GEN', unit_type: 'directorate' },
  { id: 'digen', code: 'DIGEN', unit_type: 'directorate' },
  { id: 'diaf', code: 'DIAF', unit_type: 'directorate' },
  { id: 'dime', code: 'DIME', unit_type: 'directorate' },
  { id: 'fbcc', code: 'FBCC', unit_type: 'foundation' },
]

const generalDirector = {
  unit_ids: ['gen', 'digen'],
  visible_unit_ids: ['gen', 'digen', 'diaf', 'dime', 'fbcc'],
  supervised_unit_ids: ['digen', 'diaf', 'dime', 'fbcc'],
  digen_unit_id: 'gen',
}
const digenDirector = {
  unit_ids: ['digen'],
  visible_unit_ids: ['digen', 'diaf', 'dime'],
  supervised_unit_ids: ['diaf', 'dime'],
  digen_unit_id: 'digen',
}
const dimeDirector = { unit_ids: ['dime'], visible_unit_ids: ['dime'], supervised_unit_ids: [], digen_unit_id: 'dime' }

test('visible units follow the organization chart returned by the access overview', () => {
  assert.deepEqual(visibleUnits(units, digenDirector).map((unit) => unit.code), ['DIGEN', 'DIAF', 'DIME'])
  assert.deepEqual(visibleUnits(units, dimeDirector).map((unit) => unit.code), ['DIME'])
  assert.deepEqual(visibleUnits(units, generalDirector).map((unit) => unit.code), ['GEN', 'DIGEN', 'DIAF', 'DIME', 'FBCC'])
})

test('visible units fall back to every unit while an older overview omits the list', () => {
  assert.equal(visibleUnits(units, { unit_ids: ['dime'] }).length, units.length)
})

test('supervised units are the visible units the person does not belong to', () => {
  assert.deepEqual(supervisedUnits(units, digenDirector).map((unit) => unit.code), ['DIAF', 'DIME'])
  assert.deepEqual(supervisedUnits(units, generalDirector).map((unit) => unit.code), ['DIAF', 'DIME', 'FBCC'])
  assert.deepEqual(supervisedUnits(units, dimeDirector), [])
})

test('the default unit is the highest own unit, never a unit matched by its code', () => {
  assert.equal(defaultOwnUnitId(units, generalDirector), 'gen')
  assert.equal(defaultOwnUnitId(units, dimeDirector), 'dime')
  assert.equal(defaultOwnUnitId(units, { unit_ids: ['dime'], digen_unit_id: null }), 'dime')
  assert.equal(defaultOwnUnitId(units, { unit_ids: [], digen_unit_id: null }), '')
})

test('calendar review is allowed only on units below the reviewer', () => {
  assert.equal(canReviewUnitActivity({ unit_id: 'dime' }, digenDirector), true)
  assert.equal(canReviewUnitActivity({ unit_id: 'fbcc' }, digenDirector), false)
  assert.equal(canReviewUnitActivity({ unit_id: 'digen' }, digenDirector), false)
  assert.equal(canReviewUnitActivity({ unit_id: 'dime' }, dimeDirector), false)
})

test('tenant admins see every unit without belonging to one', () => {
  assert.equal(canViewAllUnits('admin'), true)
  assert.equal(canViewAllUnits('super_admin'), true)
  assert.equal(canViewAllUnits('operator'), false)
  assert.equal(canViewAllUnits(undefined), false)
})

test('selectable units are every unit for an admin and only own units for everyone else', () => {
  const adminWithoutUnit = { unit_ids: [], visible_unit_ids: ['gen', 'digen', 'diaf', 'dime', 'fbcc'] }
  assert.deepEqual(selectableUnits(units, adminWithoutUnit, { viewAll: true }).map((unit) => unit.code), ['GEN', 'DIGEN', 'DIAF', 'DIME', 'FBCC'])
  assert.deepEqual(selectableUnits(units, digenDirector).map((unit) => unit.code), ['DIGEN'])
  assert.deepEqual(selectableUnits(units, { unit_ids: [] }), [])
})

test('the default selectable unit prefers an own unit and falls back to the first unit for an admin', () => {
  assert.equal(defaultSelectableUnitId(units, { unit_ids: [] }, { viewAll: true }), 'gen')
  assert.equal(defaultSelectableUnitId(units, { unit_ids: ['dime'], digen_unit_id: 'dime' }, { viewAll: true }), 'dime')
  assert.equal(defaultSelectableUnitId(units, { unit_ids: [] }), '')
})
