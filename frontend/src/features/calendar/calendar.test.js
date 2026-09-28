import test from 'node:test'
import assert from 'node:assert/strict'
import { renameableModules } from '../settings/moduleLabels.js'
import {
  DEFAULT_CALENDAR_MODULE_LABEL,
  resolveCalendarModuleLabel,
  visibleCalendarActivities,
  canEditCalendarActivity,
  canOpenCalendarActivityEntry,
  buildCalendarActivityPayloads,
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

test('calendar is registered as a tenant-renamable module', () => {
  const module = renameableModules.find((item) => item.key === 'calendar')
  assert.equal(module?.column, 'calendar_module_label')
  assert.equal(module?.rpc, 'admin_set_calendar_module_label')
  assert.equal(module?.defaultLabel, 'Calendario')
})


test('calendar entry can open even when a unit has zero objectives', () => {
  assert.equal(canOpenCalendarActivityEntry({ canCreate: true, saving: false }), true)
  assert.equal(canOpenCalendarActivityEntry({ canCreate: false, saving: false }), false)
  assert.equal(canOpenCalendarActivityEntry({ canCreate: true, saving: true }), false)
})

test('bulk calendar payloads share defaults and allow an optional objective', () => {
  const payloads = buildCalendarActivityPayloads({
    organizationId: 'org-1',
    workPlanId: 'plan-1',
    userId: 'user-1',
    defaults: {
      objective_id: '',
      indicator_id: '',
      responsible_name: 'Equipo DIPROM',
      modality: 'hybrid',
      status: 'planned',
    },
    rows: [
      { title: 'Actividad A', start_date: '2026-10-10', end_date: '', description: '' },
      { title: 'Actividad B', start_date: '2026-11-05', end_date: '2026-11-06', description: 'Detalle' },
      { title: '   ', start_date: '', end_date: '', description: '' },
    ],
  })

  assert.equal(payloads.length, 2)
  assert.equal(payloads[0].objective_id, null)
  assert.equal(payloads[0].indicator_id, null)
  assert.equal(payloads[0].responsible_name, 'Equipo DIPROM')
  assert.equal(payloads[0].modality, 'hybrid')
  assert.equal(payloads[1].description, 'Detalle')
})
