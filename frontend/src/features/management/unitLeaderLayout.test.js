import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('unit leader controls share one aligned grid', async () => {
  const css = await readFile(new URL('./unit-leader-layout.css', import.meta.url), 'utf8')

  assert.match(css, /\.leader-section\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /\.leader-section \.structure-person-grid\s*\{\s*display:\s*contents/)
  assert.match(css, /\.leader-section \.structure-person-grid label,[^}]*align-content:\s*start/)
  assert.match(css, /\.leader-section > \.structure-access-choice\s*\{\s*grid-column:\s*1\s*\/\s*span 9/)
})
