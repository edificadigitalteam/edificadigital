import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const jsx = readFileSync(join(here, 'ProductLandingPage.jsx'), 'utf8')
const css = readFileSync(join(here, 'product-landing.css'), 'utf8')

test('a skip link to the main content is the first focusable element', () => {
  const skipLinkIndex = jsx.search(/<a href="#main-content" className="skip-link">/)
  const headerIndex = jsx.indexOf('<header')
  assert.notEqual(skipLinkIndex, -1, 'expected a skip link targeting #main-content')
  assert.ok(skipLinkIndex < headerIndex, 'skip link must appear before the header in the DOM')
  assert.match(jsx, /<main id="main-content"/, 'expected <main> to carry the skip-link target id')
})

test('the hamburger menu and language toggle buttons have an aria-label', () => {
  const menuButtonMatch = jsx.match(/<button className="product-menu-button"[^>]*>/)
  assert.ok(menuButtonMatch, 'expected the hamburger menu button')
  assert.match(menuButtonMatch[0], /aria-label=/, 'hamburger button needs an aria-label (it has no visible text)')

  const languageButtonMatch = jsx.match(/<button type="button" aria-label=\{[^}]*\} onClick=\{\(\) => \{ setLanguage/)
  assert.ok(languageButtonMatch, 'expected the language toggle button to carry a dynamic aria-label')
})

test('product-landing.css supports prefers-reduced-motion and visible focus states', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /:focus-visible/)
})
