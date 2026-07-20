import { cloneElement, isValidElement, useEffect, useId, useState } from 'react'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import { supabase } from '../../lib/supabase.js'
import { monetaryContent } from './monetaryContent.js'
import {
  createInitialMonetaryDraft,
  calculateUsdBaseAmount,
  validateMonetaryDraft,
} from './validation.js'
import { submitMonetaryDonation, validateMonetaryEvidence } from './submission.js'
import '../in-kind/in-kind.css'
import './monetary.css'

const DRAFT_KEY = 'edifica-monetary-draft-v1'

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 3.5 3.5L16 5.5" /></svg>
)

const ArrowLeft = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5" /></svg>
)

const Paperclip = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12.5 5.7-5.7a3.2 3.2 0 0 1 4.5 4.5l-7.6 7.6a5 5 0 0 1-7.1-7.1l7.4-7.4" /></svg>
)

const Trash = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M9 9v4m2-4v4" /></svg>
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
  const descriptionId = error || hint ? `${fieldId}-description` : undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
      id: children.props.id ?? fieldId,
      'aria-describedby': descriptionId,
      'aria-invalid': Boolean(error),
    })
    : children

  return (
    <div className={`intake-field ${className}`}>
      <label htmlFor={fieldId}>{label}</label>
      {control}
      {error
        ? <p className="field-error" id={descriptionId} role="alert">{error}</p>
        : hint ? <p className="field-hint" id={descriptionId}>{hint}</p> : null}
    </div>
  )
}

