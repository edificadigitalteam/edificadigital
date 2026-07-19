import test from 'node:test'
import assert from 'node:assert/strict'

import handler from './log.js'

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    ended: false,
    setHeader(key, value) {
      this.headers[key] = value
    },
    end() {
      this.ended = true
    },
  }
}

test('rejects non-POST requests with 405 and an Allow header', () => {
  const res = mockRes()

  handler({ method: 'GET' }, res)

  assert.equal(res.statusCode, 405)
  assert.equal(res.headers.Allow, 'POST')
  assert.equal(res.ended, true)
})

test('logs a sanitized error entry and responds 204', (t) => {
  const calls = []
  t.mock.method(console, 'error', (line) => calls.push(line))
  const res = mockRes()

  handler({ method: 'POST', body: { level: 'error', message: 'boom', context: 'window.onerror' } }, res)

  assert.equal(res.statusCode, 204)
  assert.equal(calls.length, 1)

  const logged = JSON.parse(calls[0])
  assert.equal(logged.source, 'frontend')
  assert.equal(logged.message, 'boom')
  assert.equal(logged.context, 'window.onerror')
})

test('routes warn-level entries to console.warn instead of console.error', (t) => {
  const errorCalls = []
  const warnCalls = []
  t.mock.method(console, 'error', (line) => errorCalls.push(line))
  t.mock.method(console, 'warn', (line) => warnCalls.push(line))
  const res = mockRes()

  handler({ method: 'POST', body: { level: 'warn', message: 'heads up' } }, res)

  assert.equal(errorCalls.length, 0)
  assert.equal(warnCalls.length, 1)
})

test('handles a missing body without throwing', (t) => {
  t.mock.method(console, 'error', () => {})
  const res = mockRes()

  assert.doesNotThrow(() => handler({ method: 'POST' }, res))
  assert.equal(res.statusCode, 204)
})
