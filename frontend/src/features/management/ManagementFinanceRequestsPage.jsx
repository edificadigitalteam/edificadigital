import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-finance.css'
import './management-finance-requests.css'

const statusLabels = {
  es: { submitted: 'Recibida', in_review: 'En revisión', observed: 'Con observación', approved: 'Aprobada', rejected: 'Rechazada', released: 'Recursos liberados' },
  en: { submitted: 'Received', in_review: 'Under review', observed: 'Needs changes', approved: 'Approved', rejected: 'Rejected', released: 'Resources released' },
}

const copy = {
  es: {
    eyebrow: 'FINANZAS', title: 'Solicitudes de recursos', intro: 'Cada unidad registra aquí los recursos que necesita. Finanzas revisa, aprueba y luego libera el dinero desde un fondo institucional.',
    back: '← Volver a Finanzas', newRequest: '＋ Registrar solicitud de recursos', close: 'Cerrar', organization: 'Organización', unit: 'Unidad solicitante', period: 'Período de gestión', concept: '¿Para qué se requieren los recursos?', justification: 'Justificación', amount: 'Monto solicitado', currency: 'Moneda', neededBy: 'Fecha en que se necesitan', submit: 'Enviar solicitud a Finanzas', saving: 'Guardando…',
    inbox: 'SOLICITUDES DE RECURSOS', inboxTitle: 'Bandeja de solicitudes', inboxHelpManager: 'Aquí Finanzas recibe las solicitudes de todas las unidades y controla su aprobación antes de liberar dinero.', inboxHelpUnit: 'Aquí puedes consultar las solicitudes de recursos enviadas por tu unidad.', noRequests: 'Todavía no hay solicitudes de recursos registradas.', requested: 'Solicitado', approved: 'Aprobado', review: 'Revisar', release: 'Liberar recursos',
    reviewTitle: 'Revisión financiera', reviewStatus: 'Decisión / estado', notes: 'Observación de Finanzas', approvedAmount: 'Monto aprobado', apply: 'Guardar revisión', releaseTitle: 'Liberar recursos aprobados', fund: 'Fondo de origen', reference: 'Referencia / comprobante', releaseHelp: 'Solo las solicitudes aprobadas pueden liberar dinero. El egreso quedará registrado automáticamente en el fondo seleccionado.', releaseAction: 'Liberar dinero',
    submittedOk: 'Solicitud enviada a Finanzas.', reviewedOk: 'Solicitud actualizada.', releasedOk: 'Recursos liberados y movimiento financiero registrado.',
  },
  en: {
    eyebrow: 'FINANCE', title: 'Resource requests', intro: 'Each unit records the resources it needs here. Finance reviews, approves, and then releases the money from an institutional fund.',
    back: '← Back to Finance', newRequest: '＋ Register resource request', close: 'Close', organization: 'Organization', unit: 'Requesting unit', period: 'Management period', concept: 'What are the resources needed for?', justification: 'Justification', amount: 'Requested amount', currency: 'Currency', neededBy: 'Date resources are needed', submit: 'Send request to Finance', saving: 'Saving…',
    inbox: 'RESOURCE REQUESTS', inboxTitle: 'Request inbox', inboxHelpManager: 'Finance receives requests from every unit here and controls approval before releasing money.', inboxHelpUnit: 'Track resource requests submitted by your unit here.', noRequests: 'No resource requests have been recorded yet.', requested: 'Requested', approved: 'Approved', review: 'Review', release: 'Release resources',
    reviewTitle: 'Finance review', reviewStatus: 'Decision / status', notes: 'Finance notes', approvedAmount: 'Approved amount', apply: 'Save review', releaseTitle: 'Release approved resources', fund: 'Source fund', reference: 'Reference / proof', releaseHelp: 'Only approved requests can release money. The expense is automatically recorded against the selected fund.', releaseAction: 'Release money',
    submittedOk: 'Request sent to Finance.', reviewedOk: 'Request updated.', releasedOk: 'Resources released and financial movement recorded.',
  },
}

const emptyRequest = () => ({ unit_id: '', management_period_id: '', title: '', justification: '', requested_amount: '', currency: 'USD', needed_by: '' })
const emptyReview = () => ({ id: '', status: 'in_review', approved_amount: '', finance_notes: '' })
const emptyRelease = () => ({ id: '', fund_id: '', reference: '' })

