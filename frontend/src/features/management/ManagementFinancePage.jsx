import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-finance.css'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const allowedTypes = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/csv',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const statusLabels = {
  es: { draft: 'Borrador', submitted: 'Recibida', in_review: 'En revisión', approved: 'Aprobada', observed: 'Con observación', paid: 'Pagada', rejected: 'Rechazada' },
  en: { draft: 'Draft', submitted: 'Received', in_review: 'Under review', approved: 'Approved', observed: 'Needs changes', paid: 'Paid', rejected: 'Rejected' },
}
const fundTypes = {
  es: { bank_account: 'Cuenta bancaria', cash_box: 'Caja', internal_fund: 'Pote / fondo interno', digital_wallet: 'Billetera digital', other: 'Otro' },
  en: { bank_account: 'Bank account', cash_box: 'Cash box', internal_fund: 'Internal fund / envelope', digital_wallet: 'Digital wallet', other: 'Other' },
}
const docTypes = {
  es: { invoice: 'Factura', receipt: 'Recibo', quote: 'Presupuesto / cotización', payment_request: 'Solicitud de pago', other: 'Otro documento' },
  en: { invoice: 'Invoice', receipt: 'Receipt', quote: 'Quote', payment_request: 'Payment request', other: 'Other document' },
}
const movementTypes = {
  es: { income: 'Entrada de fondos', expense: 'Egreso manual', adjustment_in: 'Ajuste positivo', adjustment_out: 'Ajuste negativo' },
  en: { income: 'Funds received', expense: 'Manual expense', adjustment_in: 'Positive adjustment', adjustment_out: 'Negative adjustment' },
}

