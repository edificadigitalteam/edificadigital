import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const jsx = readFileSync(join(here, 'ProductLandingPage.jsx'), 'utf8')
const indexHtml = readFileSync(join(here, '../../../index.html'), 'utf8')

test('the FAQ section renders the approved bilingual question/answer copy', () => {
  assert.match(jsx, /<section className="product-section product-faq" id="faq">/)
  assert.match(jsx, /text\.faq\.items\.map/)

  const esFaqMatch = jsx.match(/es: \{[\s\S]*?faq: \{[\s\S]*?items: \[([\s\S]*?)\],\s*\},/)
  assert.ok(esFaqMatch, 'expected an es.faq.items array')
  assert.match(esFaqMatch[1], /¿Qué es Edifica Digital\?/)
  assert.equal((esFaqMatch[1].match(/^\s*\[/gm) || []).length, 8, 'expected 8 Spanish FAQ entries')

  const enFaqMatch = jsx.match(/en: \{[\s\S]*?faq: \{[\s\S]*?items: \[([\s\S]*?)\],\s*\},/)
  assert.ok(enFaqMatch, 'expected an en.faq.items array')
  assert.match(enFaqMatch[1], /What is Edifica Digital\?/)
  assert.equal((enFaqMatch[1].match(/^\s*\[/gm) || []).length, 8, 'expected 8 English FAQ entries')
})

test('index.html embeds a FAQPage JSON-LD block matching the visible FAQ', () => {
  const match = indexHtml.match(/<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>/)
  assert.ok(match, 'expected a FAQPage JSON-LD block')
  const jsonText = match[0].replace(/<\/?script[^>]*>/g, '')
  const data = JSON.parse(jsonText)
  assert.equal(data['@type'], 'FAQPage')
  assert.equal(data.mainEntity.length, 8)
  assert.equal(data.mainEntity[0]['@type'], 'Question')
  assert.equal(data.mainEntity[0].acceptedAnswer['@type'], 'Answer')
})
