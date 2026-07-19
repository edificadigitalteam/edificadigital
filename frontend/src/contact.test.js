import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPublicContactUrl } from './contact.js'

test('builds a privacy-safe contact URL with optional environment configuration', () => {
  const fallback = new URL(buildPublicContactUrl('Request a presentation'))
  assert.equal(fallback.origin + fallback.pathname, 'https://wa.me/')
  assert.equal(fallback.searchParams.get('text'), 'Request a presentation')

  const configured = new URL(buildPublicContactUrl(
    'Request a presentation',
    'https://contact.example.org/request',
  ))
  assert.equal(configured.origin + configured.pathname, 'https://contact.example.org/request')
  assert.equal(configured.searchParams.get('text'), 'Request a presentation')
})
