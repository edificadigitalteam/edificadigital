import { useEffect, useId, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOperatorAccess } from './useOperatorAccess.js'
import { OperatorAccessScreen } from './OperatorAccess.jsx'
import { submitInKindShipment, validateEvidence } from './submission.js'
import './in-kind.css'
import '../monetary/monetary.css'
import './simplified-in-kind.css'

const DRAFT_KEY = 'edifica-in-kind-consolidated-draft-v2'

const content = {
  es: {
    metaTitle: 'Nueva donación en especies | Edifica',
    back: 'Volver al panel',
    draftSaved: 'Borrador guardado',
    signOut: 'Usar otra cuenta',
    eyebrow: 'RECEPCIÓN DE BIENES E INSUMOS',
    title: 'Nueva donación en especies',
    intro: 'Registra el envío de forma consolidada. El detalle extenso puede cargarse mediante un manifiesto en Excel, CSV o PDF.',
    required: 'Los campos marcados con * son obligatorios.',
    sections: {
      sender: ['01', 'Remitente y proyecto', 'Identifica a la organización o persona que envía la donación y el proyecto relacionado.'],
      route: ['02', 'Ruta del envío', 'Utiliza únicamente la información logística necesaria para seguimiento.'],
      contents: ['03', 'Resumen del contenido', 'Clasifica la carga por categorías y registra bultos, cajas, paletas o lotes.'],
      evidence: ['04', 'Documentos y confirmación', 'Adjunta manifiesto, conocimiento de embarque, fotografías u otros soportes.'],
    },
    successTitle: 'Donación registrada',
    successCopy: 'El envío quedó registrado con una referencia única y puede consultarse desde el panel.',
    another: 'Registrar otra donación',
    panel: 'Volver al panel',
  },
  en: {
    metaTitle: 'New in-kind donation | Edifica',
    back: 'Back to dashboard',
    draftSaved: 'Draft saved',
    signOut: 'Use another account',
    eyebrow: 'GOODS AND SUPPLIES INTAKE',
    title: 'New in-kind donation',
    intro: 'Register the shipment as a consolidated load. Extensive detail can be uploaded through an Excel, CSV, or PDF manifest.',
    required: 'Fields marked with * are required.',
    sections: {
      sender: ['01', 'Sender and project', 'Identify the organization or person sending the donation and the related project.'],
      route: ['02', 'Shipment route', 'Use only the logistics information required for tracking.'],
      contents: ['03', 'Contents summary', 'Classify the load and register packages, boxes, pallets, or lots.'],
      evidence: ['04', 'Documents and confirmation', 'Attach the manifest, bill of lading, photographs, or other evidence.'],
    },
    successTitle: 'Donation registered',
    successCopy: 'The shipment was recorded with a unique reference and is available from the dashboard.',
    another: 'Register another donation',
    panel: 'Back to dashboard',
  },
}

const categoryLabels = {
  es: { food: 'Alimentos', clothing: 'Ropa', hygiene: 'Higiene', medical: 'Medicinas e insumos médicos', household: 'Hogar', other: 'Otros' },
  en: { food: 'Food', clothing: 'Clothing', hygiene: 'Hygiene', medical: 'Medical supplies', household: 'Household', other: 'Other' },
}

