import test from 'node:test'
import assert from 'node:assert/strict'

import { buildLogEntry } from './sanitize.js'

test('defaults to error level and a fallback message when the body is empty', () => {
  const entry = buildLogEntry({})

  assert.equal(entry.level, 'error')
  assert.equal(entry.message, 'Unknown client error')
  assert.equal(entry.stack, '')
  assert.equal(entry.context, '')
})

test('rejects unsupported levels and falls back to error', () => {
  const entry = buildLogEntry({ level: 'debug', message: 'boom' })

  assert.equal(entry.level, 'error')
  assert.equal(entry.message, 'boom')
})

test('accepts warn and info levels', () => {
  assert.equal(buildLogEntry({ level: 'warn', message: 'x' }).level, 'warn')
  assert.equal(buildLogEntry({ level: 'info', message: 'x' }).level, 'info')
})

test('strips newlines from every string field to prevent log injection', () => {
  const entry = buildLogEntry({
    message: 'line one\nline two\r\nline three',
    context: 'a\nb',
    url: 'https://example.com/\npath',
    userAgent: 'agent\r\nvalue',
  })

  assert.equal(entry.message, 'line one line two line three')
  assert.equal(entry.context, 'a b')
  assert.equal(entry.url, 'https://example.com/ path')
  assert.equal(entry.userAgent, 'agent value')
})

test('truncates oversized fields', () => {
  const entry = buildLogEntry({
    message: 'a'.repeat(600),
    stack: 'b'.repeat(3000),
    context: 'c'.repeat(500),
    url: 'd'.repeat(500),
    userAgent: 'e'.repeat(500),
  })

  assert.equal(entry.message.length, 500)
  assert.equal(entry.stack.length, 2000)
  assert.equal(entry.context.length, 200)
  assert.equal(entry.url.length, 300)
  assert.equal(entry.userAgent.length, 300)
})

test('coerces non-string fields to empty rather than throwing', () => {
  const entry = buildLogEntry({ message: 42, stack: { evil: true }, context: null, url: undefined })

  assert.equal(entry.message, 'Unknown client error')
  assert.equal(entry.stack, '')
  assert.equal(entry.context, '')
  assert.equal(entry.url, '')
})

test('stamps a server-generated timestamp regardless of client input', () => {
  const entry = buildLogEntry({ message: 'x', timestamp: 'not-a-real-timestamp' })

  assert.equal(typeof entry.timestamp, 'string')
  assert.doesNotThrow(() => new Date(entry.timestamp).toISOString())
})
