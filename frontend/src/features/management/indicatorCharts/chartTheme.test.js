import test from 'node:test'
import assert from 'node:assert/strict'

import { CHART_SURFACE, chartTheme, seriesColor } from './chartTheme.js'

// sRGB → OKLab lightness, so the palette's lightness band is asserted rather than trusted.
function oklabLightness(hex) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground, background) {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

test('T6 the categorical palette holds three distinct slots in a fixed order', () => {
  assert.equal(chartTheme.categorical.length, 3)
  assert.equal(new Set(chartTheme.categorical).size, 3)
  assert.deepEqual(chartTheme.categorical, ['#8257c5', '#e07b1f', '#2f9e8f'])
})

test('T6b every categorical slot sits inside the OKLab lightness band', () => {
  for (const hex of chartTheme.categorical) {
    const lightness = oklabLightness(hex)
    assert.ok(lightness >= 0.43 && lightness <= 0.77, `${hex} lightness ${lightness.toFixed(3)} outside 0.43–0.77`)
  }
})

test('T6c chart ink keeps text contrast against the chart surface', () => {
  assert.ok(contrast(chartTheme.ink, CHART_SURFACE) >= 4.5)
  assert.ok(contrast(chartTheme.mutedInk, CHART_SURFACE) >= 4.5)
})

test('T6d series colors follow the entity index and never wrap around', () => {
  assert.equal(seriesColor(0), chartTheme.categorical[0])
  assert.equal(seriesColor(2), chartTheme.categorical[2])
  assert.equal(seriesColor(3), chartTheme.otherSeries)
  assert.equal(seriesColor(99), chartTheme.otherSeries)
})

test('T6e every color token is a literal hex, so pdfmake can render the same SVG', () => {
  const tokens = [...chartTheme.categorical, chartTheme.ink, chartTheme.mutedInk, chartTheme.grid, chartTheme.track, chartTheme.otherSeries, chartTheme.reference]
  for (const token of tokens) assert.match(token, /^#[0-9a-f]{6}$/)
})
