import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, 'index.html'), 'utf8')

function readPngDimensions(path) {
  const buffer = readFileSync(path)
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} is not a valid PNG`)
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

test('index.html title and description match the approved landing copy', () => {
  assert.match(html, /<title>Edifica Digital \| Software para iglesias<\/title>/)
  assert.match(html, /<meta name="description" content="Edifica es un software modular para iglesias[^"]*"/)
})

test('index.html declares a canonical link to the production domain', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/somosedificadigital\.com\/" \/>/)
})

test('index.html carries Open Graph and Twitter Card tags for link previews', () => {
  assert.match(html, /<meta property="og:type" content="website" \/>/)
  assert.match(html, /<meta property="og:site_name" content="Edifica Digital" \/>/)
  assert.match(html, /<meta property="og:title" content="Edifica Digital \| Software para iglesias" \/>/)
  assert.match(html, /<meta property="og:description" content="Edifica es un software modular para iglesias[^"]*" \/>/)
  assert.match(html, /<meta property="og:url" content="https:\/\/somosedificadigital\.com\/" \/>/)
  assert.match(html, /<meta property="og:image" content="https:\/\/somosedificadigital\.com\/og-image\.png" \/>/)
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/)
  assert.match(html, /<meta name="twitter:image" content="https:\/\/somosedificadigital\.com\/og-image\.png" \/>/)
})

test('index.html declares favicon, favicon.ico fallback, and apple-touch-icon links', () => {
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/)
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any" \/>/)
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/)
})

test('index.html embeds JSON-LD Organization structured data with the confirmed keywords', () => {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  assert.ok(match, 'expected a JSON-LD <script> block')
  const data = JSON.parse(match[1])
  assert.equal(data['@type'], 'Organization')
  assert.equal(data.name, 'Edifica Digital')
  assert.equal(data.url, 'https://somosedificadigital.com/')
  assert.match(html, /<meta name="keywords" content="software para iglesias, software para donaciones, software de trazabilidad de donaciones" \/>/)
})

test('og-image.png is a 1200x630 social preview asset checked into public/', () => {
  const path = join(here, 'public/og-image.png')
  assert.ok(existsSync(path), 'frontend/public/og-image.png is missing')
  assert.deepEqual(readPngDimensions(path), { width: 1200, height: 630 })
})

test('apple-touch-icon.png is a 180x180 icon checked into public/', () => {
  const path = join(here, 'public/apple-touch-icon.png')
  assert.ok(existsSync(path), 'frontend/public/apple-touch-icon.png is missing')
  assert.deepEqual(readPngDimensions(path), { width: 180, height: 180 })
})

test('favicon.ico is a valid ICO container checked into public/', () => {
  const path = join(here, 'public/favicon.ico')
  assert.ok(existsSync(path), 'frontend/public/favicon.ico is missing')
  const buffer = readFileSync(path)
  assert.equal(buffer.readUInt16LE(0), 0, 'ICO reserved field must be 0')
  assert.equal(buffer.readUInt16LE(2), 1, 'ICO type field must be 1')
})