function readLanguage() { try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function money(value, currency, language) { try { return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value || 0)) } catch { return `${Number(value || 0).toFixed(2)} ${currency || ''}` } }
function dateLabel(value, language) { if (!value) return '—'; return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0,10)}T00:00:00`)) }

export default function ManagementFinanceRequestsPage() {
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
  const [requests, setRequests] = useState([])
  const [activeForm, setActiveForm] = useState('')
  const [requestForm, setRequestForm] = useState(emptyRequest)
  const [reviewForm, setReviewForm] = useState(emptyReview)
  const [releaseForm, setReleaseForm] = useState(emptyRelease)
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
    const responses = await Promise.all([
      supabase.rpc('finance_access_overview', { target_organization_id: organizationId }),
      supabase.from('organization_unit').select('id,code,name,active').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('management_period').select('id,name,status,start_date').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.rpc('list_finance_funds', { target_organization_id: organizationId }),
      supabase.from('finance_resource_request').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      setOverview(responses[0].data ?? null)
      setUnits(responses[1].data ?? [])
      setPeriods(responses[2].data ?? [])
      setFunds(responses[3].data ?? [])
      setRequests(responses[4].data ?? [])
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const canManage = Boolean(overview?.can_manage_finance)
  const memberUnitIds = useMemo(() => new Set(overview?.unit_ids ?? []), [overview?.unit_ids])
  const availableUnits = useMemo(() => canManage ? units : units.filter((unit) => memberUnitIds.has(unit.id)), [canManage, memberUnitIds, units])
  const activePeriod = periods.find((period) => period.status === 'active') || periods[0]
  const unitFor = (id) => units.find((unit) => unit.id === id)
  const fundFor = (id) => funds.find((fund) => fund.id === id)

  useEffect(() => {
    setRequestForm((current) => ({ ...current, unit_id: current.unit_id || availableUnits[0]?.id || '', management_period_id: current.management_period_id || activePeriod?.id || '' }))
  }, [availableUnits, activePeriod?.id])

  const startNew = () => { setRequestForm({ ...emptyRequest(), unit_id: availableUnits[0]?.id || '', management_period_id: activePeriod?.id || '' }); setActiveForm('request'); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const startReview = (request) => { setReviewForm({ id: request.id, status: request.status === 'submitted' ? 'in_review' : request.status === 'released' ? 'approved' : request.status, approved_amount: request.approved_amount || request.requested_amount, finance_notes: request.finance_notes || '' }); setActiveForm('review'); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const startRelease = (request) => { const matching = funds.find((fund) => fund.active && fund.currency === request.currency); setReleaseForm({ id: request.id, fund_id: matching?.id || '', reference: '' }); setActiveForm('release'); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const saveRequest = async (event) => {
    event.preventDefault(); if (saving) return
    setSaving(true); setError(''); setMessage('')
    const { error: requestError } = await supabase.rpc('save_finance_resource_request', { payload: { ...requestForm, organization_id: organizationId } })
    if (requestError) setError(requestError.message)
    else { setMessage(t.submittedOk); setActiveForm(''); setRequestForm(emptyRequest()); await reload() }
    setSaving(false)
  }

  const saveReview = async (event) => {
    event.preventDefault(); if (saving) return
    setSaving(true); setError(''); setMessage('')
    const { error: requestError } = await supabase.rpc('review_finance_resource_request', { payload: reviewForm })
    if (requestError) setError(requestError.message)
    else { setMessage(t.reviewedOk); setActiveForm(''); await reload() }
    setSaving(false)
  }

  const releaseResources = async (event) => {
    event.preventDefault(); if (saving) return
    setSaving(true); setError(''); setMessage('')
    const { error: requestError } = await supabase.rpc('release_finance_resource_request', { payload: releaseForm })
    if (requestError) setError(requestError.message)
    else { setMessage(t.releasedOk); setActiveForm(''); await reload() }
    setSaving(false)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel finance-resource-requests-page">
      <div className="management-panel-heading"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div><div className="finance-request-heading-actions"><button type="button" onClick={() => window.location.assign('/app/management/finance')}>{t.back}</button><button className="primary" type="button" onClick={startNew}>{t.newRequest}</button></div></div>
      {isSuperAdmin && <section className="management-filter-row"><label><span>{t.organization}</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label></section>}
      {error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}

      {activeForm === 'request' && <form className="management-form-card finance-request-form" onSubmit={saveRequest}><div className="management-form-title"><div><small>{t.newRequest}</small><h2>{t.concept}</h2></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
        <label><span>{t.unit} *</span><select value={requestForm.unit_id} onChange={(event) => setRequestForm((current) => ({ ...current, unit_id: event.target.value }))} required>{availableUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
        <label><span>{t.period}</span><select value={requestForm.management_period_id} onChange={(event) => setRequestForm((current) => ({ ...current, management_period_id: event.target.value }))}><option value="">—</option>{periods.map((period) => <option value={period.id} key={period.id}>{period.name}</option>)}</select></label>
        <label className="wide"><span>{t.concept} *</span><input value={requestForm.title} onChange={(event) => setRequestForm((current) => ({ ...current, title: event.target.value }))} required /></label>
        <label className="wide"><span>{t.justification}</span><textarea value={requestForm.justification} onChange={(event) => setRequestForm((current) => ({ ...current, justification: event.target.value }))} /></label>
        <label><span>{t.amount} *</span><input type="number" min="0.01" step="0.01" value={requestForm.requested_amount} onChange={(event) => setRequestForm((current) => ({ ...current, requested_amount: event.target.value }))} required /></label>
        <label><span>{t.currency}</span><select value={requestForm.currency} onChange={(event) => setRequestForm((current) => ({ ...current, currency: event.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>
        <label><span>{t.neededBy}</span><input type="date" value={requestForm.needed_by} onChange={(event) => setRequestForm((current) => ({ ...current, needed_by: event.target.value }))} /></label>
      </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.submit}</button></div></form>}

      {activeForm === 'review' && canManage && <form className="management-form-card finance-request-form" onSubmit={saveReview}><div className="management-form-title"><div><small>{t.reviewTitle}</small><h2>{t.review}</h2></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
        <label><span>{t.reviewStatus}</span><select value={reviewForm.status} onChange={(event) => setReviewForm((current) => ({ ...current, status: event.target.value }))}><option value="in_review">{statusLabels[language].in_review}</option><option value="observed">{statusLabels[language].observed}</option><option value="approved">{statusLabels[language].approved}</option><option value="rejected">{statusLabels[language].rejected}</option></select></label>
        {reviewForm.status === 'approved' && <label><span>{t.approvedAmount}</span><input type="number" min="0.01" step="0.01" value={reviewForm.approved_amount} onChange={(event) => setReviewForm((current) => ({ ...current, approved_amount: event.target.value }))} required /></label>}
        <label className="wide"><span>{t.notes}</span><textarea value={reviewForm.finance_notes} onChange={(event) => setReviewForm((current) => ({ ...current, finance_notes: event.target.value }))} /></label>
      </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.apply}</button></div></form>}

      {activeForm === 'release' && canManage && <form className="management-form-card finance-request-form" onSubmit={releaseResources}><div className="management-form-title"><div><small>{t.releaseTitle}</small><h2>{t.release}</h2><p>{t.releaseHelp}</p></div><button type="button" onClick={() => setActiveForm('')}>{t.close}</button></div><div className="management-form-grid">
        <label className="wide"><span>{t.fund} *</span><select value={releaseForm.fund_id} onChange={(event) => setReleaseForm((current) => ({ ...current, fund_id: event.target.value }))} required><option value="">—</option>{funds.filter((fund) => fund.active).map((fund) => <option value={fund.id} key={fund.id}>{fund.code} · {fund.name} · {money(fund.balance,fund.currency,language)}</option>)}</select></label>
        <label className="wide"><span>{t.reference}</span><input value={releaseForm.reference} onChange={(event) => setReleaseForm((current) => ({ ...current, reference: event.target.value }))} /></label>
      </div><div className="management-form-actions"><button type="button" onClick={() => setActiveForm('')}>{t.close}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.releaseAction}</button></div></form>}

      {loading ? <div className="management-loading"><span /><p>...</p></div> : <section className="finance-resource-request-list"><div className="management-card-heading"><div><small>{t.inbox}</small><h2>{t.inboxTitle}</h2><p>{canManage ? t.inboxHelpManager : t.inboxHelpUnit}</p></div></div>{!requests.length ? <p className="management-empty">{t.noRequests}</p> : <div>{requests.map((request) => <article key={request.id}><div className="finance-request-unit"><span>{unitFor(request.unit_id)?.code || '—'}</span><small>{request.needed_by ? dateLabel(request.needed_by,language) : ''}</small></div><div className="finance-request-main"><strong>{request.title}</strong><p>{request.justification || '—'}</p>{request.finance_notes && <small><b>{language === 'en' ? 'Finance:' : 'Finanzas:'}</b> {request.finance_notes}</small>}</div><div className="finance-request-money"><strong>{money(request.requested_amount,request.currency,language)}</strong>{request.approved_amount && <small>{t.approved}: {money(request.approved_amount,request.currency,language)}</small>}<span className={`finance-request-status ${request.status}`}>{statusLabels[language][request.status]}</span>{request.released_from_fund_id && <small>{fundFor(request.released_from_fund_id)?.name || ''}</small>}</div><div className="finance-request-actions">{canManage && request.status !== 'released' && <button type="button" onClick={() => startReview(request)}>{t.review}</button>}{canManage && request.status === 'approved' && <button className="primary" type="button" onClick={() => startRelease(request)}>{t.release}</button>}</div></article>)}</div>}</section>}
    </div>
  </ManagementStandaloneShell>
}