const copy = {
  es: {
    eyebrow: 'ADMINISTRACIÓN Y FINANZAS', title: 'Centro financiero institucional',
    introManager: 'Finanzas recibe la información de todas las unidades, administra fondos y registra la distribución y ejecución con trazabilidad.',
    introUnit: 'Carga facturas y solicitudes financieras de tu unidad y consulta su estado dentro del flujo financiero.',
    loading: 'Cargando información financiera…', organization: 'Organización', funds: 'Fondos activos', pending: 'Pendientes en Finanzas', paid: 'Pagadas', submittedTotal: 'Documentos recibidos',
    newInvoice: '＋ Cargar factura o solicitud', newFund: '＋ Crear fondo', movement: '＋ Registrar movimiento', transfer: '⇄ Transferir entre fondos', close: 'Cerrar',
    inbox: 'BANDEJA FINANCIERA', inboxTitle: 'Facturas y solicitudes', inboxHelpManager: 'Todo lo enviado por las unidades aparece aquí para revisión financiera.', inboxHelpUnit: 'Aquí puedes seguir las facturas y solicitudes enviadas por tu unidad.',
    noSubmissions: 'Todavía no hay documentos financieros registrados.', fundsTitle: 'Bancos, cajas y potes', noFunds: 'Todavía no existen fondos visibles.', ledger: 'MOVIMIENTOS', ledgerTitle: 'Últimos movimientos financieros', noMovements: 'Todavía no hay movimientos.',
    unit: 'Unidad', period: 'Período de gestión', documentType: 'Tipo de documento', vendor: 'Proveedor / beneficiario', documentNumber: 'N.º de factura o documento', documentDate: 'Fecha del documento', dueDate: 'Fecha de vencimiento', description: 'Concepto / descripción', amount: 'Monto', currency: 'Moneda', files: 'Factura y soportes', fileHelp: 'PDF, imagen, Excel o CSV · máximo 20 MB por archivo.', submit: 'Enviar a Finanzas', saving: 'Guardando…',
    fundName: 'Nombre del fondo', fundCode: 'Código', fundType: 'Tipo', institution: 'Banco / institución', accountRef: 'Referencia de cuenta', purpose: 'Propósito', assignedUnit: 'Dirección asignada (opcional)', openingBalance: 'Saldo inicial (opcional)', createFund: 'Crear fondo',
    selectFund: 'Fondo', movementType: 'Tipo de movimiento', date: 'Fecha', reference: 'Referencia', saveMovement: 'Registrar movimiento', sourceFund: 'Fondo de origen', targetFund: 'Fondo de destino', transferAmount: 'Monto a transferir', transferDescription: 'Motivo de la transferencia', saveTransfer: 'Transferir',
    review: 'Gestionar', financeAction: 'GESTIÓN FINANCIERA', reviewStatus: 'Decisión / estado', financeNotes: 'Observación financiera', paymentFund: 'Fondo desde el que se pagará', paymentReference: 'Referencia de pago', paymentProof: 'Comprobante de pago (opcional)', apply: 'Aplicar', attachments: 'archivos', assigned: 'Asignado a', available: 'Saldo', inflows: 'Entradas', outflows: 'Salidas',
    successInvoice: 'Documento enviado a Finanzas.', successFund: 'Fondo creado.', successMovement: 'Movimiento registrado.', successTransfer: 'Transferencia registrada.', successReview: 'Estado financiero actualizado.',
  },
  en: {
    eyebrow: 'ADMINISTRATION AND FINANCE', title: 'Institutional finance center',
    introManager: 'Finance receives financial information from all units, manages funds, and records distribution and execution with traceability.',
    introUnit: 'Upload invoices and financial requests from your unit and track their status through the finance workflow.',
    loading: 'Loading financial information…', organization: 'Organization', funds: 'Active funds', pending: 'Pending in Finance', paid: 'Paid', submittedTotal: 'Documents received',
    newInvoice: '＋ Upload invoice or request', newFund: '＋ Create fund', movement: '＋ Record movement', transfer: '⇄ Transfer between funds', close: 'Close',
    inbox: 'FINANCE INBOX', inboxTitle: 'Invoices and requests', inboxHelpManager: 'Everything submitted by the units appears here for Finance review.', inboxHelpUnit: 'Track invoices and requests submitted by your unit here.',
    noSubmissions: 'No financial documents have been recorded yet.', fundsTitle: 'Banks, cash boxes, and funds', noFunds: 'No visible funds yet.', ledger: 'MOVEMENTS', ledgerTitle: 'Latest financial movements', noMovements: 'No movements yet.',
    unit: 'Unit / directorate', period: 'Management period', documentType: 'Document type', vendor: 'Vendor / beneficiary', documentNumber: 'Invoice or document number', documentDate: 'Document date', dueDate: 'Due date', description: 'Purpose / description', amount: 'Amount', currency: 'Currency', files: 'Invoice and supporting files', fileHelp: 'PDF, image, Excel, or CSV · 20 MB maximum per file.', submit: 'Send to Finance', saving: 'Saving…',
    fundName: 'Fund name', fundCode: 'Code', fundType: 'Type', institution: 'Bank / institution', accountRef: 'Account reference', purpose: 'Purpose', assignedUnit: 'Assigned unit (optional)', openingBalance: 'Opening balance (optional)', createFund: 'Create fund',
    selectFund: 'Fund', movementType: 'Movement type', date: 'Date', reference: 'Reference', saveMovement: 'Record movement', sourceFund: 'Source fund', targetFund: 'Destination fund', transferAmount: 'Transfer amount', transferDescription: 'Transfer purpose', saveTransfer: 'Transfer',
    review: 'Manage', financeAction: 'FINANCE REVIEW', reviewStatus: 'Decision / status', financeNotes: 'Finance notes', paymentFund: 'Fund used for payment', paymentReference: 'Payment reference', paymentProof: 'Payment proof (optional)', apply: 'Apply', attachments: 'files', assigned: 'Assigned to', available: 'Balance', inflows: 'Inflows', outflows: 'Outflows',
    successInvoice: 'Document sent to Finance.', successFund: 'Fund created.', successMovement: 'Movement recorded.', successTransfer: 'Transfer recorded.', successReview: 'Financial status updated.',
  },
}

const today = () => new Date().toISOString().slice(0, 10)
const emptySubmission = () => ({ id: '', unit_id: '', management_period_id: '', document_type: 'invoice', vendor_name: '', document_number: '', document_date: today(), due_date: '', description: '', amount: '', currency: 'USD', existingAttachmentCount: 0 })
const emptyFund = () => ({ code: '', name: '', fund_type: 'internal_fund', institution: '', account_reference: '', currency: 'USD', purpose: '', owner_unit_id: '', opening_balance: '', opening_date: today(), opening_reference: '' })
const emptyMovement = () => ({ fund_id: '', unit_id: '', movement_type: 'income', occurred_on: today(), amount: '', description: '', reference: '' })
const emptyTransfer = () => ({ from_fund_id: '', to_fund_id: '', occurred_on: today(), amount: '', description: '', reference: '' })
const emptyReview = () => ({ id: '', status: 'in_review', fund_id: '', diaf_notes: '', payment_reference: '' })

