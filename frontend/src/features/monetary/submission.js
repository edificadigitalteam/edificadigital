const MAX_EVIDENCE_SIZE = 20 * 1024 * 1024
const ALLOWED_EVIDENCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const nullable = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : value
  return normalized === '' || normalized === undefined ? null : normalized
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value ?? '')

const sanitizeFileName = (name) => {
  const lastDot = name.lastIndexOf('.')
  const extension = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : ''
  const base = (lastDot >= 0 ? name.slice(0, lastDot) : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'evidence'

  return `${base}${extension.replace(/[^.a-z0-9]/g, '')}`
}

export class MonetarySubmissionError extends Error {
  constructor(stage, cause) {
    super(cause?.message || 'Monetary donation submission failed.')
    this.name = 'MonetarySubmissionError'
    this.stage = stage
    this.cause = cause
  }
}

export function createMonetaryReference(draft) {
  const currency = String(draft.originCurrency ?? 'XXX').toUpperCase().slice(0, 3).padEnd(3, 'X')
  const receivedDate = draft.receivedAt?.slice(0, 10).replaceAll('-', '') || '00000000'
  const suffix = String(draft.submissionId ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toUpperCase()
    .padEnd(8, '0')
  return `MON-${currency}-${receivedDate}-${suffix}`
}

export function buildMonetaryPayload(draft, attachments = []) {
  const donorContact = nullable(draft.donorContact)
  return {
    submission_key: draft.submissionId,
    reference_code: createMonetaryReference(draft),
    donor: {
      name: draft.donorName.trim(),
      email: donorContact && isEmail(donorContact) ? donorContact.toLowerCase() : null,
      phone: donorContact && !isEmail(donorContact) ? donorContact : null,
      is_organization: draft.donorType === 'organization',
      is_anonymous: Boolean(draft.isAnonymous),
    },
    received_at: new Date(draft.receivedAt).toISOString(),
    payment_method: draft.paymentMethod,
    origin_amount: Number(draft.originAmount),
    origin_currency: draft.originCurrency.toUpperCase(),
    usd_base_amount: Number(draft.usdBaseAmount),
    exchange_rate_to_usd: Number(draft.exchangeRateToUsd),
    exchange_rate_source: nullable(draft.exchangeRateSource),
    exchange_rate_date: nullable(draft.exchangeRateDate),
    sender_institution: nullable(draft.senderInstitution),
    receiver_account_label: nullable(draft.receiverAccountLabel),
    transaction_reference: nullable(draft.transactionReference),
    notes: nullable(draft.notes),
    attachments,
  }
}

export function validateMonetaryEvidence(file) {
  const errors = {}
  if (!ALLOWED_EVIDENCE_TYPES.has(file?.type)) errors.type = 'unsupported'
  if (Number(file?.size) > MAX_EVIDENCE_SIZE) errors.size = 'too_large'
  return errors
}

export function createMonetaryEvidencePath(userId, submissionId, evidence) {
  const evidenceId = String(evidence.id).replace(/[^a-z0-9-]/gi, '').slice(0, 64)
  return `donations/${userId}/${submissionId}/${evidenceId}-${sanitizeFileName(evidence.file.name)}`
}

export async function submitMonetaryDonation({ client, draft, evidence = [] }) {
  const userResponse = await client.auth.getUser()
  if (userResponse.error || !userResponse.data?.user) {
    throw new MonetarySubmissionError('authentication', userResponse.error)
  }

  if (evidence.length === 0) throw new MonetarySubmissionError('evidence_required')

  const invalidEvidence = evidence.find(({ file }) => Object.keys(validateMonetaryEvidence(file)).length)
  if (invalidEvidence) throw new MonetarySubmissionError('evidence_validation')

  const attachments = []
  for (const entry of evidence) {
    const path = createMonetaryEvidencePath(userResponse.data.user.id, draft.submissionId, entry)
    const upload = await client.storage.from('attachments').upload(path, entry.file, {
      cacheControl: '3600',
      contentType: entry.file.type,
      upsert: true,
    })

    if (upload.error) throw new MonetarySubmissionError('evidence_upload', upload.error)

    attachments.push({
      attachment_type: entry.type,
      storage_path: upload.data?.path ?? path,
      file_name: entry.file.name,
      notes: null,
    })
  }

  const response = await client.rpc('submit_monetary_donation', {
    payload: buildMonetaryPayload(draft, attachments),
  })

  if (response.error) throw new MonetarySubmissionError('record', response.error)

  return { ...response.data, evidence_count: attachments.length }
}
