import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-reports-v2.css'

const reportStatus = {
  es: { draft: 'Borrador', submitted: 'Enviado', reviewed: 'Revisado', approved: 'Aprobado', closed: 'Cerrado', none: 'Pendiente' },
  en: { draft: 'Draft', submitted: 'Submitted', reviewed: 'Reviewed', approved: 'Approved', closed: 'Closed', none: 'Pending' },
}

const copy = {
  es: {
    eyebrow: 'INFORMES DE GESTIÓN', title: 'Informes claros por Dirección', intro: 'Cada Dirección registra sus acciones y logros por puntos. Edifica conserva ese orden y los integra automáticamente en el informe institucional.',
    organization: 'Organización', period: 'Período', units: 'Direcciones / unidades', started: 'Iniciados', submitted: 'Enviados', approved: 'Aprobados', consolidated: 'Ver informe consolidado', back: 'Volver al directorio', print: 'Imprimir / PDF',
    directory: 'INFORMES POR DIRECCIÓN', directoryTitle: 'Estado de los informes', directoryHelp: 'Abre cada Dirección para redactar, revisar o consultar exactamente lo que aparecerá en el consolidado.', pending: 'Sin informe iniciado', updated: 'Actualizado', create: 'Crear informe', edit: 'Editar', view: 'Ver',
    report: 'INFORME DE LA DIRECCIÓN', executive: 'Resumen ejecutivo', executiveHelp: 'Una síntesis breve del período. Los hechos concretos se registran debajo, uno por renglón.', achievements: 'Acciones y logros del período', achievementsHelp: 'Escribe una acción o logro por renglón. Ej.: “Se hicieron las vigilias de oración del mes de agosto”.', challenges: 'Retos o asuntos pendientes', challengesHelp: 'Registra cada reto de forma independiente.', next: 'Próximos pasos', nextHelp: 'Registra cada acción prevista para el siguiente período.', addAchievement: '＋ Agregar logro', addChallenge: '＋ Agregar reto', addNext: '＋ Agregar próximo paso', reviewer: 'Observaciones del revisor', saveDraft: 'Guardar borrador', send: 'Enviar informe', reviewed: 'Marcar revisado', approve: 'Aprobar', saving: 'Guardando…', saved: 'Informe actualizado.', close: 'Cerrar', remove: 'Eliminar',
    unitReport: 'INFORME DE GESTIÓN POR DIRECCIÓN', responsible: 'Responsable', status: 'Estado', objectives: 'Objetivos relacionados', indicators: 'Indicadores', projects: 'Proyectos e iniciativas', noItems: 'Sin información registrada.', target: 'Meta', achieved: 'Logrado', execution: 'Ejecución',
    consolidatedTitle: 'INFORME INSTITUCIONAL CONSOLIDADO', institutionalObjectives: 'Objetivos institucionales', indicatorTracking: 'Seguimiento de indicadores', managementByUnit: 'Gestión por Dirección', loading: 'Cargando informes…',
  },
  en: {
    eyebrow: 'MANAGEMENT REPORTS', title: 'Clear reports by unit', intro: 'Each unit records actions and achievements as individual items. Edifica preserves the order and automatically integrates them into the institutional report.',
    organization: 'Organization', period: 'Period', units: 'Units / directorates', started: 'Started', submitted: 'Submitted', approved: 'Approved', consolidated: 'View consolidated report', back: 'Back to directory', print: 'Print / PDF',
    directory: 'REPORTS BY UNIT', directoryTitle: 'Report status', directoryHelp: 'Open each unit to write, review, or see exactly what will appear in the consolidated report.', pending: 'No report started', updated: 'Updated', create: 'Create report', edit: 'Edit', view: 'View',
    report: 'UNIT REPORT', executive: 'Executive summary', executiveHelp: 'A short period summary. Record concrete facts below, one per line.', achievements: 'Actions and achievements', achievementsHelp: 'Enter one action or achievement per line.', challenges: 'Challenges or pending issues', challengesHelp: 'Record each challenge independently.', next: 'Next steps', nextHelp: 'Record each action planned for the next period.', addAchievement: '＋ Add achievement', addChallenge: '＋ Add challenge', addNext: '＋ Add next step', reviewer: 'Reviewer notes', saveDraft: 'Save draft', send: 'Submit report', reviewed: 'Mark reviewed', approve: 'Approve', saving: 'Saving…', saved: 'Report updated.', close: 'Close', remove: 'Remove',
    unitReport: 'UNIT MANAGEMENT REPORT', responsible: 'Responsible', status: 'Status', objectives: 'Related objectives', indicators: 'Indicators', projects: 'Projects and initiatives', noItems: 'No information recorded.', target: 'Target', achieved: 'Achieved', execution: 'Execution',
    consolidatedTitle: 'CONSOLIDATED INSTITUTIONAL REPORT', institutionalObjectives: 'Institutional objectives', indicatorTracking: 'Indicator tracking', managementByUnit: 'Management by unit', loading: 'Loading reports…',
  },
}

