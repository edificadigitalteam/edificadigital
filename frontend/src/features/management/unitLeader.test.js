import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLeaderPayload, validateUnitLeader } from './unitLeader.js'

test('accepts a named leader with email when access creation is enabled', () => {
  const leader = { display_name: 'Ana Pérez', email: ' ANA@example.com ', create_access: true }
  assert.equal(validateUnitLeader(leader), '')
  assert.deepEqual(buildLeaderPayload(leader), { display_name: 'Ana Pérez', email: 'ana@example.com', create_access: true })
})

test('accepts a named leader with email without creating access', () => {
  const leader = { display_name: 'Ana Pérez', email: 'ana@example.com', create_access: false }
  assert.equal(validateUnitLeader(leader), '')
  assert.equal(buildLeaderPayload(leader).create_access, false)
})

test('accepts a named leader without email when access creation is disabled', () => {
  const leader = { display_name: 'Ana Pérez', email: '', create_access: false }
  assert.equal(validateUnitLeader(leader), '')
  assert.deepEqual(buildLeaderPayload(leader), { display_name: 'Ana Pérez', email: '', create_access: false })
})

test('requires email only when access creation is enabled', () => {
  assert.equal(
    validateUnitLeader({ display_name: 'Ana Pérez', email: '', create_access: true }),
    'Indica un correo válido para crear el acceso de la persona responsable.',
  )
})

test('always requires the leader name and validates a supplied email', () => {
  assert.equal(validateUnitLeader({ display_name: '', email: '', create_access: false }), 'Indica el nombre y apellido de la persona responsable.')
  assert.equal(validateUnitLeader({ display_name: 'Ana Pérez', email: 'incorrecto', create_access: false }), 'Corrige el correo de la persona responsable o deja el campo vacío.')
})
