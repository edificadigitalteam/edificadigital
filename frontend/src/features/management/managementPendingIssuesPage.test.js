import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('pending issues module is routed and available in the management navigation', async () => {
  const [main, shell] = await Promise.all([
    read('../../main.jsx'),
    read('./ManagementStandaloneShell.jsx'),
  ])
  assert.match(main, /ManagementPendingIssuesPage/)
  assert.match(main, /\/app\/management\/pending-issues/)
  assert.match(shell, /Asuntos pendientes/)
})

test('pending issues mobile layout stacks filters and cards with touch-sized actions', async () => {
  const css = await read('./management-pending-issues.css')
  assert.match(css, /@media\(max-width:720px\)/)
  assert.match(css, /\.pending-issues-filters\{grid-template-columns:1fr/)
  assert.match(css, /\.pending-issue-actions button\{[^}]*min-height:44px/)
  assert.match(css, /\.pending-issues-grid\{grid-template-columns:1fr/)
})
