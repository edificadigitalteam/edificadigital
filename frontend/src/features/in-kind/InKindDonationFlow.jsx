import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import { inKindContent } from './inKindContent.js'
import { OperatorAccessScreen } from './OperatorAccess.jsx'
import { useOperatorAccess } from './useOperatorAccess.js'
import { submitInKindShipment, validateEvidence } from './submission.js'
import { supabase } from '../../lib/supabase.js'
import { reportClientError } from '../../lib/logger.js'
import {
  createEmptyItem,
  createInitialDraft,
  validateDraft,
  validateItems,
  validateOrigin,
  validateShipment,
} from './validation.js'
import './in-kind.css'

const DRAFT_KEY = 'edifica-in-kind-draft-v1'

const ArrowLeft = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5" /></svg>
)

const ArrowRight = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
)

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 3.5 3.5L16 5.5" /></svg>
)

const Plus = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
)

const Trash = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M9 9v4m2-4v4" /></svg>
)

const Package = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7m-8 4v10" /></svg>
)

function Brand() {
  return (
    <span className="intake-brand">
      <span className="intake-brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>edifica<span>digital</span></span>
    </span>
  )
}

function Field({ label, error, hint, children, className = '' }) {
  const fieldId = useId()
  const labelId = `${fieldId}-label`
  const descriptionId = error || hint ? `${fieldId}-description` : undefined
  const isGroup = isValidElement(children) && children.type === 'div'
  const control = isValidElement(children)
    ? cloneElement(children, isGroup
      ? { role: 'group', 'aria-labelledby': labelId, 'aria-describedby': descriptionId }
      : { id: children.props.id ?? fieldId, 'aria-describedby': descriptionId })
    : children

  return (
    <div className={`intake-field ${className}`}>
      {isGroup ? <span className="field-label" id={labelId}>{label}</span> : <label htmlFor={fieldId}>{label}</label>}
      {control}
      {error ? <p className="field-error" id={descriptionId} role="alert">{error}</p> : hint ? <p className="field-hint" id={descriptionId}>{hint}</p> : null}
    </div>
  )
}

function TextInput({ error, ...props }) {
  return <input {...props} aria-invalid={Boolean(error)} />
}

function SelectInput({ error, children, ...props }) {
  return <select {...props} aria-invalid={Boolean(error)}>{children}</select>
}

function loadDraft() {
  try {
    const saved = window.localStorage.getItem(DRAFT_KEY)
    if (!saved) return createInitialDraft()
    const parsed = JSON.parse(saved)
    return { ...createInitialDraft(), ...parsed, items: parsed.items?.length ? parsed.items : [createEmptyItem()] }
  } catch {
    return createInitialDraft()
  }
}

