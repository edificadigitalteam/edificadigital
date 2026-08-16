import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './management.css'
import './management-fixes.css'
import './management-reports.css'

const reportStatus = {
  es: { draft: 'Borrador', submitted: 'Enviado', reviewed: 'Revisado', approved: 'Aprobado', closed: 'Cerrado', none: 'Pendiente' },
  en: { draft: 'Draft', submitted: 'Submitted', reviewed: 'Reviewed', approved: 'Approved', closed: 'Closed', none: 'Pending' },
}

const copy = {
  es: {
    module: 'GESTIÓN ORGANIZACIONAL', back: '← Todos los módulos', nav: ['Resumen', 'Estructura', 'Objetivos', 'Proyectos', 'Seguimiento', 'Informes'], users: 'Usuarios y accesos', signOut: 'Cerrar sesión',
    eyebrow: 'INFORMES DE GESTIÓN', title: 'Informes por unidad y consolidado', intro: 'Consulta cada dirección, departamento o ministerio de forma independiente y luego reúne la información en el consolidado institucional.',
    period: 'Período', organization: 'Organización', unit: 'Unidad / dirección', units: 'Unidades', started: 'Informes iniciados', submitted: 'Enviados', approved: 'Aprobados',
    unitReports: 'INFORMES POR UNIDAD', unitReportsTitle: 'Estado y acceso por dirección', unitReportsHelp: 'Cada unidad conserva su propio informe. Puedes verlo, imprimirlo o editarlo según tus permisos.', view: 'Ver informe', edit: 'Editar', create: 'Crear informe', consolidated: 'Ver consolidado', backToReports: 'Volver a informes', print: 'Imprimir / PDF', closePreview: 'Cerrar informe',
    editReport: 'INFORME DE LA UNIDAD', executive: 'Resumen ejecutivo', executiveHelp: 'Síntesis clara de la gestión realizada en el período.', achievements: 'Principales logros', challenges: 'Retos y dificultades', next: 'Próximos pasos', reviewer: 'Observaciones del revisor', saveDraft: 'Guardar borrador', send: 'Enviar informe', reviewed: 'Marcar revisado', approve: 'Aprobar', saving: 'Guardando…', saved: 'Informe actualizado.',
    unitReport: 'INFORME DE GESTIÓN POR UNIDAD', responsible: 'Responsable visible', status: 'Estado del informe', lastUpdate: 'Última actualización', objectives: 'Objetivos relacionados', indicators: 'Indicadores de gestión', projects: 'Proyectos e iniciativas', noNarrative: 'Esta sección todavía no tiene información redactada.', noIndicators: 'Esta unidad todavía no tiene indicadores para el período.', noProjects: 'Esta unidad todavía no tiene proyectos relacionados.', noObjectives: 'Esta unidad todavía no tiene objetivos asignados.', target: 'Meta', achieved: 'Logrado', execution: 'Ejecución', relationResponsible: 'Responsable', relationParticipant: 'Participante',
    consolidatedTitle: 'INFORME INSTITUCIONAL CONSOLIDADO', organizationalUnits: 'Unidades organizativas', indicatorCount: 'Indicadores', projectCount: 'Proyectos', objectiveCount: 'Objetivos', institutionalObjectives: 'Objetivos institucionales', indicatorTracking: 'Seguimiento de indicadores', managementByUnit: 'Gestión por unidad', pendingReport: 'Sin informe iniciado', updated: 'Actualizado', loading: 'Cargando informes…',
  },
  en: {
    module: 'ORGANIZATIONAL MANAGEMENT', back: '← All modules', nav: ['Overview', 'Structure', 'Objectives', 'Projects', 'Tracking', 'Reports'], users: 'Users and access', signOut: 'Sign out',
    eyebrow: 'MANAGEMENT REPORTS', title: 'Reports by unit and consolidated', intro: 'Review each directorate, department, or ministry independently and then bring the information together in the institutional consolidated report.',
    period: 'Period', organization: 'Organization', unit: 'Unit / directorate', units: 'Units', started: 'Reports started', submitted: 'Submitted', approved: 'Approved',
    unitReports: 'REPORTS BY UNIT', unitReportsTitle: 'Status and access by directorate', unitReportsHelp: 'Each unit keeps its own report. You can view, print, or edit it according to your permissions.', view: 'View report', edit: 'Edit', create: 'Create report', consolidated: 'View consolidated', backToReports: 'Back to reports', print: 'Print / PDF', closePreview: 'Close report',
    editReport: 'UNIT REPORT', executive: 'Executive summary', executiveHelp: 'Clear summary of management performed during the period.', achievements: 'Key achievements', challenges: 'Challenges and difficulties', next: 'Next steps', reviewer: 'Reviewer notes', saveDraft: 'Save draft', send: 'Submit report', reviewed: 'Mark reviewed', approve: 'Approve', saving: 'Saving…', saved: 'Report updated.',
    unitReport: 'UNIT MANAGEMENT REPORT', responsible: 'Visible manager', status: 'Report status', lastUpdate: 'Last update', objectives: 'Related objectives', indicators: 'Management indicators', projects: 'Projects and initiatives', noNarrative: 'This section has not been written yet.', noIndicators: 'This unit has no indicators for the selected period yet.', noProjects: 'This unit has no related projects yet.', noObjectives: 'This unit has no assigned objectives yet.', target: 'Target', achieved: 'Achieved', execution: 'Execution', relationResponsible: 'Responsible', relationParticipant: 'Participant',
    consolidatedTitle: 'CONSOLIDATED INSTITUTIONAL REPORT', organizationalUnits: 'Organizational units', indicatorCount: 'Indicators', projectCount: 'Projects', objectiveCount: 'Objectives', institutionalObjectives: 'Institutional objectives', indicatorTracking: 'Indicator tracking', managementByUnit: 'Management by unit', pendingReport: 'No report started', updated: 'Updated', loading: 'Loading reports…',
  },
}

