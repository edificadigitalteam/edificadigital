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

test('DIGEN can assign an instruction to a target unit and target units get quick status actions', async () => {
  const [page, css] = await Promise.all([
    read('./ManagementPendingIssuesPage.jsx'),
    read('./management-pending-issues.css'),
  ])
  assert.match(page, /can_issue_instructions/)
  assert.match(page, /instruction_target_unit_ids/)
  assert.match(page, /Asignar instrucción/)
  assert.match(page, /Asignar a Dirección \/ organización/)
  assert.match(page, /updateInstructionStatus/)
  assert.match(page, /pending-status-actions/)
  assert.match(css, /\.pending-status-actions button\{[^}]*min-height:44px/)
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.pending-status-actions\{grid-template-columns:1fr/)
})
