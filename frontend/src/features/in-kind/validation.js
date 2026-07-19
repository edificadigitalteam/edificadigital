const messages = {
  es: {
    senderName: 'Escribe el nombre del remitente para continuar.',
    originCountry: 'Escribe el país de origen para continuar.',
    destinationCountry: 'Escribe el país de destino para continuar.',
    transportMode: 'Selecciona el medio de transporte.',
    estimatedArrival: 'Selecciona la fecha estimada de llegada.',
    actualArrival: 'La llegada real debe ser igual o posterior a la salida.',
    itemRequired: 'Agrega al menos un producto al embarque.',
    description: 'Escribe el nombre o una descripción breve del producto.',
    category: 'Selecciona una categoría.',
    declaredQuantity: 'Escribe una cantidad mayor que cero.',
    unit: 'Selecciona una unidad.',
    referenceValue: 'El valor de referencia debe ser mayor que cero.',
  },
  en: {
    senderName: 'Enter the sender name to continue.',
    originCountry: 'Enter the origin country to continue.',
    destinationCountry: 'Enter the destination country to continue.',
    transportMode: 'Select the transport mode.',
    estimatedArrival: 'Select the estimated arrival date.',
    actualArrival: 'Actual arrival must be on or after departure.',
    itemRequired: 'Add at least one item to the shipment.',
    description: 'Enter the item name or a short description.',
    category: 'Select a category.',
    declaredQuantity: 'Enter a quantity greater than zero.',
    unit: 'Select a unit.',
    referenceValue: 'Reference value must be greater than zero.',
  },
}

const countryCodes = {
  alemania: 'DE',
  germany: 'DE',
  venezuela: 'VE',
  spain: 'ES',
  españa: 'ES',
  'united states': 'US',
  'estados unidos': 'US',
}

const createItemId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const createEmptyItem = () => ({
  id: createItemId(),
  description: '',
  category: '',
  declaredQuantity: '',
  unit: '',
  referenceValue: '',
  referenceCurrency: 'EUR',
  dietaryAttributes: [],
  allergens: '',
  lotCode: '',
  expiryDate: '',
  notes: '',
})

export const createInitialDraft = () => ({
  donationType: 'in_kind',
  senderName: '',
  senderType: 'organization',
  senderContact: '',
  originCountry: '',
  originCity: '',
  destinationCountry: 'Venezuela',
  destinationCity: '',
  transportMode: 'sea',
  containerNumber: '',
  trackingNumber: '',
  departureDate: '',
  estimatedArrival: '',
  actualArrival: '',
  status: 'announced',
  notes: '',
  items: [createEmptyItem()],
})

const copyFor = (language) => messages[language] ?? messages.es

export function validateOrigin(draft, language = 'es') {
  const copy = copyFor(language)
  const errors = {}

  if (!draft.senderName?.trim()) errors.senderName = copy.senderName
  if (!draft.originCountry?.trim()) errors.originCountry = copy.originCountry
  if (!draft.destinationCountry?.trim()) errors.destinationCountry = copy.destinationCountry

  return errors
}

export function validateShipment(draft, language = 'es') {
  const copy = copyFor(language)
  const errors = {}

  if (!draft.transportMode) errors.transportMode = copy.transportMode
  if (!draft.estimatedArrival) errors.estimatedArrival = copy.estimatedArrival
  if (
    draft.actualArrival &&
    draft.departureDate &&
    draft.actualArrival < draft.departureDate
  ) {
    errors.actualArrival = copy.actualArrival
  }

  return errors
}

const isPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0

export function validateItems(items, language = 'es') {
  const copy = copyFor(language)
  const result = { items: [] }

  if (!Array.isArray(items) || items.length === 0) {
    result.form = copy.itemRequired
    return result
  }

  result.items = items.map((item) => {
    const errors = {}
    if (!item.description?.trim()) errors.description = copy.description
    if (!item.category) errors.category = copy.category
    if (!isPositive(item.declaredQuantity)) errors.declaredQuantity = copy.declaredQuantity
    if (!item.unit) errors.unit = copy.unit
    if (item.referenceValue !== '' && !isPositive(item.referenceValue)) {
      errors.referenceValue = copy.referenceValue
    }
    return errors
  })

  return result
}

export function validateDraft(draft, language = 'es') {
  const errors = {
    origin: validateOrigin(draft, language),
    shipment: validateShipment(draft, language),
    items: validateItems(draft.items, language),
  }
  const invalidSteps = []

  if (Object.keys(errors.origin).length) invalidSteps.push('origin')
  if (Object.keys(errors.shipment).length) invalidSteps.push('shipment')
  if (errors.items.form || errors.items.items.some((item) => Object.keys(item).length)) {
    invalidSteps.push('items')
  }

  return {
    valid: invalidSteps.length === 0,
    invalidSteps,
    errors,
  }
}

export function createShipmentReference(country, estimatedArrival, sequence = '0001') {
  const normalizedCountry = country?.trim().toLocaleLowerCase('es') ?? ''
  const countryCode = countryCodes[normalizedCountry] ?? normalizedCountry
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, 'X')
  const date = estimatedArrival?.replaceAll('-', '') || '00000000'
  const safeSequence = String(sequence).replace(/\D/g, '').padStart(4, '0').slice(-4)

  return `INK-${countryCode}-${date}-${safeSequence}`
}
