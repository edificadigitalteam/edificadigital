import { useEffect, useId, useState } from 'react'
import DonorPicker from '../donors/DonorPicker.jsx'
import { useToast } from '../notifications/ToastProvider.jsx'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import { calculateUsdBaseAmount, createInitialMonetaryDraft, validateMonetaryDraft } from './validation.js'
import { submitMonetaryDonation, validateMonetaryEvidence } from './submission.js'
import '../in-kind/in-kind.css'
import './monetary.css'
import './unified-monetary.css'

const DRAFT_KEY = 'edifica-monetary-draft-v4'

const content = {
  es: {
    metaTitle: 'Nueva donación monetaria | Edifica', back: 'Volver al panel', draftSaved: 'Borrador guardado', signOut: 'Usar otra cuenta',
    eyebrow: 'RECEPCIÓN DE FONDOS', title: 'Nueva donación monetaria',
    intro: 'Registra el ingreso, vincúlalo al proyecto financiado y adjunta el comprobante en una sola pantalla.',
    required: 'Los campos marcados con * son obligatorios.', completed: 'REGISTRO COMPLETADO', reference: 'Referencia',
    sections: {
      donor: ['01', 'Aliado o donante y proyecto', 'Busca un registro existente o crea uno rápidamente y vincula el ingreso al proyecto correspondiente.'],
      receipt: ['02', 'Fondos recibidos', 'Registra el monto, moneda, fecha y método de recepción.'],
      conversion: ['03', 'Conversión y conciliación', 'Conserva la base de reporte en USD y los datos de la transacción.'],
      evidence: ['04', 'Comprobante y confirmación', 'Adjunta el soporte de pago y confirma la revisión del registro.'],
    },
    successTitle: 'Donación monetaria registrada', successCopy: 'El ingreso quedó guardado y asociado al contexto operativo seleccionado.', another: 'Registrar otra donación', panel: 'Volver al panel',
    evidenceDescription: 'PDF, JPG, PNG o WebP · máximo 20 MB',
    errors: { organization: 'Selecciona la organización responsable.', evidenceRequired: 'Adjunta al menos un comprobante.', evidenceInvalid: 'Revisa el formato o tamaño del comprobante.', default: 'No fue posible guardar la donación.' },
  },
  en: {
    metaTitle: 'New monetary donation | Edifica', back: 'Back to dashboard', draftSaved: 'Draft saved', signOut: 'Use another account',
    eyebrow: 'FUNDS INTAKE', title: 'New monetary donation',
    intro: 'Record the income, link it to the funded project, and attach the payment evidence on one screen.',
    required: 'Fields marked with * are required.', completed: 'RECORD COMPLETED', reference: 'Reference',
    sections: {
      donor: ['01', 'Partner or donor and project', 'Search for an existing record or create one quickly and link the income to the corresponding project.'],
      receipt: ['02', 'Funds received', 'Record the amount, currency, date, and receipt method.'],
      conversion: ['03', 'Conversion and reconciliation', 'Keep the USD reporting base and transaction data.'],
      evidence: ['04', 'Evidence and confirmation', 'Attach payment evidence and confirm the review.'],
    },
    successTitle: 'Monetary donation registered', successCopy: 'The income was saved and linked to the selected operational context.', another: 'Register another donation', panel: 'Back to dashboard',
    evidenceDescription: 'PDF, JPG, PNG, or WebP · 20 MB maximum',
    errors: { organization: 'Select the responsible organization.', evidenceRequired: 'Attach at least one payment document.', evidenceInvalid: 'Review the evidence format or size.', default: 'The donation could not be saved.' },
  },
}

