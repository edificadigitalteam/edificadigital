import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createInitialDraft,
  createShipmentReference,
  validateDraft,
  validateItems,
  validateOrigin,
  validateShipment,
} from './validation.js'

test('creates a Venezuela-bound in-kind draft with one editable item', () => {
  const draft = createInitialDraft()

  assert.equal(draft.donationType, 'in_kind')
  assert.equal(draft.destinationCountry, 'Venezuela')
  assert.equal(draft.transportMode, 'sea')
  assert.equal(draft.items.length, 1)
})

test('requires a sender and both countries in the origin step', () => {
  const errors = validateOrigin({
    senderName: '',
    originCountry: '',
    destinationCountry: '',
  }, 'en')

  assert.deepEqual(Object.keys(errors).sort(), [
    'destinationCountry',
    'originCountry',
    'senderName',
  ])
  assert.match(errors.senderName, /sender/i)
})

test('returns Spanish validation guidance when Spanish is active', () => {
  const errors = validateOrigin({
    senderName: '',
    originCountry: 'Alemania',
    destinationCountry: 'Venezuela',
  }, 'es')

  assert.match(errors.senderName, /remitente/i)
})

test('requires an estimated arrival and supports a sea container identifier', () => {
  const errors = validateShipment({
    transportMode: 'sea',
    containerNumber: 'MSCU 123456 7',
    estimatedArrival: '',
    departureDate: '2026-07-22',
    actualArrival: '',
  }, 'en')

  assert.deepEqual(Object.keys(errors), ['estimatedArrival'])
})

test('rejects an actual arrival before departure', () => {
  const errors = validateShipment({
    transportMode: 'sea',
    estimatedArrival: '2026-08-17',
    departureDate: '2026-07-22',
    actualArrival: '2026-07-20',
  }, 'en')

  assert.match(errors.actualArrival, /departure/i)
})

test('requires at least one complete item with a positive quantity', () => {
  const errors = validateItems([{
    description: '',
    category: '',
    declaredQuantity: '0',
    unit: '',
    referenceValue: '',
  }], 'en')

  assert.equal(errors.form, undefined)
  assert.equal(errors.items[0].description.length > 0, true)
  assert.equal(errors.items[0].category.length > 0, true)
  assert.equal(errors.items[0].declaredQuantity.length > 0, true)
  assert.equal(errors.items[0].unit.length > 0, true)
})

test('requires a positive reference value only when a value is supplied', () => {
  const emptyValue = validateItems([{
    description: 'Canned beans',
    category: 'food',
    declaredQuantity: '120',
    unit: 'box',
    referenceValue: '',
  }], 'en')
  const invalidValue = validateItems([{
    description: 'Canned beans',
    category: 'food',
    declaredQuantity: '120',
    unit: 'box',
    referenceValue: '-1',
  }], 'en')

  assert.deepEqual(emptyValue.items[0], {})
  assert.match(invalidValue.items[0].referenceValue, /greater than zero/i)
})

test('accepts gluten-free food metadata without affecting clothing lines', () => {
  const errors = validateItems([
    {
      description: 'Gluten-free pasta',
      category: 'food',
      declaredQuantity: '250',
      unit: 'unit',
      referenceValue: '875.50',
      dietaryAttributes: ['gluten_free'],
      allergens: 'May contain soy',
      lotCode: 'GF-2026-08',
      expiryDate: '2027-01-31',
    },
    {
      description: 'Winter clothing',
      category: 'clothing',
      declaredQuantity: '40',
      unit: 'box',
      referenceValue: '',
      dietaryAttributes: [],
    },
  ], 'en')

  assert.deepEqual(errors.items, [{}, {}])
})

test('identifies every incomplete step before review', () => {
  const result = validateDraft(createInitialDraft(), 'en')

  assert.equal(result.valid, false)
  assert.deepEqual(result.invalidSteps, ['origin', 'shipment', 'items'])
})

test('accepts the real Germany-to-Venezuela container scenario', () => {
  const draft = {
    ...createInitialDraft(),
    senderName: 'Partner Organization Germany',
    senderType: 'organization',
    originCountry: 'Germany',
    destinationCountry: 'Venezuela',
    transportMode: 'sea',
    containerNumber: 'MSCU 123456 7',
    departureDate: '2026-07-22',
    estimatedArrival: '2026-08-17',
    status: 'in_transit',
    items: [
      {
        id: 'item-1',
        description: 'Canned non-perishable food',
        category: 'food',
        declaredQuantity: '800',
        unit: 'kilogram',
        referenceValue: '',
        referenceCurrency: 'EUR',
        dietaryAttributes: [],
        allergens: '',
        lotCode: 'CAN-2026',
        expiryDate: '2027-08-31',
        notes: '',
      },
      {
        id: 'item-2',
        description: 'Gluten-free food',
        category: 'food',
        declaredQuantity: '250',
        unit: 'unit',
        referenceValue: '875.50',
        referenceCurrency: 'EUR',
        dietaryAttributes: ['gluten_free'],
        allergens: '',
        lotCode: 'GF-2026',
        expiryDate: '2027-02-28',
        notes: '',
      },
      {
        id: 'item-3',
        description: 'Clothing',
        category: 'clothing',
        declaredQuantity: '40',
        unit: 'box',
        referenceValue: '',
        referenceCurrency: 'EUR',
        dietaryAttributes: [],
        allergens: '',
        lotCode: '',
        expiryDate: '',
        notes: '',
      },
    ],
  }

  assert.deepEqual(validateDraft(draft, 'en'), {
    valid: true,
    invalidSteps: [],
    errors: {
      origin: {},
      shipment: {},
      items: { items: [{}, {}, {}] },
    },
  })
})

test('creates a readable, stable shipment reference', () => {
  assert.equal(
    createShipmentReference('Germany', '2026-08-17', '0001'),
    'INK-DE-20260817-0001',
  )
})