function loadLanguage() {
  try {
    return window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

function loadDraft() {
  try {
    const saved = window.localStorage.getItem(DRAFT_KEY)
    return saved ? { ...createInitialMonetaryDraft(), ...JSON.parse(saved) } : createInitialMonetaryDraft()
  } catch {
    return createInitialMonetaryDraft()
  }
}

function MonetarySection({ section, children }) {
  return (
    <section className="monetary-section">
      <header>
        <span>{section.number}</span>
        <div><h2>{section.title}</h2><p>{section.help}</p></div>
      </header>
      {children}
    </section>
  )
}

export default function MonetaryDonationFlow() {
  const [language, setLanguage] = useState(loadLanguage)
  const [draft, setDraft] = useState(loadDraft)
  const [errors, setErrors] = useState({})
  const [evidence, setEvidence] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [reference, setReference] = useState('')
  const [savedPulse, setSavedPulse] = useState(false)
  const evidenceInputId = useId()
  const access = useOperatorAccess()
  const copy = monetaryContent[language]
  const calculatedBase = calculateUsdBaseAmount(draft.originAmount, draft.exchangeRateToUsd)
  const isInstitutionalMethod = ['bank_transfer', 'mobile_payment'].includes(draft.paymentMethod)
  const requiresReference = draft.paymentMethod !== 'cash'

  useEffect(() => {
    document.documentElement.lang = language
    document.title = copy.metaTitle
    try {
      window.localStorage.setItem('edifica-language', language)
    } catch {
      // The current language remains active for this session.
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

  const updateDraft = (field, value) => {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (field === 'originCurrency') {
        if (value === 'USD') {
          next.exchangeRateToUsd = '1'
          next.usdBaseAmount = next.originAmount
          next.exchangeRateSource = ''
          next.exchangeRateDate = ''
        } else if (current.originCurrency === 'USD') {
          next.exchangeRateToUsd = ''
          next.usdBaseAmount = ''
        }
      }
      if (field === 'originAmount' && next.originCurrency === 'USD') {
        next.usdBaseAmount = value
        next.exchangeRateToUsd = '1'
      }
      return next
    })
    setErrors((current) => ({ ...current, [field]: undefined }))
    setMessage('')
  }

  const addEvidence = (files) => {
    const additions = Array.from(files).map((file) => ({
      id: globalThis.crypto?.randomUUID?.() ?? `proof-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'proof_of_payment',
      file,
      errors: validateMonetaryEvidence(file),
    }))
    setEvidence((current) => [...current, ...additions])
    setMessage('')
  }

  const removeEvidence = (id) => {
    setEvidence((current) => current.filter((entry) => entry.id !== id))
    setMessage('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const result = validateMonetaryDraft(draft, language)
    if (!result.valid) {
      setErrors(result.errors)
      window.setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 20)
      return
    }

    if (evidence.length === 0) {
      setMessage(copy.evidence.required)
      document.getElementById(evidenceInputId)?.focus()
      return
    }

    const invalidEvidence = evidence.find((entry) => Object.keys(entry.errors).length)
    if (invalidEvidence) {
      setMessage(invalidEvidence.errors.size ? copy.evidence.tooLarge : copy.evidence.unsupported)
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const result = await submitMonetaryDonation({ client: supabase, draft, evidence })
      window.localStorage.removeItem(DRAFT_KEY)
      setReference(result.reference_code)
    } catch (error) {
      setMessage(copy.submissionErrors[error.stage] ?? copy.submissionErrors.default)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setDraft(createInitialMonetaryDraft())
    setErrors({})
    setEvidence([])
    setMessage('')
    setReference('')
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
          <div className="reference-card"><span>{copy.success.reference}</span><strong>{reference}</strong></div>
          <p className="success-note">{copy.success.note}</p>
          <div className="success-actions">
            <button className="intake-button primary" type="button" onClick={reset}>{copy.actions.another}</button>
            <a className="intake-button secondary" href="/">{copy.actions.home}</a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="intake-shell monetary-shell">
      <header className="intake-header">
        <a href="/" aria-label={copy.backHome}><Brand /></a>
        <div className="intake-header-actions">
          <span className={savedPulse ? 'save-state pulse' : 'save-state'}><Check /> {copy.draftSaved}</span>
          <button className="operator-signout" type="button" onClick={access.signOut}>{copy.auth.signOut}</button>
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

      <main className="intake-main monetary-main">
        <a className="intake-back-home" href="/"><ArrowLeft /> {copy.backHome}</a>
        <div className="intake-heading">
          <p className="intake-eyebrow"><span />{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
          <small className="monetary-required">{copy.requiredNote}</small>
        </div>

        <form className="monetary-form" onSubmit={submit}>
          <MonetarySection section={copy.sections.donor}>
            <div className="monetary-grid">
              <Field label={copy.fields.donorName} error={errors.donorName} className="wide">
                <input value={draft.donorName} onChange={(event) => updateDraft('donorName', event.target.value)} placeholder={copy.fields.donorNamePlaceholder} autoComplete="name" />
              </Field>
              <Field label={copy.fields.donorType}>
                <select value={draft.donorType} onChange={(event) => updateDraft('donorType', event.target.value)}>
                  <option value="person">{copy.fields.person}</option>
                  <option value="organization">{copy.fields.organization}</option>
                </select>
              </Field>
              <Field label={copy.fields.donorContact} hint={copy.fields.donorContactHint}>
                <input value={draft.donorContact} onChange={(event) => updateDraft('donorContact', event.target.value)} autoComplete="email" />
              </Field>
              <label className="monetary-check wide">
                <input type="checkbox" checked={draft.isAnonymous} onChange={(event) => updateDraft('isAnonymous', event.target.checked)} />
                <span><i><Check /></i>{copy.fields.anonymous}</span>
              </label>
            </div>
          </MonetarySection>

          <MonetarySection section={copy.sections.receipt}>
            <div className="monetary-grid">
              <Field label={copy.fields.receivedAt} error={errors.receivedAt}>
                <input type="datetime-local" value={draft.receivedAt} onChange={(event) => updateDraft('receivedAt', event.target.value)} />
              </Field>
              <Field label={copy.fields.paymentMethod} error={errors.paymentMethod}>
                <select value={draft.paymentMethod} onChange={(event) => updateDraft('paymentMethod', event.target.value)}>
                  {Object.entries(copy.methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label={copy.fields.originAmount} error={errors.originAmount}>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.originAmount} onChange={(event) => updateDraft('originAmount', event.target.value)} />
              </Field>
              <Field label={copy.fields.originCurrency} error={errors.originCurrency}>
                <select value={draft.originCurrency} onChange={(event) => updateDraft('originCurrency', event.target.value)}>
                  {Object.entries(copy.currencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              {isInstitutionalMethod && (
                <>
                  <Field label={copy.fields.senderInstitution} error={errors.senderInstitution}>
                    <input value={draft.senderInstitution} onChange={(event) => updateDraft('senderInstitution', event.target.value)} placeholder={copy.fields.senderInstitutionPlaceholder} />
                  </Field>
                  <Field label={copy.fields.receiverAccountLabel} error={errors.receiverAccountLabel}>
                    <input value={draft.receiverAccountLabel} onChange={(event) => updateDraft('receiverAccountLabel', event.target.value)} placeholder={copy.fields.receiverAccountPlaceholder} />
                  </Field>
                </>
              )}
              {requiresReference && (
                <Field label={copy.fields.transactionReference} error={errors.transactionReference} className="wide">
                  <input value={draft.transactionReference} onChange={(event) => updateDraft('transactionReference', event.target.value)} placeholder={copy.fields.transactionReferencePlaceholder} />
                </Field>
              )}
            </div>
          </MonetarySection>

          <MonetarySection section={copy.sections.reporting}>
            <div className="monetary-grid">
              <Field label={copy.fields.exchangeRate} error={errors.exchangeRateToUsd}>
                <input type="number" min="0" step="0.0000000001" inputMode="decimal" value={draft.exchangeRateToUsd} onChange={(event) => updateDraft('exchangeRateToUsd', event.target.value)} readOnly={draft.originCurrency === 'USD'} />
              </Field>
              <Field label={copy.fields.usdBaseAmount} error={errors.usdBaseAmount}>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.usdBaseAmount} onChange={(event) => updateDraft('usdBaseAmount', event.target.value)} />
              </Field>
              {draft.originCurrency !== 'USD' && (
                <>
                  <div className="conversion-preview wide" aria-live="polite">
                    <div><span>{copy.fields.calculated}</span><strong>{calculatedBase ? `USD ${calculatedBase}` : '—'}</strong></div>
                    <button type="button" disabled={!calculatedBase} onClick={() => updateDraft('usdBaseAmount', calculatedBase)}>{copy.fields.applyCalculation}</button>
                  </div>
                  <Field label={copy.fields.exchangeRateSource} error={errors.exchangeRateSource}>
                    <input value={draft.exchangeRateSource} onChange={(event) => updateDraft('exchangeRateSource', event.target.value)} placeholder={copy.fields.exchangeRateSourcePlaceholder} />
                  </Field>
                  <Field label={copy.fields.exchangeRateDate} error={errors.exchangeRateDate}>
                    <input type="date" value={draft.exchangeRateDate} onChange={(event) => updateDraft('exchangeRateDate', event.target.value)} />
                  </Field>
                </>
              )}
              <Field label={copy.fields.notes} className="wide">
                <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder={copy.fields.notesPlaceholder} />
              </Field>
            </div>
          </MonetarySection>

          <MonetarySection section={copy.sections.evidence}>
            <div className="evidence-panel monetary-evidence">
              <div className="evidence-heading">
                <div><h3>{copy.evidence.add}</h3><p>{copy.evidence.formats}</p></div>
                <span><Paperclip /></span>
              </div>
              <p className="evidence-session">{copy.evidence.session}</p>
              <label className="evidence-add" htmlFor={evidenceInputId}><Paperclip /> {copy.evidence.add}</label>
              <input
                className="evidence-input"
                id={evidenceInputId}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
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
                        <span>{(entry.file.size / 1024 / 1024).toFixed(2)} MB</span>
                        {entry.errors.type && <small>{copy.evidence.unsupported}</small>}
                        {entry.errors.size && <small>{copy.evidence.tooLarge}</small>}
                      </div>
                      <label>
                        <span>{copy.evidence.type}</span>
                        <select value={entry.type} onChange={(event) => setEvidence((current) => current.map((item) => item.id === entry.id ? { ...item, type: event.target.value } : item))}>
                          {Object.entries(copy.evidence.types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={() => removeEvidence(entry.id)} aria-label={`${copy.evidence.remove}: ${entry.file.name}`}><Trash /> {copy.evidence.remove}</button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <label className="monetary-check verification-check">
              <input type="checkbox" checked={draft.verificationAccepted} onChange={(event) => updateDraft('verificationAccepted', event.target.checked)} aria-invalid={Boolean(errors.verificationAccepted)} />
              <span><i><Check /></i>{copy.fields.verification}</span>
            </label>
            {errors.verificationAccepted && <p className="field-error" role="alert">{errors.verificationAccepted}</p>}
            {message && <p className="monetary-message" role="alert">{message}</p>}
          </MonetarySection>

          <div className="monetary-submit">
            <button className="intake-button primary" type="submit" disabled={saving}>
              {saving ? copy.actions.saving : copy.actions.save}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

