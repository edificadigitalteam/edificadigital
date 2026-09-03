import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('finance interface uses organization-neutral language', async () => {
  const source = await readFile(new URL('./ManagementFinancePage.jsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /DIAF/)
  assert.match(source, /GESTIÓN FINANCIERA/)
  assert.match(source, /Enviar a Finanzas/)
  assert.match(source, /Institucional/)
})
