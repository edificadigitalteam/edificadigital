import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateUsdBaseAmount,
  createInitialMonetaryDraft,
  validateMonetaryDraft,
} from './validation.js'

const completeUsdCashDraft = () => ({
  ...createInitialMonetaryDraft(),
  donorName: 'Community donor',
  receivedAt: '2026-07-19T10:30',
  paymentMethod: 'cash',
  originAmount: '100.00',
  originCurrency: 'USD',
  usdBaseAmount: '100.00',
  exchangeRateToUsd: '1',
  verificationAccepted: true,
})

test('creates a continuous USD cash draft with retry identity', () => {
  const draft = createInitialMonetaryDraft()

  assert.equal(draft.donationType, 'monetary')
  assert.equal(draft.paymentMethod, 'cash')
  assert.equal(draft.originCurrency, 'USD')
  assert.equal(draft.exchangeRateToUsd, '1')
  assert.match(draft.submissionId, /^[0-9a-f-]{36}$/i)
})

test('requires donor, receipt time, positive amounts, and final verification', () => {
  const result = validateMonetaryDraft(createInitialMonetaryDraft(), 'en')

  assert.equal(result.valid, false)
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'donorName',
    'originAmount',
    'receivedAt',
    'usdBaseAmount',
    'verificationAccepted',
  ])
})

test('returns direct Spanish guidance', () => {
  const result = validateMonetaryDraft(createInitialMonetaryDraft(), 'es')

  assert.match(result.errors.donorName, /donante/i)
  assert.match(result.errors.originAmount, /monto/i)
})

test('accepts a USD cash receipt with identity conversion', () => {
  assert.deepEqual(validateMonetaryDraft(completeUsdCashDraft(), 'en'), {
    valid: true,
    errors: {},
  })
  assert.equal(calculateUsdBaseAmount('100.00', '1'), '100.00')
})

test('requires exchange-rate evidence for a non-USD receipt', () => {
  const draft = {
    ...completeUsdCashDraft(),
    originCurrency: 'VES',
    originAmount: '3650',
    usdBaseAmount: '',
    exchangeRateToUsd: '',
    exchangeRateSource: '',
    exchangeRateDate: '',
  }
  const result = validateMonetaryDraft(draft, 'en')

  assert.deepEqual(Object.keys(result.errors).sort(), [
    'exchangeRateDate',
    'exchangeRateSource',
    'exchangeRateToUsd',
    'usdBaseAmount',
  ])
})

test('accepts a traceable VES bank transfer', () => {
  const draft = {
    ...completeUsdCashDraft(),
    paymentMethod: 'bank_transfer',
    originCurrency: 'VES',
    originAmount: '3650',
    usdBaseAmount: '10.00',
    exchangeRateToUsd: '0.0027397260',
    exchangeRateSource: 'BCV',
    exchangeRateDate: '2026-07-19',
    senderInstitution: 'Banco emisor',
    receiverAccountLabel: 'Cuenta operativa',
    transactionReference: 'REF-20260719-001',
  }

  assert.deepEqual(validateMonetaryDraft(draft, 'en'), { valid: true, errors: {} })
})

test('requires a transaction reference for every non-cash method', () => {
  const draft = {
    ...completeUsdCashDraft(),
    paymentMethod: 'mobile_payment',
    senderInstitution: 'Banco móvil',
    transactionReference: '',
  }
  const result = validateMonetaryDraft(draft, 'en')

  assert.match(result.errors.transactionReference, /reference/i)
})

test('flags a confirmed USD base amount that differs from the applied rate', () => {
  const result = validateMonetaryDraft({
    ...completeUsdCashDraft(),
    usdBaseAmount: '80.00',
  }, 'en')

  assert.match(result.errors.usdBaseAmount, /rate/i)
})

