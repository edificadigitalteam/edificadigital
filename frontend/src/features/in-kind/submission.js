const MAX_EVIDENCE_SIZE = 20 * 1024 * 1024
const ALLOWED_EVIDENCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const countryCodes = {
  alemania: 'DE',
  germany: 'DE',
  venezuela: 'VE',
  spain: 'ES',
  españa: 'ES',
  'united states': 'US',
  'estados unidos': 'US',
}

const normalizeCountryCode = (country) => {
  const normalized = country?.trim().toLocaleLowerCase('es') ?? ''
  return countryCodes[normalized] ?? normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, 'X')
}

const nullable = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : value
  return normalized === '' || normalized === undefined ? null : normalized
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value ?? '')

export class SubmissionError extends Error {
  constructor(stage, cause) {
    super(cause?.message || 'Shipment submission failed.')
    this.name = 'SubmissionError'
    this.stage = stage
    this.cause = cause
  }
}

export function createSubmissionReference(draft) {
  const country = normalizeCountryCode(draft.originCountry)
  const arrival = draft.estimatedArrival?.replaceAll('-', '') || '00000000'
  const suffix = String(draft.submissionId ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toUpperCase()
    .padEnd(8, '0')

  return `INK-${country}-${arrival}-${suffix}`
}

export function buildSubmissionPayload(draft, attachments = []) {
  const senderContact = nullable(draft.senderContact)

  return {
    submission_key: draft.submissionId,
    reference_code: createSubmissionReference(draft),
    sender: {
      name: draft.senderName.trim(),
      email: senderContact && isEmail(senderContact) ? senderContact.toLowerCase() : null,
      phone: senderContact && !isEmail(senderContact) ? senderContact : null,
      country: nullable(draft.originCountry),
      is_organization: draft.senderType === 'organization',
    },
    shipment: {
      transport_mode: draft.transportMode,
      status: draft.status,
      origin_country: draft.originCountry.trim(),
      origin_city: nullable(draft.originCity),
      destination_country: draft.destinationCountry.trim(),
      destination_city: nullable(draft.destinationCity),
      container_number: nullable(draft.containerNumber),
      tracking_number: nullable(draft.trackingNumber),
      carrier_name: nullable(draft.carrierName),
      departure_date: nullable(draft.departureDate),
      estimated_arrival: draft.estimatedArrival,
      actual_arrival: nullable(draft.actualArrival),
      customs_reference: nullable(draft.customsReference),
      notes: nullable(draft.notes),
    },
    items: draft.items.map((item) => ({
      item_code: nullable(item.itemCode),
      description: item.description.trim(),
      category: item.category,
      declared_quantity: Number(item.declaredQuantity),
      unit_code: item.unit,
      reference_value: item.referenceValue === '' ? null : Number(item.referenceValue),
      reference_currency: item.referenceValue === '' ? null : item.referenceCurrency,
      valuation_method: nullable(item.valuationMethod),
      valuation_source: nullable(item.valuationSource),
      valued_at: nullable(item.valuedAt),
      dietary_attributes: item.dietaryAttributes ?? [],
      allergens: nullable(item.allergens),
      lot_code: nullable(item.lotCode),
      expiry_date: nullable(item.expiryDate),
      notes: nullable(item.notes),
    })),
    attachments,
  }
}

export function validateEvidence(file) {
  const errors = {}
  if (!ALLOWED_EVIDENCE_TYPES.has(file?.type)) errors.type = 'unsupported'
  if (Number(file?.size) > MAX_EVIDENCE_SIZE) errors.size = 'too_large'
  return errors
}

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

export function createEvidencePath(userId, submissionId, evidence) {
  const evidenceId = String(evidence.id).replace(/[^a-z0-9-]/gi, '').slice(0, 64)
  return `shipments/${userId}/${submissionId}/${evidenceId}-${sanitizeFileName(evidence.file.name)}`
}

export async function submitInKindShipment({ client, draft, evidence = [] }) {
  const userResponse = await client.auth.getUser()
  if (userResponse.error || !userResponse.data?.user) {
    throw new SubmissionError('authentication', userResponse.error)
  }

  const invalidEvidence = evidence.find(({ file }) => Object.keys(validateEvidence(file)).length)
  if (invalidEvidence) throw new SubmissionError('evidence_validation')

  const attachments = []
  for (const entry of evidence) {
    const path = createEvidencePath(userResponse.data.user.id, draft.submissionId, entry)
    const upload = await client.storage.from('attachments').upload(path, entry.file, {
      cacheControl: '3600',
      contentType: entry.file.type,
      upsert: true,
    })

    if (upload.error) throw new SubmissionError('evidence_upload', upload.error)

    attachments.push({
      attachment_type: entry.type,
      storage_path: upload.data?.path ?? path,
      file_name: entry.file.name,
      notes: null,
    })
  }

  const response = await client.rpc('submit_in_kind_shipment', {
    payload: buildSubmissionPayload(draft, attachments),
  })

  if (response.error) throw new SubmissionError('record', response.error)

  return {
    ...response.data,
    evidence_count: attachments.length,
  }
}

