import test from 'node:test'
import assert from 'node:assert/strict'

import { buildOrganizationPayload } from './organizationAdmin.js'

const completeForm = () => ({
  id: '',
  code: 'CNBV ',
  name: ' Casa Nueva ',
  legal_name: '',
  tax_id: '',
  country: '',
  city: '',
  contact_email: ' Admin@Example.COM ',
  contact_phone: '',
  subscription_status: 'trial',
  language: 'en',
  active: true,
})

test('normalizes optional fields to null when left blank', () => {
  const payload = buildOrganizationPayload(completeForm())

  assert.equal(payload.legal_name, null)
  assert.equal(payload.tax_id, null)
  assert.equal(payload.country, null)
  assert.equal(payload.city, null)
  assert.equal(payload.contact_phone, null)
})

test('trims and lowercases the required contact email instead of nulling it', () => {
  const payload = buildOrganizationPayload(completeForm())

  assert.equal(payload.contact_email, 'admin@example.com')
})

test('trims code to lowercase and name, and maps blank id to null for create', () => {
  const payload = buildOrganizationPayload(completeForm())

  assert.equal(payload.id, null)
  assert.equal(payload.code, 'cnbv')
  assert.equal(payload.name, 'Casa Nueva')
})

test('preserves an existing id for edit', () => {
  const payload = buildOrganizationPayload({ ...completeForm(), id: 'org-1' })

  assert.equal(payload.id, 'org-1')
})

test('preserves subscription status, language and active flag', () => {
  const payload = buildOrganizationPayload({
    ...completeForm(),
    subscription_status: 'active',
    language: 'es',
    active: false,
  })

  assert.equal(payload.subscription_status, 'active')
  assert.equal(payload.language, 'es')
  assert.equal(payload.active, false)
})