function readLanguage() { try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function Brand() { return <a className="management-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a> }
function formatDate(value, language) { if (!value) return '—'; return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0,10)}T00:00:00`)) }
function formatNumber(value, language) { return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { maximumFractionDigits: 2 }).format(Number(value || 0)) }
function latestProgress(rows) { return [...rows].sort((a,b) => { const p = new Date(b.reporting_period_end || b.created_at || 0) - new Date(a.reporting_period_end || a.created_at || 0); return p || new Date(b.created_at || 0) - new Date(a.created_at || 0) })[0] }
function normalizedMethod(indicator) { return indicator?.aggregation_method === 'calculated' ? 'latest' : (indicator?.aggregation_method || 'sum') }
function aggregateIndicator(indicator, progressRows) {
  const rows = progressRows.filter((row) => row.indicator_id === indicator.id && row.status !== 'draft')
  if (!rows.length) return { value: null, text: '', completion: 0 }
  if (indicator.metric_type === 'text') return { value: null, text: latestProgress(rows)?.text_value || '', completion: 0 }
  if (indicator.metric_type === 'boolean') { const value = Number(Boolean(Number(latestProgress(rows)?.numeric_value || 0))); return { value, text: '', completion: value * 100 } }
  const method = normalizedMethod(indicator)
  let value = 0
  if (method === 'average') value = rows.reduce((sum,row) => sum + Number(row.numeric_value || 0), 0) / rows.length
  else if (['latest','unique_people','non_aggregable'].includes(method)) value = Number(latestProgress(rows)?.numeric_value ?? latestProgress(rows)?.numerator ?? 0)
  else if (method === 'max') value = Math.max(...rows.map((row) => Number(row.numeric_value || 0)))
  else value = rows.reduce((sum,row) => sum + Number(row.numeric_value || 0), 0)
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

export default function ManagementReportsPage() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(readLanguage)
  const t = copy[language]
  const [organizations, setOrganizations] = useState([])
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [periods, setPeriods] = useState([])
  const [activePeriodId, setActivePeriodId] = useState('')
  const [units, setUnits] = useState([])
  const [memberships, setMemberships] = useState([])
  const [reports, setReports] = useState([])
  const [indicators, setIndicators] = useState([])
  const [progress, setProgress] = useState([])
  const [objectives, setObjectives] = useState([])
  const [assignments, setAssignments] = useState([])
  const [projects, setProjects] = useState([])
  const [projectUnits, setProjectUnits] = useState([])
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ id: '', executive_summary: '', achievements: '', challenges: '', next_steps: '', reviewer_notes: '', status: 'draft' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'

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
      supabase.from('organization_unit_member').select('*').eq('organization_id', organizationId),
      supabase.from('unit_management_report').select('*').eq('organization_id', organizationId).order('updated_at', { ascending: false }),
      supabase.from('management_indicator').select('*').eq('organization_id', organizationId).eq('active', true).order('created_at'),
      supabase.from('indicator_progress').select('*').eq('organization_id', organizationId).order('created_at'),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('objective_unit_assignment').select('*').eq('organization_id', organizationId),
      supabase.from('project').select('id, organization_id, code, name, status, project_type').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('project_organization_unit').select('*').eq('organization_id', organizationId),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows = responses[0].data ?? []
      setPeriods(periodRows); setUnits(responses[1].data ?? []); setMemberships(responses[2].data ?? []); setReports(responses[3].data ?? []); setIndicators(responses[4].data ?? []); setProgress(responses[5].data ?? []); setObjectives(responses[6].data ?? []); setAssignments(responses[7].data ?? []); setProjects(responses[8].data ?? []); setProjectUnits(responses[9].data ?? [])
      setActivePeriodId((current) => current && periodRows.some((item) => item.id === current) ? current : periodRows.find((item) => item.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const manageableUnitIds = useMemo(() => canAdmin ? units.map((u) => u.id) : memberships.filter((m) => m.active && ['director','manager','operator','reviewer'].includes(m.unit_role)).map((m) => m.unit_id), [canAdmin, memberships, units])
  const visibleUnits = useMemo(() => canAdmin ? units : units.filter((u) => manageableUnitIds.includes(u.id)), [canAdmin, manageableUnitIds, units])
  useEffect(() => { if (!visibleUnits.some((u) => u.id === selectedUnitId)) setSelectedUnitId(visibleUnits[0]?.id || '') }, [selectedUnitId, visibleUnits])

  const periodReports = reports.filter((r) => r.management_period_id === activePeriodId)
  const periodIndicators = indicators.filter((i) => i.management_period_id === activePeriodId)
  const periodObjectives = objectives.filter((o) => o.management_period_id === activePeriodId)
  const selectedUnit = units.find((u) => u.id === selectedUnitId)
  const selectedReport = periodReports.find((r) => r.unit_id === selectedUnitId)
  const canManageSelected = canAdmin || manageableUnitIds.includes(selectedUnitId)
  const submittedCount = periodReports.filter((r) => ['submitted','reviewed','approved','closed'].includes(r.status)).length
  const approvedCount = periodReports.filter((r) => ['approved','closed'].includes(r.status)).length

  const hydrateForm = (unitId) => {
    const report = periodReports.find((r) => r.unit_id === unitId)
    setSelectedUnitId(unitId)
    setForm(report ? { id: report.id, executive_summary: report.executive_summary || '', achievements: report.achievements || '', challenges: report.challenges || '', next_steps: report.next_steps || '', reviewer_notes: report.reviewer_notes || '', status: report.status } : { id: '', executive_summary: '', achievements: '', challenges: '', next_steps: '', reviewer_notes: '', status: 'draft' })
    setEditOpen(true); setViewMode('list'); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveReport = async (status) => {
    if (!canManageSelected || saving || !selectedUnitId || !activePeriodId) return
    setSaving(true); setError(''); setMessage('')
    const payload = { organization_id: organizationId, management_period_id: activePeriodId, unit_id: selectedUnitId, status, executive_summary: form.executive_summary.trim() || null, achievements: form.achievements.trim() || null, challenges: form.challenges.trim() || null, next_steps: form.next_steps.trim() || null, reviewer_notes: form.reviewer_notes.trim() || null, updated_by: access.userId || null }
    if (!form.id) payload.created_by = access.userId || null
    const request = form.id ? supabase.from('unit_management_report').update(payload).eq('id', form.id).select('*').single() : supabase.from('unit_management_report').insert(payload).select('*').single()
    const { data, error: requestError } = await request
    if (requestError) setError(requestError.message)
    else { setMessage(t.saved); setForm({ id: data.id, executive_summary: data.executive_summary || '', achievements: data.achievements || '', challenges: data.challenges || '', next_steps: data.next_steps || '', reviewer_notes: data.reviewer_notes || '', status: data.status }); await reload() }
    setSaving(false)
  }

  const viewUnit = (unitId) => { setSelectedUnitId(unitId); setEditOpen(false); setViewMode('unit'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const unitIndicators = (id) => periodIndicators.filter((i) => i.unit_id === id)
  const unitObjectives = (id) => assignments.filter((a) => a.unit_id === id).map((a) => periodObjectives.find((o) => o.id === a.objective_id)).filter(Boolean)
  const unitProjects = (id) => projectUnits.filter((r) => r.unit_id === id).map((r) => ({ relation: r.relationship, project: projects.find((p) => p.id === r.project_id) })).filter((x) => x.project)
  const currentOrgName = access.organizationName || organizations.find((o) => o.id === organizationId)?.name || t.organization
  const activePeriodName = periods.find((p) => p.id === activePeriodId)?.name || t.period
  const navRoutes = ['', 'structure', 'objectives', 'projects', 'tracking', 'reports']

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />
  if (loading) return <div className="management-shell"><aside className="management-sidebar no-print"><div className="management-sidebar-top"><Brand /><small>{t.module}</small></div></aside><main className="management-main"><div className="management-loading"><span /><p>{t.loading}</p></div></main></div>

  const renderUnitReport = (unit) => {
    const report = periodReports.find((r) => r.unit_id === unit.id)
    const unitIndicatorRows = unitIndicators(unit.id)
    const unitObjectiveRows = unitObjectives(unit.id)
    const unitProjectRows = unitProjects(unit.id)
    return <section className="unit-report-document">
      <header><div><small>{t.unitReport}</small><h1>{unit.code} · {unit.name}</h1><p>{currentOrgName} · {activePeriodName}</p></div><div className="unit-report-print-actions no-print"><button onClick={() => setViewMode('list')}>{t.closePreview}</button><button className="primary" onClick={() => window.print()}>{t.print}</button></div></header>
      <div className="unit-report-meta"><article><span>{t.responsible}</span><strong>{unit.manager_name || '—'}</strong></article><article><span>{t.status}</span><strong>{reportStatus[language][report?.status || 'none']}</strong></article><article><span>{t.lastUpdate}</span><strong>{report ? formatDate(report.updated_at, language) : '—'}</strong></article></div>
      <section className="unit-report-narrative"><article><h2>{t.executive}</h2><p>{report?.executive_summary || t.noNarrative}</p></article><article><h2>{t.achievements}</h2><p>{report?.achievements || t.noNarrative}</p></article><article><h2>{t.challenges}</h2><p>{report?.challenges || t.noNarrative}</p></article><article><h2>{t.next}</h2><p>{report?.next_steps || t.noNarrative}</p></article></section>
      <section><h2>{t.objectives}</h2>{!unitObjectiveRows.length ? <p className="report-empty">{t.noObjectives}</p> : <div className="unit-report-objectives">{unitObjectiveRows.map((o) => <article key={o.id}><span>{o.code}</span><div><strong>{o.title}</strong>{o.description && <p>{o.description}</p>}</div></article>)}</div>}</section>
      <section><h2>{t.indicators}</h2>{!unitIndicatorRows.length ? <p className="report-empty">{t.noIndicators}</p> : <div className="unit-report-indicators">{unitIndicatorRows.map((indicator) => { const result = aggregateIndicator(indicator, progress); return <article key={indicator.id}><strong>{indicator.name}</strong><div><span>{t.target}: {indicator.target_value == null ? indicator.target_text || '—' : metricDisplay(indicator.target_value, indicator, language)}</span><span>{t.achieved}: {result.text || metricDisplay(result.value, indicator, language)}</span><b>{t.execution}: {result.completion}%</b></div></article> })}</div>}</section>
      <section><h2>{t.projects}</h2>{!unitProjectRows.length ? <p className="report-empty">{t.noProjects}</p> : <div className="unit-report-projects">{unitProjectRows.map(({ project, relation }) => <article key={`${project.id}-${relation}`}><span>{relation === 'responsible' ? t.relationResponsible : t.relationParticipant}</span><div><strong>{project.name}</strong><small>{project.code} · {project.status}</small></div></article>)}</div>}</section>
    </section>
  }

  const renderConsolidated = () => <section className="consolidated-report management-consolidated-v2">
    <header><div><small>{t.consolidatedTitle}</small><h1>{activePeriodName}</h1><p>{currentOrgName}</p></div><div className="unit-report-print-actions no-print"><button onClick={() => setViewMode('list')}>{t.backToReports}</button><button className="primary" onClick={() => window.print()}>{t.print}</button></div></header>
    <div className="consolidated-overview"><article><span>{t.organizationalUnits}</span><strong>{units.length}</strong></article><article><span>{t.objectiveCount}</span><strong>{periodObjectives.length}</strong></article><article><span>{t.indicatorCount}</span><strong>{periodIndicators.length}</strong></article><article><span>{t.projectCount}</span><strong>{projects.length}</strong></article></div>
    <section><h2>{t.institutionalObjectives}</h2>{periodObjectives.map((objective) => <div className="consolidated-objective" key={objective.id}><span>{objective.code}</span><div><strong>{objective.title}</strong><p>{objective.description}</p></div></div>)}</section>
    <section><h2>{t.indicatorTracking}</h2><div className="consolidated-indicators">{periodIndicators.map((indicator) => { const result = aggregateIndicator(indicator, progress); return <article key={indicator.id}><small>{units.find((u) => u.id === indicator.unit_id)?.code}</small><strong>{indicator.name}</strong><span>{t.target}: {indicator.target_value == null ? indicator.target_text || '—' : metricDisplay(indicator.target_value, indicator, language)}</span><b>{t.achieved}: {result.text || metricDisplay(result.value, indicator, language)} · {result.completion}%</b></article> })}</div></section>
    <section><h2>{t.managementByUnit}</h2>{units.map((unit) => { const report = periodReports.find((r) => r.unit_id === unit.id); if (!report) return null; return <article className="consolidated-unit" key={unit.id}><header><span>{unit.code}</span><div><h3>{unit.name}</h3><small>{reportStatus[language][report.status]}</small></div></header>{report.executive_summary && <div><strong>{t.executive}</strong><p>{report.executive_summary}</p></div>}{report.achievements && <div><strong>{t.achievements}</strong><p>{report.achievements}</p></div>}{report.challenges && <div><strong>{t.challenges}</strong><p>{report.challenges}</p></div>}{report.next_steps && <div><strong>{t.next}</strong><p>{report.next_steps}</p></div>}</article> })}</section>
  </section>

  return <div className="management-shell">
    <aside className="management-sidebar no-print"><div className="management-sidebar-top"><Brand /><small>{t.module}</small></div><a className="management-back" href="/app">{t.back}</a>{isSuperAdmin && <label className="management-org-selector"><span>{t.organization}</span><select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}<nav>{t.nav.map((label,index) => <button className={index === 5 ? 'active' : ''} type="button" onClick={() => window.location.assign(navRoutes[index] ? `/app/management/${navRoutes[index]}` : '/app/management')} key={label}><span>0{index+1}</span>{label}</button>)}</nav><div className="management-sidebar-footer">{canAdmin && <a className="management-users-link" href="/app/admin/operators">{t.users}</a>}<div><strong>{currentOrgName}</strong><span>{access.displayName || access.email}</span></div><button onClick={access.signOut}>{t.signOut}</button></div></aside>
    <main className="management-main"><div className="management-mobile-header no-print"><Brand /><button onClick={() => window.location.assign('/app')}>{language === 'en' ? 'Modules' : 'Módulos'}</button></div><div className="management-panel reports-panel">
      <div className="management-panel-heading no-print"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div><button onClick={() => { setEditOpen(false); setViewMode(viewMode === 'consolidated' ? 'list' : 'consolidated') }}>{viewMode === 'consolidated' ? t.backToReports : t.consolidated}</button></div>
      {error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}
      {viewMode === 'unit' && selectedUnit ? renderUnitReport(selectedUnit) : viewMode === 'consolidated' ? renderConsolidated() : <>
        <section className="management-report-summary no-print"><article><span>{t.units}</span><strong>{units.length}</strong></article><article><span>{t.started}</span><strong>{periodReports.length}</strong></article><article><span>{t.submitted}</span><strong>{submittedCount}</strong></article><article><span>{t.approved}</span><strong>{approvedCount}</strong></article></section>
        <section className="management-filter-row no-print"><label><span>{t.period}</span><select value={activePeriodId} onChange={(e) => setActivePeriodId(e.target.value)}>{periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></section>
        {editOpen && selectedUnit && <section className="management-form-card report-editor no-print"><div className="management-form-title"><div><small>{t.editReport}</small><h2>{selectedUnit.code} · {selectedUnit.name}</h2><span className={`report-state ${form.status}`}>{reportStatus[language][form.status]}</span></div><button type="button" onClick={() => setEditOpen(false)}>{language === 'en' ? 'Close' : 'Cerrar'}</button></div><div className="report-editor-grid"><label><span>{t.executive}</span><textarea value={form.executive_summary} onChange={(e) => setForm((c) => ({ ...c, executive_summary: e.target.value }))} /><small>{t.executiveHelp}</small></label><label><span>{t.achievements}</span><textarea value={form.achievements} onChange={(e) => setForm((c) => ({ ...c, achievements: e.target.value }))} /></label><label><span>{t.challenges}</span><textarea value={form.challenges} onChange={(e) => setForm((c) => ({ ...c, challenges: e.target.value }))} /></label><label><span>{t.next}</span><textarea value={form.next_steps} onChange={(e) => setForm((c) => ({ ...c, next_steps: e.target.value }))} /></label>{canAdmin && <label className="wide"><span>{t.reviewer}</span><textarea value={form.reviewer_notes} onChange={(e) => setForm((c) => ({ ...c, reviewer_notes: e.target.value }))} /></label>}</div><div className="report-actions"><button onClick={() => saveReport('draft')} disabled={saving}>{t.saveDraft}</button><button className="primary" onClick={() => saveReport('submitted')} disabled={saving}>{t.send}</button>{canAdmin && form.id && <button onClick={() => saveReport('reviewed')} disabled={saving}>{t.reviewed}</button>}{canAdmin && form.id && <button className="approve" onClick={() => saveReport('approved')} disabled={saving}>{t.approve}</button>}</div></section>}
        <section className="management-report-status management-unit-report-directory"><div className="management-card-heading"><div><small>{t.unitReports}</small><h2>{t.unitReportsTitle}</h2><p>{t.unitReportsHelp}</p></div></div><div>{visibleUnits.map((unit) => { const report = periodReports.find((r) => r.unit_id === unit.id); const canEdit = canAdmin || manageableUnitIds.includes(unit.id); return <article key={unit.id}><span>{unit.code}</span><div><strong>{unit.name}</strong><small>{report ? `${t.updated} ${formatDate(report.updated_at, language)}` : t.pendingReport}</small></div><b className={`report-state ${report?.status || 'none'}`}>{reportStatus[language][report?.status || 'none']}</b><div className="unit-report-row-actions"><button onClick={() => viewUnit(unit.id)}>{t.view}</button>{canEdit && <button className="secondary" onClick={() => hydrateForm(unit.id)}>{report ? t.edit : t.create}</button>}</div></article> })}</div></section>
      </>}
    </div></main>
  </div>
}
