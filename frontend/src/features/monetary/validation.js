const messages = {
  es: {
    donorName: 'Escribe el nombre del donante para continuar.',
    receivedAt: 'Selecciona la fecha y hora de recepción.',
    paymentMethod: 'Selecciona la forma de recepción.',
    originAmount: 'Escribe un monto de origen mayor que cero.',
    originCurrency: 'Selecciona una moneda válida.',
    usdBaseAmount: 'Confirma un monto base en USD mayor que cero.',
    exchangeRateToUsd: 'Escribe una tasa aplicada mayor que cero.',
    exchangeRateSource: 'Escribe la fuente de la tasa aplicada.',
    exchangeRateDate: 'Selecciona la fecha de la tasa aplicada.',
    conversion: 'El monto base en USD debe coincidir con la tasa aplicada.',
    transactionReference: 'Escribe la referencia de la transacción.',
    senderInstitution: 'Escribe la institución emisora.',
    receiverAccountLabel: 'Escribe la cuenta o institución receptora.',
    verificationAccepted: 'Confirma la revisión de los datos y comprobantes.',
  },
  en: {
    donorName: 'Enter the donor name to continue.',
    receivedAt: 'Select the receipt date and time.',
    paymentMethod: 'Select the receipt method.',
    originAmount: 'Enter an origin amount greater than zero.',
    originCurrency: 'Select a valid currency.',
    usdBaseAmount: 'Confirm a USD base amount greater than zero.',
    exchangeRateToUsd: 'Enter an applied rate greater than zero.',
    exchangeRateSource: 'Enter the source of the applied rate.',
    exchangeRateDate: 'Select the applied rate date.',
    conversion: 'The USD base amount must match the applied rate.',
    transactionReference: 'Enter the transaction reference.',
    senderInstitution: 'Enter the sending institution.',
    receiverAccountLabel: 'Enter the receiving account or institution.',
    verificationAccepted: 'Confirm the review of the data and evidence.',
  },
}

const createUuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const tail = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
    .replace(/[^a-f0-9]/g, '')
    .padEnd(12, '0')
    .slice(0, 12)
  return `00000000-0000-4000-8000-${tail}`
}

export const createInitialMonetaryDraft = () => ({
  submissionId: createUuid(),
  donationType: 'monetary',
  donorName: '',
  donorType: 'person',
  donorContact: '',
  isAnonymous: false,
  receivedAt: '',
  paymentMethod: 'cash',
  originAmount: '',
  originCurrency: 'USD',
  usdBaseAmount: '',
  exchangeRateToUsd: '1',
  exchangeRateSource: '',
  exchangeRateDate: '',
  senderInstitution: '',
  receiverAccountLabel: '',
  transactionReference: '',
  notes: '',
  verificationAccepted: false,
})

const isPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0

export function calculateUsdBaseAmount(originAmount, exchangeRateToUsd) {
  if (!isPositive(originAmount) || !isPositive(exchangeRateToUsd)) return ''
  return (Number(originAmount) * Number(exchangeRateToUsd)).toFixed(2)
}

export function validateMonetaryDraft(draft, language = 'es') {
  const copy = messages[language] ?? messages.es
  const errors = {}

  if (!draft.donorName?.trim()) errors.donorName = copy.donorName
  if (!draft.receivedAt) errors.receivedAt = copy.receivedAt
  if (!draft.paymentMethod) errors.paymentMethod = copy.paymentMethod
  if (!isPositive(draft.originAmount)) errors.originAmount = copy.originAmount
  if (!/^[A-Z]{3}$/.test(draft.originCurrency ?? '')) errors.originCurrency = copy.originCurrency
  if (!isPositive(draft.usdBaseAmount)) errors.usdBaseAmount = copy.usdBaseAmount
  if (!isPositive(draft.exchangeRateToUsd)) errors.exchangeRateToUsd = copy.exchangeRateToUsd

  if (draft.originCurrency !== 'USD') {
    if (!draft.exchangeRateSource?.trim()) errors.exchangeRateSource = copy.exchangeRateSource
    if (!draft.exchangeRateDate) errors.exchangeRateDate = copy.exchangeRateDate
  }

  if (draft.paymentMethod !== 'cash' && !draft.transactionReference?.trim()) {
    errors.transactionReference = copy.transactionReference
  }

  if (['bank_transfer', 'mobile_payment'].includes(draft.paymentMethod)) {
    if (!draft.senderInstitution?.trim()) errors.senderInstitution = copy.senderInstitution
    if (!draft.receiverAccountLabel?.trim()) errors.receiverAccountLabel = copy.receiverAccountLabel
  }

  if (
    isPositive(draft.originAmount)
    && isPositive(draft.exchangeRateToUsd)
    && isPositive(draft.usdBaseAmount)
  ) {
    const calculated = Number(draft.originAmount) * Number(draft.exchangeRateToUsd)
    if (Math.abs(calculated - Number(draft.usdBaseAmount)) > 0.02) {
      errors.usdBaseAmount = copy.conversion
    }
    if (
      draft.originCurrency === 'USD'
      && (Number(draft.exchangeRateToUsd) !== 1 || Math.abs(Number(draft.originAmount) - Number(draft.usdBaseAmount)) > 0.01)
    ) {
      errors.usdBaseAmount = copy.conversion
    }
  }

  if (!draft.verificationAccepted) errors.verificationAccepted = copy.verificationAccepted

  return { valid: Object.keys(errors).length === 0, errors }
}

