import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMonetaryPayload,
  createMonetaryEvidencePath,
  createMonetaryReference,
  submitMonetaryDonation,
  validateMonetaryEvidence,
} from './submission.js'
import { createInitialMonetaryDraft } from './validation.js'

const completeDraft = () => ({
  ...createInitialMonetaryDraft(),
  submissionId: '550e8400-e29b-41d4-a716-446655440000',
  donorName: 'Donante local',
  donorType: 'person',
  donorContact: '000 000 0000',
  isAnonymous: false,
  receivedAt: '2026-07-19T10:30',
  paymentMethod: 'bank_transfer',
  originAmount: '3650',
  originCurrency: 'VES',
  usdBaseAmount: '10.00',
  exchangeRateToUsd: '0.0027397260',
  exchangeRateSource: 'BCV',
  exchangeRateDate: '2026-07-19',
  senderInstitution: 'Banco emisor',
  receiverAccountLabel: 'Cuenta operativa',
  transactionReference: 'REF-20260719-001',
  notes: 'Transferencia verificada por el operador.',
  verificationAccepted: true,
})

test('builds a four-measure monetary RPC payload', () => {
  const payload = buildMonetaryPayload(completeDraft(), [{
    attachment_type: 'proof_of_payment',
    storage_path: 'donations/user/submission/proof.pdf',
    file_name: 'proof.pdf',
  }])

  assert.equal(payload.submission_key, '550e8400-e29b-41d4-a716-446655440000')
  assert.equal(payload.reference_code, 'MON-VES-20260719-550E8400')
  assert.equal(payload.donor.phone, '000 000 0000')
  assert.equal(payload.donor.email, null)
  assert.equal(payload.origin_amount, 3650)
  assert.equal(payload.origin_currency, 'VES')
  assert.equal(payload.usd_base_amount, 10)
  assert.equal(payload.exchange_rate_to_usd, 0.002739726)
  assert.equal(payload.transaction_reference, 'REF-20260719-001')
  assert.equal(payload.attachments[0].attachment_type, 'proof_of_payment')
})

test('preserves anonymous donor status without removing the operational name', () => {
  const payload = buildMonetaryPayload({ ...completeDraft(), isAnonymous: true })

  assert.equal(payload.donor.name, 'Donante local')
  assert.equal(payload.donor.is_anonymous, true)
})

test('creates stable references and deterministic private evidence paths', () => {
  const draft = completeDraft()

  assert.equal(createMonetaryReference(draft), 'MON-VES-20260719-550E8400')
  assert.equal(
    createMonetaryEvidencePath('user-1', draft.submissionId, {
      id: 'proof-1',
      file: { name: 'Comprobante Final.PDF' },
    }),
    'donations/user-1/550e8400-e29b-41d4-a716-446655440000/proof-1-comprobante-final.pdf',
  )
})

test('uses the existing private evidence limits', () => {
  assert.deepEqual(validateMonetaryEvidence({ type: 'application/pdf', size: 1_500_000 }), {})
  assert.equal(validateMonetaryEvidence({ type: 'text/plain', size: 100 }).type, 'unsupported')
  assert.equal(validateMonetaryEvidence({ type: 'image/jpeg', size: 20 * 1024 * 1024 + 1 }).size, 'too_large')
})

test('requires payment or receipt evidence before persistence', async () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    storage: { from: () => ({ upload: async () => ({ data: null, error: null }) }) },
    rpc: async () => ({ data: { created: true }, error: null }),
  }

  await assert.rejects(
    submitMonetaryDonation({ client, draft: completeDraft(), evidence: [] }),
    (error) => error.name === 'MonetarySubmissionError' && error.stage === 'evidence_required',
  )
})

test('uploads payment evidence before the atomic monetary RPC', async () => {
  const calls = { uploads: [], rpc: [] }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    storage: {
      from: (bucket) => ({
        upload: async (path, file, options) => {
          calls.uploads.push({ bucket, path, file, options })
          return { data: { path }, error: null }
        },
      }),
    },
    rpc: async (name, args) => {
      calls.rpc.push({ name, args })
      return {
        data: {
          donation_id: 'donation-1',
          detail_id: 'detail-1',
          reference_code: 'MON-VES-20260719-550E8400',
          created: true,
        },
        error: null,
      }
    },
  }
  const evidence = [{
    id: 'proof-1',
    type: 'proof_of_payment',
    file: { name: 'proof.pdf', type: 'application/pdf', size: 1200 },
  }]

  const result = await submitMonetaryDonation({ client, draft: completeDraft(), evidence })

  assert.equal(calls.uploads[0].bucket, 'attachments')
  assert.equal(calls.uploads[0].options.upsert, true)
  assert.equal(calls.rpc[0].name, 'submit_monetary_donation')
  assert.equal(calls.rpc[0].args.payload.attachments[0].storage_path, calls.uploads[0].path)
  assert.equal(result.reference_code, 'MON-VES-20260719-550E8400')
  assert.equal(result.evidence_count, 1)
})

test('retries with the same submission key and evidence path', async () => {
  const paths = []
  const keys = []
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    storage: {
      from: () => ({
        upload: async (path) => {
          paths.push(path)
          return { data: { path }, error: null }
        },
      }),
    },
    rpc: async (_name, args) => {
      keys.push(args.payload.submission_key)
      return { data: { reference_code: args.payload.reference_code, created: keys.length === 1 }, error: null }
    },
  }
  const evidence = [{
    id: 'proof-1',
    type: 'proof_of_payment',
    file: { name: 'proof.pdf', type: 'application/pdf', size: 1200 },
  }]

  await submitMonetaryDonation({ client, draft: completeDraft(), evidence })
  await submitMonetaryDonation({ client, draft: completeDraft(), evidence })

  assert.equal(paths[0], paths[1])
  assert.equal(keys[0], keys[1])
})
