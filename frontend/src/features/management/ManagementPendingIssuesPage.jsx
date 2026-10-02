import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import {
  canEditPendingIssue,
  pendingIssueStatusMeta,
  pendingIssueSummary,
  pendingIssueUrgencyMeta,
  sortPendingIssues,
} from './pendingIssues.js'
import { visibleUnits, defaultOwnUnitId } from './unitScope.js'
import './management-pending-issues.css'

const copy = {
  es: {
    eyebrow: 'CONTROL Y SEGUIMIENTO',
    title: 'Asuntos pendientes',
    intro: 'Registra compromisos, da seguimiento a su avance y prioriza lo que requiere atención en cada Dirección.',
    period: 'Período',
    unit: 'Dirección / agencia',
    myUnit: 'Mi Dirección',
    consolidated: 'Consolidado institucional',
    consolidatedHelp: 'Ves los asuntos de tu unidad y de las unidades que dependen de ella.',
    ownHelp: 'Cada Dirección administra únicamente sus propios asuntos.',
    newIssue: '＋ Nuevo asunto',
    editIssue: 'Editar asunto',
    createIssue: 'Nuevo asunto pendiente',
    close: 'Cerrar',
    cancel: 'Cancelar',
    save: 'Guardar asunto',
    saving: 'Guardando…',
    titleField: 'Asunto',
    description: 'Descripción',
    status: 'Seguimiento',
    urgency: 'Urgencia',
    dueDate: 'Fecha límite (opcional)',
    search: 'Buscar',
    searchPlaceholder: 'Buscar por asunto o descripción',
    allStatuses: 'Todos los estados',
    allUrgencies: 'Todas las urgencias',
    allUnits: 'Todas las Direcciones',
    clearFilters: 'Limpiar',
    pending: 'Pendientes',
    inProgress: 'En proceso',
    completed: 'Realizados',
    urgent: 'Alta / Crítica',
    visible: 'Asuntos visibles',
    noIssues: 'Todavía no hay asuntos en este contexto.',
    due: 'Fecha límite',
    withoutDue: 'Sin fecha límite',
    updated: 'Actualizado',
    edit: 'Editar',
    saved: 'Asunto guardado.',
    noUnitAccess: 'Tu usuario todavía no está asignado a una Dirección o agencia con acceso a este módulo.',
    loading: 'Cargando asuntos pendientes…',
    required: 'Completa el asunto y la descripción.',
  },
  en: {
    eyebrow: 'CONTROL AND FOLLOW-UP',
    title: 'Pending issues',
    intro: 'Register commitments, track progress and prioritize the matters that require attention in each unit.',
    period: 'Period',
    unit: 'Unit / agency',
    myUnit: 'My unit',
    consolidated: 'Institutional consolidated',
    consolidatedHelp: 'You see the pending issues of your unit and of the units below it.',
    ownHelp: 'Each unit manages only its own pending issues.',
    newIssue: '＋ New issue',
    editIssue: 'Edit issue',
    createIssue: 'New pending issue',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save issue',
    saving: 'Saving…',
    titleField: 'Issue',
    description: 'Description',
    status: 'Tracking',
    urgency: 'Urgency',
    dueDate: 'Due date (optional)',
    search: 'Search',
    searchPlaceholder: 'Search issue or description',
    allStatuses: 'All statuses',
    allUrgencies: 'All urgency levels',
    allUnits: 'All units',
    clearFilters: 'Clear',
    pending: 'Pending',
    inProgress: 'In progress',
    completed: 'Completed',
    urgent: 'High / Critical',
    visible: 'Visible issues',
    noIssues: 'There are no issues in this context yet.',
    due: 'Due date',
    withoutDue: 'No due date',
    updated: 'Updated',
    edit: 'Edit',
    saved: 'Issue saved.',
    noUnitAccess: 'Your user is not assigned to a unit or agency with access to this module yet.',
    loading: 'Loading pending issues…',
    required: 'Complete the issue and description.',
  },
}

const emptyForm = () => ({
  id: '',
  title: '',
  description: '',
  status: 'pending',
  urgency: 'medium',
  due_date: '',
})

