import { useEffect, useId, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOperatorAccess } from './useOperatorAccess.js'
import { OperatorAccessScreen } from './OperatorAccess.jsx'
import { submitInKindShipment, validateEvidence } from './submission.js'
import './in-kind.css'
import '../monetary/monetary.css'
import './simplified-in-kind.css'

const DRAFT_KEY = 'edifica-in-kind-consolidated-draft-v3'

const content = {
  es: {
    metaTitle: 'Nueva donación en especies | Edifica', back: 'Volver al panel', draftSaved: 'Borrador guardado', signOut: 'Usar otra cuenta',
    eyebrow: 'RECEPCIÓN DE BIENES E INSUMOS', title: 'Nueva donación en especies',
    intro: 'Registra la donación y su envío de forma consolidada. El detalle extenso puede cargarse mediante un manifiesto en Excel, CSV o PDF.',
    required: 'Los campos marcados con * son obligatorios.', completed: 'REGISTRO COMPLETADO', reference: 'Referencia',
    sections: {
      donor: ['01', 'Donante o aliado y proyecto', 'Identifica a la organización, persona o donante anónimo y el proyecto relacionado.'],
      route: ['02', 'Ruta del envío', 'Utiliza únicamente la información logística necesaria para seguimiento.'],
      contents: ['03', 'Resumen del contenido', 'Clasifica la carga por categorías y registra bultos, cajas, paletas o lotes.'],
      evidence: ['04', 'Documentos y confirmación', 'Adjunta manifiesto, documento de transporte, fotografías u otros soportes.'],
    },
    successTitle: 'Donación registrada', successCopy: 'La donación quedó registrada con una referencia única y puede consultarse desde el panel.', another: 'Registrar otra donación', panel: 'Volver al panel',
  },
  en: {
    metaTitle: 'New in-kind donation | Edifica', back: 'Back to dashboard', draftSaved: 'Draft saved', signOut: 'Use another account',
    eyebrow: 'GOODS AND SUPPLIES INTAKE', title: 'New in-kind donation',
    intro: 'Record the donation and shipment as a consolidated load. Extensive detail can be uploaded through an Excel, CSV, or PDF manifest.',
    required: 'Fields marked with * are required.', completed: 'RECORD COMPLETED', reference: 'Reference',
    sections: {
      donor: ['01', 'Donor or partner and project', 'Identify the organization, person, or anonymous donor and the related project.'],
      route: ['02', 'Shipment route', 'Use only the logistics information required for tracking.'],
      contents: ['03', 'Contents summary', 'Classify the load and register packages, boxes, pallets, or lots.'],
      evidence: ['04', 'Documents and confirmation', 'Attach the manifest, transport document, photographs, or other evidence.'],
    },
    successTitle: 'Donation registered', successCopy: 'The donation was recorded with a unique reference and is available from the dashboard.', another: 'Register another donation', panel: 'Back to dashboard',
  },
}