const labels = {
  es: {
    organization: 'Organización *', project: 'Proyecto financiado', receivedAt: 'Fecha y hora de recepción *', paymentMethod: 'Método de recepción *', amount: 'Monto recibido *', currency: 'Moneda *',
    senderInstitution: 'Institución emisora *', receiverAccount: 'Cuenta o institución receptora *', reference: 'Referencia de transacción *',
    rate: 'Tasa hacia USD *', baseUsd: 'Base de reporte USD *', rateSource: 'Fuente de la tasa *', rateDate: 'Fecha de la tasa *',
    notes: 'Observaciones', files: 'Comprobantes', addFiles: 'Agregar comprobantes', confirmation: 'Confirmo que revisé el monto, la tasa y los comprobantes.',
    noProject: 'Sin proyecto específico', select: 'Seleccionar', calculated: 'Base calculada', remove: 'Eliminar', submit: 'Registrar donación', saving: 'Guardando…',
  },
  en: {
    organization: 'Organization *', project: 'Funded project', receivedAt: 'Receipt date and time *', paymentMethod: 'Receipt method *', amount: 'Amount received *', currency: 'Currency *',
    senderInstitution: 'Sending institution *', receiverAccount: 'Receiving account or institution *', reference: 'Transaction reference *',
    rate: 'Rate to USD *', baseUsd: 'USD reporting base *', rateSource: 'Rate source *', rateDate: 'Rate date *',
    notes: 'Notes', files: 'Payment evidence', addFiles: 'Add evidence', confirmation: 'I confirm that I reviewed the amount, rate, and evidence.',
    noProject: 'No specific project', select: 'Select', calculated: 'Calculated base', remove: 'Remove', submit: 'Register donation', saving: 'Saving…',
  },
}

const paymentMethods = {
  es: { cash: 'Efectivo', bank_transfer: 'Transferencia bancaria', mobile_payment: 'Pago móvil', digital_wallet: 'Billetera digital', crypto: 'Criptoactivo', other: 'Otro' },
  en: { cash: 'Cash', bank_transfer: 'Bank transfer', mobile_payment: 'Mobile payment', digital_wallet: 'Digital wallet', crypto: 'Crypto', other: 'Other' },
}

