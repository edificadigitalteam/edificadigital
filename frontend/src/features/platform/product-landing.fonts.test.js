import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, 'product-landing.css'), 'utf8')

test('the landing page only loads the Inter and Source Serif 4 weights it actually uses', () => {
  assert.match(
    css,
    /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;600;700;800;900&family=Source\+Serif\+4:opsz,wght@8\.\.60,700&display=swap'\);/,
    'expected the trimmed weight list (no unused 500 for Inter, no unused 600 for Source Serif 4)',
  )
})
