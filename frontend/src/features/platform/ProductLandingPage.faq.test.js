import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const jsx = readFileSync(join(here, 'ProductLandingPage.jsx'), 'utf8')
const indexHtml = readFileSync(join(here, '../../../index.html'), 'utf8')

// Reads the [question, answer] pairs of one language's faq.items from the copy object.
function faqItems(language) {
  const start = jsx.indexOf(`${language}: {`)
  assert.ok(start >= 0, `expected a ${language} copy block`)
  const faqStart = jsx.indexOf('faq: {', start)
  const faqEnd = jsx.indexOf('closing: {', faqStart)
  assert.ok(faqStart >= 0 && faqEnd > faqStart, `expected a ${language}.faq block`)
  const block = jsx.slice(jsx.indexOf('items: [', faqStart), faqEnd)
  return [...block.matchAll(/\['([^']+)', '([^']+)'\]/g)].map((match) => [match[1], match[2]])
}

test('the FAQ section renders the approved bilingual question/answer copy', () => {
  assert.match(jsx, /<section className="product-section product-faq" id="faq">/)
  assert.match(jsx, /text\.faq\.items\.map/)

  const es = faqItems('es')
  const en = faqItems('en')
  assert.equal(es.length, 8, 'expected 8 Spanish FAQ entries')
  assert.equal(en.length, 8, 'expected 8 English FAQ entries')
  assert.equal(es[0][0], '¿Qué es Edifica Digital?')
  assert.equal(en[0][0], 'What is Edifica Digital?')
})

test('index.html embeds a FAQPage JSON-LD block that matches the visible Spanish FAQ word for word', () => {
  const match = indexHtml.match(/<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>/)
  assert.ok(match, 'expected a FAQPage JSON-LD block')
  const data = JSON.parse(match[0].replace(/<\/?script[^>]*>/g, ''))
  assert.equal(data['@type'], 'FAQPage')
  const structured = data.mainEntity.map((entry) => {
    assert.equal(entry['@type'], 'Question')
    assert.equal(entry.acceptedAnswer['@type'], 'Answer')
    return [entry.name, entry.acceptedAnswer.text]
  })
  assert.deepEqual(structured, faqItems('es'))
})
