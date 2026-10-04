import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(fileURLToPath(new URL('./management-annual-plan.css', import.meta.url)), 'utf8')

test('annual plan constrains mobile content to the viewport', () => {
  assert.match(css, /\.annual-plan-page\s*\{[^}]*min-width:\s*0/i)
  assert.match(css, /\.annual-plan-context\s+select\s*\{[^}]*width:\s*100%/i)
  assert.match(css, /\.annual-plan-page\s+\.guided-intro-card[^\{]*\{[^}]*min-width:\s*0/i)
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.annual-plan-page\s+\.management-panel-heading\s+h1\s*\{[^}]*overflow-wrap:\s*anywhere/i)
})