const emptyForm = () => ({ id: '', executive_summary: '', achievements: [''], challenges: [''], next_steps: [''], reviewer_notes: '', status: 'draft' })
function readLanguage() { try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function formatDate(value, language) { if (!value) return '—'; return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0,10)}T00:00:00`)) }
function formatNumber(value, language) { return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { maximumFractionDigits: 2 }).format(Number(value || 0)) }
function splitLegacy(value) { return String(value || '').split(/\r?\n/).map((item) => item.replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').trim()).filter(Boolean) }
function latestProgress(rows) { return [...rows].sort((a,b) => new Date(b.reporting_period_end || b.created_at || 0) - new Date(a.reporting_period_end || a.created_at || 0))[0] }
function aggregateIndicator(indicator, rows) {
  const data = rows.filter((row) => row.indicator_id === indicator.id && row.status !== 'draft')
  if (!data.length) return { value: null, text: '', completion: 0 }
  if (indicator.metric_type === 'text') return { value: null, text: latestProgress(data)?.text_value || '', completion: 0 }
  if (indicator.metric_type === 'boolean') { const value = Number(Boolean(Number(latestProgress(data)?.numeric_value || 0))); return { value, text: '', completion: value * 100 } }
  let value = 0; const method = indicator.aggregation_method === 'calculated' ? 'latest' : indicator.aggregation_method
  if (method === 'average') value = data.reduce((sum,row) => sum + Number(row.numeric_value || 0),0) / data.length
  else if (['latest','unique_people','non_aggregable'].includes(method)) value = Number(latestProgress(data)?.numeric_value ?? latestProgress(data)?.numerator ?? 0)
  else if (method === 'max') value = Math.max(...data.map((row) => Number(row.numeric_value || 0)))
  else value = data.reduce((sum,row) => sum + Number(row.numeric_value || 0),0)
  const target = Number(indicator.target_value || 0); return { value, text: '', completion: target > 0 ? Math.round(value / target * 1000) / 10 : 0 }
}
function metricDisplay(value, indicator, language) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  if (indicator.metric_type === 'currency') return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { style: 'currency', currency: indicator.currency || 'USD', maximumFractionDigits: 2 }).format(Number(value))
  if (indicator.metric_type === 'percentage') return `${formatNumber(value,language)}%`
  if (indicator.metric_type === 'boolean') return Number(value) ? (language === 'en' ? 'Yes' : 'Sí') : 'No'
  return `${formatNumber(value,language)}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}

function ItemEditor({ title, help, values, setValues, addLabel, removeLabel, placeholder }) {
  const update = (index, value) => setValues(values.map((item,i) => i === index ? value : item))
  const remove = (index) => setValues(values.filter((_,i) => i !== index).length ? values.filter((_,i) => i !== index) : [''])
  return <div className="report-item-editor"><div className="report-item-editor-heading"><div><strong>{title}</strong><small>{help}</small></div><button type="button" onClick={() => setValues([...values,''])}>{addLabel}</button></div><div className="report-item-editor-list">{values.map((value,index) => <label key={index}><span>{index + 1}</span><textarea value={value} onChange={(event) => update(index,event.target.value)} placeholder={index === 0 ? placeholder : ''} /><button type="button" title={removeLabel} onClick={() => remove(index)}>×</button></label>)}</div></div>
}

function OrderedItems({ items, empty }) { return items.length ? <ol className="unit-report-items">{items.map((item,index) => <li key={item.id || `${item.statement}-${index}`}>{item.statement}</li>)}</ol> : <p className="report-empty-text">{empty}</p> }

