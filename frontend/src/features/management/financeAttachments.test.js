import test from 'node:test'
import assert from 'node:assert/strict'
import { createFinanceAttachmentPath } from './financeAttachments.js'

test('places the authenticated user id in the second storage folder', () => {
  const path = createFinanceAttachmentPath({
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    submissionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    uniqueId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    fileName: 'Factura septiembre 01.pdf',
  })

  assert.equal(
    path,
    'finance/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc-factura-septiembre-01.pdf',
  )
})

test('rejects an attachment path without an authenticated user', () => {
  assert.throws(
    () => createFinanceAttachmentPath({ userId: '', submissionId: 'submission', uniqueId: 'file', fileName: 'invoice.pdf' }),
    /authenticated user/i,
  )
})
