import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('indicator action buttons remain readable inside narrow cards', async () => {
  const css = await readFile(new URL('./management-grouped-nav.css', import.meta.url), 'utf8')

  assert.match(css, /\.indicator-card-footer\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
  assert.match(css, /\.indicator-card-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(css, /\.indicator-card-actions button\s*\{[^}]*min-height:\s*44px[^}]*white-space:\s*nowrap/s)
  assert.match(css, /@media\s*\(max-width:\s*560px\)[\s\S]*\.indicator-card-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
})
