import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-report-create.css'

const statusLabels = { draft: 'Borrador', submitted: 'Enviado a DIAF', reviewed: 'Revisado por DIAF', approved: 'Aprobado por DIAF', closed: 'Cerrado' }
const kindLabels = { result: 'Resultado', output: 'Producto / entregable', process: 'Proceso / gestión', impact: 'Impacto' }

function emptyStatement() { return { statement: '', objective_id: '', indicator_id: '' } }
function emptyForm() { return { id: '', executive_summary: '', statements: [emptyStatement()], challenges: [''], next_steps: [''], reviewer_notes: '', status: 'draft' } }
function formatDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) }
function targetLabel(indicator) {
  if (indicator.target_value == null) return indicator.target_text || '—'
  if (indicator.metric_type === 'currency') return new Intl.NumberFormat('es-VE', { style: 'currency', currency: indicator.currency || 'USD', maximumFractionDigits: 2 }).format(Number(indicator.target_value))
  if (indicator.metric_type === 'percentage') return `${Number(indicator.target_value).toLocaleString('es-VE')}%`
  return `${Number(indicator.target_value).toLocaleString('es-VE')}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}

export default function ManagementReportCreatePage() {
  const access = useOperatorAccess()
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'

  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [organizations, setOrganizations] = useState([])
  const [periods, setPeriods] = useState([])
  const [windows, setWindows] = useState([])
  const [units, setUnits] = useState([])
  const [memberships, setMemberships] = useState([])
  const [workPlans, setWorkPlans] = useState([])
  const [objectives, setObjectives] = useState([])
  const [assignments, setAssignments] = useState([])
  const [indicators, setIndicators] = useState([])
  const [reports, setReports] = useState([])
  const [items, setItems] = useState([])
  const [periodId, setPeriodId] = useState(params.get('period') || '')
  const [windowId, setWindowId] = useState(params.get('window') || '')
  const [unitId, setUnitId] = useState(params.get('unit') || '')
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (access.status === 'authorized' && !isSuperAdmin) setOrganizationId(access.organizationId || '')
  }, [access.organizationId, access.status, isSuperAdmin])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) {
      setOrganizations(access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : [])
      return
    }
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) setError(requestError.message)
    else {
      const rows = data ?? []
      setOrganizations(rows)
      setOrganizationId((current) => current || rows.find((item) => item.code === 'cnbv')?.id || rows[0]?.id || '')
    }
  }, [access.organizationId, access.organizationName, access.status, isSuperAdmin])

  const reload = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const responses = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('management_report_window').select('*').eq('organization_id', organizationId).eq('active', true).order('sort_order'),
      supabase.from('organization_unit').select('*').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id', organizationId).eq('active', true),
      supabase.from('unit_work_plan').select('*').eq('organization_id', organizationId),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('objective_unit_assignment').select('*').eq('organization_id', organizationId),
      supabase.from('management_indicator').select('*').eq('organization_id', organizationId).eq('active', true).order('created_at'),
      supabase.from('unit_management_report').select('*').eq('organization_id', organizationId).order('updated_at', { ascending: false }),
      supabase.from('unit_management_report_item').select('*').eq('organization_id', organizationId).order('sort_order'),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows = responses[0].data ?? []
      setPeriods(periodRows); setWindows(responses[1].data ?? []); setUnits(responses[2].data ?? []); setMemberships(responses[3].data ?? []); setWorkPlans(responses[4].data ?? []); setObjectives(responses[5].data ?? []); setAssignments(responses[6].data ?? []); setIndicators(responses[7].data ?? []); setReports(responses[8].data ?? []); setItems(responses[9].data ?? [])
      setPeriodId((current) => periodRows.some((item) => item.id === current) ? current : periodRows.find((item) => item.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const manageableUnitIds = useMemo(() => canAdmin
    ? units.map((unit) => unit.id)
    : memberships.filter((item) => ['director', 'manager', 'operator', 'reviewer'].includes(item.unit_role)).map((item) => item.unit_id), [canAdmin, memberships, units])
  const visibleUnits = useMemo(() => canAdmin ? units : units.filter((unit) => manageableUnitIds.includes(unit.id)), [canAdmin, manageableUnitIds, units])
  useEffect(() => { if (!visibleUnits.some((unit) => unit.id === unitId)) setUnitId(visibleUnits[0]?.id || '') }, [unitId, visibleUnits])

  const periodWindows = useMemo(() => windows.filter((item) => item.management_period_id === periodId), [windows, periodId])
  useEffect(() => { if (!periodWindows.some((item) => item.id === windowId)) setWindowId(periodWindows[0]?.id || '') }, [periodWindows, windowId])

  const currentPlan = workPlans.find((plan) => plan.management_period_id === periodId && plan.unit_id === unitId)
  const unitObjectives = useMemo(() => objectives.filter((objective) => objective.management_period_id === periodId && (
    currentPlan ? objective.work_plan_id === currentPlan.id : assignments.some((assignment) => assignment.objective_id === objective.id && assignment.unit_id === unitId && assignment.assignment_type === 'responsible')
  )), [objectives, assignments, periodId, unitId, currentPlan])
  const unitIndicators = useMemo(() => indicators.filter((indicator) => indicator.management_period_id === periodId && indicator.unit_id === unitId), [indicators, periodId, unitId])
  const selectedWindow = periodWindows.find((item) => item.id === windowId)
  const selectedUnit = visibleUnits.find((item) => item.id === unitId)
  const existingReport = reports.find((report) => report.report_window_id === windowId && report.unit_id === unitId)

  useEffect(() => {
    if (!windowId || !unitId || loading) return
    if (!existingReport) { setForm(emptyForm()); return }
    const reportItems = items.filter((item) => item.report_id === existingReport.id)
    const achievements = reportItems.filter((item) => item.item_type === 'achievement')
    setForm({
      id: existingReport.id,
      executive_summary: existingReport.executive_summary || '',
      statements: achievements.length ? achievements.map((item) => ({ statement: item.statement, objective_id: item.objective_id || '', indicator_id: item.indicator_id || '' })) : [emptyStatement()],
      challenges: reportItems.filter((item) => item.item_type === 'challenge').map((item) => item.statement).length ? reportItems.filter((item) => item.item_type === 'challenge').map((item) => item.statement) : [''],
      next_steps: reportItems.filter((item) => item.item_type === 'next_step').map((item) => item.statement).length ? reportItems.filter((item) => item.item_type === 'next_step').map((item) => item.statement) : [''],
      reviewer_notes: existingReport.reviewer_notes || '',
      status: existingReport.status,
    })
  }, [windowId, unitId, existingReport?.id, loading, items])

  const updateStatement = (index, patch) => setForm((current) => ({ ...current, statements: current.statements.map((row, i) => i === index ? { ...row, ...patch } : row) }))
  const addStatement = () => setForm((current) => ({ ...current, statements: [...current.statements, emptyStatement()] }))
  const removeStatement = (index) => setForm((current) => { const next = current.statements.filter((_, i) => i !== index); return { ...current, statements: next.length ? next : [emptyStatement()] } })
  const updateList = (key, index, value) => setForm((current) => ({ ...current, [key]: current[key].map((item, i) => i === index ? value : item) }))
  const addList = (key) => setForm((current) => ({ ...current, [key]: [...current[key], ''] }))
  const removeList = (key, index) => setForm((current) => { const next = current[key].filter((_, i) => i !== index); return { ...current, [key]: next.length ? next : [''] } })

  const save = async (status) => {
    if (!supabase || saving || !windowId || !unitId) return
    const statements = form.statements.filter((row) => row.statement.trim())
    if (!statements.length) { setError('Agrega por lo menos una declaración al informe.'); return }
    if (statements.some((row) => !row.objective_id)) { setError('Cada declaración debe estar vinculada a un objetivo.'); return }
    if (status === 'submitted') {
      const missingIndicator = statements.find((row) => unitIndicators.some((indicator) => indicator.objective_id === row.objective_id) && !row.indicator_id)
      if (missingIndicator) { setError('Selecciona el indicador que respalda cada declaración cuando ese objetivo tenga indicadores disponibles.'); return }
    }

    const payloadItems = statements.map((row) => ({ item_type: 'achievement', statement: row.statement.trim(), objective_id: row.objective_id, indicator_id: row.indicator_id || null }))
    form.challenges.map((value) => value.trim()).filter(Boolean).forEach((statement) => payloadItems.push({ item_type: 'challenge', statement }))
    form.next_steps.map((value) => value.trim()).filter(Boolean).forEach((statement) => payloadItems.push({ item_type: 'next_step', statement }))

    setSaving(true); setError(''); setMessage('')
    const { data: reportId, error: requestError } = await supabase.rpc('save_unit_management_report_v4', { payload: {
      id: form.id || null,
      organization_id: organizationId,
      report_window_id: windowId,
      unit_id: unitId,
      status,
      executive_summary: form.executive_summary,
      reviewer_notes: form.reviewer_notes,
      items: payloadItems,
    } })
    if (requestError) setError(requestError.message)
    else {
      setForm((current) => ({ ...current, id: reportId, status }))
      setMessage(status === 'submitted' ? 'Informe enviado a DIAF.' : 'Borrador guardado.')
      await reload()
    }
    setSaving(false)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel report-create-page">
      <div className="report-create-back"><a href="/app/management/reports">← Volver a Informes</a></div>
      <div className="report-create-hero">
        <div><p>CREAR INFORME</p><h1>{existingReport ? 'Editar informe de gestión' : 'Crear informe de gestión'}</h1><span>Selecciona el corte y la Dirección. Luego redacta cada declaración y vincúlala al indicador que demuestra ese resultado.</span></div>
        {form.status && <b className={`report-state ${form.status}`}>{statusLabels[form.status] || form.status}</b>}
      </div>

      {error && <p className="management-flash error">{error}</p>}
      {message && <p className="management-flash success">{message}</p>}

      {loading ? <div className="management-loading"><span /><p>Cargando informe…</p></div> : <>
        <section className="report-create-context">
          {isSuperAdmin && <label><span>Organización</span><select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setPeriodId(''); setWindowId(''); setUnitId('') }}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label><span>Año de trabajo</span><select value={periodId} onChange={(event) => { setPeriodId(event.target.value); setWindowId('') }}>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Informe / corte</span><select value={windowId} onChange={(event) => setWindowId(event.target.value)}>{periodWindows.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label><span>Dirección</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)}>{visibleUnits.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          {selectedWindow && <div className="report-create-range"><small>PERÍODO INFORMADO</small><strong>{formatDate(selectedWindow.start_date)} — {formatDate(selectedWindow.end_date)}</strong><span>{selectedUnit?.code} · {selectedUnit?.name}</span></div>}
        </section>

        {!unitObjectives.length && <div className="report-create-warning"><div><strong>Esta Dirección todavía no tiene objetivos en el Plan Anual.</strong><span>Crea primero los objetivos para poder relacionar las declaraciones del informe.</span></div><a href={`/app/management/objectives?period=${encodeURIComponent(periodId)}&unit=${encodeURIComponent(unitId)}`}>Abrir Plan Anual</a></div>}

        <section className="report-create-card">
          <div className="report-create-section-title"><div><small>RESUMEN</small><h2>Resumen ejecutivo</h2><p>Escribe una síntesis breve del período informado.</p></div></div>
          <textarea className="report-create-summary" value={form.executive_summary} onChange={(event) => setForm((current) => ({ ...current, executive_summary: event.target.value }))} placeholder="Ej.: Durante el período enero-marzo la Dirección de Promoción desarrolló…" />
        </section>

        <section className="report-create-card report-statements-card">
          <div className="report-create-section-title"><div><small>CONTENIDO DEL INFORME</small><h2>Declaraciones y sus indicadores</h2><p>Para cada declaración: 1) selecciona el objetivo; 2) selecciona el indicador creado para ese objetivo; 3) escribe el resultado o actividad realizada.</p></div><button type="button" onClick={addStatement}>＋ Agregar declaración</button></div>
          <div className="report-statement-list">{form.statements.map((row, index) => {
            const availableIndicators = unitIndicators.filter((indicator) => indicator.objective_id === row.objective_id)
            return <article className="report-statement-card" key={index}>
              <header><span>{index + 1}</span><strong>Declaración del informe</strong>{form.statements.length > 1 && <button type="button" onClick={() => removeStatement(index)}>Eliminar</button>}</header>
              <div className="report-statement-selectors">
                <label><span>1. OBJETIVO *</span><select value={row.objective_id} onChange={(event) => updateStatement(index, { objective_id: event.target.value, indicator_id: '' })}><option value="">Seleccionar objetivo</option>{unitObjectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.code} · {objective.title}</option>)}</select></label>
                <label className={row.objective_id && availableIndicators.length ? 'indicator-selector-ready' : ''}><span>2. INDICADOR QUE RESPALDA ESTA DECLARACIÓN {availableIndicators.length ? '*' : ''}</span><select value={row.indicator_id} disabled={!row.objective_id || !availableIndicators.length} onChange={(event) => updateStatement(index, { indicator_id: event.target.value })}><option value="">{!row.objective_id ? 'Selecciona primero el objetivo' : availableIndicators.length ? 'Seleccionar indicador' : 'Este objetivo aún no tiene indicadores'}</option>{availableIndicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{kindLabels[indicator.indicator_kind || 'result']} · {indicator.name} · Meta: {targetLabel(indicator)}</option>)}</select>{row.objective_id && availableIndicators.length > 0 && <small>Solo aparecen los indicadores que pertenecen al objetivo seleccionado.</small>}</label>
              </div>
              {row.indicator_id && <div className="report-selected-indicator">{(() => { const indicator = unitIndicators.find((item) => item.id === row.indicator_id); return indicator ? <><span>{kindLabels[indicator.indicator_kind || 'result']}</span><strong>{indicator.name}</strong><b>Meta: {targetLabel(indicator)}</b></> : null })()}</div>}
              <label className="report-statement-text"><span>3. DECLARACIÓN / STATEMENT *</span><textarea value={row.statement} onChange={(event) => updateStatement(index, { statement: event.target.value })} placeholder="Ej.: Se efectuaron las cuatro vigilias nacionales de oración programadas para el período." /></label>
            </article>
          })}</div>
        </section>

        <section className="report-create-card">
          <div className="report-create-section-title"><div><small>REFERENCIA</small><h2>Indicadores disponibles de {selectedUnit?.code || 'la Dirección'}</h2><p>Estos son los indicadores definidos en el Plan Anual para el año seleccionado.</p></div></div>
          <div className="report-indicator-reference">{unitIndicators.length ? unitIndicators.map((indicator) => {
            const objective = unitObjectives.find((item) => item.id === indicator.objective_id)
            return <article key={indicator.id}><span>{kindLabels[indicator.indicator_kind || 'result']}</span><strong>{indicator.name}</strong><small>{objective ? `${objective.code} · ${objective.title}` : 'Objetivo pendiente'}</small><b>Meta: {targetLabel(indicator)}</b></article>
          }) : <p>Aún no hay indicadores creados para esta Dirección.</p>}</div>
        </section>

        <section className="report-create-card report-simple-lists">
          <div><div className="report-create-section-title"><div><small>SEGUIMIENTO</small><h2>Retos o asuntos pendientes</h2></div><button type="button" onClick={() => addList('challenges')}>＋ Agregar</button></div>{form.challenges.map((value, index) => <div className="report-list-row" key={index}><span>{index + 1}</span><textarea value={value} onChange={(event) => updateList('challenges', index, event.target.value)} />{form.challenges.length > 1 && <button type="button" onClick={() => removeList('challenges', index)}>×</button>}</div>)}</div>
          <div><div className="report-create-section-title"><div><small>PRÓXIMO PERÍODO</small><h2>Próximos pasos</h2></div><button type="button" onClick={() => addList('next_steps')}>＋ Agregar</button></div>{form.next_steps.map((value, index) => <div className="report-list-row" key={index}><span>{index + 1}</span><textarea value={value} onChange={(event) => updateList('next_steps', index, event.target.value)} />{form.next_steps.length > 1 && <button type="button" onClick={() => removeList('next_steps', index)}>×</button>}</div>)}</div>
        </section>

        <div className="report-create-actions"><a href="/app/management/reports">Cancelar</a><button type="button" onClick={() => save('draft')} disabled={saving || !unitObjectives.length}>Guardar borrador</button><button className="primary" type="button" onClick={() => save('submitted')} disabled={saving || !unitObjectives.length}>{saving ? 'Guardando…' : 'Enviar informe a DIAF'}</button></div>
      </>}
    </div>
  </ManagementStandaloneShell>
}
