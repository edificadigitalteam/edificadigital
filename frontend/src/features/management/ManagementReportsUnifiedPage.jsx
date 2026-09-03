import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-reports-v2.css'
import './management-reports-unified.css'

const statusLabels = {
  es: { draft: 'Borrador', submitted: 'Enviado a DIAF', reviewed: 'Revisado por DIAF', approved: 'Aprobado por DIAF', closed: 'Cerrado', none: 'Pendiente' },
  en: { draft: 'Draft', submitted: 'Sent to Finance', reviewed: 'Reviewed by Finance', approved: 'Approved by Finance', closed: 'Closed', none: 'Pending' },
}

const copy = {
  es: {
    eyebrow: 'RENDICIÓN DE GESTIÓN', title: 'Indicadores e informes en un solo flujo',
    intro: 'Cada Dirección rinde su gestión desde los mismos indicadores que utiliza en Seguimiento. Las actividades explican el resultado de cada indicador y el informe final se envía a DIAF.',
    organization: 'Organización', period: 'Período', units: 'Direcciones / unidades', started: 'Iniciados', submitted: 'Enviados a DIAF', approved: 'Aprobados por DIAF', consolidated: 'Ver consolidado', back: 'Volver al directorio', print: 'Imprimir / PDF',
    directory: 'RENDICIÓN POR DIRECCIÓN', directoryTitle: 'Estado de rendición', directoryHelp: 'Cada Dirección trabaja sus indicadores, registra las actividades que explican sus resultados y envía la rendición final a DIAF.', pending: 'Sin rendición iniciada', updated: 'Actualizado', create: 'Preparar rendición', edit: 'Editar', view: 'Ver', review: 'Revisar',
    report: 'RENDICIÓN DE LA DIRECCIÓN', executive: 'Resumen ejecutivo', executiveHelp: 'Resume el período. Las cifras oficiales se toman automáticamente de Seguimiento.',
    indicatorSection: 'Rendición por indicadores', indicatorHelp: 'Cada actividad o logro queda vinculado al indicador que demuestra su cumplimiento. Meta, logrado y ejecución se leen directamente de Seguimiento.',
    addActivity: '＋ Agregar actividad', activityLabel: 'Actividad o explicación del resultado', noIndicators: 'Esta Dirección todavía no tiene indicadores activos para este período.', createIndicator: 'Crear indicador en Seguimiento',
    legacyTitle: 'Información anterior pendiente de vincular', legacyHelp: 'Estos registros existían antes de unificar Indicadores e Informes. Selecciona el indicador correspondiente para conservarlos dentro de la nueva rendición.', chooseIndicator: 'Seleccionar indicador',
    challenges: 'Retos o asuntos pendientes', challengesHelp: 'Registra cada reto de forma independiente.', next: 'Próximos pasos', nextHelp: 'Registra cada acción prevista para el siguiente período.', addChallenge: '＋ Agregar reto', addNext: '＋ Agregar próximo paso', reviewer: 'Observaciones de DIAF',
    saveDraft: 'Guardar borrador', send: 'Enviar rendición a DIAF', markReviewed: 'Marcar revisado', approve: 'Aprobar rendición', saving: 'Guardando…', saved: 'Rendición actualizada.', close: 'Cerrar', remove: 'Eliminar',
    target: 'Meta', achieved: 'Logrado', execution: 'Ejecución', activities: 'Actividades vinculadas', noActivities: 'Sin actividades registradas para este indicador.', objective: 'Objetivo relacionado', project: 'Proyecto relacionado',
    destination: 'Rendición dirigida a', diaf: 'DIAF · Dirección de Administración y Finanzas', flowNote: 'La Dirección registra y envía. DIAF recibe, revisa y aprueba la rendición institucional.',
    consolidatedTitle: 'CONSOLIDADO INSTITUCIONAL DE RENDICIÓN', managementByUnit: 'Rendición por Dirección', loading: 'Cargando rendición…', noItems: 'Sin información registrada.',
    missingIndicatorLink: 'Cada actividad o logro debe estar vinculado a un indicador antes de enviar la rendición.', reviewerOnly: 'Estás revisando la rendición enviada por esta Dirección. Los datos de gestión permanecen bloqueados; DIAF puede agregar observaciones y aprobar.',
  },
  en: {
    eyebrow: 'MANAGEMENT ACCOUNTABILITY', title: 'Indicators and reports in one workflow',
    intro: 'Each unit reports from the same indicators used in Tracking. Activities explain each indicator result and the final report is sent to Finance.',
    organization: 'Organization', period: 'Period', units: 'Units', started: 'Started', submitted: 'Sent to Finance', approved: 'Approved by Finance', consolidated: 'View consolidated', back: 'Back to directory', print: 'Print / PDF',
    directory: 'ACCOUNTABILITY BY UNIT', directoryTitle: 'Accountability status', directoryHelp: 'Each unit works with its indicators, records activities explaining the results, and sends the final accountability report to Finance.', pending: 'No report started', updated: 'Updated', create: 'Prepare report', edit: 'Edit', view: 'View', review: 'Review',
    report: 'UNIT ACCOUNTABILITY', executive: 'Executive summary', executiveHelp: 'Summarize the period. Official figures are read automatically from Tracking.',
    indicatorSection: 'Accountability by indicator', indicatorHelp: 'Every activity is linked to the indicator that demonstrates its result. Target, achieved, and execution come directly from Tracking.',
    addActivity: '＋ Add activity', activityLabel: 'Activity or explanation of the result', noIndicators: 'This unit has no active indicators for this period.', createIndicator: 'Create indicator in Tracking',
    legacyTitle: 'Previous information pending linkage', legacyHelp: 'These records existed before Indicators and Reports were unified. Select the corresponding indicator to preserve them in the new workflow.', chooseIndicator: 'Select indicator',
    challenges: 'Challenges or pending issues', challengesHelp: 'Record each challenge independently.', next: 'Next steps', nextHelp: 'Record each planned action for the next period.', addChallenge: '＋ Add challenge', addNext: '＋ Add next step', reviewer: 'Finance observations',
    saveDraft: 'Save draft', send: 'Send accountability to Finance', markReviewed: 'Mark reviewed', approve: 'Approve report', saving: 'Saving…', saved: 'Accountability updated.', close: 'Close', remove: 'Remove',
    target: 'Target', achieved: 'Achieved', execution: 'Execution', activities: 'Linked activities', noActivities: 'No activities recorded for this indicator.', objective: 'Related objective', project: 'Related project',
    destination: 'Accountability sent to', diaf: 'Finance / Administration', flowNote: 'The unit records and submits. Finance receives, reviews, and approves the institutional accountability report.',
    consolidatedTitle: 'CONSOLIDATED INSTITUTIONAL ACCOUNTABILITY', managementByUnit: 'Accountability by unit', loading: 'Loading accountability…', noItems: 'No information recorded.',
    missingIndicatorLink: 'Every activity must be linked to an indicator before the accountability report can be submitted.', reviewerOnly: 'You are reviewing the accountability report submitted by this unit. Management data is read-only; Finance can add observations and approve it.',
  },
}

