import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public')

test('robots.txt allows crawling everything so noindex headers on private routes can be read, and points at the sitemap', () => {
  const robots = readFileSync(join(publicDir, 'robots.txt'), 'utf8')
  assert.match(robots, /User-agent: \*/)
  assert.match(robots, /Allow: \//)
  // A Disallow on /app hides the X-Robots-Tag: noindex header from crawlers and
  // produces "Indexed, though blocked by robots.txt" for the login link.
  assert.doesNotMatch(robots, /Disallow:\s*\/\S/)
  assert.match(robots, /Sitemap: https:\/\/somosedificadigital\.com\/sitemap\.xml/)
})

test('sitemap.xml lists only indexable public pages under the canonical domain', () => {
  const sitemap = readFileSync(join(publicDir, 'sitemap.xml'), 'utf8')
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  // /donations/* now redirects into the authenticated app, so it must stay out.
  assert.deepEqual(locs, ['https://somosedificadigital.com/'])
})

test('llms.txt gives AI assistants a bilingual, factual summary of Edifica that matches the landing', () => {
  const llmsTxt = readFileSync(join(publicDir, 'llms.txt'), 'utf8')
  assert.match(llmsTxt, /^# Edifica Digital/)
  assert.match(llmsTxt, /Gestión organizacional \/ Organizational management/)
  assert.match(llmsTxt, /Productos digitales \/ Digital products/)
  assert.match(llmsTxt, /Aportes y recursos/)
  assert.doesNotMatch(llmsTxt, /Donaciones y proyectos \/ Donations and projects \(Disponible/)
  assert.match(llmsTxt, /https:\/\/somosedificadigital\.com\/#contacto$/m)
})
