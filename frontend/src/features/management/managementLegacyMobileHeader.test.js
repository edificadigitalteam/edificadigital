import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('legacy management screens receive the same mobile hamburger behavior', async () => {
  const source = await read('./ManagementOperationalFixes.jsx')
  const css = await read('./management-legacy-mobile-nav.css')

  assert.match(source, /legacyMobileMenuOpen/)
  assert.match(source, /management-legacy-mobile-menu-button/)
  assert.match(source, /management-legacy-mobile-sidebar/)
  assert.match(source, /management-legacy-mobile-backdrop/)
  assert.match(source, /management-legacy-mobile-close-button/)
  assert.doesNotMatch(source, /createPortal\(\s*<a className="management-resources-mobile-link"/s)
  assert.doesNotMatch(source, /createPortal\(\s*<a className="management-finance-mobile-link"/s)
  assert.doesNotMatch(source, /createPortal\(\s*<a className="management-users-mobile-link"/s)

  assert.match(css, /@media\(max-width:920px\)/)
  assert.match(css, /\.management-sidebar\.management-legacy-mobile-open\{[^}]*position:fixed[^}]*z-index:99/s)
  assert.match(css, /\.management-legacy-mobile-menu-button\{[^}]*min-width:44px[^}]*min-height:44px/s)
  assert.match(css, /\.management-legacy-mobile-close-button\{[^}]*width:44px[^}]*height:44px/s)
})

test('legacy mobile header keeps only hamburger, brand and compact management label', async () => {
  const css = await read('./management-legacy-mobile-nav.css')
  assert.match(css, /\.management-mobile-header\.management-legacy-mobile-header/)
  assert.match(css, /\.management-resources-mobile-link,[\s\S]*\.management-finance-mobile-link,[\s\S]*\.management-users-mobile-link\{display:none!important\}/)
})
