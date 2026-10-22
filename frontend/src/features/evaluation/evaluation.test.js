import test from 'node:test'
import assert from 'node:assert/strict'
import { EXECUTIVE_COMPETENCIES, blankEvaluation, evaluationIsComplete, evaluationPayload, normalizeEvaluation, evaluationRatingCounts } from './evaluation.js'

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
