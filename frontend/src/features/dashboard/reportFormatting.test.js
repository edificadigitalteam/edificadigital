import test from 'node:test'
import assert from 'node:assert/strict'

import { donationValue, formatBreakdown, formatDate, formatMoney, percentage } from './reportFormatting.js'

test('formatMoney renders a currency amount in es-ES style', () => {
  assert.match(formatMoney(1234.5, 'USD'), /1234,50/)
})

test('percentage caps at 999 and handles a zero target', () => {
  assert.equal(percentage(50, 0), 0)
  assert.equal(percentage(5000, 100), 999)
  assert.equal(percentage(50, 100), 50)
})

test('formatBreakdown drops zero-amount currencies and joins the rest', () => {
  assert.equal(formatBreakdown({ USD: 0, EUR: 10 }), formatMoney(10, 'EUR'))
  assert.equal(formatBreakdown({}), '—')
})

test('formatDate returns an em dash for a missing value', () => {
  assert.equal(formatDate(null), '—')
  assert.match(formatDate('2026-07-27'), /2026/)
})

test('donationValue reports the reference value for in-kind donations without one yet', () => {
  const value = donationValue({ donation_type: 'in_kind', contents_summary: 'Ropa', package_count: 3, package_unit: 'cajas' })
  assert.equal(value.primary, 'Ropa')
  assert.match(value.secondary, /Valor referencial pendiente/)
})