function readLanguage() {
  try {
    return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

function dateLabel(value, language) {
  if (!value) return ''
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function timestampLabel(value, language) {
  if (!value) return ''
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

export default function ManagementPendingIssuesPage() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(readLanguage)
  const t = copy[language]
  const [periods, setPeriods] = useState([])
  const [units, setUnits] = useState([])
  const [issues, setIssues] = useState([])
  const [moduleAccess, setModuleAccess] = useState({ is_digen: false, unit_ids: [], can_view_consolidated: false, digen_unit_id: null })
  const [periodId, setPeriodId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [scope, setScope] = useState('mine')
  const [consolidatedUnitId, setConsolidatedUnitId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const organizationId = access.organizationId || ''

  useEffect(() => {
    const observer = new MutationObserver(() => setLanguage(readLanguage()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  const loadData = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const responses = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('organization_unit').select('id,organization_id,code,name,active,sort_order').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('unit_pending_issue').select('*').eq('organization_id', organizationId).order('updated_at', { ascending: false }),
      supabase.rpc('pending_issue_access_overview', { target_organization_id: organizationId }),
    ])

    const firstError = responses.find((response) => response.error)?.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const periodRows = responses[0].data ?? []
    const unitRows = responses[1].data ?? []
    const nextAccess = responses[3].data ?? { is_digen: false, unit_ids: [] }

    setPeriods(periodRows)
    setUnits(unitRows)
    setIssues(responses[2].data ?? [])
    setModuleAccess(nextAccess)
    setPeriodId((current) => periodRows.some((period) => period.id === current)
      ? current
      : periodRows.find((period) => period.status === 'active')?.id || periodRows[0]?.id || '')
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadData() }, [loadData])

  const ownUnitIds = useMemo(() => new Set(moduleAccess.unit_ids ?? []), [moduleAccess.unit_ids])
  const ownUnits = useMemo(() => units.filter((unit) => ownUnitIds.has(unit.id)), [units, ownUnitIds])
  const defaultUnitId = defaultOwnUnitId(units, moduleAccess)
  const consolidatedUnits = useMemo(() => visibleUnits(units, moduleAccess), [units, moduleAccess])

  useEffect(() => {
    setSelectedUnitId((current) => ownUnitIds.has(current) ? current : defaultUnitId)
  }, [defaultUnitId, ownUnitIds])

  const currentUnit = units.find((unit) => unit.id === selectedUnitId)
  const canCreate = Boolean(periodId && selectedUnitId && ownUnitIds.has(selectedUnitId))

  const periodIssues = useMemo(
    () => issues.filter((issue) => issue.management_period_id === periodId),
    [issues, periodId],
  )

  const contextIssues = useMemo(() => {
    if (scope === 'consolidated' && moduleAccess.is_digen) {
      return consolidatedUnitId ? periodIssues.filter((issue) => issue.unit_id === consolidatedUnitId) : periodIssues
    }
    return periodIssues.filter((issue) => issue.unit_id === selectedUnitId)
  }, [scope, moduleAccess.is_digen, consolidatedUnitId, periodIssues, selectedUnitId])

  const summary = useMemo(() => pendingIssueSummary(contextIssues), [contextIssues])

  const visibleIssues = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = contextIssues.filter((issue) => {
      if (statusFilter && issue.status !== statusFilter) return false
      if (urgencyFilter && issue.urgency !== urgencyFilter) return false
      if (needle && !`${issue.title} ${issue.description}`.toLowerCase().includes(needle)) return false
      return true
    })
    return sortPendingIssues(filtered)
  }, [contextIssues, search, statusFilter, urgencyFilter])

  const reloadIssues = async () => {
    const { data, error: requestError } = await supabase
      .from('unit_pending_issue')
      .select('*')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
    if (requestError) setError(requestError.message)
    else setIssues(data ?? [])
  }

  const openNew = () => {
    if (!canCreate || saving) return
    setForm(emptyForm())
    setFormOpen(true)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openEdit = (issue) => {
    if (!canEditPendingIssue(issue, { ownUnitIds: [...ownUnitIds], isDigen: moduleAccess.is_digen })) return
    setSelectedUnitId(issue.unit_id)
    setScope('mine')
    setForm({
      ...emptyForm(),
      ...issue,
      due_date: issue.due_date || '',
    })
    setFormOpen(true)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveIssue = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canCreate) return
    if (!form.title.trim() || !form.description.trim()) {
      setError(t.required)
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    const payload = {
      organization_id: organizationId,
      management_period_id: periodId,
      unit_id: selectedUnitId,
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      urgency: form.urgency,
      due_date: form.due_date || null,
      updated_by: access.userId || null,
      ...(form.id ? {} : { created_by: access.userId || null }),
    }

    const request = form.id
      ? supabase.from('unit_pending_issue').update(payload).eq('id', form.id).eq('unit_id', selectedUnitId)
      : supabase.from('unit_pending_issue').insert(payload)

    const { error: requestError } = await request
    if (requestError) setError(requestError.message)
    else {
      setFormOpen(false)
      setForm(emptyForm())
      setMessage(t.saved)
      await reloadIssues()
    }
    setSaving(false)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setUrgencyFilter('')
    setConsolidatedUnitId('')
  }

  if (access.status !== 'authorized') {
    return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />
  }

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-panel management-pending-issues-page">
        <div className="management-panel-heading pending-issues-heading">
          <div>
            <p>{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <span>{t.intro}</span>
          </div>
          {scope === 'mine' && canCreate && (
            <button type="button" title={language === 'en' ? 'Create a pending issue' : 'Registrar un asunto pendiente'} onClick={openNew} disabled={saving}>
              {t.newIssue}
            </button>
          )}
        </div>

        {error && <p className="management-flash error">{error}</p>}
        {message && <p className="management-flash success">{message}</p>}

        <section className="pending-issues-context">
          <label>
            <span>{t.period}</span>
            <select value={periodId} onChange={(event) => { setPeriodId(event.target.value); setFormOpen(false) }}>
              {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
            </select>
          </label>
          {scope === 'mine' && (
            <label>
              <span>{t.unit}</span>
              <select value={selectedUnitId} disabled={ownUnits.length <= 1} onChange={(event) => { setSelectedUnitId(event.target.value); setFormOpen(false) }}>
                {ownUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
              </select>
            </label>
          )}
          <div className="pending-issues-access-copy">
            <strong>{scope === 'consolidated' ? t.consolidatedHelp : t.ownHelp}</strong>
            <small>{scope === 'mine' && currentUnit ? `${currentUnit.code} · ${currentUnit.name}` : access.organizationName}</small>
          </div>
        </section>

        {!ownUnits.length && <p className="management-flash error">{t.noUnitAccess}</p>}

        {moduleAccess.is_digen && (
          <div className="pending-issues-scope-tabs" role="group" aria-label={language === 'en' ? 'Pending issues view' : 'Vista de asuntos pendientes'}>
            <button type="button" title={t.myUnit} className={scope === 'mine' ? 'active' : ''} onClick={() => { setScope('mine'); setFormOpen(false) }}>{t.myUnit}</button>
            <button type="button" title={t.consolidated} className={scope === 'consolidated' ? 'active' : ''} onClick={() => { setScope('consolidated'); setFormOpen(false) }}>{t.consolidated}</button>
          </div>
        )}

        {formOpen && (
          <form className="management-form-card pending-issue-form" onSubmit={saveIssue}>
            <div className="management-form-title">
              <div>
                <small>{currentUnit?.code || t.eyebrow}</small>
                <h2>{form.id ? t.editIssue : t.createIssue}</h2>
              </div>
              <button type="button" title={t.close} onClick={() => setFormOpen(false)}>{t.close}</button>
            </div>
            <div className="management-form-grid">
              <label className="wide">
                <span>{t.titleField} *</span>
                <input maxLength="180" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
              </label>
              <label className="wide">
                <span>{t.description} *</span>
                <textarea maxLength="4000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required />
              </label>
              <label>
                <span>{t.status}</span>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  {['pending', 'in_progress', 'completed'].map((value) => <option key={value} value={value}>{pendingIssueStatusMeta(value, language).label}</option>)}
                </select>
              </label>
              <label>
                <span>{t.urgency}</span>
                <select value={form.urgency} onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value }))}>
                  {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{pendingIssueUrgencyMeta(value, language).label}</option>)}
                </select>
              </label>
              <label>
                <span>{t.dueDate}</span>
                <input type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} />
              </label>
            </div>
            <div className="management-form-actions">
              <button type="button" title={t.cancel} onClick={() => setFormOpen(false)}>{t.cancel}</button>
              <button className="primary" title={t.save} disabled={saving}>{saving ? t.saving : t.save}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="management-loading"><span /><p>{t.loading}</p></div>
        ) : (
          <>
            <section className="pending-issues-metrics" aria-label={language === 'en' ? 'Pending issue summary' : 'Resumen de asuntos pendientes'}>
              <article className="metric-red"><span>{t.pending}</span><strong>{summary.pending}</strong><small>● {pendingIssueStatusMeta('pending', language).label}</small></article>
              <article className="metric-yellow"><span>{t.inProgress}</span><strong>{summary.inProgress}</strong><small>◐ {pendingIssueStatusMeta('in_progress', language).label}</small></article>
              <article className="metric-green"><span>{t.completed}</span><strong>{summary.completed}</strong><small>✓ {pendingIssueStatusMeta('completed', language).label}</small></article>
              <article className="metric-urgent"><span>{t.urgent}</span><strong>{summary.urgent}</strong><small>{language === 'en' ? 'Priority matters' : 'Prioridad de atención'}</small></article>
            </section>

            <section className="pending-issues-filters">
              <label className="pending-search-field">
                <span>{t.search}</span>
                <input value={search} placeholder={t.searchPlaceholder} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <label>
                <span>{t.status}</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">{t.allStatuses}</option>
                  {['pending', 'in_progress', 'completed'].map((value) => <option key={value} value={value}>{pendingIssueStatusMeta(value, language).label}</option>)}
                </select>
              </label>
              <label>
                <span>{t.urgency}</span>
                <select value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value)}>
                  <option value="">{t.allUrgencies}</option>
                  {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{pendingIssueUrgencyMeta(value, language).label}</option>)}
                </select>
              </label>
              {scope === 'consolidated' && moduleAccess.is_digen && (
                <label>
                  <span>{t.unit}</span>
                  <select value={consolidatedUnitId} onChange={(event) => setConsolidatedUnitId(event.target.value)}>
                    <option value="">{t.allUnits}</option>
                    {consolidatedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
                  </select>
                </label>
              )}
              <button type="button" title={t.clearFilters} onClick={clearFilters}>{t.clearFilters}</button>
            </section>

            <section className="pending-issues-list-card">
              <header>
                <div><small>{t.eyebrow}</small><h2>{t.visible}</h2></div>
                <strong>{visibleIssues.length}</strong>
              </header>
              {visibleIssues.length ? (
                <div className="pending-issues-grid">
                  {visibleIssues.map((issue) => {
                    const status = pendingIssueStatusMeta(issue.status, language)
                    const urgency = pendingIssueUrgencyMeta(issue.urgency, language)
                    const unit = units.find((item) => item.id === issue.unit_id)
                    const editable = canEditPendingIssue(issue, { ownUnitIds: [...ownUnitIds], isDigen: moduleAccess.is_digen })
                    return (
                      <article className={`pending-issue-card status-${status.tone}`} key={issue.id}>
                        <div className="pending-issue-card-top">
                          <div className="pending-issue-badges">
                            <span className={`pending-status-badge ${status.tone}`}><b aria-hidden="true">{status.icon}</b>{status.label}</span>
                            <span className={`pending-urgency-badge ${urgency.tone}`}>{t.urgency}: {urgency.label}</span>
                          </div>
                          {scope === 'consolidated' && <span className="pending-unit-badge">{unit?.code || '—'}</span>}
                        </div>
                        <div className="pending-issue-copy">
                          <h3>{issue.title}</h3>
                          <p>{issue.description}</p>
                        </div>
                        <div className="pending-issue-meta">
                          <span><small>{t.due}</small><strong>{issue.due_date ? dateLabel(issue.due_date, language) : t.withoutDue}</strong></span>
                          <span><small>{t.updated}</small><strong>{timestampLabel(issue.updated_at, language)}</strong></span>
                        </div>
                        {editable && (
                          <div className="pending-issue-actions">
                            <button type="button" title={`${t.edit}: ${issue.title}`} onClick={() => openEdit(issue)}>{t.edit}</button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              ) : <p className="pending-issues-empty">{t.noIssues}</p>}
            </section>
          </>
        )}
      </div>
    </ManagementStandaloneShell>
  )
}