export default function ManagementReportsV2Page() {
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
  const [memberships, setMemberships] = useState([])
  const [reports, setReports] = useState([])
  const [items, setItems] = useState([])
  const [indicators, setIndicators] = useState([])
  const [progress, setProgress] = useState([])
  const [objectives, setObjectives] = useState([])
  const [assignments, setAssignments] = useState([])
  const [projects, setProjects] = useState([])
  const [projectUnits, setProjectUnits] = useState([])
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { const observer = new MutationObserver(() => setLanguage(readLanguage())); observer.observe(document.documentElement,{ attributes:true, attributeFilter:['lang'] }); return () => observer.disconnect() }, [])
  useEffect(() => { if (access.status === 'authorized') setOrganizationId((current) => current || access.organizationId || '') }, [access.organizationId, access.status])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) { setOrganizations(access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : []); return }
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) setError(requestError.message); else { setOrganizations(data ?? []); setOrganizationId((current) => current || data?.find((item) => item.code === 'cnbv')?.id || data?.[0]?.id || '') }
  }, [access.organizationId, access.organizationName, access.status, isSuperAdmin])

  const reload = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const responses = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id',organizationId).order('start_date',{ ascending:false }),
      supabase.from('organization_unit').select('*').eq('organization_id',organizationId).eq('active',true).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id',organizationId),
      supabase.from('unit_management_report').select('*').eq('organization_id',organizationId).order('updated_at',{ ascending:false }),
      supabase.from('unit_management_report_item').select('*').eq('organization_id',organizationId).order('sort_order'),
      supabase.from('management_indicator').select('*').eq('organization_id',organizationId).eq('active',true).order('created_at'),
      supabase.from('indicator_progress').select('*').eq('organization_id',organizationId).order('created_at'),
      supabase.from('institutional_objective').select('*').eq('organization_id',organizationId).order('code'),
      supabase.from('objective_unit_assignment').select('*').eq('organization_id',organizationId),
      supabase.from('project').select('id, organization_id, code, name, status, project_type').eq('organization_id',organizationId).order('created_at',{ ascending:false }),
      supabase.from('project_organization_unit').select('*').eq('organization_id',organizationId),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows = responses[0].data ?? []; setPeriods(periodRows); setUnits(responses[1].data ?? []); setMemberships(responses[2].data ?? []); setReports(responses[3].data ?? []); setItems(responses[4].data ?? []); setIndicators(responses[5].data ?? []); setProgress(responses[6].data ?? []); setObjectives(responses[7].data ?? []); setAssignments(responses[8].data ?? []); setProjects(responses[9].data ?? []); setProjectUnits(responses[10].data ?? []); setActivePeriodId((current) => current && periodRows.some((period) => period.id === current) ? current : periodRows.find((period) => period.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status,organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const manageableUnitIds = useMemo(() => canAdmin ? units.map((unit) => unit.id) : memberships.filter((member) => member.active && ['director','manager','operator','reviewer'].includes(member.unit_role)).map((member) => member.unit_id), [canAdmin,memberships,units])
  const visibleUnits = useMemo(() => canAdmin ? units : units.filter((unit) => manageableUnitIds.includes(unit.id)), [canAdmin,manageableUnitIds,units])
  useEffect(() => { if (!visibleUnits.some((unit) => unit.id === selectedUnitId)) setSelectedUnitId(visibleUnits[0]?.id || '') }, [selectedUnitId,visibleUnits])

  const periodReports = reports.filter((report) => report.management_period_id === activePeriodId)
  const periodIndicators = indicators.filter((indicator) => indicator.management_period_id === activePeriodId)
  const periodObjectives = objectives.filter((objective) => objective.management_period_id === activePeriodId)
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId)
  const canManageSelected = canAdmin || manageableUnitIds.includes(selectedUnitId)
  const submittedCount = periodReports.filter((report) => ['submitted','reviewed','approved','closed'].includes(report.status)).length
  const approvedCount = periodReports.filter((report) => ['approved','closed'].includes(report.status)).length
  const activePeriodName = periods.find((period) => period.id === activePeriodId)?.name || ''
  const currentOrgName = organizations.find((organization) => organization.id === organizationId)?.name || access.organizationName || 'Organización'

  const reportItems = (report, type) => {
    if (!report) return []
    const stored = items.filter((item) => item.report_id === report.id && item.item_type === type).sort((a,b) => a.sort_order - b.sort_order)
    if (stored.length) return stored
    const legacy = type === 'achievement' ? report.achievements : type === 'challenge' ? report.challenges : report.next_steps
    return splitLegacy(legacy).map((statement,index) => ({ id: `legacy-${type}-${index}`, statement, sort_order:index }))
  }
  const unitObjectives = (unitId) => assignments.filter((assignment) => assignment.unit_id === unitId && periodObjectives.some((objective) => objective.id === assignment.objective_id)).map((assignment) => ({ assignment, objective: periodObjectives.find((objective) => objective.id === assignment.objective_id) })).filter((row) => row.objective)
  const unitIndicators = (unitId) => periodIndicators.filter((indicator) => indicator.unit_id === unitId)
  const unitProjects = (unitId) => projectUnits.filter((relation) => relation.unit_id === unitId).map((relation) => projects.find((project) => project.id === relation.project_id)).filter(Boolean)

  const hydrateForm = (unitId) => {
    const report = periodReports.find((row) => row.unit_id === unitId); setSelectedUnitId(unitId)
    setForm(report ? { id: report.id, executive_summary: report.executive_summary || '', achievements: reportItems(report,'achievement').map((item) => item.statement).length ? reportItems(report,'achievement').map((item) => item.statement) : [''], challenges: reportItems(report,'challenge').map((item) => item.statement).length ? reportItems(report,'challenge').map((item) => item.statement) : [''], next_steps: reportItems(report,'next_step').map((item) => item.statement).length ? reportItems(report,'next_step').map((item) => item.statement) : [''], reviewer_notes: report.reviewer_notes || '', status: report.status } : emptyForm())
    setEditOpen(true); setViewMode('list'); setError(''); setMessage(''); window.scrollTo({ top:0, behavior:'smooth' })
  }

  const saveReport = async (status) => {
    if (!canManageSelected || saving || !selectedUnitId || !activePeriodId) return
    setSaving(true); setError(''); setMessage('')
    const payload = { id: form.id, organization_id: organizationId, management_period_id: activePeriodId, unit_id: selectedUnitId, status, executive_summary: form.executive_summary, achievements: form.achievements.map((item) => item.trim()).filter(Boolean), challenges: form.challenges.map((item) => item.trim()).filter(Boolean), next_steps: form.next_steps.map((item) => item.trim()).filter(Boolean), reviewer_notes: form.reviewer_notes }
    const { data: reportId, error: requestError } = await supabase.rpc('save_unit_management_report_v2',{ payload })
    if (requestError) setError(requestError.message); else { setForm((current) => ({ ...current, id: reportId, status })); setMessage(t.saved); await reload() }
    setSaving(false)
  }

  const viewUnit = (unitId) => { setSelectedUnitId(unitId); setEditOpen(false); setViewMode('unit'); window.scrollTo({ top:0, behavior:'smooth' }) }

  const renderUnitReport = (unit) => {
    const report = periodReports.find((row) => row.unit_id === unit.id); const achievements = reportItems(report,'achievement'); const challenges = reportItems(report,'challenge'); const nextSteps = reportItems(report,'next_step'); const objectiveRows = unitObjectives(unit.id); const indicatorRows = unitIndicators(unit.id); const projectRows = unitProjects(unit.id)
    return <section className="unit-report-v2-document"><header><div><small>{t.unitReport}</small><h1>{unit.code} · {unit.name}</h1><p>{activePeriodName} · {currentOrgName}</p></div><div className="unit-report-v2-actions no-print"><button onClick={() => setViewMode('list')}>{t.back}</button><button className="primary" onClick={() => window.print()}>{t.print}</button></div></header>
      <div className="unit-report-v2-meta"><div><span>{t.responsible}</span><strong>{unit.manager_name || unit.manager_email || '—'}</strong></div><div><span>{t.status}</span><strong>{reportStatus[language][report?.status || 'none']}</strong></div></div>
      {report?.executive_summary && <section><h2>{t.executive}</h2><p>{report.executive_summary}</p></section>}
      <section><h2>{t.achievements}</h2><OrderedItems items={achievements} empty={t.noItems} /></section>
      {challenges.length > 0 && <section><h2>{t.challenges}</h2><OrderedItems items={challenges} empty={t.noItems} /></section>}
      {nextSteps.length > 0 && <section><h2>{t.next}</h2><OrderedItems items={nextSteps} empty={t.noItems} /></section>}
      <section><h2>{t.objectives}</h2>{objectiveRows.length ? objectiveRows.map(({ objective }) => <article className="report-reference-row" key={objective.id}><span>{objective.code}</span><strong>{objective.title}</strong></article>) : <p className="report-empty-text">{t.noItems}</p>}</section>
      <section><h2>{t.indicators}</h2>{indicatorRows.length ? <div className="report-indicator-grid">{indicatorRows.map((indicator) => { const result = aggregateIndicator(indicator,progress); return <article key={indicator.id}><strong>{indicator.name}</strong><span>{t.target}: {indicator.target_value == null ? indicator.target_text || '—' : metricDisplay(indicator.target_value,indicator,language)}</span><b>{t.achieved}: {result.text || metricDisplay(result.value,indicator,language)} · {result.completion}%</b></article> })}</div> : <p className="report-empty-text">{t.noItems}</p>}</section>
      <section><h2>{t.projects}</h2>{projectRows.length ? projectRows.map((project) => <article className="report-reference-row" key={project.id}><span>{project.code}</span><strong>{project.name}</strong></article>) : <p className="report-empty-text">{t.noItems}</p>}</section>
    </section>
  }

  const renderConsolidated = () => <section className="unit-report-v2-document consolidated-v2"><header><div><small>{t.consolidatedTitle}</small><h1>{activePeriodName}</h1><p>{currentOrgName}</p></div><div className="unit-report-v2-actions no-print"><button onClick={() => setViewMode('list')}>{t.back}</button><button className="primary" onClick={() => window.print()}>{t.print}</button></div></header>
    <div className="consolidated-v2-summary"><article><span>{t.units}</span><strong>{units.length}</strong></article><article><span>{t.started}</span><strong>{periodReports.length}</strong></article><article><span>{t.submitted}</span><strong>{submittedCount}</strong></article><article><span>{t.approved}</span><strong>{approvedCount}</strong></article></div>
    <section><h2>{t.institutionalObjectives}</h2>{periodObjectives.map((objective) => <article className="report-reference-row" key={objective.id}><span>{objective.code}</span><strong>{objective.title}</strong></article>)}</section>
    <section><h2>{t.indicatorTracking}</h2><div className="report-indicator-grid">{periodIndicators.map((indicator) => { const result=aggregateIndicator(indicator,progress); return <article key={indicator.id}><small>{units.find((unit) => unit.id===indicator.unit_id)?.code}</small><strong>{indicator.name}</strong><span>{t.target}: {indicator.target_value == null ? indicator.target_text || '—' : metricDisplay(indicator.target_value,indicator,language)}</span><b>{t.achieved}: {result.text || metricDisplay(result.value,indicator,language)} · {result.completion}%</b></article> })}</div></section>
    <section><h2>{t.managementByUnit}</h2><div className="consolidated-v2-units">{units.map((unit) => { const report=periodReports.find((row) => row.unit_id===unit.id); if(!report) return null; const achievements=reportItems(report,'achievement'); const challenges=reportItems(report,'challenge'); const nextSteps=reportItems(report,'next_step'); return <article key={unit.id}><header><span>{unit.code}</span><div><h3>{unit.name}</h3><small>{reportStatus[language][report.status]}</small></div></header>{report.executive_summary && <div><strong>{t.executive}</strong><p>{report.executive_summary}</p></div>}<div><strong>{t.achievements}</strong><OrderedItems items={achievements} empty={t.noItems} /></div>{challenges.length>0 && <div><strong>{t.challenges}</strong><OrderedItems items={challenges} empty={t.noItems} /></div>}{nextSteps.length>0 && <div><strong>{t.next}</strong><OrderedItems items={nextSteps} empty={t.noItems} /></div>}</article> })}</div></section>
  </section>

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />

  return <ManagementStandaloneShell access={access}><div className="management-panel reports-v2-page">
    <div className="management-panel-heading no-print"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div><button onClick={() => { setEditOpen(false); setViewMode(viewMode === 'consolidated' ? 'list' : 'consolidated') }}>{viewMode === 'consolidated' ? t.back : t.consolidated}</button></div>
    {isSuperAdmin && <section className="management-filter-row no-print"><label><span>{t.organization}</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label></section>}
    {error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}
    {loading ? <div className="management-loading"><span /><p>{t.loading}</p></div> : viewMode === 'unit' && selectedUnit ? renderUnitReport(selectedUnit) : viewMode === 'consolidated' ? renderConsolidated() : <>
      <section className="management-report-summary no-print"><article><span>{t.units}</span><strong>{units.length}</strong></article><article><span>{t.started}</span><strong>{periodReports.length}</strong></article><article><span>{t.submitted}</span><strong>{submittedCount}</strong></article><article><span>{t.approved}</span><strong>{approvedCount}</strong></article></section>
      <section className="management-filter-row no-print"><label><span>{t.period}</span><select value={activePeriodId} onChange={(event) => setActivePeriodId(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label></section>
      {editOpen && selectedUnit && <section className="management-form-card report-v2-editor no-print"><div className="management-form-title"><div><small>{t.report}</small><h2>{selectedUnit.code} · {selectedUnit.name}</h2><span className={`report-state ${form.status}`}>{reportStatus[language][form.status]}</span></div><button type="button" onClick={() => setEditOpen(false)}>{t.close}</button></div>
        <label className="report-v2-summary"><span>{t.executive}</span><textarea value={form.executive_summary} onChange={(event) => setForm((current) => ({ ...current, executive_summary:event.target.value }))} /><small>{t.executiveHelp}</small></label>
        <ItemEditor title={t.achievements} help={t.achievementsHelp} values={form.achievements} setValues={(values) => setForm((current) => ({ ...current, achievements:values }))} addLabel={t.addAchievement} removeLabel={t.remove} placeholder={language === 'en' ? 'Example: Two meetings were held with the teams from Germany and Hungary.' : 'Ej.: Se hicieron dos reuniones con la gente de Alemania y Hungría.'} />
        <ItemEditor title={t.challenges} help={t.challengesHelp} values={form.challenges} setValues={(values) => setForm((current) => ({ ...current, challenges:values }))} addLabel={t.addChallenge} removeLabel={t.remove} placeholder="" />
        <ItemEditor title={t.next} help={t.nextHelp} values={form.next_steps} setValues={(values) => setForm((current) => ({ ...current, next_steps:values }))} addLabel={t.addNext} removeLabel={t.remove} placeholder="" />
        {canAdmin && <label className="report-v2-summary"><span>{t.reviewer}</span><textarea value={form.reviewer_notes} onChange={(event) => setForm((current) => ({ ...current, reviewer_notes:event.target.value }))} /></label>}
        <div className="report-actions"><button onClick={() => saveReport('draft')} disabled={saving}>{t.saveDraft}</button><button className="primary" onClick={() => saveReport('submitted')} disabled={saving}>{saving ? t.saving : t.send}</button>{canAdmin && form.id && <button onClick={() => saveReport('reviewed')} disabled={saving}>{t.reviewed}</button>}{canAdmin && form.id && <button className="approve" onClick={() => saveReport('approved')} disabled={saving}>{t.approve}</button>}</div>
      </section>}
      <section className="management-report-status management-unit-report-directory"><div className="management-card-heading"><div><small>{t.directory}</small><h2>{t.directoryTitle}</h2><p>{t.directoryHelp}</p></div></div><div>{visibleUnits.map((unit) => { const report=periodReports.find((row) => row.unit_id===unit.id); const canEdit=canAdmin || manageableUnitIds.includes(unit.id); return <article key={unit.id}><span>{unit.code}</span><div><strong>{unit.name}</strong><small>{report ? `${t.updated} ${formatDate(report.updated_at,language)}` : t.pending}</small></div><b className={`report-state ${report?.status || 'none'}`}>{reportStatus[language][report?.status || 'none']}</b><div className="unit-report-row-actions"><button onClick={() => viewUnit(unit.id)}>{t.view}</button>{canEdit && <button className="secondary" onClick={() => hydrateForm(unit.id)}>{report ? t.edit : t.create}</button>}</div></article> })}</div></section>
    </>}
  </div></ManagementStandaloneShell>
}