const labels = {
  es: {
    organization: 'Organización *', project: 'Proyecto relacionado', noProject: 'Sin proyecto específico', select: 'Seleccionar',
    donorName: 'Nombre del donante o aliado *', donorType: 'Tipo de donante', organizationType: 'Organización', personType: 'Persona', anonymousType: 'Anónimo',
    donorEmail: 'Correo electrónico', donorPhone: 'Teléfono', donorCountry: 'País del donante o aliado', anonymousNotice: 'El registro se guardará como donante anónimo y los datos de contacto quedarán vacíos.',
    scope: 'Alcance *', international: 'Internacional', national: 'Nacional', transport: 'Transporte *', sea: 'Marítimo', air: 'Aéreo',
    originCountry: 'País de origen *', originCity: 'Ciudad de origen', destinationCountry: 'País de destino *', destinationCity: 'Ciudad de destino', status: 'Estado',
    announced: 'Anunciado', inTransit: 'En tránsito', customs: 'En aduana', received: 'Recibido', closed: 'Cerrado', container: 'Número de contenedor', tracking: 'Número de seguimiento',
    departure: 'Fecha de salida', estimatedArrival: 'Llegada estimada *', actualArrival: 'Llegada real', categories: 'Categorías principales *', summary: 'Resumen del contenido *',
    summaryPlaceholder: 'Ejemplo: carga mixta de alimentos, higiene y material médico según manifiesto adjunto', packageCount: 'Cantidad declarada *', unit: 'Unidad',
    lot: 'Lote consolidado', boxes: 'Cajas', pallets: 'Paletas', bags: 'Sacos', units: 'Unidades', referenceValue: 'Valor referencial', currency: 'Moneda', notes: 'Observaciones',
    manyProducts: '¿El contenedor incluye cientos de productos?', manifestHelp: 'Carga el manifiesto completo en Excel, CSV o PDF. Edifica registra la carga consolidada y el detalle se incorpora durante la recepción e inventario.',
    attach: 'Adjuntar documentos', fileHelp: 'Excel, CSV, PDF, JPG, PNG o WebP · máximo 20 MB por archivo', addFiles: 'Agregar archivos', detailedManifest: 'Manifiesto detallado', packingList: 'Lista de empaque', transportDocument: 'Documento de transporte', photo: 'Fotografía', remove: 'Eliminar',
    confirmation: 'Confirmo que la información registrada corresponde a los documentos disponibles.', submit: 'Registrar donación', saving: 'Guardando…',
  },
  en: {
    organization: 'Organization *', project: 'Related project', noProject: 'No specific project', select: 'Select',
    donorName: 'Donor or partner name *', donorType: 'Donor type', organizationType: 'Organization', personType: 'Person', anonymousType: 'Anonymous',
    donorEmail: 'Email address', donorPhone: 'Phone', donorCountry: 'Donor or partner country', anonymousNotice: 'The record will be saved as an anonymous donor and contact fields will remain empty.',
    scope: 'Scope *', international: 'International', national: 'National', transport: 'Transport *', sea: 'Sea', air: 'Air',
    originCountry: 'Origin country *', originCity: 'Origin city', destinationCountry: 'Destination country *', destinationCity: 'Destination city', status: 'Status',
    announced: 'Announced', inTransit: 'In transit', customs: 'In customs', received: 'Received', closed: 'Closed', container: 'Container number', tracking: 'Tracking number',
    departure: 'Departure date', estimatedArrival: 'Estimated arrival *', actualArrival: 'Actual arrival', categories: 'Main categories *', summary: 'Contents summary *',
    summaryPlaceholder: 'Example: mixed shipment of food, hygiene, and medical supplies according to the attached manifest', packageCount: 'Declared quantity *', unit: 'Unit',
    lot: 'Consolidated lot', boxes: 'Boxes', pallets: 'Pallets', bags: 'Bags', units: 'Units', referenceValue: 'Reference value', currency: 'Currency', notes: 'Notes',
    manyProducts: 'Does the container include hundreds of products?', manifestHelp: 'Upload the complete manifest in Excel, CSV, or PDF. Edifica records the consolidated load and the detail is incorporated during receipt and inventory.',
    attach: 'Attach documents', fileHelp: 'Excel, CSV, PDF, JPG, PNG, or WebP · 20 MB maximum per file', addFiles: 'Add files', detailedManifest: 'Detailed manifest', packingList: 'Packing list', transportDocument: 'Transport document', photo: 'Photograph', remove: 'Remove',
    confirmation: 'I confirm that the recorded information matches the available documents.', submit: 'Register donation', saving: 'Saving…',
  },
}

const categoryLabels = {
  es: { food: 'Alimentos', clothing: 'Ropa', hygiene: 'Higiene', medical: 'Medicinas e insumos médicos', household: 'Hogar', other: 'Otros' },
  en: { food: 'Food', clothing: 'Clothing', hygiene: 'Hygiene', medical: 'Medical supplies', household: 'Household', other: 'Other' },
}

