import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CALENDAR_MODULE_LABEL,
  resolveCalendarModuleLabel,
  visibleCalendarActivities,
  canEditCalendarActivity,
} from './calendar.js'

const activities = [
  { id: 'a', unit_id: 'diprom' },
  { id: 'b', unit_id: 'dime' },
  { id: 'c', unit_id: 'digen' },
]

test('calendar module label falls back and supports a tenant override', () => {
  assert.equal(resolveCalendarModuleLabel(null), DEFAULT_CALENDAR_MODULE_LABEL)
  assert.equal(resolveCalendarModuleLabel({ calendar_module_label: 'Agenda anual' }), 'Agenda anual')
})

test('a unit sees only its own activities during ordinary work', () => {
  assert.deepEqual(
    visibleCalendarActivities(activities, { ownUnitIds: ['diprom'], isDigen: false, jointReviewEnabled: false }).map((row) => row.id),
    ['a'],
  )
})

test('DIGEN sees the complete institutional calendar', () => {
  assert.deepEqual(
    visibleCalendarActivities(activities, { ownUnitIds: ['digen'], isDigen: true, jointReviewEnabled: false }).map((row) => row.id),
    ['a', 'b', 'c'],
  )
})

test('joint review temporarily exposes the consolidated calendar read-only', () => {
  assert.deepEqual(
    visibleCalendarActivities(activities, { ownUnitIds: ['diprom'], isDigen: false, jointReviewEnabled: true }).map((row) => row.id),
    ['a', 'b', 'c'],
  )
  assert.equal(canEditCalendarActivity({ unit_id: 'dime' }, { ownUnitIds: ['diprom'], isDigen: false }), false)
})

test('DIGEN can edit its own activities but not another unit activity', () => {
  const access = { ownUnitIds: ['digen'], isDigen: true }
  assert.equal(canEditCalendarActivity({ unit_id: 'digen' }, access), true)
  assert.equal(canEditCalendarActivity({ unit_id: 'diprom' }, access), false)
})
