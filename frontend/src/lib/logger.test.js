import test from 'node:test'
import assert from 'node:assert/strict'

import { buildErrorPayload, reportClientError } from './logger.js'

test('builds a payload with a fallback message and default level', () => {
  const payload = buildErrorPayload({}, { href: 'https://example.com/page', userAgent: 'test-agent' })

  assert.equal(payload.level, 'error')
  assert.equal(payload.message, 'Unknown error')
  assert.equal(payload.url, 'https://example.com/page')
  assert.equal(payload.userAgent, 'test-agent')
})

test('truncates an oversized message to the shared limit', () => {
  const payload = buildErrorPayload({ message: 'a'.repeat(600) }, {})

  assert.equal(payload.message.length, 500)
})

test('carries through context, stack, and level', () => {
  const payload = buildErrorPayload(
    { message: 'boom', stack: 'at foo()', context: 'react-error-boundary', level: 'warn' },
    { href: '', userAgent: '' },
  )

  assert.equal(payload.message, 'boom')
  assert.equal(payload.stack, 'at foo()')
  assert.equal(payload.context, 'react-error-boundary')
  assert.equal(payload.level, 'warn')
})

test('reportClientError is a no-op outside a browser environment', () => {
  assert.equal(typeof window, 'undefined')
  assert.doesNotThrow(() => reportClientError({ message: 'x' }))
})