const emptyForm = () => ({ id: '', executive_summary: '', indicator_notes: {}, legacy: [], challenges: [''], next_steps: [''], reviewer_notes: '', status: 'draft' })

function readLanguage() { try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function formatDate(value, language) { if (!value) return '—'; return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) }
function formatNumber(value, language) { return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { maximumFractionDigits: 2 }).format(Number(value || 0)) }
function splitLegacy(value) { return String(value || '').split(/\r?\n/).map((item) => item.replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').trim()).filter(Boolean) }
function latestProgress(rows) { return [...rows].sort((a, b) => new Date(b.reporting_period_end || b.created_at || 0) - new Date(a.reporting_period_end || a.created_at || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] }
function aggregateIndicator(indicator, progressRows) {
  const rows = progressRows.filter((row) => row.indicator_id === indicator.id && row.status !== 'draft')
  if (!rows.length) return { value: null, text: '', completion: 0 }
  if (indicator.metric_type === 'text') return { value: null, text: latestProgress(rows)?.text_value || '', completion: 0 }
  if (indicator.metric_type === 'boolean') { const value = Number(Boolean(Number(latestProgress(rows)?.numeric_value || 0))); return { value, text: '', completion: value * 100 } }
  let value = 0
  if (indicator.aggregation_method === 'average') value = rows.reduce((sum, row) => sum + Number(row.numeric_value || 0), 0) / rows.length
  else if (['latest', 'unique_people', 'non_aggregable'].includes(indicator.aggregation_method)) value = Number(latestProgress(rows)?.numeric_value || 0)
  else if (indicator.aggregation_method === 'max') value = Math.max(...rows.map((row) => Number(row.numeric_value || 0)))
  else if (indicator.aggregation_method === 'calculated') {
    const row = latestProgress(rows)
    value = Number(row?.denominator || 0) > 0 ? (Number(row?.numerator || 0) / Number(row.denominator)) * 100 : Number(row?.numeric_value || 0)
  } else value = rows.reduce((sum, row) => sum + Number(row.numeric_value || 0), 0)
  const target = Number(indicator.target_value || 0)
  return { value, text: '', completion: target > 0 ? Math.round((value / target) * 1000) / 10 : 0 }
}
function metricDisplay(value, indicator, language) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  if (indicator.metric_type === 'currency') return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { style: 'currency', currency: indicator.currency || 'USD', maximumFractionDigits: 2 }).format(Number(value))
  if (indicator.metric_type === 'percentage') return `${formatNumber(value, language)}%`
  if (indicator.metric_type === 'boolean') return Number(value) ? (language === 'en' ? 'Yes' : 'Sí') : 'No'
  return `${formatNumber(value, language)}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}

function SimpleListEditor({ title, help, values, onChange, addLabel, removeLabel, readOnly }) {
  const update = (index, value) => onChange(values.map((item, i) => i === index ? value : item))
  const remove = (index) => { const next = values.filter((_, i) => i !== index); onChange(next.length ? next : ['']) }
  return <section className="unified-list-editor"><div className="unified-section-heading"><div><h3>{title}</h3><p>{help}</p></div>{!readOnly && <button type="button" onClick={() => onChange([...values, ''])}>{addLabel}</button>}</div><div className="unified-list-rows">{values.map((value, index) => <div className="unified-list-row" key={index}><span>{index + 1}</span><textarea value={value} readOnly={readOnly} onChange={(event) => update(index, event.target.value)} />{!readOnly && <button type="button" title={removeLabel} onClick={() => remove(index)}>×</button>}</div>)}</div></section>
}

export default function ManagementReportsUnifiedPage() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(readLanguage)
  const t = copy[language]
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'
  const [organizations, setOrganizations] = useState([])
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [periods, setPeriods] = useState([])
  const [activePeriodId, setActivePeriodId] = useState('')
  const [units, setUnits] = useState([])
  const [reports, setReports] = useState([])
  const [items, setItems] = useState([])
  const [indicators, setIndicators] = useState([])
  const [progress, setProgress] = useState([])
  const [objectives, setObjectives] = useState([])
  const [projects, setProjects] = useState([])
  const [financeAccess, setFinanceAccess] = useState(null)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [editorOpen, setEditorOpen] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [form, setForm] = useState(emptyForm)
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
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('organization_unit').select('*').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('unit_management_report').select('*').eq('organization_id', organizationId).order('updated_at', { ascending: false }),
      supabase.from('unit_management_report_item').select('*').eq('organization_id', organizationId).order('sort_order'),
      supabase.from('management_indicator').select('*').eq('organization_id', organizationId).eq('active', true).order('created_at'),
      supabase.from('indicator_progress').select('*').eq('organization_id', organizationId).order('created_at'),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('project').select('id,organization_id,code,name,status,project_type').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.rpc('finance_access_overview', { target_organization_id: organizationId }),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows = responses[0].data ?? []
      setPeriods(periodRows); setUnits(responses[1].data ?? []); setReports(responses[2].data ?? []); setItems(responses[3].data ?? []); setIndicators(responses[4].data ?? []); setProgress(responses[5].data ?? []); setObjectives(responses[6].data ?? []); setProjects(responses[7].data ?? []); setFinanceAccess(responses[8].data ?? null)
      setActivePeriodId((current) => current && periodRows.some((period) => period.id === current) ? current : periodRows.find((period) => period.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const canReview = Boolean(financeAccess?.can_manage_finance)
  const memberUnitIds = useMemo(() => new Set(financeAccess?.unit_ids ?? []), [financeAccess?.unit_ids])
  const canManageUnit = useCallback((unitId) => canAdmin || memberUnitIds.has(unitId), [canAdmin, memberUnitIds])
  const visibleUnits = useMemo(() => (canReview || canAdmin) ? units : units.filter((unit) => memberUnitIds.has(unit.id)), [canReview, canAdmin, units, memberUnitIds])
  useEffect(() => { if (!visibleUnits.some((unit) => unit.id === selectedUnitId)) setSelectedUnitId(visibleUnits[0]?.id || '') }, [selectedUnitId, visibleUnits])

  const periodReports = reports.filter((report) => report.management_period_id === activePeriodId)
  const periodIndicators = indicators.filter((indicator) => indicator.management_period_id === activePeriodId)
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId)
  const diafUnit = units.find((unit) => String(unit.code || '').trim().toUpperCase() === 'DIAF')
  const submittedCount = periodReports.filter((report) => ['submitted', 'reviewed', 'approved', 'closed'].includes(report.status)).length
  const approvedCount = periodReports.filter((report) => ['approved', 'closed'].includes(report.status)).length
  const activePeriodName = periods.find((period) => period.id === activePeriodId)?.name || ''
  const currentOrgName = organizations.find((organization) => organization.id === organizationId)?.name || access.organizationName || 'Organización'

  const unitIndicators = useCallback((unitId) => periodIndicators.filter((indicator) => indicator.unit_id === unitId), [periodIndicators])
  const reportItems = useCallback((report, type) => {
    if (!report) return []
    const saved = items.filter((item) => item.report_id === report.id && item.item_type === type).sort((a, b) => a.sort_order - b.sort_order)
    if (saved.length) return saved
    const legacy = type === 'achievement' ? report.achievements : type === 'challenge' ? report.challenges : report.next_steps
    return splitLegacy(legacy).map((statement, index) => ({ id: `legacy-${type}-${index}`, statement, sort_order: index, indicator_id: null }))
  }, [items])

  const hydrateForm = (unitId, asReview = false) => {
    const report = periodReports.find((row) => row.unit_id === unitId)
    const currentIndicators = unitIndicators(unitId)
    const achievements = reportItems(report, 'achievement')
    const indicatorNotes = Object.fromEntries(currentIndicators.map((indicator) => [indicator.id, achievements.filter((item) => item.indicator_id === indicator.id).map((item) => item.statement)]))
    const legacy = achievements.filter((item) => !item.indicator_id).map((item) => ({ statement: item.statement, indicator_id: '' }))
    setSelectedUnitId(unitId)
    setForm(report ? {
      id: report.id,
      executive_summary: report.executive_summary || '',
      indicator_notes: indicatorNotes,
      legacy,
      challenges: reportItems(report, 'challenge').map((item) => item.statement).length ? reportItems(report, 'challenge').map((item) => item.statement) : [''],
      next_steps: reportItems(report, 'next_step').map((item) => item.statement).length ? reportItems(report, 'next_step').map((item) => item.statement) : [''],
      reviewer_notes: report.reviewer_notes || '',
      status: report.status,
    } : { ...emptyForm(), indicator_notes: Object.fromEntries(currentIndicators.map((indicator) => [indicator.id, []])) })
    setReviewMode(asReview); setEditorOpen(true); setViewMode('list'); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateIndicatorNotes = (indicatorId, notes) => setForm((current) => ({ ...current, indicator_notes: { ...current.indicator_notes, [indicatorId]: notes } }))

  const saveReport = async (status) => {
    if (saving || !selectedUnitId || !activePeriodId) return
    const reviewStatus = ['reviewed', 'approved', 'closed'].includes(status)
    if (reviewStatus && !canReview) return
    if (!reviewStatus && !canManageUnit(selectedUnitId) && !canReview) return
    const currentIndicators = unitIndicators(selectedUnitId)
    if (status === 'submitted' && !currentIndicators.length) { setError(t.noIndicators); return }
    const legacyPending = form.legacy.filter((item) => item.statement.trim() && !item.indicator_id)
    if (status === 'submitted' && legacyPending.length) { setError(t.missingIndicatorLink); return }

    const reportItemsPayload = []
    currentIndicators.forEach((indicator) => {
      ;(form.indicator_notes[indicator.id] || []).map((statement) => statement.trim()).filter(Boolean).forEach((statement) => reportItemsPayload.push({ item_type: 'achievement', indicator_id: indicator.id, statement }))
    })
    form.legacy.filter((item) => item.statement.trim() && item.indicator_id).forEach((item) => reportItemsPayload.push({ item_type: 'achievement', indicator_id: item.indicator_id, statement: item.statement.trim() }))
    form.challenges.map((statement) => statement.trim()).filter(Boolean).forEach((statement) => reportItemsPayload.push({ item_type: 'challenge', indicator_id: null, statement }))
    form.next_steps.map((statement) => statement.trim()).filter(Boolean).forEach((statement) => reportItemsPayload.push({ item_type: 'next_step', indicator_id: null, statement }))

    setSaving(true); setError(''); setMessage('')
    const { data: reportId, error: requestError } = await supabase.rpc('save_unit_management_report_v3', { payload: {
      id: form.id, organization_id: organizationId, management_period_id: activePeriodId, unit_id: selectedUnitId, status,
      executive_summary: form.executive_summary, reviewer_notes: form.reviewer_notes, items: reportItemsPayload,
    } })
    if (requestError) setError(requestError.message)
    else { setForm((current) => ({ ...current, id: reportId, status, legacy: [] })); setMessage(t.saved); await reload() }
    setSaving(false)
  }

  const renderIndicatorCard = (indicator, report, editable = false) => {
    const result = aggregateIndicator(indicator, progress)
    const linked = report ? reportItems(report, 'achievement').filter((item) => item.indicator_id === indicator.id) : []
    const objective = objectives.find((item) => item.id === indicator.objective_id)
    const project = projects.find((item) => item.id === indicator.project_id)
    const notes = form.indicator_notes[indicator.id] || []
    const displayNotes = editable ? notes : linked.map((item) => item.statement)
    const readOnly = reviewMode || !canManageUnit(selectedUnitId)
    return <article className="unified-indicator-card" key={indicator.id}>
      <header><div><small>{indicator.metric_type === 'currency' ? 'DINERO' : indicator.metric_type === 'percentage' ? 'PORCENTAJE' : 'INDICADOR'}</small><h3>{indicator.name}</h3>{(objective || project) && <p>{objective && <span>{t.objective}: {objective.code} · {objective.title}</span>}{project && <span>{t.project}: {project.code} · {project.name}</span>}</p>}</div><b>{indicator.frequency}</b></header>
      <div className="unified-indicator-values"><div><span>{t.target}</span><strong>{indicator.target_value == null ? indicator.target_text || '—' : metricDisplay(indicator.target_value, indicator, language)}</strong></div><div><span>{t.achieved}</span><strong>{result.text || metricDisplay(result.value, indicator, language)}</strong></div><div><span>{t.execution}</span><strong>{formatNumber(result.completion, language)}%</strong></div></div>
      {indicator.target_value != null && <div className="unified-progress"><span style={{ width: `${Math.min(Math.max(result.completion, 0), 100)}%` }} /></div>}
      <div className="unified-indicator-activities"><div className="unified-activity-heading"><strong>{t.activities}</strong>{editable && !readOnly && <button type="button" onClick={() => updateIndicatorNotes(indicator.id, [...notes, ''])}>{t.addActivity}</button>}</div>
        {editable ? (!displayNotes.length ? <p className="report-empty-text">{t.noActivities}</p> : displayNotes.map((statement, index) => <div className="unified-activity-row" key={index}><span>{index + 1}</span><textarea value={statement} readOnly={readOnly} placeholder={t.activityLabel} onChange={(event) => updateIndicatorNotes(indicator.id, notes.map((item, i) => i === index ? event.target.value : item))} />{!readOnly && <button type="button" onClick={() => updateIndicatorNotes(indicator.id, notes.filter((_, i) => i !== index))}>×</button>}</div>)) : (displayNotes.length ? <ol>{displayNotes.map((statement, index) => <li key={index}>{statement}</li>)}</ol> : <p className="report-empty-text">{t.noActivities}</p>)}
      </div>
    </article>
  }

  const renderUnitReport = (unit) => {
    const report = periodReports.find((row) => row.unit_id === unit.id)
    const currentIndicators = unitIndicators(unit.id)
    const challenges = reportItems(report, 'challenge')
    const nextSteps = reportItems(report, 'next_step')
    const unlinked = reportItems(report, 'achievement').filter((item) => !item.indicator_id)
    const destination = units.find((item) => item.id === report?.submitted_to_unit_id) || diafUnit
    return <section className="unified-report-document"><header><div><small>{t.report}</small><h1>{unit.code} · {unit.name}</h1><p>{activePeriodName} · {currentOrgName}</p></div><div className="unit-report-v2-actions no-print"><button onClick={() => setViewMode('list')}>{t.back}</button><button className="primary" onClick={() => window.print()}>{t.print}</button></div></header>
      <div className="unified-report-routing"><span>{t.destination}</span><strong>{destination ? `${destination.code} · ${destination.name}` : t.diaf}</strong><small>{t.flowNote}</small></div>
      {report?.executive_summary && <section><h2>{t.executive}</h2><p>{report.executive_summary}</p></section>}
      <section><h2>{t.indicatorSection}</h2><div className="unified-indicator-stack">{currentIndicators.length ? currentIndicators.map((indicator) => renderIndicatorCard(indicator, report, false)) : <p className="report-empty-text">{t.noIndicators}</p>}</div></section>
      {unlinked.length > 0 && <section className="unified-legacy-warning"><h2>{t.legacyTitle}</h2><p>{t.legacyHelp}</p><ol>{unlinked.map((item) => <li key={item.id}>{item.statement}</li>)}</ol></section>}
      {challenges.length > 0 && <section><h2>{t.challenges}</h2><ol className="unit-report-items">{challenges.map((item) => <li key={item.id}>{item.statement}</li>)}</ol></section>}
      {nextSteps.length > 0 && <section><h2>{t.next}</h2><ol className="unit-report-items">{nextSteps.map((item) => <li key={item.id}>{item.statement}</li>)}</ol></section>}
      {report?.reviewer_notes && <section><h2>{t.reviewer}</h2><p>{report.reviewer_notes}</p></section>}
    </section>
  }

  const renderConsolidated = () => <section className="unified-report-document consolidated-v2"><header><div><small>{t.consolidatedTitle}</small><h1>{activePeriodName}</h1><p>{currentOrgName}</p></div><div className="unit-report-v2-actions no-print"><button onClick={() => setViewMode('list')}>{t.back}</button><button className="primary" onClick={() => window.print()}>{t.print}</button></div></header>
    <div className="consolidated-v2-summary"><article><span>{t.units}</span><strong>{units.length}</strong></article><article><span>{t.started}</span><strong>{periodReports.length}</strong></article><article><span>{t.submitted}</span><strong>{submittedCount}</strong></article><article><span>{t.approved}</span><strong>{approvedCount}</strong></article></div>
    <section><h2>{t.managementByUnit}</h2><div className="unified-consolidated-units">{units.map((unit) => { const report = periodReports.find((row) => row.unit_id === unit.id); if (!report) return null; const currentIndicators = unitIndicators(unit.id); return <article key={unit.id}><header><span>{unit.code}</span><div><h3>{unit.name}</h3><small>{statusLabels[language][report.status]}</small></div></header>{report.executive_summary && <p>{report.executive_summary}</p>}<div className="unified-indicator-stack compact">{currentIndicators.map((indicator) => renderIndicatorCard(indicator, report, false))}</div></article> })}</div></section>
  </section>

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />

  const selectedReport = periodReports.find((report) => report.unit_id === selectedUnitId)
  const selectedIndicators = unitIndicators(selectedUnitId)
  const readOnlyEditor = reviewMode || !canManageUnit(selectedUnitId)

  return <ManagementStandaloneShell access={access}><div className="management-panel unified-reports-page">
    <div className="management-panel-heading no-print"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div><button onClick={() => { setEditorOpen(false); setViewMode(viewMode === 'consolidated' ? 'list' : 'consolidated') }}>{viewMode === 'consolidated' ? t.back : t.consolidated}</button></div>
    {isSuperAdmin && <section className="management-filter-row no-print"><label><span>{t.organization}</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label></section>}
    {error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}
    {loading ? <div className="management-loading"><span /><p>{t.loading}</p></div> : viewMode === 'unit' && selectedUnit ? renderUnitReport(selectedUnit) : viewMode === 'consolidated' ? renderConsolidated() : <>
      <section className="management-report-summary no-print"><article><span>{t.units}</span><strong>{visibleUnits.length}</strong></article><article><span>{t.started}</span><strong>{periodReports.length}</strong></article><article><span>{t.submitted}</span><strong>{submittedCount}</strong></article><article><span>{t.approved}</span><strong>{approvedCount}</strong></article></section>
      <section className="management-filter-row no-print"><label><span>{t.period}</span><select value={activePeriodId} onChange={(event) => setActivePeriodId(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label></section>

      {editorOpen && selectedUnit && <section className="management-form-card unified-report-editor no-print"><div className="management-form-title"><div><small>{t.report}</small><h2>{selectedUnit.code} · {selectedUnit.name}</h2><span className={`report-state ${form.status}`}>{statusLabels[language][form.status]}</span></div><button type="button" onClick={() => setEditorOpen(false)}>{t.close}</button></div>
        <div className="unified-route-card"><div><span>{t.destination}</span><strong>{diafUnit ? `${diafUnit.code} · ${diafUnit.name}` : t.diaf}</strong></div><p>{t.flowNote}</p></div>
        {reviewMode && <div className="unified-review-note">{t.reviewerOnly}</div>}
        <label className="report-v2-summary unified-summary"><span>{t.executive}</span><small>{t.executiveHelp}</small><textarea value={form.executive_summary} readOnly={readOnlyEditor} onChange={(event) => setForm((current) => ({ ...current, executive_summary: event.target.value }))} /></label>
        <section className="unified-indicator-editor-section"><div className="unified-section-heading"><div><h3>{t.indicatorSection}</h3><p>{t.indicatorHelp}</p></div></div>{selectedIndicators.length ? <div className="unified-indicator-stack">{selectedIndicators.map((indicator) => renderIndicatorCard(indicator, selectedReport, true))}</div> : <div className="unified-no-indicators"><p>{t.noIndicators}</p>{canManageUnit(selectedUnitId) && <a href={`/app/management/tracking/new?period=${encodeURIComponent(activePeriodId)}&unit=${encodeURIComponent(selectedUnitId)}`}>{t.createIndicator}</a>}</div>}</section>
        {form.legacy.length > 0 && <section className="unified-legacy-editor"><div className="unified-section-heading"><div><h3>{t.legacyTitle}</h3><p>{t.legacyHelp}</p></div></div>{form.legacy.map((item, index) => <div className="unified-legacy-row" key={index}><select value={item.indicator_id} disabled={readOnlyEditor} onChange={(event) => setForm((current) => ({ ...current, legacy: current.legacy.map((row, i) => i === index ? { ...row, indicator_id: event.target.value } : row) }))}><option value="">{t.chooseIndicator}</option>{selectedIndicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.name}</option>)}</select><textarea value={item.statement} readOnly={readOnlyEditor} onChange={(event) => setForm((current) => ({ ...current, legacy: current.legacy.map((row, i) => i === index ? { ...row, statement: event.target.value } : row) }))} /></div>)}</section>}
        <SimpleListEditor title={t.challenges} help={t.challengesHelp} values={form.challenges} onChange={(values) => setForm((current) => ({ ...current, challenges: values }))} addLabel={t.addChallenge} removeLabel={t.remove} readOnly={readOnlyEditor} />
        <SimpleListEditor title={t.next} help={t.nextHelp} values={form.next_steps} onChange={(values) => setForm((current) => ({ ...current, next_steps: values }))} addLabel={t.addNext} removeLabel={t.remove} readOnly={readOnlyEditor} />
        {canReview && <label className="report-v2-summary unified-reviewer"><span>{t.reviewer}</span><textarea value={form.reviewer_notes} onChange={(event) => setForm((current) => ({ ...current, reviewer_notes: event.target.value }))} /></label>}
        <div className="report-actions unified-report-actions">{canManageUnit(selectedUnitId) && !reviewMode && <><button onClick={() => saveReport('draft')} disabled={saving}>{t.saveDraft}</button><button className="primary" onClick={() => saveReport('submitted')} disabled={saving}>{saving ? t.saving : t.send}</button></>}{canReview && form.id && <><button onClick={() => saveReport('reviewed')} disabled={saving}>{t.markReviewed}</button><button className="approve" onClick={() => saveReport('approved')} disabled={saving}>{t.approve}</button></>}</div>
      </section>}

      <section className="management-report-status management-unit-report-directory"><div className="management-card-heading"><div><small>{t.directory}</small><h2>{t.directoryTitle}</h2><p>{t.directoryHelp}</p></div></div><div>{visibleUnits.map((unit) => { const report = periodReports.find((row) => row.unit_id === unit.id); return <article key={unit.id}><span>{unit.code}</span><div><strong>{unit.name}</strong><small>{report ? `${t.updated} ${formatDate(report.updated_at, language)}` : t.pending}</small></div><b className={`report-state ${report?.status || 'none'}`}>{statusLabels[language][report?.status || 'none']}</b><div className="unit-report-row-actions"><button onClick={() => { setSelectedUnitId(unit.id); setEditorOpen(false); setViewMode('unit'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{t.view}</button>{canManageUnit(unit.id) && <button className="secondary" onClick={() => hydrateForm(unit.id, false)}>{report ? t.edit : t.create}</button>}{canReview && report && ['submitted', 'reviewed', 'approved'].includes(report.status) && <button className="primary" onClick={() => hydrateForm(unit.id, true)}>{t.review}</button>}</div></article> })}</div></section>
    </>}
  </div></ManagementStandaloneShell>
}
