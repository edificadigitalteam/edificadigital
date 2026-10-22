import test from 'node:test'
import assert from 'node:assert/strict'
import { EXECUTIVE_COMPETENCIES, blankEvaluation, evaluationIsComplete, evaluationPayload, normalizeEvaluation, evaluationRatingCounts, evaluationsForCollection, eligibleEvaluationUnits } from './evaluation.js'

test('evaluation preserves the source Word structure: 4 SWOT groups, 18 skills, 7 achievements', () => {
  const form = blankEvaluation('Directora')
  assert.equal(EXECUTIVE_COMPETENCIES.length, 18)
  assert.equal(Object.keys(form.swot).length, 4)
  assert.ok(Object.values(form.swot).every((entries) => entries.length === 3))
  assert.equal(form.achievements.length, 7)
})

test('submission requires the director and all 18 competency responses', () => {
  const form = blankEvaluation('Director')
  form.year_joined = '2020'
  form.period_number = '2'
  form.location = 'Caracas'
  assert.equal(evaluationIsComplete(form), false)
  for (let i = 1; i <= 18; i++) form.competencies[i] = 'strength_medium'
  assert.equal(evaluationIsComplete(form), true)
  form.competencies[18] = ''
  assert.equal(evaluationIsComplete(form), false)
})

test('stored evaluations hydrate safely and totals are counts rather than invented scores', () => {
  const form = normalizeEvaluation({ swot: { strengths: ['Experiencia'] }, achievements: ['Logro'], competencies: { 1: 'strength_high', 2: 'weakness_low' } })
  assert.equal(form.swot.strengths[0], 'Experiencia')
  assert.equal(form.swot.strengths.length, 3)
  assert.equal(form.achievements.length, 7)
  assert.deepEqual(evaluationRatingCounts(form.competencies), { strengths: 1, weaknesses: 1, completed: 2 })
  assert.equal(evaluationPayload(form).achievements[0], 'Logro')
})

test('the evaluation collection lists submitted rows, and drafts too for the tenant admin', () => {
  const rows = [
    { id: 'a', management_period_id: 'p1', status: 'submitted' },
    { id: 'b', management_period_id: 'p1', status: 'draft' },
    { id: 'c', management_period_id: 'p2', status: 'submitted' },
  ]
  assert.deepEqual(evaluationsForCollection(rows, 'p1').map((row) => row.id), ['a'])
  assert.deepEqual(evaluationsForCollection(rows, 'p1', { includeDrafts: true }).map((row) => row.id), ['a', 'b'])
  assert.deepEqual(evaluationsForCollection(rows, 'p3', { includeDrafts: true }), [])
  assert.deepEqual(evaluationsForCollection(null, 'p1'), [])
})

test('only subordinate directorates may submit; GEN and DIGEN receive results without forms', () => {
  const units = [
    { id: 'g', code: 'GEN', active: true },
    { id: 'd', code: 'DIGEN', active: true },
    { id: 'f', code: 'DIAF', active: true },
    { id: 'p', code: 'DIPROM', active: true },
    { id: 'off', code: 'DIME', active: false },
  ]
  const memberships = ['g', 'd', 'f', 'p', 'off']
  assert.deepEqual(eligibleEvaluationUnits(units, memberships, false).map((unit) => unit.code), ['DIAF', 'DIPROM'])
  assert.deepEqual(eligibleEvaluationUnits(units, memberships, true), [])
  assert.deepEqual(eligibleEvaluationUnits(units, ['f'], false).map((unit) => unit.code), ['DIAF'])
  assert.deepEqual(eligibleEvaluationUnits(units, [], false), [])
  assert.deepEqual(eligibleEvaluationUnits([], memberships, false), [])
})