function loadLanguage() { try { return window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function loadDraft() { try { const saved = window.localStorage.getItem(DRAFT_KEY); return saved ? { ...createInitialMonetaryDraft(), ...JSON.parse(saved) } : createInitialMonetaryDraft() } catch { return createInitialMonetaryDraft() } }
function Brand() { return <span className="intake-brand"><span className="intake-brand-mark" aria-hidden="true"><i /><i /><i /></span><span>edifica<span>digital</span></span></span> }
function Section({ data, children }) { return <section className="monetary-section unified-monetary-section"><header><span>{data[0]}</span><div><h2>{data[1]}</h2><p>{data[2]}</p></div></header>{children}</section> }
function Field({ label, error, children, className = '' }) { return <label className={`intake-field ${className}`}><span className="field-label">{label}</span>{children}{error && <p className="field-error">{error}</p>}</label> }

export default function UnifiedMonetaryDonationFlow() {
  const access = useOperatorAccess()
  const { notify } = useToast()
  const [language, setLanguage] = useState(loadLanguage)
  const [draft, setDraft] = useState(loadDraft)
  const [organizations, setOrganizations] = useState([])
  const [projects, setProjects] = useState([])
  const [evidence, setEvidence] = useState([])
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [reference, setReference] = useState('')
  const [savedPulse, setSavedPulse] = useState(false)
  const evidenceInputId = useId()
  const copy = content[language]
  const field = labels[language]
  const institutionalMethod = ['bank_transfer', 'mobile_payment'].includes(draft.paymentMethod)
  const referenceRequired = draft.paymentMethod !== 'cash'
  const calculatedBase = calculateUsdBaseAmount(draft.originAmount, draft.exchangeRateToUsd)

  useEffect(() => { document.documentElement.lang = language; document.title = copy.metaTitle; window.localStorage.setItem('edifica-language', language) }, [copy.metaTitle, language])

  useEffect(() => {
    if (access.status !== 'authorized') return
    setDraft((current) => ({ ...current, organizationId: current.organizationId || access.organizationId || '' }))
    const loadRelations = async () => {
      if (access.role === 'super_admin') { const { data } = await supabase.rpc('admin_list_organizations'); setOrganizations(data ?? []) }
      const { data } = await supabase.from('project').select('id, name, code, organization_id').order('name')
      setProjects(data ?? [])
    }
    loadRelations()
  }, [access.organizationId, access.role, access.status])

  useEffect(() => {
    const timer = window.setTimeout(() => { try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); setSavedPulse(true); window.setTimeout(() => setSavedPulse(false), 900) } catch { setSavedPulse(false) } }, 250)
    return () => window.clearTimeout(timer)
  }, [draft])

  const update = (name, value) => {
    setDraft((current) => {
      const next = { ...current, [name]: value }
      if (name === 'originCurrency') {
        if (value === 'USD') { next.exchangeRateToUsd = '1'; next.usdBaseAmount = next.originAmount; next.exchangeRateSource = ''; next.exchangeRateDate = '' }
        else if (current.originCurrency === 'USD') { next.exchangeRateToUsd = ''; next.usdBaseAmount = '' }
      }
      if (name === 'originAmount' && next.originCurrency === 'USD') { next.exchangeRateToUsd = '1'; next.usdBaseAmount = value }
      return next
    })
    setErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  const selectDonor = (donor) => {
    setDraft((current) => ({
      ...current,
      donorActorId: donor?.id ?? '',
      donorName: donor?.name ?? '',
      donorType: donor?.is_anonymous ? 'anonymous' : donor?.is_organization ? 'organization' : 'person',
      donorEmail: donor?.email ?? '',
      donorPhone: donor?.phone ?? '',
      donorCountry: donor?.country ?? '',
      isAnonymous: Boolean(donor?.is_anonymous),
    }))
    setErrors((current) => ({ ...current, donorName: undefined }))
  }

  const addEvidence = (files) => setEvidence((current) => [...current, ...Array.from(files).map((file) => ({ id: globalThis.crypto?.randomUUID?.() ?? `proof-${Date.now()}-${Math.random().toString(16).slice(2)}`, type: 'proof_of_payment', file, errors: validateMonetaryEvidence(file) }))])

  const submit = async (event) => {
    event.preventDefault()
    const result = validateMonetaryDraft(draft, language)
    const nextErrors = { ...result.errors }
    if (!draft.organizationId) nextErrors.organizationId = copy.errors.organization
    if (!evidence.length) nextErrors.evidence = copy.errors.evidenceRequired
    if (evidence.some((entry) => Object.keys(entry.errors).length)) nextErrors.evidence = copy.errors.evidenceInvalid
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || saving) return
    setSaving(true); setMessage('')
    try { const saved = await submitMonetaryDonation({ client: supabase, draft, evidence }); window.localStorage.removeItem(DRAFT_KEY); setReference(saved.reference_code) }
    catch (requestError) {
      const friendlyMessage = requestError?.code === '42501'
        ? (language === 'en' ? 'You do not have access for this action. Confirm your email or contact your administrator.' : 'No tienes acceso para esta acción. Confirma tu correo o contacta al administrador.')
        : (requestError?.message || copy.errors.default)
      setMessage(friendlyMessage)
      notify({ type: 'error', message: friendlyMessage })
    }
    finally { setSaving(false) }
  }

  const reset = () => { const next = createInitialMonetaryDraft(); next.organizationId = access.organizationId || organizations[0]?.id || ''; setDraft(next); setEvidence([]); setErrors({}); setMessage(''); setReference('') }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ ...copy, auth: { signOut: copy.signOut }, languageLabel: 'Language' }} language={language} onLanguageChange={() => setLanguage((current) => current === 'es' ? 'en' : 'es')} />
  if (reference) return <main className="intake-success"><div className="success-card"><Brand /><span className="success-icon">✓</span><p className="intake-eyebrow">{copy.completed}</p><h1>{copy.successTitle}</h1><p>{copy.successCopy}</p><div className="reference-card"><span>{copy.reference}</span><strong>{reference}</strong></div><div className="success-actions"><button className="intake-button primary" type="button" onClick={reset}>{copy.another}</button><a className="intake-button secondary" href="/app">{copy.panel}</a></div></div></main>

  const availableProjects = projects.filter((project) => !draft.organizationId || project.organization_id === draft.organizationId)

  return (
    <div className="intake-shell monetary-shell unified-monetary-shell">
      <header className="intake-header"><a href="/app" aria-label={copy.back}><Brand /></a><div className="intake-header-actions"><span className={savedPulse ? 'save-state pulse' : 'save-state'}>✓ {copy.draftSaved}</span><button className="operator-signout" type="button" onClick={access.signOut}>{copy.signOut}</button><button className="intake-language" type="button" onClick={() => setLanguage((current) => current === 'es' ? 'en' : 'es')}><b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}</button></div></header>
      <main className="intake-main monetary-main">
        <a className="intake-back-home" href="/app">← {copy.back}</a>
        <div className="intake-heading"><p className="intake-eyebrow"><span />{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><small className="monetary-required">{copy.required}</small></div>
        <form className="monetary-form" onSubmit={submit}>
          <Section data={copy.sections.donor}><div className="monetary-grid">
            {access.role === 'super_admin' ? <Field label={field.organization} error={errors.organizationId}><select value={draft.organizationId} onChange={(event) => { update('organizationId', event.target.value); update('projectId', ''); selectDonor(null) }}><option value="">{field.select}</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></Field> : <input type="hidden" value={draft.organizationId} readOnly />}
            <Field label={field.project}><select value={draft.projectId} onChange={(event) => update('projectId', event.target.value)}><option value="">{field.noProject}</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field>
            <div className="wide"><DonorPicker organizationId={draft.organizationId} value={draft.donorActorId} onChange={selectDonor} language={language} required />{errors.donorName && <p className="field-error">{errors.donorName}</p>}</div>
          </div></Section>

          <Section data={copy.sections.receipt}><div className="monetary-grid">
            <Field label={field.receivedAt} error={errors.receivedAt}><input type="datetime-local" value={draft.receivedAt} onChange={(event) => update('receivedAt', event.target.value)} /></Field>
            <Field label={field.paymentMethod} error={errors.paymentMethod}><select value={draft.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value)}>{Object.entries(paymentMethods[language]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label={field.amount} error={errors.originAmount}><input type="number" min="0" step="0.01" value={draft.originAmount} onChange={(event) => update('originAmount', event.target.value)} /></Field>
            <Field label={field.currency} error={errors.originCurrency}><select value={draft.originCurrency} onChange={(event) => update('originCurrency', event.target.value)}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></Field>
            {institutionalMethod && <><Field label={field.senderInstitution} error={errors.senderInstitution}><input value={draft.senderInstitution} onChange={(event) => update('senderInstitution', event.target.value)} /></Field><Field label={field.receiverAccount} error={errors.receiverAccountLabel}><input value={draft.receiverAccountLabel} onChange={(event) => update('receiverAccountLabel', event.target.value)} /></Field></>}
            {referenceRequired && <Field label={field.reference} error={errors.transactionReference} className="wide"><input value={draft.transactionReference} onChange={(event) => update('transactionReference', event.target.value)} /></Field>}
          </div></Section>

          <Section data={copy.sections.conversion}><div className="monetary-grid">
            <Field label={field.rate} error={errors.exchangeRateToUsd}><input type="number" min="0" step="0.0000000001" value={draft.exchangeRateToUsd} onChange={(event) => update('exchangeRateToUsd', event.target.value)} readOnly={draft.originCurrency === 'USD'} /></Field>
            <Field label={field.baseUsd} error={errors.usdBaseAmount}><input type="number" min="0" step="0.01" value={draft.usdBaseAmount} onChange={(event) => update('usdBaseAmount', event.target.value)} /></Field>
            <div className="unified-calculation"><span>{field.calculated}</span><strong>{calculatedBase || '—'} USD</strong></div>
            {draft.originCurrency !== 'USD' && <><Field label={field.rateSource} error={errors.exchangeRateSource}><input value={draft.exchangeRateSource} onChange={(event) => update('exchangeRateSource', event.target.value)} /></Field><Field label={field.rateDate} error={errors.exchangeRateDate}><input type="date" value={draft.exchangeRateDate} onChange={(event) => update('exchangeRateDate', event.target.value)} /></Field></>}
            <Field label={field.notes} className="wide"><textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></Field>
          </div></Section>

          <Section data={copy.sections.evidence}><div className="evidence-panel monetary-evidence"><div className="evidence-heading"><div><h3>{field.files}</h3><p>{copy.evidenceDescription}</p></div><span>{evidence.length}</span></div><label className="evidence-add" htmlFor={evidenceInputId}>＋ {field.addFiles}</label><input className="evidence-input" id={evidenceInputId} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { addEvidence(event.target.files); event.target.value = '' }} />{evidence.length > 0 && <div className="evidence-list">{evidence.map((entry) => <article key={entry.id}><div className="evidence-file"><strong>{entry.file.name}</strong><span>{(entry.file.size / 1024 / 1024).toFixed(2)} MB</span></div><button type="button" onClick={() => setEvidence((current) => current.filter((item) => item.id !== entry.id))}>{field.remove}</button></article>)}</div>}{errors.evidence && <p className="field-error">{errors.evidence}</p>}</div><label className="confirmation-field unified-confirmation"><input type="checkbox" checked={draft.verificationAccepted} onChange={(event) => update('verificationAccepted', event.target.checked)} /><span>✓</span><b>{field.confirmation}</b></label>{errors.verificationAccepted && <p className="field-error">{errors.verificationAccepted}</p>}{message && <p className="form-error">{message}</p>}</Section>
          <div className="monetary-submit"><button className="intake-button primary" type="submit" disabled={saving}>{saving ? field.saving : field.submit}</button></div>
        </form>
      </main>
    </div>
  )
}
