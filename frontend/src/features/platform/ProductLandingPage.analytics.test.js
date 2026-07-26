import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const jsx = readFileSync(join(here, 'ProductLandingPage.jsx'), 'utf8')

test('CTA clicks are tracked as custom Vercel Analytics events', () => {
  assert.match(jsx, /import \{ Analytics, track \} from '@vercel\/analytics\/react'/)

  assert.match(jsx, /product-button primary[\s\S]{0,80}onClick=\{\(\) => trackCta\('hero_primary_click'\)\}/)
  assert.match(jsx, /product-text-link[\s\S]{0,80}onClick=\{\(\) => trackCta\('hero_secondary_click'\)\}/)
  assert.match(jsx, /onClick=\{\(\) => trackCta\('plan_cta_click', \{ plan: name \}\)\}/)
  assert.match(jsx, /onClick=\{\(\) => trackCta\('contact_whatsapp_click'\)\}/)
})
