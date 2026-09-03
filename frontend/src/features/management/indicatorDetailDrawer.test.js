import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('indicator history opens in an accessible responsive drawer outside the card grid', async () => {
  const page = await readFile(new URL('./ManagementTrackingPage.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./management-fixes.css', import.meta.url), 'utf8')

  assert.match(page, /role="dialog"/)
  assert.match(page, /aria-modal="true"/)
  assert.match(page, /className="indicator-detail-backdrop"/)
  assert.match(page, /className="indicator-detail-drawer"/)
  assert.match(page, /onKeyDown=\{handleDetailKeyDown\}/)
  assert.match(page, /event\.key === 'Escape'/)
  assert.match(page, /detailTriggerRef/)
  assert.match(css, /\.indicator-detail-drawer\s*\{[^}]*position:\s*fixed[^}]*right:\s*0/s)
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.indicator-detail-drawer\s*\{[^}]*width:\s*100%/)
})