const createId = () => globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString(16).padEnd(12, '0').slice(0, 12)}`

const createDraft = (access = {}) => ({
  submissionId: createId(), organizationId: access.organizationId || '', projectId: '',
  donorName: '', donorType: 'organization', donorEmail: '', donorPhone: '', donorCountry: '',
  shipmentScope: 'international', originCountry: '', originCity: '', destinationCountry: 'Venezuela', destinationCity: '',
  transportMode: 'sea', status: 'announced', containerNumber: '', trackingNumber: '', departureDate: '', estimatedArrival: '', actualArrival: '',
  categories: [], contentsSummary: '', packageCount: '', packageUnit: 'lot', referenceValue: '', referenceCurrency: 'USD', notes: '', confirmed: false,
})

function loadLanguage() { try { return window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function loadDraft(access) { try { const saved = window.localStorage.getItem(DRAFT_KEY); return saved ? { ...createDraft(access), ...JSON.parse(saved), organizationId: JSON.parse(saved).organizationId || access.organizationId || '' } : createDraft(access) } catch { return createDraft(access) } }
function Brand() { return <span className="intake-brand"><span className="intake-brand-mark" aria-hidden="true"><i /><i /><i /></span><span>edifica<span>digital</span></span></span> }
function Section({ data, children }) { return <section className="monetary-section simplified-section"><header><span>{data[0]}</span><div><h2>{data[1]}</h2><p>{data[2]}</p></div></header>{children}</section> }

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
  const field = labels[language]
  const anonymous = draft.donorType === 'anonymous'

  useEffect(() => { document.documentElement.lang = language; document.title = copy.metaTitle; window.localStorage.setItem('edifica-language', language) }, [copy.metaTitle, language])
  useEffect(() => {
    if (access.status !== 'authorized') return
    setDraft((current) => ({ ...current, organizationId: current.organizationId || access.organizationId || '' }))
    const loadRelations = async () => {
      if (access.role === 'super_admin') { const { data } = await supabase.rpc('admin_list_organizations'); setOrganizations(data ?? []) }
      const { data } = await supabase.from('project').select('id, name, organization_id').order('name')
      setProjects(data ?? [])
    }
    loadRelations()
  }, [access.organizationId, access.role, access.status])

  useEffect(() => {
    const timer = window.setTimeout(() => { try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); setSavedPulse(true); window.setTimeout(() => setSavedPulse(false), 900) } catch { setSavedPulse(false) } }, 250)
    return () => window.clearTimeout(timer)
  }, [draft])

  const update = (fieldName, value) => {
    setDraft((current) => {
      const next = { ...current, [fieldName]: value }
      if (fieldName === 'donorType' && value === 'anonymous') { next.donorName = ''; next.donorEmail = ''; next.donorPhone = ''; next.donorCountry = '' }
      return next
    })
    setErrors((current) => ({ ...current, [fieldName]: undefined }))
    setMessage('')
  }

  const toggleCategory = (category) => update('categories', draft.categories.includes(category) ? draft.categories.filter((item) => item !== category) : [...draft.categories, category])
  const addEvidence = (files) => setEvidence((current) => [...current, ...Array.from(files).map((file) => ({ id: createId(), type: file.type.includes('excel') || file.type.includes('spreadsheet') || file.type.includes('csv') ? 'manifest_spreadsheet' : file.type.startsWith('image/') ? 'photo' : 'packing_list', file, errors: validateEvidence(file) }))])

  const validate = () => {
    const next = {}
    if (!draft.organizationId) next.organizationId = language === 'es' ? 'Selecciona una organización.' : 'Select an organization.'
    if (!anonymous && !draft.donorName.trim()) next.donorName = language === 'es' ? 'Escribe el nombre del donante o aliado.' : 'Enter the donor or partner name.'
    if (!draft.originCountry.trim()) next.originCountry = language === 'es' ? 'Escribe el país de origen.' : 'Enter the origin country.'
    if (!draft.destinationCountry.trim()) next.destinationCountry = language === 'es' ? 'Escribe el país de destino.' : 'Enter the destination country.'
    if (!draft.estimatedArrival) next.estimatedArrival = language === 'es' ? 'Selecciona una fecha estimada.' : 'Select an estimated date.'
    if (!draft.contentsSummary.trim()) next.contentsSummary = language === 'es' ? 'Resume el contenido de la carga.' : 'Summarize the shipment contents.'
    if (!draft.categories.length) next.categories = language === 'es' ? 'Selecciona al menos una categoría.' : 'Select at least one category.'
    if (!Number.isFinite(Number(draft.packageCount)) || Number(draft.packageCount) <= 0) next.packageCount = language === 'es' ? 'Indica una cantidad mayor que cero.' : 'Enter a quantity greater than zero.'
    if (!draft.confirmed) next.confirmed = language === 'es' ? 'Confirma la veracidad del registro.' : 'Confirm the accuracy of the record.'
    if (evidence.find((item) => Object.keys(item.errors).length)) next.evidence = language === 'es' ? 'Revisa el formato o tamaño de los archivos.' : 'Review the file format or size.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate() || saving) return
    setSaving(true); setMessage('')
    try { const result = await submitInKindShipment({ client: supabase, draft, evidence }); window.localStorage.removeItem(DRAFT_KEY); setReference(result.reference_code) }
    catch (requestError) { setMessage(language === 'es' ? `No fue posible guardar la donación: ${requestError.message}` : `The donation could not be saved: ${requestError.message}`) }
    finally { setSaving(false) }
  }

  const reset = () => { const next = createDraft(access); next.organizationId = access.organizationId || organizations[0]?.id || ''; setDraft(next); setEvidence([]); setErrors({}); setMessage(''); setReference('') }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ ...copy, auth: { signOut: copy.signOut }, languageLabel: 'Language' }} language={language} onLanguageChange={() => setLanguage((current) => current === 'es' ? 'en' : 'es')} />
  if (reference) return <main className="intake-success"><div className="success-card"><Brand /><span className="success-icon">✓</span><p className="intake-eyebrow">{copy.completed}</p><h1>{copy.successTitle}</h1><p>{copy.successCopy}</p><div className="reference-card"><span>{copy.reference}</span><strong>{reference}</strong></div><div className="success-actions"><button className="intake-button primary" type="button" onClick={reset}>{copy.another}</button><a className="intake-button secondary" href="/app">{copy.panel}</a></div></div></main>

  const availableProjects = projects.filter((project) => !draft.organizationId || project.organization_id === draft.organizationId)

  return (
    <div className="intake-shell monetary-shell simplified-in-kind-shell">
      <header className="intake-header"><a href="/app" aria-label={copy.back}><Brand /></a><div className="intake-header-actions"><span className={savedPulse ? 'save-state pulse' : 'save-state'}>✓ {copy.draftSaved}</span><button className="operator-signout" type="button" onClick={access.signOut}>{copy.signOut}</button><button className="intake-language" type="button" onClick={() => setLanguage((current) => current === 'es' ? 'en' : 'es')}><b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}</button></div></header>
      <main className="intake-main monetary-main">
        <a className="intake-back-home" href="/app">← {copy.back}</a>
        <div className="intake-heading"><p className="intake-eyebrow"><span />{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><small className="monetary-required">{copy.required}</small></div>
        <form className="monetary-form" onSubmit={submit}>
          <Section data={copy.sections.donor}><div className="monetary-grid">
            {access.role === 'super_admin' ? <label className="intake-field"><span className="field-label">{field.organization}</span><select value={draft.organizationId} onChange={(event) => { update('organizationId', event.target.value); update('projectId', '') }}><option value="">{field.select}</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>{errors.organizationId && <p className="field-error">{errors.organizationId}</p>}</label> : <input type="hidden" value={draft.organizationId} readOnly />}
            <label className="intake-field"><span className="field-label">{field.project}</span><select value={draft.projectId} onChange={(event) => update('projectId', event.target.value)}><option value="">{field.noProject}</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label className="intake-field"><span className="field-label">{field.donorType}</span><select value={draft.donorType} onChange={(event) => update('donorType', event.target.value)}><option value="organization">{field.organizationType}</option><option value="person">{field.personType}</option><option value="anonymous">{field.anonymousType}</option></select></label>
            {!anonymous && <><label className="intake-field wide"><span className="field-label">{field.donorName}</span><input value={draft.donorName} onChange={(event) => update('donorName', event.target.value)} />{errors.donorName && <p className="field-error">{errors.donorName}</p>}</label><label className="intake-field"><span className="field-label">{field.donorEmail}</span><input type="email" value={draft.donorEmail} onChange={(event) => update('donorEmail', event.target.value)} /></label><label className="intake-field"><span className="field-label">{field.donorPhone}</span><input value={draft.donorPhone} onChange={(event) => update('donorPhone', event.target.value)} /></label><label className="intake-field"><span className="field-label">{field.donorCountry}</span><input value={draft.donorCountry} onChange={(event) => update('donorCountry', event.target.value)} /></label></>}
            {anonymous && <p className="operations-empty-note wide">{field.anonymousNotice}</p>}
          </div></Section>

          <Section data={copy.sections.route}><div className="monetary-grid">
            <label className="intake-field"><span className="field-label">{field.scope}</span><select value={draft.shipmentScope} onChange={(event) => update('shipmentScope', event.target.value)}><option value="international">{field.international}</option><option value="national">{field.national}</option></select></label>
            <label className="intake-field"><span className="field-label">{field.transport}</span><select value={draft.transportMode} onChange={(event) => update('transportMode', event.target.value)}><option value="sea">{field.sea}</option><option value="air">{field.air}</option></select></label>
            <label className="intake-field"><span className="field-label">{field.originCountry}</span><input value={draft.originCountry} onChange={(event) => update('originCountry', event.target.value)} />{errors.originCountry && <p className="field-error">{errors.originCountry}</p>}</label>
            <label className="intake-field"><span className="field-label">{field.originCity}</span><input value={draft.originCity} onChange={(event) => update('originCity', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">{field.destinationCountry}</span><input value={draft.destinationCountry} onChange={(event) => update('destinationCountry', event.target.value)} />{errors.destinationCountry && <p className="field-error">{errors.destinationCountry}</p>}</label>
            <label className="intake-field"><span className="field-label">{field.destinationCity}</span><input value={draft.destinationCity} onChange={(event) => update('destinationCity', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">{field.status}</span><select value={draft.status} onChange={(event) => update('status', event.target.value)}><option value="announced">{field.announced}</option><option value="in_transit">{field.inTransit}</option><option value="customs">{field.customs}</option><option value="received">{field.received}</option><option value="closed">{field.closed}</option></select></label>
            {draft.transportMode === 'sea' && <label className="intake-field"><span className="field-label">{field.container}</span><input value={draft.containerNumber} onChange={(event) => update('containerNumber', event.target.value.toUpperCase())} /></label>}
            <label className="intake-field"><span className="field-label">{field.tracking}</span><input value={draft.trackingNumber} onChange={(event) => update('trackingNumber', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">{field.departure}</span><input type="date" value={draft.departureDate} onChange={(event) => update('departureDate', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">{field.estimatedArrival}</span><input type="date" value={draft.estimatedArrival} onChange={(event) => update('estimatedArrival', event.target.value)} />{errors.estimatedArrival && <p className="field-error">{errors.estimatedArrival}</p>}</label>
            <label className="intake-field"><span className="field-label">{field.actualArrival}</span><input type="date" value={draft.actualArrival} onChange={(event) => update('actualArrival', event.target.value)} /></label>
          </div></Section>

          <Section data={copy.sections.contents}><div className="monetary-grid">
            <div className="wide simplified-categories"><span>{field.categories}</span><div>{Object.entries(categoryLabels[language]).map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.categories.includes(value)} onChange={() => toggleCategory(value)} />{label}</label>)}</div>{errors.categories && <p className="field-error">{errors.categories}</p>}</div>
            <label className="intake-field wide"><span className="field-label">{field.summary}</span><textarea value={draft.contentsSummary} onChange={(event) => update('contentsSummary', event.target.value)} placeholder={field.summaryPlaceholder} />{errors.contentsSummary && <p className="field-error">{errors.contentsSummary}</p>}</label>
            <label className="intake-field"><span className="field-label">{field.packageCount}</span><input type="number" min="0" step="0.001" value={draft.packageCount} onChange={(event) => update('packageCount', event.target.value)} />{errors.packageCount && <p className="field-error">{errors.packageCount}</p>}</label>
            <label className="intake-field"><span className="field-label">{field.unit}</span><select value={draft.packageUnit} onChange={(event) => update('packageUnit', event.target.value)}><option value="lot">{field.lot}</option><option value="box">{field.boxes}</option><option value="pallet">{field.pallets}</option><option value="bag">{field.bags}</option><option value="unit">{field.units}</option></select></label>
            <label className="intake-field"><span className="field-label">{field.referenceValue}</span><input type="number" min="0" step="0.01" value={draft.referenceValue} onChange={(event) => update('referenceValue', event.target.value)} /></label>
            <label className="intake-field"><span className="field-label">{field.currency}</span><select value={draft.referenceCurrency} onChange={(event) => update('referenceCurrency', event.target.value)}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
            <label className="intake-field wide"><span className="field-label">{field.notes}</span><textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          </div></Section>

          <Section data={copy.sections.evidence}><div className="simplified-manifest-note"><strong>{field.manyProducts}</strong><p>{field.manifestHelp}</p></div><div className="evidence-panel monetary-evidence"><div className="evidence-heading"><div><h3>{field.attach}</h3><p>{field.fileHelp}</p></div><span>{evidence.length}</span></div><label className="evidence-add" htmlFor={fileInputId}>＋ {field.addFiles}</label><input className="evidence-input" id={fileInputId} type="file" multiple accept=".xlsx,.xls,.csv,image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { addEvidence(event.target.files); event.target.value = '' }} />{evidence.length > 0 && <div className="evidence-list">{evidence.map((entry) => <article key={entry.id}><div className="evidence-file"><strong>{entry.file.name}</strong><span>{(entry.file.size / 1024 / 1024).toFixed(2)} MB</span></div><select value={entry.type} onChange={(event) => setEvidence((current) => current.map((item) => item.id === entry.id ? { ...item, type: event.target.value } : item))}><option value="manifest_spreadsheet">{field.detailedManifest}</option><option value="packing_list">{field.packingList}</option><option value="bill_of_lading">{field.transportDocument}</option><option value="photo">{field.photo}</option></select><button type="button" onClick={() => setEvidence((current) => current.filter((item) => item.id !== entry.id))}>{field.remove}</button></article>)}</div>}{errors.evidence && <p className="field-error">{errors.evidence}</p>}</div><label className="confirmation-field simplified-confirmation"><input type="checkbox" checked={draft.confirmed} onChange={(event) => update('confirmed', event.target.checked)} /><span>✓</span><b>{field.confirmation}</b></label>{errors.confirmed && <p className="field-error">{errors.confirmed}</p>}{message && <p className="form-error">{message}</p>}</Section>
          <div className="monetary-submit"><button className="intake-button primary" type="submit" disabled={saving}>{saving ? field.saving : field.submit}</button></div>
        </form>
      </main>
    </div>
  )
}