function loadLanguage() {
  try {
    return window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

function InKindDonationFlow() {
  const [language, setLanguage] = useState(loadLanguage)
  const [draft, setDraft] = useState(loadDraft)
  const [step, setStep] = useState(0)
  const [highestStep, setHighestStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [reference, setReference] = useState('')
  const [savedPulse, setSavedPulse] = useState(false)
  const [evidence, setEvidence] = useState([])
  const headingRef = useRef(null)
  const evidenceInputId = useId()
  const copy = inKindContent[language]
  const access = useOperatorAccess()

  useEffect(() => {
    document.documentElement.lang = language
    document.title = copy.metaTitle
    try {
      window.localStorage.setItem('edifica-language', language)
    } catch {
      // The active language still applies to the current session.
    }
  }, [copy.metaTitle, language])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        setSavedPulse(true)
        window.setTimeout(() => setSavedPulse(false), 1200)
      } catch {
        setSavedPulse(false)
      }
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [draft])

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const currentKey = copy.steps[step].key
  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setStorageError('')
    setConfirmed(false)
  }

  const updateItem = (id, field, value) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }))
    setErrors({})
    setStorageError('')
    setConfirmed(false)
  }

  const validateCurrentStep = () => {
    if (currentKey === 'origin') return validateOrigin(draft, language)
    if (currentKey === 'shipment') return validateShipment(draft, language)
    if (currentKey === 'items') return validateItems(draft.items, language)
    return {}
  }

  const hasErrors = (result) => {
    if (result.form) return true
    if (result.items) return result.items.some((item) => Object.keys(item).length)
    return Object.keys(result).length > 0
  }

  const focusFirstError = () => {
    window.setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 20)
  }

  const goNext = () => {
    const result = validateCurrentStep()
    if (hasErrors(result)) {
      setErrors(result)
      focusFirstError()
      return
    }
    const nextStep = Math.min(step + 1, copy.steps.length - 1)
    setErrors({})
    setStep(nextStep)
    setHighestStep((current) => Math.max(current, nextStep))
  }

  const goBack = () => {
    setErrors({})
    setStep((current) => Math.max(0, current - 1))
  }

  const goToStep = (index) => {
    if (index > highestStep) return
    setErrors({})
    setStep(index)
  }

  const addItem = () => {
    setDraft((current) => ({ ...current, items: [...current.items, createEmptyItem()] }))
    setErrors({})
    setStorageError('')
    setConfirmed(false)
  }

  const removeItem = (id) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
    setErrors({})
    setStorageError('')
    setConfirmed(false)
  }

  const toggleDietary = (id, value) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item
        const active = item.dietaryAttributes.includes(value)
        return {
          ...item,
          dietaryAttributes: active
            ? item.dietaryAttributes.filter((attribute) => attribute !== value)
            : [...item.dietaryAttributes, value],
        }
      }),
    }))
    setStorageError('')
    setConfirmed(false)
  }

  const addEvidence = (files) => {
    const additions = Array.from(files).map((file) => ({
      id: globalThis.crypto?.randomUUID?.() ?? `proof-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: file.type.startsWith('image/') ? 'photo' : 'packing_list',
      file,
      errors: validateEvidence(file),
    }))
    setEvidence((current) => [...current, ...additions])
    setStorageError('')
    setConfirmed(false)
  }

  const updateEvidenceType = (id, type) => {
    setEvidence((current) => current.map((entry) => entry.id === id ? { ...entry, type } : entry))
    setConfirmed(false)
  }

  const removeEvidence = (id) => {
    setEvidence((current) => current.filter((entry) => entry.id !== id))
    setStorageError('')
    setConfirmed(false)
  }

  const submit = async () => {
    const result = validateDraft(draft, language)
    if (!result.valid) {
      const firstInvalid = copy.steps.findIndex(({ key }) => key === result.invalidSteps[0])
      setStep(firstInvalid)
      setErrors(result.errors[result.invalidSteps[0]])
      focusFirstError()
      return
    }
    if (!confirmed) return

    const invalidEvidence = evidence.find((entry) => Object.keys(entry.errors).length)
    if (invalidEvidence) {
      setStorageError(invalidEvidence.errors.size
        ? copy.review.evidenceTooLarge
        : copy.review.evidenceUnsupported)
      return
    }

    setSaving(true)
    try {
      const result = await submitInKindShipment({ client: supabase, draft, evidence })
      window.localStorage.removeItem(DRAFT_KEY)
      setReference(result.reference_code)
    } catch (error) {
      reportClientError({
        message: error.message,
        context: 'in_kind_submission:' + (error.stage ?? 'unknown'),
      })
      setStorageError(copy.submissionErrors[error.stage] ?? copy.submissionErrors.default)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setDraft(createInitialDraft())
    setStep(0)
    setHighestStep(0)
    setErrors({})
    setConfirmed(false)
    setStorageError('')
    setReference('')
    setEvidence([])
  }

  if (access.status !== 'authorized') {
    return (
      <OperatorAccessScreen
        access={access}
        copy={copy}
        language={language}
        onLanguageChange={() => setLanguage((current) => current === 'es' ? 'en' : 'es')}
      />
    )
  }

  if (reference) {
    return (
      <main className="intake-success">
        <div className="success-card">
          <Brand />
          <span className="success-icon"><Check /></span>
          <p className="intake-eyebrow">{copy.success.eyebrow}</p>
          <h1>{copy.success.title}</h1>
          <p>{copy.success.copy}</p>
          <div className="reference-card">
            <span>{copy.success.reference}</span>
            <strong>{reference}</strong>
          </div>
          <p className="success-note">{copy.success.note}</p>
          <div className="success-actions">
            <button className="intake-button primary" type="button" onClick={reset}>{copy.actions.startAnother}</button>
            <a className="intake-button secondary" href="/">{copy.actions.home}</a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="intake-shell">
      <header className="intake-header">
        <a href="/" aria-label={copy.backHome}><Brand /></a>
        <div className="intake-header-actions">
          <span className={savedPulse ? 'save-state pulse' : 'save-state'}><Check /> {copy.draftSaved}</span>
          <button className="operator-signout" type="button" onClick={access.signOut} title={access.email}>
            {copy.auth.signOut}
          </button>
          <button
            className="intake-language"
            type="button"
            aria-label={copy.languageLabel}
            onClick={() => setLanguage((current) => current === 'es' ? 'en' : 'es')}
          >
            <b>{copy.languageCurrent}</b><span>/</span>{copy.languageAlternate}
          </button>
        </div>
      </header>

      <main className="intake-main">
        <a className="intake-back-home" href="/"><ArrowLeft /> {copy.backHome}</a>
        <div className="intake-heading">
          <p className="intake-eyebrow"><span />{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <nav className="intake-steps" aria-label={copy.stepsLabel}>
          {copy.steps.map((item, index) => (
            <button
              key={item.key}
              type="button"
              className={index === step ? 'active' : index < step ? 'complete' : ''}
              aria-current={index === step ? 'step' : undefined}
              disabled={index > highestStep}
              onClick={() => goToStep(index)}
            >
              <span>{index < step ? <Check /> : index + 1}</span>
              <span><b>{item.short}</b><small>{item.label}</small></span>
            </button>
          ))}
        </nav>

        <form className="intake-form" onSubmit={(event) => event.preventDefault()}>
          <section className="intake-card" aria-labelledby={`step-${currentKey}`}>
            {currentKey === 'origin' && (
              <>
                <div className="step-heading">
                  <span className="step-icon"><Package /></span>
                  <div>
                    <h2 id="step-origin" ref={headingRef} tabIndex="-1">{copy.origin.title}</h2>
                    <p>{copy.origin.help}</p>
                  </div>
                </div>
                <p className="required-note">{copy.requiredNote}</p>
                <div className="field-grid">
                  <Field label={copy.origin.senderName} error={errors.senderName} className="wide">
                    <TextInput
                      value={draft.senderName}
                      error={errors.senderName}
                      placeholder={copy.origin.senderPlaceholder}
                      onChange={(event) => updateDraft('senderName', event.target.value)}
                      autoComplete="organization"
                    />
                  </Field>
                  <Field label={copy.origin.senderType}>
                    <SelectInput value={draft.senderType} onChange={(event) => updateDraft('senderType', event.target.value)}>
                      <option value="organization">{copy.origin.organization}</option>
                      <option value="individual">{copy.origin.individual}</option>
                    </SelectInput>
                  </Field>
                  <Field label={copy.origin.senderContact} hint={copy.origin.senderContactHint}>
                    <TextInput
                      value={draft.senderContact}
                      onChange={(event) => updateDraft('senderContact', event.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label={copy.origin.originCountry} error={errors.originCountry}>
                    <TextInput
                      value={draft.originCountry}
                      error={errors.originCountry}
                      placeholder={copy.origin.originCountryPlaceholder}
                      onChange={(event) => updateDraft('originCountry', event.target.value)}
                      autoComplete="country-name"
                    />
                  </Field>
                  <Field label={copy.origin.originCity}>
                    <TextInput
                      value={draft.originCity}
                      placeholder={copy.origin.originCityPlaceholder}
                      onChange={(event) => updateDraft('originCity', event.target.value)}
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label={copy.origin.destinationCountry} error={errors.destinationCountry}>
                    <TextInput
                      value={draft.destinationCountry}
                      error={errors.destinationCountry}
                      onChange={(event) => updateDraft('destinationCountry', event.target.value)}
                      autoComplete="country-name"
                    />
                  </Field>
                  <Field label={copy.origin.destinationCity}>
                    <TextInput
                      value={draft.destinationCity}
                      placeholder={copy.origin.destinationCityPlaceholder}
                      onChange={(event) => updateDraft('destinationCity', event.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}

            {currentKey === 'shipment' && (
              <>
                <div className="step-heading">
                  <span className="step-icon"><Package /></span>
                  <div>
                    <h2 id="step-shipment" ref={headingRef} tabIndex="-1">{copy.shipment.title}</h2>
                    <p>{copy.shipment.help}</p>
                  </div>
                </div>
                <p className="required-note">{copy.requiredNote}</p>
                <Field label={copy.shipment.transportMode} error={errors.transportMode} className="wide">
                  <div className="choice-grid">
                    {Object.entries(copy.shipment.modes).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={draft.transportMode === value ? 'selected' : ''}
                        aria-pressed={draft.transportMode === value}
                        onClick={() => updateDraft('transportMode', value)}
                      >{label}</button>
                    ))}
                  </div>
                </Field>
                <div className="field-grid">
                  {draft.transportMode === 'sea' && (
                    <Field label={copy.shipment.containerNumber}>
                      <TextInput
                        value={draft.containerNumber}
                        placeholder={copy.shipment.containerPlaceholder}
                        onChange={(event) => updateDraft('containerNumber', event.target.value.toUpperCase())}
                      />
                    </Field>
                  )}
                  <Field label={copy.shipment.trackingNumber}>
                    <TextInput
                      value={draft.trackingNumber}
                      placeholder={copy.shipment.trackingPlaceholder}
                      onChange={(event) => updateDraft('trackingNumber', event.target.value)}
                    />
                  </Field>
                  <Field label={copy.shipment.departureDate}>
                    <TextInput type="date" value={draft.departureDate} onChange={(event) => updateDraft('departureDate', event.target.value)} />
                  </Field>
                  <Field label={copy.shipment.estimatedArrival} error={errors.estimatedArrival}>
                    <TextInput type="date" value={draft.estimatedArrival} error={errors.estimatedArrival} onChange={(event) => updateDraft('estimatedArrival', event.target.value)} />
                  </Field>
                  <Field label={copy.shipment.actualArrival} error={errors.actualArrival}>
                    <TextInput type="date" value={draft.actualArrival} error={errors.actualArrival} onChange={(event) => updateDraft('actualArrival', event.target.value)} />
                  </Field>
                  <Field label={copy.shipment.status}>
                    <SelectInput value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                      {Object.entries(copy.shipment.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </SelectInput>
                  </Field>
                  <Field label={copy.shipment.notes} className="wide">
                    <textarea value={draft.notes} placeholder={copy.shipment.notesPlaceholder} onChange={(event) => updateDraft('notes', event.target.value)} />
                  </Field>
                </div>
              </>
            )}

            {currentKey === 'items' && (
              <>
                <div className="step-heading items-heading">
                  <span className="step-icon"><Package /></span>
                  <div>
                    <h2 id="step-items" ref={headingRef} tabIndex="-1">{copy.items.title}</h2>
                    <p>{copy.items.help}</p>
                  </div>
                  <span className="item-count">{copy.items.count(draft.items.length)}</span>
                </div>
                <p className="required-note">{copy.requiredNote}</p>
                {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
                <div className="item-list">
                  {draft.items.map((item, index) => {
                    const itemErrors = errors.items?.[index] ?? {}
                    return (
                      <article className="item-card" key={item.id}>
                        <div className="item-card-head">
                          <div><span>{index + 1}</span><h3>{copy.items.item} {index + 1}</h3></div>
                          {draft.items.length > 1 && (
                            <button className="remove-item" type="button" onClick={() => removeItem(item.id)}><Trash /> {copy.items.remove}</button>
                          )}
                        </div>
                        <div className="field-grid">
                          <Field label={copy.items.description} error={itemErrors.description} className="wide">
                            <TextInput
                              value={item.description}
                              error={itemErrors.description}
                              placeholder={copy.items.descriptionPlaceholder}
                              onChange={(event) => updateItem(item.id, 'description', event.target.value)}
                            />
                          </Field>
                          <Field label={copy.items.category} error={itemErrors.category}>
                            <SelectInput value={item.category} error={itemErrors.category} onChange={(event) => updateItem(item.id, 'category', event.target.value)}>
                              <option value="">—</option>
                              {Object.entries(copy.items.categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </SelectInput>
                          </Field>
                          <Field label={copy.items.quantity} error={itemErrors.declaredQuantity}>
                            <TextInput
                              type="number"
                              min="0"
                              step="0.001"
                              inputMode="decimal"
                              value={item.declaredQuantity}
                              error={itemErrors.declaredQuantity}
                              onChange={(event) => updateItem(item.id, 'declaredQuantity', event.target.value)}
                            />
                          </Field>
                          <Field label={copy.items.unit} error={itemErrors.unit}>
                            <SelectInput value={item.unit} error={itemErrors.unit} onChange={(event) => updateItem(item.id, 'unit', event.target.value)}>
                              <option value="">—</option>
                              {Object.entries(copy.items.units).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </SelectInput>
                          </Field>
                          <Field label={copy.items.value} error={itemErrors.referenceValue} hint={copy.items.valueHint}>
                            <div className="money-field">
                              <SelectInput aria-label={copy.items.currency} value={item.referenceCurrency} onChange={(event) => updateItem(item.id, 'referenceCurrency', event.target.value)}>
                                <option value="EUR">EUR</option><option value="USD">USD</option><option value="VES">VES</option>
                              </SelectInput>
                              <TextInput
                                aria-label={copy.items.value}
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={item.referenceValue}
                                error={itemErrors.referenceValue}
                                onChange={(event) => updateItem(item.id, 'referenceValue', event.target.value)}
                              />
                            </div>
                          </Field>
                        </div>

                        {item.category === 'food' && (
                          <div className="food-panel">
                            <h4>{copy.items.foodDetails}</h4>
                            <label className="check-field">
                              <input
                                type="checkbox"
                                checked={item.dietaryAttributes.includes('gluten_free')}
                                onChange={() => toggleDietary(item.id, 'gluten_free')}
                              />
                              <span><Check /></span>{copy.items.glutenFree}
                            </label>
                            <div className="field-grid">
                              <Field label={copy.items.lotCode}>
                                <TextInput value={item.lotCode} onChange={(event) => updateItem(item.id, 'lotCode', event.target.value)} />
                              </Field>
                              <Field label={copy.items.expiryDate}>
                                <TextInput type="date" value={item.expiryDate} onChange={(event) => updateItem(item.id, 'expiryDate', event.target.value)} />
                              </Field>
                              <Field label={copy.items.allergens} className="wide">
                                <TextInput value={item.allergens} placeholder={copy.items.allergensPlaceholder} onChange={(event) => updateItem(item.id, 'allergens', event.target.value)} />
                              </Field>
                            </div>
                          </div>
                        )}

                        <details className="item-details">
                          <summary>{copy.items.extraDetails}</summary>
                          <Field label={copy.items.notes}>
                            <textarea value={item.notes} placeholder={copy.items.notesPlaceholder} onChange={(event) => updateItem(item.id, 'notes', event.target.value)} />
                          </Field>
                        </details>
                      </article>
                    )
                  })}
                </div>
                <button className="add-item" type="button" onClick={addItem}><Plus /> {copy.items.add}</button>
              </>
            )}

            {currentKey === 'review' && (
              <>
                <div className="step-heading">
                  <span className="step-icon"><Check /></span>
                  <div>
                    <h2 id="step-review" ref={headingRef} tabIndex="-1">{copy.review.title}</h2>
                    <p>{copy.review.help}</p>
                  </div>
                </div>
                <div className="review-list">
                  <section className="review-section">
                    <div className="review-head"><h3>{copy.review.origin}</h3><button type="button" onClick={() => goToStep(0)}>{copy.review.edit}</button></div>
                    <dl>
                      <div><dt>{copy.review.sender}</dt><dd>{draft.senderName}</dd></div>
                      <div><dt>{copy.review.routeLabel}</dt><dd>{draft.originCity ? `${draft.originCity}, ` : ''}{draft.originCountry} → {draft.destinationCity ? `${draft.destinationCity}, ` : ''}{draft.destinationCountry}</dd></div>
                    </dl>
                  </section>
                  <section className="review-section">
                    <div className="review-head"><h3>{copy.review.route}</h3><button type="button" onClick={() => goToStep(1)}>{copy.review.edit}</button></div>
                    <dl>
                      <div><dt>{copy.review.transport}</dt><dd>{copy.shipment.modes[draft.transportMode]}</dd></div>
                      <div><dt>{copy.review.eta}</dt><dd>{draft.estimatedArrival}</dd></div>
                      {draft.containerNumber && <div><dt>{copy.review.container}</dt><dd>{draft.containerNumber}</dd></div>}
                    </dl>
                  </section>
                  <section className="review-section goods-review">
                    <div className="review-head"><h3>{copy.review.goods}</h3><button type="button" onClick={() => goToStep(2)}>{copy.review.edit}</button></div>
                    <p className="goods-total">{copy.items.count(draft.items.length)}</p>
                    {draft.items.map((item) => (
                      <article key={item.id}>
                        <span className="review-category">{copy.items.categories[item.category]}</span>
                        <h4>{item.description}</h4>
                        <p>{item.declaredQuantity} {copy.items.units[item.unit]}</p>
                        {item.referenceValue && <small>{copy.review.referenceValue}: {item.referenceCurrency} {Number(item.referenceValue).toLocaleString(language, { minimumFractionDigits: 2 })}</small>}
                        {item.dietaryAttributes.includes('gluten_free') && <span className="dietary-badge"><Check /> {copy.review.glutenFree}</span>}
                      </article>
                    ))}
                  </section>
                </div>
                <section className="evidence-panel" aria-labelledby="evidence-title">
                  <div className="evidence-heading">
                    <div>
                      <h3 id="evidence-title">{copy.review.evidence}</h3>
                      <p>{copy.review.evidenceHelp}</p>
                    </div>
                    <span>{evidence.length}</span>
                  </div>
                  <p className="evidence-formats">{copy.review.evidenceFormats}</p>
                  <label className="evidence-add" htmlFor={evidenceInputId}>
                    <Plus /> {copy.review.evidenceAdd}
                  </label>
                  <input
                    className="evidence-input"
                    id={evidenceInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    onChange={(event) => {
                      addEvidence(event.target.files)
                      event.target.value = ''
                    }}
                  />
                  {evidence.length > 0 && (
                    <div className="evidence-list">
                      {evidence.map((entry) => (
                        <article key={entry.id}>
                          <div className="evidence-file">
                            <strong>{entry.file.name}</strong>
                            <span>{(entry.file.size / 1024 / 1024).toLocaleString(language, { maximumFractionDigits: 1 })} MB</span>
                            {entry.errors.type && <small role="alert">{copy.review.evidenceUnsupported}</small>}
                            {entry.errors.size && <small role="alert">{copy.review.evidenceTooLarge}</small>}
                          </div>
                          <label>
                            <span>{copy.review.evidenceType}</span>
                            <select value={entry.type} onChange={(event) => updateEvidenceType(entry.id, event.target.value)}>
                              {Object.entries(copy.review.evidenceTypes).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                          <button type="button" onClick={() => removeEvidence(entry.id)}>
                            <Trash /> {copy.review.evidenceRemove}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  <p className="evidence-session">{copy.review.evidenceSession}</p>
                </section>
                <label className="confirmation-field">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  <span><Check /></span><b>{copy.review.confirmation}</b>
                </label>
                {storageError && <p className="form-error" role="alert">{storageError}</p>}
              </>
            )}
          </section>

          <div className="intake-actions">
            {step > 0 ? <button className="intake-button secondary" type="button" onClick={goBack}><ArrowLeft /> {copy.actions.back}</button> : <span />}
            {step < 3 ? (
              <button className="intake-button primary" type="button" onClick={goNext}>
                {step === 2 ? copy.actions.review : copy.actions.continue} <ArrowRight />
              </button>
            ) : (
              <button className="intake-button primary" type="button" disabled={!confirmed || saving} onClick={submit}>
                {saving ? copy.actions.saving : copy.actions.save} {!saving && <Check />}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}

export default InKindDonationFlow
