import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public')

test('robots.txt allows public content, blocks only the authenticated app, and points at the sitemap', () => {
  const robots = readFileSync(join(publicDir, 'robots.txt'), 'utf8')
  assert.match(robots, /User-agent: \*/)
  assert.match(robots, /Allow: \//)
  assert.match(robots, /Disallow: \/app/)
  assert.match(robots, /Sitemap: https:\/\/somosedificadigital\.com\/sitemap\.xml/)
})

test('sitemap.xml lists the public routes under the canonical domain', () => {
  const sitemap = readFileSync(join(publicDir, 'sitemap.xml'), 'utf8')
  assert.match(sitemap, /<loc>https:\/\/somosedificadigital\.com\/<\/loc>/)
  assert.match(sitemap, /<loc>https:\/\/somosedificadigital\.com\/donations\/in-kind<\/loc>/)
  assert.match(sitemap, /<loc>https:\/\/somosedificadigital\.com\/donations\/monetary<\/loc>/)
})

test('llms.txt gives AI assistants a bilingual, factual summary of Edifica', () => {
  const llmsTxt = readFileSync(join(publicDir, 'llms.txt'), 'utf8')
  assert.match(llmsTxt, /^# Edifica Digital/)
  assert.match(llmsTxt, /Donaciones y proyectos \/ Donations and projects/)
  assert.match(llmsTxt, /Iglesia \/ Church \(En desarrollo \/ In development\)/)
  assert.match(llmsTxt, /somosedificadigital\.com/)
})
