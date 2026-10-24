import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(here, 'vercel.json'), 'utf8'))
const notFoundHtml = readFileSync(join(here, 'public', '404.html'), 'utf8')

const headerFor = (source, host) => (config.headers || []).find((rule) => rule.source === source
  && (host ? rule.has?.some((condition) => condition.type === 'host' && condition.value === host) : !rule.has))

test('www permanently redirects to the canonical apex domain', () => {
  const rule = config.redirects.find((item) => item.has?.some((condition) => condition.type === 'host' && condition.value === 'www.somosedificadigital.com'))
  assert.ok(rule, 'expected a host-based redirect for www')
  assert.equal(rule.source, '/:path*')
  assert.equal(rule.destination, 'https://somosedificadigital.com/:path*')
  assert.equal(rule.permanent, true)
})

test('legacy public donation routes redirect on the server to their app destinations', () => {
  const find = (source) => config.redirects.find((item) => item.source === source)
  assert.equal(find('/donations/monetary/:path*')?.destination, '/app/management/resources/monetary/new')
  assert.equal(find('/donations/in-kind/:path*')?.destination, '/app/management/resources/in-kind/new')
  assert.equal(find('/donations/monetary/:path*').permanent, true)
  assert.equal(find('/donations/in-kind/:path*').permanent, true)
})

test('private and duplicate surfaces send X-Robots-Tag noindex', () => {
  for (const source of ['/app', '/app/:path*', '/activar']) {
    const rule = headerFor(source)
    assert.ok(rule, `expected a header rule for ${source}`)
    assert.deepEqual(rule.headers, [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }])
  }
  const alias = headerFor('/:path*', 'edificadigital.vercel.app')
  assert.ok(alias, 'expected the Vercel production alias to be noindex')
  assert.deepEqual(alias.headers, [{ key: 'X-Robots-Tag', value: 'noindex' }])
})

test('only real SPA routes rewrite to index.html, so unknown URLs return a real 404', () => {
  const sources = config.rewrites.map((rule) => rule.source).sort()
  assert.deepEqual(sources, ['/activar', '/app', '/app/:path*'])
  for (const rule of config.rewrites) assert.equal(rule.destination, '/index.html')
  assert.ok(!config.rewrites.some((rule) => rule.source === '/(.*)'), 'a catch-all rewrite turns every unknown URL into a soft 404')
})

test('the 404 page is bilingual, noindex, and links back home', () => {
  assert.match(notFoundHtml, /<html lang="es">/)
  assert.match(notFoundHtml, /<meta name="robots" content="noindex" \/>/)
  assert.match(notFoundHtml, /Página no encontrada/)
  assert.match(notFoundHtml, /Page not found/)
  assert.match(notFoundHtml, /href="\/"/)
  assert.match(notFoundHtml, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/)
})
