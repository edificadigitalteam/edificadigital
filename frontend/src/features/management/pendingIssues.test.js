import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pendingIssueStatusMeta,
  pendingIssueUrgencyMeta,
  sortPendingIssues,
  pendingIssueSummary,
  canEditPendingIssue,
  isDigenInstruction,
  canRespondToPendingInstruction,
  canManagePendingIssueContent,
} from './pendingIssues.js'

test('status metadata exposes the requested red yellow green tracking states', () => {
  assert.equal(pendingIssueStatusMeta('pending','es').label, 'Pendiente')
  assert.equal(pendingIssueStatusMeta('pending','es').tone, 'red')
  assert.equal(pendingIssueStatusMeta('in_progress','es').label, 'En proceso')
  assert.equal(pendingIssueStatusMeta('in_progress','es').tone, 'yellow')
  assert.equal(pendingIssueStatusMeta('completed','es').label, 'Realizado')
  assert.equal(pendingIssueStatusMeta('completed','es').tone, 'green')
})

test('urgency metadata supports four degrees of urgency', () => {
  assert.deepEqual(
    ['low','medium','high','critical'].map((value)=>pendingIssueUrgencyMeta(value,'es').label),
    ['Baja','Media','Alta','Crítica'],
  )
})

test('open and urgent matters sort ahead of completed and lower urgency matters', () => {
  const rows = [
    { id:'done', status:'completed', urgency:'critical', due_date:'2026-10-01', updated_at:'2026-10-01T10:00:00Z' },
    { id:'low', status:'pending', urgency:'low', due_date:'2026-10-01', updated_at:'2026-10-01T10:00:00Z' },
    { id:'critical', status:'pending', urgency:'critical', due_date:'2026-10-10', updated_at:'2026-10-01T10:00:00Z' },
    { id:'progress', status:'in_progress', urgency:'high', due_date:'2026-10-02', updated_at:'2026-10-01T10:00:00Z' },
  ]
  assert.deepEqual(sortPendingIssues(rows).map((row)=>row.id), ['critical','progress','low','done'])
})

test('summary counts tracking state and high urgency', () => {
  const summary = pendingIssueSummary([
    { status:'pending', urgency:'critical' },
    { status:'pending', urgency:'medium' },
    { status:'in_progress', urgency:'high' },
    { status:'completed', urgency:'critical' },
  ])
  assert.deepEqual(summary, { pending:2, inProgress:1, completed:1, urgent:2 })
})

test('editing stays scoped to the user own units even for DIGEN consolidated access', () => {
  assert.equal(canEditPendingIssue({unit_id:'diprom'},{ownUnitIds:['diprom'],isDigen:false}),true)
  assert.equal(canEditPendingIssue({unit_id:'dime'},{ownUnitIds:['diprom'],isDigen:false}),false)
  assert.equal(canEditPendingIssue({unit_id:'diprom'},{ownUnitIds:['digen'],isDigen:true}),false)
  assert.equal(canEditPendingIssue({unit_id:'digen'},{ownUnitIds:['digen'],isDigen:true}),true)
})

test('DIGEN instructions are distinguished from unit-created matters', () => {
  assert.equal(isDigenInstruction({ origin:'digen_instruction' }), true)
  assert.equal(isDigenInstruction({ origin:'unit' }), false)
  assert.equal(isDigenInstruction({}), false)
})

test('target unit can respond to a DIGEN instruction but another unit cannot', () => {
  const instruction = { origin:'digen_instruction', unit_id:'diprom' }
  assert.equal(canRespondToPendingInstruction(instruction,{ ownUnitIds:['diprom'], canIssueInstructions:false }), true)
  assert.equal(canRespondToPendingInstruction(instruction,{ ownUnitIds:['dime'], canIssueInstructions:false }), false)
  assert.equal(canRespondToPendingInstruction(instruction,{ ownUnitIds:['digen'], canIssueInstructions:true }), false)
})

test('DIGEN manages instruction content while a target unit only responds by status', () => {
  const instruction = { origin:'digen_instruction', unit_id:'diprom' }
  assert.equal(canManagePendingIssueContent(instruction,{ ownUnitIds:['diprom'], canIssueInstructions:false }), false)
  assert.equal(canManagePendingIssueContent(instruction,{ ownUnitIds:['digen'], canIssueInstructions:true }), true)
  assert.equal(canManagePendingIssueContent({ origin:'unit', unit_id:'diprom' },{ ownUnitIds:['diprom'], canIssueInstructions:false }), true)
})
