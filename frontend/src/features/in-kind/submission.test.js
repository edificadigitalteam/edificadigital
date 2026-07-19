import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSubmissionPayload,
  createEvidencePath,
  createSubmissionReference,
  submitInKindShipment,
  validateEvidence,
} from './submission.js'
import { createInitialDraft } from './validation.js'

const completeDraft = () => ({
  ...createInitialDraft(),
  submissionId: '550e8400-e29b-41d4-a716-446655440000',
  senderName: 'Partner Organization Germany',
  senderType: 'organization',
  senderContact: 'logistics@example.org',
  originCountry: 'Germany',
  originCity: 'Hamburg',
  destinationCountry: 'Venezuela',
  destinationCity: 'La Guaira',
  transportMode: 'sea',
  containerNumber: 'MSCU 123456 7',
  trackingNumber: 'DE/VE/2026-0817',
  departureDate: '2026-07-22',
  estimatedArrival: '2026-08-17',
  status: 'in_transit',
  items: [{
    id: 'item-1',
    description: 'Gluten-free food',
    category: 'food',
    declaredQuantity: '250',
    unit: 'unit',
    referenceValue: '875.50',
    referenceCurrency: 'EUR',
    dietaryAttributes: ['gluten_free'],
    allergens: 'May contain soy',
    lotCode: 'GF-2026',
    expiryDate: '2027-02-28',
    notes: 'Sealed cartons',
  }],
})

test('builds the atomic RPC payload from the bilingual form draft', () => {
  const payload = buildSubmissionPayload(completeDraft(), [{
    attachment_type: 'packing_list',
    storage_path: 'shipments/user/submission/packing-list.pdf',
    file_name: 'packing-list.pdf',
  }])

  assert.equal(payload.submission_key, '550e8400-e29b-41d4-a716-446655440000')
  assert.equal(payload.reference_code, 'INK-DE-20260817-550E8400')
  assert.deepEqual(payload.sender, {
    name: 'Partner Organization Germany',
    email: 'logistics@example.org',
    phone: null,
    country: 'Germany',
    is_organization: true,
  })
  assert.equal(payload.shipment.status, 'in_transit')
  assert.equal(payload.items[0].declared_quantity, 250)
  assert.equal(payload.items[0].reference_value, 875.5)
  assert.deepEqual(payload.items[0].dietary_attributes, ['gluten_free'])
  assert.equal(payload.attachments[0].attachment_type, 'packing_list')
})

test('maps a non-email sender contact to the optional phone field', () => {
  const payload = buildSubmissionPayload({
    ...completeDraft(),
    senderContact: '+49 40 123456',
  })

  assert.equal(payload.sender.email, null)
  assert.equal(payload.sender.phone, '+49 40 123456')
})

test('creates a stable human-readable reference and deterministic evidence path', () => {
  const draft = completeDraft()

  assert.equal(createSubmissionReference(draft), 'INK-DE-20260817-550E8400')
  assert.equal(
    createEvidencePath('user-1', draft.submissionId, {
      id: 'proof-1',
      file: { name: 'Packing List (Final).PDF' },
    }),
    'shipments/user-1/550e8400-e29b-41d4-a716-446655440000/proof-1-packing-list-final.pdf',
  )
})

test('accepts approved evidence and rejects unsupported or oversized files', () => {
  assert.deepEqual(validateEvidence({
    name: 'packing-list.pdf',
    type: 'application/pdf',
    size: 2_000_000,
  }), {})
  assert.equal(validateEvidence({
    name: 'manifest.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 1000,
  }).type, 'unsupported')
  assert.equal(validateEvidence({
    name: 'inspection.jpg',
    type: 'image/jpeg',
    size: 20 * 1024 * 1024 + 1,
  }).size, 'too_large')
})

test('uploads evidence before calling the atomic RPC and returns the persisted reference', async () => {
  const calls = { uploads: [], rpc: [] }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    },
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
          shipment_id: 'shipment-1',
          reference_code: 'INK-DE-20260817-550E8400',
          created: true,
        },
        error: null,
      }
    },
  }
  const evidence = [{
    id: 'proof-1',
    type: 'packing_list',
    file: { name: 'packing-list.pdf', type: 'application/pdf', size: 1200 },
  }]

  const result = await submitInKindShipment({ client, draft: completeDraft(), evidence })

  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.uploads[0].bucket, 'attachments')
  assert.equal(calls.uploads[0].options.upsert, true)
  assert.equal(calls.rpc[0].name, 'submit_in_kind_shipment')
  assert.equal(calls.rpc[0].args.payload.attachments[0].storage_path, calls.uploads[0].path)
  assert.equal(result.reference_code, 'INK-DE-20260817-550E8400')
  assert.equal(result.evidence_count, 1)
})

test('uses the same evidence path and submission key during a retry', async () => {
  const paths = []
  const keys = []
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    },
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
    type: 'packing_list',
    file: { name: 'packing-list.pdf', type: 'application/pdf', size: 1200 },
  }]

  await submitInKindShipment({ client, draft: completeDraft(), evidence })
  await submitInKindShipment({ client, draft: completeDraft(), evidence })

  assert.equal(paths[0], paths[1])
  assert.equal(keys[0], keys[1])
})

test('reports the failed submission stage for a recoverable retry', async () => {
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    },
    storage: { from: () => ({ upload: async () => ({ data: null, error: null }) }) },
    rpc: async () => ({ data: null, error: { message: 'network unavailable' } }),
  }

  await assert.rejects(
    submitInKindShipment({ client, draft: completeDraft(), evidence: [] }),
    (error) => error.name === 'SubmissionError' && error.stage === 'record',
  )
})

