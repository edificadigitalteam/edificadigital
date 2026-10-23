import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const here = new URL('.', import.meta.url)
const legacyNav = readFileSync(new URL('ManagementOperationalFixes.jsx', here), 'utf8')
const standaloneNav = readFileSync(new URL('ManagementStandaloneShell.jsx', here), 'utf8')

test('evaluation is present on first render in both navigation implementations', () => {
  for (const source of [legacyNav, standaloneNav]) {
    assert.match(source, /\/app\/management\/evaluation/)
  }
  assert.match(legacyNav, /evaluation: evaluationOverride \|\| 'Evaluación'/)
  assert.match(legacyNav, /evaluation: evaluationOverride \|\| 'Evaluation'/)
})

test('legacy navigation loads the tenant evaluation name alongside the calendar name', () => {
  assert.match(legacyNav, /select\('calendar_module_label,evaluation_module_label'\)/)
  assert.match(legacyNav, /\[labels\.evaluation, '\/app\/management\/evaluation'\]/)
})