const createId = () => globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString(16).padEnd(12, '0').slice(0, 12)}`

const createDraft = (access = {}) => ({
  submissionId: createId(),
  organizationId: access.organizationId || '',
  projectId: '',
  senderName: '',
  senderType: 'organization',
  senderContact: '',
  shipmentScope: 'international',
  originCountry: '',
  originCity: '',
  destinationCountry: 'Venezuela',
  destinationCity: '',
  transportMode: 'sea',
  status: 'announced',
  containerNumber: '',
  trackingNumber: '',
  departureDate: '',
  estimatedArrival: '',
  actualArrival: '',
  categories: [],
  contentsSummary: '',
  packageCount: '',
  packageUnit: 'lot',
  referenceValue: '',
  referenceCurrency: 'USD',
  notes: '',
  confirmed: false,
})

function loadLanguage() {
  try { return window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' }
}

function loadDraft(access) {
  try {
    const saved = window.localStorage.getItem(DRAFT_KEY)
    return saved ? { ...createDraft(access), ...JSON.parse(saved), organizationId: JSON.parse(saved).organizationId || access.organizationId || '' } : createDraft(access)
  } catch { return createDraft(access) }
}

function Brand() {
  return <span className="intake-brand"><span className="intake-brand-mark" aria-hidden="true"><i /><i /><i /></span><span>edifica<span>digital</span></span></span>
}

function Section({ data, children }) {
  return <section className="monetary-section simplified-section"><header><span>{data[0]}</span><div><h2>{data[1]}</h2><p>{data[2]}</p></div></header>{children}</section>
}

export default function SimplifiedInKindDonationFlow() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(loadLanguage)
  const [draft, setDraft] = useState(() => loadDraft(access))
  const [organizations, setOrganizations] = useState([])
  const [projects, setProjects] = useState([])
  const [evidence, setEvidence] = useState([])
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [reference, setReference] = useState('')
  const [savedPulse, setSavedPulse] = useState(false)
  const fileInputId = useId()
  const copy = content[language]

  useEffect(() => {
    document.documentElement.lang = language
    document.title = copy.metaTitle
    window.localStorage.setItem('edifica-language', language)
  }, [copy.metaTitle, language])

  useEffect(() => {
    if (access.status !== 'authorized') return
    setDraft((current) => ({ ...current, organizationId: current.organizationId || access.organizationId || '' }))
    const loadRelations = async () => {
      if (access.role === 'super_admin') {
        const { data } = await supabase.rpc('admin_list_organizations')
        setOrganizations(data ?? [])
      }
      const { data } = await supabase.from('project').select('id, name, organization_id').order('name')
      setProjects(data ?? [])
    }
    loadRelations()
  }, [access.organizationId, access.role, access.status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        setSavedPulse(true)
        window.setTimeout(() => setSavedPulse(false), 900)
      } catch { setSavedPulse(false) }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draft])

  const update = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setMessage('')
  }

  const toggleCategory = (category) => update('categories', draft.categories.includes(category)
    ? draft.categories.filter((item) => item !== category)
    : [...draft.categories, category])

  const addEvidence = (files) => {
    const additions = Array.from(files).map((file) => {
      const spreadsheet = file.type.includes('excel') || file.type.includes('spreadsheet') || file.type.includes('csv')
      return {
        id: createId(),
        type: spreadsheet ? 'manifest_spreadsheet' : file.type.startsWith('image/') ? 'photo' : 'packing_list',
        file,
        errors: validateEvidence(file),
      }
    })
    setEvidence((current) => [...current, ...additions])
  }

  const validate = () => {
    const next = {}
    if (!draft.organizationId) next.organizationId = language === 'es' ? 'Selecciona una organización.' : 'Select an organization.'
    if (!draft.senderName.trim()) next.senderName = language === 'es' ? 'Escribe el nombre del remitente.' : 'Enter the sender name.'
    if (!draft.originCountry.trim()) next.originCountry = language === 'es' ? 'Escribe el país de origen.' : 'Enter the origin country.'
    if (!draft.destinationCountry.trim()) next.destinationCountry = language === 'es' ? 'Escribe el país de destino.' : 'Enter the destination country.'
    if (!draft.estimatedArrival) next.estimatedArrival = language === 'es' ? 'Selecciona una fecha estimada.' : 'Select an estimated date.'
    if (!draft.contentsSummary.trim()) next.contentsSummary = language === 'es' ? 'Resume el contenido de la carga.' : 'Summarize the shipment contents.'
    if (!draft.categories.length) next.categories = language === 'es' ? 'Selecciona al menos una categoría.' : 'Select at least one category.'
    if (!Number.isFinite(Number(draft.packageCount)) || Number(draft.packageCount) <= 0) next.packageCount = language === 'es' ? 'Indica una cantidad mayor que cero.' : 'Enter a quantity greater than zero.'
    if (!draft.confirmed) next.confirmed = language === 'es' ? 'Confirma la veracidad del registro.' : 'Confirm the accuracy of the record.'
    const invalidEvidence = evidence.find((item) => Object.keys(item.errors).length)
    if (invalidEvidence) next.evidence = language === 'es' ? 'Revisa el formato o tamaño de los archivos.' : 'Review the file format or size.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    setMessage('')
    try {
      const result = await submitInKindShipment({ client: supabase, draft, evidence })
      window.localStorage.removeItem(DRAFT_KEY)
      setReference(result.reference_code)
    } catch (requestError) {
      setMessage(language === 'es' ? `No fue posible guardar el envío: ${requestError.message}` : `The shipment could not be saved: ${requestError.message}`)
    } finally { setSaving(false) }
  }

  const reset = () => {
    const next = createDraft(access)
    next.organizationId = access.organizationId || organizations[0]?.id || ''
    setDraft(next)
    setEvidence([])
    setErrors({})
    setMessage('')
    setReference('')
  }

  if (access.status !== 'authorized') {
    return <OperatorAccessScreen access={access} copy={{ ...copy, auth: { signOut: copy.signOut }, languageLabel: 'Language' }} language={language} onLanguageChange={() => setLanguage((current) => current === 'es' ? 'en' : 'es')} />
  }

  if (reference) return <main className="intake-success"><div className="success-card"><Brand /><span className="success-icon">✓</span><p className="intake-eyebrow">REGISTRO COMPLETADO</p><h1>{copy.successTitle}</h1><p>{copy.successCopy}</p><div className="reference-card"><span>Referencia</span><strong>{reference}</strong></div><div className="success-actions"><button className="intake-button primary" type="button" onClick={reset}>{copy.another}</button><a className="intake-button secondary" href="/app">{copy.panel}</a></div></div></main>

  const availableProjects = projects.filter((project) => !draft.organizationId || project.organization_id === draft.organizationId)

  return (
    <div className="intake-shell monetary-shell simplified-in-kind-shell">
      <header className="intake-header">
        <a href="/app" aria-label={copy.back}><Brand /></a>
        <div className="intake-header-actions"><span className={savedPulse ? 'save-state pulse' : 'save-state'}>✓ {copy.draftSaved}</span><button className="operator-signout" type="button" onClick={access.signOut}>{copy.signOut}</button><button className="intake-language" type="button" onClick={() => setLanguage((current) => current === 'es' ? 'en' : 'es')}><b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}</button></div>
      </header>

      <main className="intake-main monetary-main">
        <a className="intake-back-home" href="/app">← {copy.back}</a>
        <div className="intake-heading"><p className="intake-eyebrow"><span />{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><small className="monetary-required">{copy.required}</small></div>

        <form className="monetary-form" onSubmit={submit}>
          <Section data={copy.sections.sender}><div className="monetary-grid">
            {access.role === 'super_admin' ? <label className="intake-field"><span className="field-label">Organización *</span><select value={draft.organizationId} onChange={(event) => { update('organizationId', event.target.value); update('projectId', '') }}><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>{errors.organizationId && <p className="field-error">{errors.organizationId}</p>}</label> : <input type="hidden" value={draft.organizationId} readOnly />}
            <label className="intake-field"><span className="field-label">Proyecto relacionado</span><select value={draft.projectId} onChange={(event) => update('projectId', event.target.value)}><option value="">Sin proyecto específico</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label className="intake-field wide"><span className="field-label">Remitente *</span><input value={draft.senderName} onChange={(event) => update('senderName', event.target.value)} placeholder="Organización o persona que envía" />{errors.senderName && <p className="field-error">{errors.senderName}</p>}</label>
            <label className="intake-field"><span className="field-label">Tipo de remitente</span><select value={draft.senderType} onChange={(event) => update('senderType', event.target.value)}><option value="organization">Organización</option><option value="individual">Persona</option></select></label>
            <label className="intake-field"><span className="field-label">Correo o teléfono</span><input value={draft.senderContact} onChange={(event) => update('senderContact', event.target.value)} /></label>
          </div></Section>

          <Section data={copy.sections.route}><div className="monetary-grid">
            <label className="intake-field"><span className="field-label">Alcance *</span><select value={draft.shipmentScope} onChange={(event) => update('shipmentScope', event.target.value)}><option value="international">Internacional</option><option value="national">Nacional</option></select></label>
            <label className="intake-field"><span className="field-label">Transporte *</span><select value={draft.transportMode} onChange={(event) => update('transportMode', event.target.value)}><option value="sea">Marítimo</option><option value="air">Aéreo</option></select></label>
            <label className="intake-field"><span className="field-label">País de origen *</span><input value={draft.originCountry} onChange={(event) => update('originCountry', event.target.value)} />{errors.originCountry && <p className="field-error">{errors.originCountry}</p>}</label>
            <label className="intake-field"><span className="field-label">Ciudad de origen</span><input value={draft.originCity} onChange={(event) => update('originCity', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">País de destino *</span><input value={draft.destinationCountry} onChange={(event) => update('destinationCountry', event.target.value)} />{errors.destinationCountry && <p className="field-error">{errors.destinationCountry}</p>}</label>
            <label className="intake-field"><span className="field-label">Ciudad de destino</span><input value={draft.destinationCity} onChange={(event) => update('destinationCity', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">Estado</span><select value={draft.status} onChange={(event) => update('status', event.target.value)}><option value="announced">Anunciado</option><option value="in_transit">En tránsito</option><option value="customs">En aduana</option><option value="received">Recibido</option><option value="closed">Cerrado</option></select></label>
            {draft.transportMode === 'sea' && <label className="intake-field"><span className="field-label">Número de contenedor</span><input value={draft.containerNumber} onChange={(event) => update('containerNumber', event.target.value.toUpperCase())} /></label>}
            <label className="intake-field"><span className="field-label">Número de seguimiento</span><input value={draft.trackingNumber} onChange={(event) => update('trackingNumber', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">Fecha de salida</span><input type="date" value={draft.departureDate} onChange={(event) => update('departureDate', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">Llegada estimada *</span><input type="date" value={draft.estimatedArrival} onChange={(event) => update('estimatedArrival', event.target.value)} />{errors.estimatedArrival && <p className="field-error">{errors.estimatedArrival}</p>}</label>
            <label className="intake-field"><span className="field-label">Llegada real</span><input type="date" value={draft.actualArrival} onChange={(event) => update('actualArrival', event.target.value)} /></label>
          </div></Section>

          <Section data={copy.sections.contents}><div className="monetary-grid">
            <div className="wide simplified-categories"><span>Categorías principales *</span><div>{Object.entries(categoryLabels[language]).map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.categories.includes(value)} onChange={() => toggleCategory(value)} />{label}</label>)}</div>{errors.categories && <p className="field-error">{errors.categories}</p>}</div>
            <label className="intake-field wide"><span className="field-label">Resumen del contenido *</span><textarea value={draft.contentsSummary} onChange={(event) => update('contentsSummary', event.target.value)} placeholder="Ejemplo: carga mixta de alimentos, higiene y material médico según manifiesto adjunto" />{errors.contentsSummary && <p className="field-error">{errors.contentsSummary}</p>}</label>
            <label className="intake-field"><span className="field-label">Cantidad declarada *</span><input type="number" min="0" step="0.001" value={draft.packageCount} onChange={(event) => update('packageCount', event.target.value)} />{errors.packageCount && <p className="field-error">{errors.packageCount}</p>}</label>
            <label className="intake-field"><span className="field-label">Unidad</span><select value={draft.packageUnit} onChange={(event) => update('packageUnit', event.target.value)}><option value="lot">Lote consolidado</option><option value="box">Cajas</option><option value="pallet">Paletas</option><option value="bag">Sacos</option><option value="unit">Unidades</option></select></label>
            <label className="intake-field"><span className="field-label">Valor referencial</span><input type="number" min="0" step="0.01" value={draft.referenceValue} onChange={(event) => update('referenceValue', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">Moneda</span><select value={draft.referenceCurrency} onChange={(event) => update('referenceCurrency', event.target.value)}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
            <label className="intake-field wide"><span className="field-label">Observaciones</span><textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          </div></Section>

          <Section data={copy.sections.evidence}><div className="simplified-manifest-note"><strong>¿El contenedor incluye cientos de productos?</strong><p>Carga el manifiesto completo en Excel, CSV o PDF. Edifica registra aquí la carga consolidada y el detalle se incorpora en la recepción e inventario.</p></div><div className="evidence-panel monetary-evidence"><div className="evidence-heading"><div><h3>Adjuntar documentos</h3><p>Excel, CSV, PDF, JPG, PNG o WebP · máximo 20 MB por archivo</p></div><span>{evidence.length}</span></div><label className="evidence-add" htmlFor={fileInputId}>＋ Agregar archivos</label><input className="evidence-input" id={fileInputId} type="file" multiple accept=".xlsx,.xls,.csv,image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { addEvidence(event.target.files); event.target.value = '' }} />{evidence.length > 0 && <div className="evidence-list">{evidence.map((entry) => <article key={entry.id}><div className="evidence-file"><strong>{entry.file.name}</strong><span>{(entry.file.size / 1024 / 1024).toFixed(2)} MB</span></div><select value={entry.type} onChange={(event) => setEvidence((current) => current.map((item) => item.id === entry.id ? { ...item, type: event.target.value } : item))}><option value="manifest_spreadsheet">Manifiesto detallado</option><option value="packing_list">Lista de empaque</option><option value="bill_of_lading">Documento de transporte</option><option value="photo">Fotografía</option></select><button type="button" onClick={() => setEvidence((current) => current.filter((item) => item.id !== entry.id))}>Eliminar</button></article>)}</div>}{errors.evidence && <p className="field-error">{errors.evidence}</p>}</div><label className="confirmation-field simplified-confirmation"><input type="checkbox" checked={draft.confirmed} onChange={(event) => update('confirmed', event.target.checked)} /><span>✓</span><b>Confirmo que la información registrada corresponde a los documentos disponibles.</b></label>{errors.confirmed && <p className="field-error">{errors.confirmed}</p>}{message && <p className="form-error">{message}</p>}</Section>

          <div className="monetary-submit"><button className="intake-button primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar donación'}</button></div>
        </form>
      </main>
    </div>
  )
}
