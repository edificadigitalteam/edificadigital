import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('management shell exposes a real accessible mobile navigation drawer', async () => {
  const source = await read('./ManagementStandaloneShell.jsx')
  const css = await read('./management.css')

  assert.match(source, /const \[mobileMenuOpen, setMobileMenuOpen\] = useState\(false\)/)
  assert.match(source, /aria-controls="management-mobile-drawer"/)
  assert.match(source, /className="management-mobile-menu-button"/)
  assert.match(source, /id="management-mobile-drawer"/)
  assert.match(source, /className="management-mobile-backdrop"/)
  assert.match(source, /aria-label="Cerrar menú"/)

  assert.match(css, /\.management-mobile-drawer\s*\{[^}]*display:\s*none/s)
  assert.match(css, /@media \(max-width:\s*920px\)[\s\S]*\.management-mobile-drawer\s*\{[^}]*position:\s*fixed/s)
  assert.match(css, /\.management-mobile-menu-button\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s)
})

test('calendar list becomes a readable card layout on narrow phones', async () => {
  const source = await read('../calendar/ManagementCalendarPage.jsx')
  const css = await read('../calendar/management-calendar.css')

  assert.match(source, /className="calendar-list-cell" data-label=\{t\.date\}/)
  assert.match(source, /className="calendar-list-cell calendar-list-activity" data-label=\{t\.activity\}/)
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.calendar-list-head\{display:none\}/)
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.calendar-list-row\{[^}]*min-width:0[^}]*grid-template-columns:1fr/s)
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.calendar-list-cell::before\{[^}]*content:attr\(data-label\)/s)
})