function readLanguage() { try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function formatMoney(value, currency, language) { try { return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value || 0)) } catch { return `${Number(value || 0).toFixed(2)} ${currency || ''}` } }
function formatDate(value, language) { if (!value) return '—'; return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0,10)}T00:00:00`)) }
function sanitizeFileName(name) { const dot = name.lastIndexOf('.'); const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : ''; const base = (dot >= 0 ? name.slice(0,dot) : name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'archivo'; return `${base}${ext}` }

export default function ManagementFinancePage() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(readLanguage)
  const t = copy[language]
  const isSuperAdmin = access.role === 'super_admin'
  const [organizations, setOrganizations] = useState([])
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [overview, setOverview] = useState(null)
  const [units, setUnits] = useState([])
  const [periods, setPeriods] = useState([])
  const [funds, setFunds] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [transactions, setTransactions] = useState([])
  const [attachments, setAttachments] = useState([])
  const [activeForm, setActiveForm] = useState('')
  const [submissionForm, setSubmissionForm] = useState(emptySubmission)
  const [submissionFiles, setSubmissionFiles] = useState([])
  const [fundForm, setFundForm] = useState(emptyFund)
  const [movementForm, setMovementForm] = useState(emptyMovement)
  const [transferForm, setTransferForm] = useState(emptyTransfer)
  const [reviewForm, setReviewForm] = useState(emptyReview)
  const [paymentFiles, setPaymentFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { const observer = new MutationObserver(() => setLanguage(readLanguage())); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); return () => observer.disconnect() }, [])
  useEffect(() => { if (access.status === 'authorized') setOrganizationId((current) => current || access.organizationId || '') }, [access.organizationId, access.status])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) { setOrganizations(access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : []); return }
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) setError(requestError.message)
    else { setOrganizations(data ?? []); setOrganizationId((current) => current || data?.find((item) => item.code === 'cnbv')?.id || data?.[0]?.id || '') }
  }, [access.organizationId, access.organizationName, access.status, isSuperAdmin])

  const reload = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const [overviewResponse, unitResponse, periodResponse, fundResponse, submissionResponse, transactionResponse, attachmentResponse] = await Promise.all([
      supabase.rpc('finance_access_overview', { target_organization_id: organizationId }),
      supabase.from('organization_unit').select('id, code, name, unit_type, active').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('management_period').select('id, name, status, start_date, end_date').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.rpc('list_finance_funds', { target_organization_id: organizationId }),
      supabase.from('finance_submission').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('finance_transaction').select('*').eq('organization_id', organizationId).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('finance_submission_attachment').select('*').eq('organization_id', organizationId).order('created_at'),
    ])
    const firstError = [overviewResponse, unitResponse, periodResponse, fundResponse, submissionResponse, transactionResponse, attachmentResponse].find((response) => response.error)?.error
    if (firstError) { setError(firstError.message); setLoading(false); return }
    const nextAttachments = await Promise.all((attachmentResponse.data ?? []).map(async (item) => { const { data } = await supabase.storage.from('attachments').createSignedUrl(item.storage_path, 3600); return { ...item, signed_url: data?.signedUrl ?? '' } }))
    setOverview(overviewResponse.data ?? null); setUnits(unitResponse.data ?? []); setPeriods(periodResponse.data ?? []); setFunds(fundResponse.data ?? []); setSubmissions(submissionResponse.data ?? []); setTransactions(transactionResponse.data ?? []); setAttachments(nextAttachments)
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const canManage = Boolean(overview?.can_manage_finance)
  const memberUnitIds = useMemo(() => new Set(overview?.unit_ids ?? []), [overview?.unit_ids])
  const availableUnits = useMemo(() => canManage ? units : units.filter((unit) => memberUnitIds.has(unit.id)), [canManage, memberUnitIds, units])
  const activeFunds = funds.filter((fund) => fund.active)
  const pendingCount = submissions.filter((item) => ['submitted','in_review','approved','observed'].includes(item.status)).length
  const paidCount = submissions.filter((item) => item.status === 'paid').length
  const attachmentsFor = (id) => attachments.filter((item) => item.submission_id === id)
  const fundFor = (id) => funds.find((item) => item.id === id)
  const unitFor = (id) => units.find((item) => item.id === id)

  useEffect(() => {
    if (!submissionForm.unit_id && availableUnits[0]) setSubmissionForm((current) => ({ ...current, unit_id: availableUnits[0].id }))
  }, [availableUnits, submissionForm.unit_id])

  const chooseFiles = (event, setter) => {
    const selected = Array.from(event.target.files ?? [])
    const invalid = selected.find((file) => !allowedTypes.has(file.type) || file.size > MAX_FILE_SIZE)
    if (invalid) setError(`${invalid.name}: ${language === 'en' ? 'use PDF, image, Excel or CSV up to 20 MB.' : 'usa PDF, imagen, Excel o CSV de máximo 20 MB.'}`)
    else { setError(''); setter((current) => [...current, ...selected]) }
    event.target.value = ''
  }

  const uploadAttachments = async (submissionId, files, attachmentType) => {
    for (const file of files) {
      const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const path = `${organizationId}/finance/${submissionId}/${unique}-${sanitizeFileName(file.name)}`
      const upload = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
      if (upload.error) throw upload.error
      const { error: recordError } = await supabase.rpc('record_finance_attachment', { payload: { submission_id: submissionId, attachment_type: attachmentType, storage_path: upload.data?.path ?? path, file_name: file.name, mime_type: file.type, file_size_bytes: file.size } })
      if (recordError) { await supabase.storage.from('attachments').remove([upload.data?.path ?? path]); throw recordError }
    }
  }

  const saveSubmission = async (event) => {
    event.preventDefault(); if (saving) return
    if (!submissionForm.unit_id || !submissionForm.description.trim() || Number(submissionForm.amount) <= 0) return setError(language === 'en' ? 'Complete the unit, description and amount.' : 'Completa la Dirección, descripción y monto.')
    if (!submissionFiles.length && !submissionForm.existingAttachmentCount) return setError(language === 'en' ? 'Attach the invoice or supporting document.' : 'Adjunta la factura o documento de soporte.')
    setSaving(true); setError(''); setMessage('')
    try {
      const payload = { ...submissionForm, organization_id: organizationId, status: 'draft' }
      const { data: draftId, error: draftError } = await supabase.rpc('save_finance_submission', { payload }); if (draftError) throw draftError
      if (submissionFiles.length) await uploadAttachments(draftId, submissionFiles, submissionForm.document_type === 'invoice' ? 'invoice' : 'support')
      const { error: submitError } = await supabase.rpc('save_finance_submission', { payload: { ...payload, id: draftId, status: 'submitted' } }); if (submitError) throw submitError
      setSubmissionForm({ ...emptySubmission(), unit_id: availableUnits[0]?.id || '' }); setSubmissionFiles([]); setActiveForm(''); setMessage(t.successInvoice); await reload()
    } catch (requestError) { setError(requestError?.message ?? 'Error') }
    setSaving(false)
  }

  const saveFund = async (event) => {
    event.preventDefault(); if (saving) return
    setSaving(true); setError(''); setMessage('')
    const { error: requestError } = await supabase.rpc('save_finance_fund', { payload: { ...fundForm, organization_id: organizationId } })
    if (requestError) setError(requestError.message); else { setFundForm(emptyFund()); setActiveForm(''); setMessage(t.successFund); await reload() }
    setSaving(false)
  }

  const saveMovement = async (event) => {
    event.preventDefault(); if (saving) return
    setSaving(true); setError(''); setMessage('')
    const { error: requestError } = await supabase.rpc('record_finance_movement', { payload: movementForm })
    if (requestError) setError(requestError.message); else { setMovementForm(emptyMovement()); setActiveForm(''); setMessage(t.successMovement); await reload() }
    setSaving(false)
  }

  const saveTransfer = async (event) => {
    event.preventDefault(); if (saving) return
    setSaving(true); setError(''); setMessage('')
    const { error: requestError } = await supabase.rpc('transfer_finance_funds', { payload: transferForm })
    if (requestError) setError(requestError.message); else { setTransferForm(emptyTransfer()); setActiveForm(''); setMessage(t.successTransfer); await reload() }
    setSaving(false)
  }

  const startReview = (submission) => {
    setReviewForm({ ...emptyReview(), id: submission.id, status: submission.status === 'submitted' ? 'in_review' : submission.status === 'paid' ? 'paid' : submission.status, fund_id: submission.fund_id || '', diaf_notes: submission.diaf_notes || '', payment_reference: submission.payment_reference || '' })
    setPaymentFiles([]); setActiveForm('review'); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveReview = async (event) => {
    event.preventDefault(); if (saving || !reviewForm.id) return
    setSaving(true); setError(''); setMessage('')
    try {
      if (reviewForm.status === 'paid' && paymentFiles.length) await uploadAttachments(reviewForm.id, paymentFiles, 'payment_proof')
      const { error: requestError } = await supabase.rpc('review_finance_submission', { payload: reviewForm }); if (requestError) throw requestError
      setReviewForm(emptyReview()); setPaymentFiles([]); setActiveForm(''); setMessage(t.successReview); await reload()
    } catch (requestError) { setError(requestError?.message ?? 'Error') }
    setSaving(false)
  }

  const editObserved = (submission) => {
    setSubmissionForm({ id: submission.id, unit_id: submission.unit_id, management_period_id: submission.management_period_id || '', document_type: submission.document_type, vendor_name: submission.vendor_name || '', document_number: submission.document_number || '', document_date: submission.document_date, due_date: submission.due_date || '', description: submission.description, amount: submission.amount, currency: submission.currency, existingAttachmentCount: attachmentsFor(submission.id).length })
    setSubmissionFiles([]); setActiveForm('submission'); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel finance-page">
      <div className="management-panel-heading"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{canManage ? t.introManager : t.introUnit}</span></div><div className="finance-heading-actions"><button type="button" onClick={() => { setActiveForm('submission'); setError(''); setMessage('') }}>{t.newInvoice}</button>{canManage && <button className="secondary" type="button" onClick={() => setActiveForm('fund')}>{t.newFund}</button>}</div></div>
      {isSuperAdmin && <section className="management-filter-row"><label><span>{t.organization}</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label></section>}
      {error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}
      {loading ? <div className="management-loading"><span /><p>{t.loading}</p></div> : <>
        <section className="finance-summary-grid"><article><span>{t.funds}</span><strong>{activeFunds.length}</strong></article><article><span>{t.pending}</span><strong>{pendingCount}</strong></article><article><span>{t.paid}</span><strong>{paidCount}</strong></article><article><span>{t.submittedTotal}</span><strong>{submissions.length}</strong></article></section>

        {activeForm === 'submission' && <form className="management-form-card finance-form" onSubmit={saveSubmission}><div className="management-form-title"><div><small>{t.inbox}</small><h2>{submissionForm.id ? (language === 'en' ? 'Correct financial document' : 'Corregir documento financiero') : t.newInvoice.replace('＋ ','')}</h2></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
          <label><span>{t.unit} *</span><select value={submissionForm.unit_id} onChange={(e) => setSubmissionForm((c) => ({ ...c, unit_id: e.target.value }))} required>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
          <label><span>{t.period}</span><select value={submissionForm.management_period_id} onChange={(e) => setSubmissionForm((c) => ({ ...c, management_period_id: e.target.value }))}><option value="">—</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label>
          <label><span>{t.documentType}</span><select value={submissionForm.document_type} onChange={(e) => setSubmissionForm((c) => ({ ...c, document_type: e.target.value }))}>{Object.entries(docTypes[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{t.vendor}</span><input value={submissionForm.vendor_name} onChange={(e) => setSubmissionForm((c) => ({ ...c, vendor_name: e.target.value }))} /></label>
          <label><span>{t.documentNumber}</span><input value={submissionForm.document_number} onChange={(e) => setSubmissionForm((c) => ({ ...c, document_number: e.target.value }))} /></label>
          <label><span>{t.documentDate} *</span><input type="date" value={submissionForm.document_date} onChange={(e) => setSubmissionForm((c) => ({ ...c, document_date: e.target.value }))} required /></label>
          <label><span>{t.dueDate}</span><input type="date" value={submissionForm.due_date} onChange={(e) => setSubmissionForm((c) => ({ ...c, due_date: e.target.value }))} /></label>
          <label><span>{t.amount} *</span><input type="number" min="0.01" step="0.01" value={submissionForm.amount} onChange={(e) => setSubmissionForm((c) => ({ ...c, amount: e.target.value }))} required /></label>
          <label><span>{t.currency}</span><select value={submissionForm.currency} onChange={(e) => setSubmissionForm((c) => ({ ...c, currency: e.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>
          <label className="wide"><span>{t.description} *</span><textarea value={submissionForm.description} onChange={(e) => setSubmissionForm((c) => ({ ...c, description: e.target.value }))} required /></label>
          <div className="wide finance-file-field"><strong>{t.files}</strong><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv" onChange={(event) => chooseFiles(event, setSubmissionFiles)} /><small>{t.fileHelp}</small>{submissionFiles.length > 0 && <div>{submissionFiles.map((file,index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setSubmissionFiles((current) => current.filter((_,i) => i!==index))}>×</button></span>)}</div>}</div>
        </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.submit}</button></div></form>}

        {canManage && activeForm === 'fund' && <form className="management-form-card finance-form" onSubmit={saveFund}><div className="management-form-title"><div><small>{t.financeAction}</small><h2>{t.newFund.replace('＋ ','')}</h2></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
          <label><span>{t.fundCode} *</span><input value={fundForm.code} onChange={(e) => setFundForm((c) => ({ ...c, code: e.target.value }))} placeholder="FONDO-01" required /></label><label><span>{t.fundName} *</span><input value={fundForm.name} onChange={(e) => setFundForm((c) => ({ ...c, name: e.target.value }))} required /></label>
          <label><span>{t.fundType}</span><select value={fundForm.fund_type} onChange={(e) => setFundForm((c) => ({ ...c, fund_type: e.target.value }))}>{Object.entries(fundTypes[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>{t.currency}</span><select value={fundForm.currency} onChange={(e) => setFundForm((c) => ({ ...c, currency: e.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>
          <label><span>{t.institution}</span><input value={fundForm.institution} onChange={(e) => setFundForm((c) => ({ ...c, institution: e.target.value }))} /></label><label><span>{t.accountRef}</span><input value={fundForm.account_reference} onChange={(e) => setFundForm((c) => ({ ...c, account_reference: e.target.value }))} /></label>
          <label><span>{t.assignedUnit}</span><select value={fundForm.owner_unit_id} onChange={(e) => setFundForm((c) => ({ ...c, owner_unit_id: e.target.value }))}><option value="">{language === 'en' ? 'Institutional' : 'Institucional'}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label><label><span>{t.openingBalance}</span><input type="number" min="0" step="0.01" value={fundForm.opening_balance} onChange={(e) => setFundForm((c) => ({ ...c, opening_balance: e.target.value }))} /></label>
          <label className="wide"><span>{t.purpose}</span><textarea value={fundForm.purpose} onChange={(e) => setFundForm((c) => ({ ...c, purpose: e.target.value }))} /></label>
        </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.createFund}</button></div></form>}

        {canManage && activeForm === 'movement' && <form className="management-form-card finance-form compact" onSubmit={saveMovement}><div className="management-form-title"><div><small>{t.financeAction}</small><h2>{t.movement.replace('＋ ','')}</h2></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
          <label><span>{t.selectFund} *</span><select value={movementForm.fund_id} onChange={(e) => setMovementForm((c) => ({ ...c, fund_id: e.target.value }))} required><option value="">—</option>{activeFunds.map((fund) => <option key={fund.id} value={fund.id}>{fund.code} · {fund.name} · {formatMoney(fund.balance,fund.currency,language)}</option>)}</select></label><label><span>{t.movementType}</span><select value={movementForm.movement_type} onChange={(e) => setMovementForm((c) => ({ ...c, movement_type: e.target.value }))}>{Object.entries(movementTypes[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{t.unit}</span><select value={movementForm.unit_id} onChange={(e) => setMovementForm((c) => ({ ...c, unit_id: e.target.value }))}><option value="">{language === 'en' ? 'Institutional' : 'Institucional'}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label><label><span>{t.date}</span><input type="date" value={movementForm.occurred_on} onChange={(e) => setMovementForm((c) => ({ ...c, occurred_on: e.target.value }))} /></label>
          <label><span>{t.amount} *</span><input type="number" min="0.01" step="0.01" value={movementForm.amount} onChange={(e) => setMovementForm((c) => ({ ...c, amount: e.target.value }))} required /></label><label><span>{t.reference}</span><input value={movementForm.reference} onChange={(e) => setMovementForm((c) => ({ ...c, reference: e.target.value }))} /></label><label className="wide"><span>{t.description} *</span><textarea value={movementForm.description} onChange={(e) => setMovementForm((c) => ({ ...c, description: e.target.value }))} required /></label>
        </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.saveMovement}</button></div></form>}

        {canManage && activeForm === 'transfer' && <form className="management-form-card finance-form compact" onSubmit={saveTransfer}><div className="management-form-title"><div><small>{t.financeAction}</small><h2>{t.transfer.replace('⇄ ','')}</h2></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
          <label><span>{t.sourceFund} *</span><select value={transferForm.from_fund_id} onChange={(e) => setTransferForm((c) => ({ ...c, from_fund_id: e.target.value }))} required><option value="">—</option>{activeFunds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name} · {formatMoney(fund.balance,fund.currency,language)}</option>)}</select></label><label><span>{t.targetFund} *</span><select value={transferForm.to_fund_id} onChange={(e) => setTransferForm((c) => ({ ...c, to_fund_id: e.target.value }))} required><option value="">—</option>{activeFunds.filter((fund) => fund.id !== transferForm.from_fund_id).map((fund) => <option key={fund.id} value={fund.id}>{fund.name} · {fund.currency}</option>)}</select></label>
          <label><span>{t.transferAmount} *</span><input type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm((c) => ({ ...c, amount: e.target.value }))} required /></label><label><span>{t.date}</span><input type="date" value={transferForm.occurred_on} onChange={(e) => setTransferForm((c) => ({ ...c, occurred_on: e.target.value }))} /></label><label><span>{t.reference}</span><input value={transferForm.reference} onChange={(e) => setTransferForm((c) => ({ ...c, reference: e.target.value }))} /></label><label className="wide"><span>{t.transferDescription} *</span><textarea value={transferForm.description} onChange={(e) => setTransferForm((c) => ({ ...c, description: e.target.value }))} required /></label>
        </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.saveTransfer}</button></div></form>}

        {canManage && activeForm === 'review' && <form className="management-form-card finance-form compact" onSubmit={saveReview}><div className="management-form-title"><div><small>{t.financeAction}</small><h2>{submissions.find((item) => item.id === reviewForm.id)?.description}</h2></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
          <label><span>{t.reviewStatus}</span><select value={reviewForm.status} onChange={(e) => setReviewForm((c) => ({ ...c, status: e.target.value }))}><option value="in_review">{statusLabels[language].in_review}</option><option value="approved">{statusLabels[language].approved}</option><option value="observed">{statusLabels[language].observed}</option><option value="rejected">{statusLabels[language].rejected}</option><option value="paid">{statusLabels[language].paid}</option></select></label>
          {reviewForm.status === 'paid' && <label><span>{t.paymentFund} *</span><select value={reviewForm.fund_id} onChange={(e) => setReviewForm((c) => ({ ...c, fund_id: e.target.value }))} required><option value="">—</option>{activeFunds.filter((fund) => fund.currency === submissions.find((item) => item.id === reviewForm.id)?.currency).map((fund) => <option key={fund.id} value={fund.id}>{fund.name} · {formatMoney(fund.balance,fund.currency,language)}</option>)}</select></label>}
          {reviewForm.status === 'paid' && <label><span>{t.paymentReference}</span><input value={reviewForm.payment_reference} onChange={(e) => setReviewForm((c) => ({ ...c, payment_reference: e.target.value }))} /></label>}
          <label className="wide"><span>{t.financeNotes}</span><textarea value={reviewForm.diaf_notes} onChange={(e) => setReviewForm((c) => ({ ...c, diaf_notes: e.target.value }))} /></label>
          {reviewForm.status === 'paid' && <div className="wide finance-file-field"><strong>{t.paymentProof}</strong><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => chooseFiles(event,setPaymentFiles)} />{paymentFiles.length > 0 && <div>{paymentFiles.map((file,index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setPaymentFiles((current) => current.filter((_,i) => i!==index))}>×</button></span>)}</div>}</div>}
        </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.apply}</button></div></form>}

        <section className="finance-inbox-card"><div className="management-card-heading"><div><small>{t.inbox}</small><h2>{t.inboxTitle}</h2><p>{canManage ? t.inboxHelpManager : t.inboxHelpUnit}</p></div></div>{!submissions.length ? <p className="management-empty">{t.noSubmissions}</p> : <div className="finance-submission-list">{submissions.map((submission) => { const unit = unitFor(submission.unit_id); const docs = attachmentsFor(submission.id); const financeNotes = submission.diaf_notes; return <article key={submission.id}><div className="finance-submission-unit"><span>{unit?.code || '—'}</span><small>{formatDate(submission.document_date,language)}</small></div><div className="finance-submission-main"><strong>{submission.description}</strong><span>{submission.vendor_name || docTypes[language][submission.document_type]}{submission.document_number ? ` · ${submission.document_number}` : ''}</span><div className="finance-file-links">{docs.map((file) => <a key={file.id} href={file.signed_url || '#'} target="_blank" rel="noreferrer">{file.attachment_type === 'payment_proof' ? (language === 'en' ? 'Payment proof' : 'Comprobante') : file.file_name}</a>)}</div>{financeNotes && <p><b>{language === 'en' ? 'Finance:' : 'Finanzas:'}</b> {financeNotes}</p>}</div><div className="finance-submission-amount"><strong>{formatMoney(submission.amount,submission.currency,language)}</strong><span className={`finance-status ${submission.status}`}>{statusLabels[language][submission.status]}</span>{submission.fund_id && <small>{fundFor(submission.fund_id)?.name || ''}</small>}</div><div className="finance-submission-actions">{canManage && submission.status !== 'paid' && <button type="button" onClick={() => startReview(submission)}>{t.review}</button>}{!canManage && submission.status === 'observed' && <button type="button" onClick={() => editObserved(submission)}>{language === 'en' ? 'Correct' : 'Corregir'}</button>}</div></article> })}</div>}</section>

        <section className="finance-funds-section"><div className="management-card-heading"><div><small>{t.financeAction}</small><h2>{t.fundsTitle}</h2></div>{canManage && <div className="finance-inline-actions"><button type="button" onClick={() => setActiveForm('movement')}>{t.movement}</button><button type="button" onClick={() => setActiveForm('transfer')}>{t.transfer}</button></div>}</div>{!funds.length ? <p className="management-empty">{t.noFunds}</p> : <div className="finance-fund-grid">{funds.map((fund) => <article key={fund.id}><header><span>{fund.code}</span><b>{fundTypes[language][fund.fund_type]}</b></header><h3>{fund.name}</h3><p>{fund.purpose || fund.institution || '—'}</p><strong>{formatMoney(fund.balance,fund.currency,language)}</strong><small>{t.available}</small><footer><span>{t.inflows}: {formatMoney(fund.inflows,fund.currency,language)}</span><span>{t.outflows}: {formatMoney(fund.outflows,fund.currency,language)}</span>{fund.owner_unit_code && <span>{t.assigned}: {fund.owner_unit_code}</span>}</footer></article>)}</div>}</section>

        <section className="finance-ledger-card"><div className="management-card-heading"><div><small>{t.ledger}</small><h2>{t.ledgerTitle}</h2></div></div>{!transactions.length ? <p className="management-empty">{t.noMovements}</p> : <div className="finance-ledger-table"><div className="finance-ledger-head"><span>{t.date}</span><span>{t.selectFund}</span><span>{t.description}</span><span>{t.unit}</span><span>{t.amount}</span></div>{transactions.slice(0,40).map((movement) => { const outgoing = ['expense','transfer_out','adjustment_out'].includes(movement.movement_type); return <div key={movement.id}><span>{formatDate(movement.occurred_on,language)}</span><span>{fundFor(movement.fund_id)?.name || '—'}</span><span>{movement.description}<small>{movement.reference || ''}</small></span><span>{unitFor(movement.unit_id)?.code || '—'}</span><strong className={outgoing ? 'out' : 'in'}>{outgoing ? '−' : '+'}{formatMoney(movement.amount,movement.currency,language)}</strong></div> })}</div>}</section>
      </>}
    </div>
  </ManagementStandaloneShell>
}
