import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ProjectsPanel from '../dashboard/ProjectsPanel.jsx'
import './management.css'

const unitTypeLabels = {
  directorate: 'Dirección', department: 'Departamento', ministry: 'Ministerio', committee: 'Comité', auxiliary: 'Unión / auxiliar',
  academy: 'Academia', foundation: 'Fundación', campus: 'Sede / campus', church_area: 'Área de iglesia', other: 'Otra unidad',
}
const objectiveLevelLabels = { general: 'General', specific: 'Específico', operational: 'Operativo' }
const periodStatusLabels = { planning: 'Planificación', active: 'Activo', reporting: 'En informes', closed: 'Cerrado' }
const reportStatusLabels = { draft: 'Borrador', submitted: 'Enviado', reviewed: 'Revisado', approved: 'Aprobado', closed: 'Cerrado' }
const metricTypeLabels = { count: 'Conteo', currency: 'Moneda', percentage: 'Porcentaje', ratio: 'Ratio', boolean: 'Sí / No', text: 'Texto' }
const aggregationLabels = { sum: 'Suma', average: 'Promedio', latest: 'Último valor', max: 'Valor máximo', unique_people: 'Personas únicas', calculated: 'Calculado', non_aggregable: 'No consolidable' }
const frequencyLabels = { monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', ad_hoc: 'Cuando aplique' }

const emptyUnit = { id: '', code: '', name: '', unit_type: 'directorate', parent_unit_id: '', description: '', manager_name: '', manager_email: '', sort_order: 0, active: true, operator_access_id: '', unit_role: 'director' }
const emptyPeriod = () => ({ id: '', name: `Gestión ${new Date().getFullYear()}`, start_date: `${new Date().getFullYear()}-01-01`, end_date: `${new Date().getFullYear()}-12-31`, status: 'planning', reporting_due_date: '', notes: '' })
const emptyObjective = { id: '', code: '', title: '', description: '', objective_level: 'general', parent_objective_id: '', weight: '', status: 'active', responsible_unit_id: '', supporting_unit_ids: [] }
const emptyIndicator = { id: '', name: '', description: '', unit_id: '', objective_id: '', project_id: '', metric_type: 'count', unit_label: 'personas', aggregation_method: 'sum', target_value: '', target_text: '', currency: 'USD', frequency: 'annual', source_note: '' }
const emptyProgress = { id: '', indicator_id: '', unit_id: '', reporting_period_start: '', reporting_period_end: '', numeric_value: '', text_value: '', numerator: '', denominator: '', notes: '', status: 'draft' }
const emptyReport = { id: '', unit_id: '', status: 'draft', executive_summary: '', achievements: '', challenges: '', next_steps: '', reviewer_notes: '' }

function readLanguage() { try { return window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function formatDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) }
function formatNumber(value) { return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(Number(value || 0)) }
function metricDisplay(value, indicator) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  if (indicator.metric_type === 'currency') return new Intl.NumberFormat('es-VE', { style: 'currency', currency: indicator.currency || 'USD', maximumFractionDigits: 2 }).format(Number(value))
  if (indicator.metric_type === 'percentage') return `${formatNumber(value)}%`
  return `${formatNumber(value)}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}
function latestProgress(rows) { return [...rows].sort((a, b) => new Date(b.reporting_period_end || b.created_at) - new Date(a.reporting_period_end || a.created_at))[0] }
function aggregateIndicator(indicator, progressRows) {
  const rows = progressRows.filter((row) => row.indicator_id === indicator.id && row.status !== 'draft')
  if (!rows.length) return { value: null, text: '', completion: 0 }
  if (indicator.metric_type === 'text') return { value: null, text: latestProgress(rows)?.text_value || '', completion: 0 }
  if (indicator.metric_type === 'boolean') return { value: Number(Boolean(latestProgress(rows)?.numeric_value)), text: '', completion: Number(Boolean(latestProgress(rows)?.numeric_value)) * 100 }
  let value = 0
  if (indicator.aggregation_method === 'average') value = rows.reduce((sum, row) => sum + Number(row.numeric_value || 0), 0) / rows.length
  else if (indicator.aggregation_method === 'latest' || indicator.aggregation_method === 'unique_people' || indicator.aggregation_method === 'non_aggregable') value = Number(latestProgress(rows)?.numeric_value || 0)
  else if (indicator.aggregation_method === 'max') value = Math.max(...rows.map((row) => Number(row.numeric_value || 0)))
  else if (indicator.aggregation_method === 'calculated') {
    const row = latestProgress(rows)
    value = Number(row?.denominator || 0) > 0 ? (Number(row?.numerator || 0) / Number(row.denominator)) * 100 : Number(row?.numeric_value || 0)
  } else value = rows.reduce((sum, row) => sum + Number(row.numeric_value || 0), 0)
  const target = Number(indicator.target_value || 0)
  return { value, text: '', completion: target > 0 ? Math.round((value / target) * 1000) / 10 : 0 }
}
function Brand() { return <a className="management-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a> }
function Flash({ error, message }) { return <>{error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}</> }

function StructurePanel({ organizationId, units, memberships, operators, canAdmin, reload }) {
  const [form, setForm] = useState(emptyUnit)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const sorted = useMemo(() => [...units].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || a.name.localeCompare(b.name)), [units])
  const memberByUnit = useMemo(() => {
    const map = new Map()
    memberships.filter((item) => item.active).forEach((item) => { const current = map.get(item.unit_id) ?? []; current.push(item); map.set(item.unit_id, current) })
    return map
  }, [memberships])
  const operatorName = (id) => operators.find((item) => item.id === id)?.display_name || operators.find((item) => item.id === id)?.email || ''
  const depthFor = (unit) => { let depth = 0; let current = unit; const seen = new Set(); while (current?.parent_unit_id && depth < 6 && !seen.has(current.id)) { seen.add(current.id); current = units.find((candidate) => candidate.id === current.parent_unit_id); depth += 1 } return depth }

  const edit = (unit) => {
    const primary = (memberByUnit.get(unit.id) ?? []).find((item) => item.is_primary) ?? (memberByUnit.get(unit.id) ?? [])[0]
    setForm({ ...emptyUnit, ...unit, parent_unit_id: unit.parent_unit_id ?? '', manager_name: unit.manager_name ?? '', manager_email: unit.manager_email ?? '', description: unit.description ?? '', operator_access_id: primary?.operator_access_id ?? '', unit_role: primary?.unit_role ?? 'director' })
    setOpen(true); setError(''); setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const reset = () => { setForm(emptyUnit); setOpen(false); setError('') }
  const save = async (event) => {
    event.preventDefault(); if (!supabase || !canAdmin || saving) return
    setSaving(true); setError(''); setMessage('')
    const payload = { organization_id: organizationId, code: form.code.trim().toUpperCase(), name: form.name.trim(), unit_type: form.unit_type, parent_unit_id: form.parent_unit_id || null, description: form.description.trim() || null, manager_name: form.manager_name.trim() || null, manager_email: form.manager_email.trim().toLowerCase() || null, sort_order: Number(form.sort_order || 0), active: form.active }
    const request = form.id ? supabase.from('organization_unit').update(payload).eq('id', form.id).select('id').single() : supabase.from('organization_unit').insert(payload).select('id').single()
    const { data, error: requestError } = await request
    if (requestError) setError(requestError.message)
    else {
      const unitId = data.id
      if (form.operator_access_id) {
        const { error: memberError } = await supabase.from('organization_unit_member').upsert({ organization_id: organizationId, unit_id: unitId, operator_access_id: form.operator_access_id, unit_role: form.unit_role, is_primary: true, active: true }, { onConflict: 'unit_id,operator_access_id' })
        if (memberError) setError(memberError.message)
      }
      setMessage(form.id ? 'Unidad actualizada.' : 'Unidad creada en el organigrama.')
      setForm(emptyUnit); setOpen(false); await reload()
    }
    setSaving(false)
  }

  return <div className="management-panel">
    <div className="management-panel-heading"><div><p>ESTRUCTURA ORGANIZACIONAL</p><h1>Organigrama y responsables</h1><span>Construye direcciones, departamentos, ministerios, comités o áreas según la realidad de cada organización.</span></div>{canAdmin && <button onClick={() => { setForm(emptyUnit); setOpen(true) }}>＋ Nueva unidad</button>}</div>
    <Flash error={error} message={message} />
    {open && <form className="management-form-card" onSubmit={save}>
      <div className="management-form-title"><div><small>{form.id ? 'EDITAR UNIDAD' : 'NUEVA UNIDAD'}</small><h2>{form.id ? form.name : 'Agregar al organigrama'}</h2></div><button type="button" onClick={reset}>Cerrar</button></div>
      <div className="management-form-grid">
        <label><span>Código *</span><input value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))} placeholder="DIPROM" required /></label>
        <label className="wide"><span>Nombre *</span><input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required /></label>
        <label><span>Tipo de unidad</span><select value={form.unit_type} onChange={(e) => setForm((c) => ({ ...c, unit_type: e.target.value }))}>{Object.entries(unitTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Depende de</span><select value={form.parent_unit_id} onChange={(e) => setForm((c) => ({ ...c, parent_unit_id: e.target.value }))}><option value="">Nivel principal</option>{units.filter((unit) => unit.id !== form.id).map((unit) => <option value={unit.id} key={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
        <label><span>Responsable visible</span><input value={form.manager_name} onChange={(e) => setForm((c) => ({ ...c, manager_name: e.target.value }))} placeholder="Nombre del responsable" /></label>
        <label><span>Correo del responsable</span><input type="email" value={form.manager_email} onChange={(e) => setForm((c) => ({ ...c, manager_email: e.target.value }))} /></label>
        <label><span>Usuario asociado</span><select value={form.operator_access_id} onChange={(e) => setForm((c) => ({ ...c, operator_access_id: e.target.value }))}><option value="">Sin asignar</option>{operators.filter((operator) => operator.active && (!operator.organization_id || operator.organization_id === organizationId)).map((operator) => <option key={operator.id} value={operator.id}>{operator.display_name} · {operator.email}</option>)}</select></label>
        <label><span>Rol en la unidad</span><select value={form.unit_role} onChange={(e) => setForm((c) => ({ ...c, unit_role: e.target.value }))}><option value="director">Director / responsable</option><option value="manager">Coordinador</option><option value="operator">Operador</option><option value="reviewer">Revisor</option><option value="member">Miembro</option></select></label>
        <label><span>Orden</span><input type="number" value={form.sort_order} onChange={(e) => setForm((c) => ({ ...c, sort_order: e.target.value }))} /></label>
        <label className="management-check"><input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} /><span>Unidad activa</span></label>
        <label className="wide"><span>Descripción</span><textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} /></label>
      </div>
      <div className="management-form-actions"><button type="button" onClick={reset}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar unidad'}</button></div>
    </form>}
    <section className="management-tree-card"><div className="management-card-heading"><div><small>ORGANIGRAMA</small><h2>{units.length} unidades registradas</h2></div></div>{!units.length ? <p className="management-empty">Todavía no existe una estructura organizacional.</p> : <div className="management-unit-list">{sorted.map((unit) => {
      const members = memberByUnit.get(unit.id) ?? []; return <article className={!unit.active ? 'inactive' : ''} key={unit.id} style={{ '--unit-depth': depthFor(unit) }}><div className="unit-line"><span>{unit.code}</span><div><strong>{unit.name}</strong><small>{unitTypeLabels[unit.unit_type] || unit.unit_type}{unit.parent_unit_id ? ` · depende de ${units.find((parent) => parent.id === unit.parent_unit_id)?.code || 'otra unidad'}` : ''}</small></div></div><div className="unit-people"><strong>{unit.manager_name || (members[0] ? operatorName(members[0].operator_access_id) : 'Responsable pendiente')}</strong><span>{members.length} usuario{members.length === 1 ? '' : 's'} vinculado{members.length === 1 ? '' : 's'}</span></div>{canAdmin && <button type="button" onClick={() => edit(unit)}>Editar</button>}</article>})}</div>}</section>
  </div>
}

function ObjectivesPanel({ organizationId, periods, units, objectives, assignments, canAdmin, activePeriodId, setActivePeriodId, reload }) {
  const [periodForm, setPeriodForm] = useState(emptyPeriod)
  const [objectiveForm, setObjectiveForm] = useState(emptyObjective)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const activeObjectives = objectives.filter((item) => item.management_period_id === activePeriodId)
  const assignmentFor = (id, type) => assignments.filter((item) => item.objective_id === id && item.assignment_type === type)

  const savePeriod = async (event) => {
    event.preventDefault(); if (!canAdmin || saving) return
    setSaving(true); setError(''); setMessage('')
    const payload = { organization_id: organizationId, name: periodForm.name.trim(), start_date: periodForm.start_date, end_date: periodForm.end_date, status: periodForm.status, reporting_due_date: periodForm.reporting_due_date || null, notes: periodForm.notes.trim() || null }
    const request = periodForm.id ? supabase.from('management_period').update(payload).eq('id', periodForm.id).select('id').single() : supabase.from('management_period').insert(payload).select('id').single()
    const { data, error: requestError } = await request
    if (requestError) setError(requestError.message); else { setMessage('Período guardado.'); setPeriodOpen(false); setPeriodForm(emptyPeriod()); await reload(); if (data?.id) setActivePeriodId(data.id) }
    setSaving(false)
  }
  const editPeriod = (period) => { setPeriodForm({ ...period, reporting_due_date: period.reporting_due_date ?? '', notes: period.notes ?? '' }); setPeriodOpen(true); setError('') }
  const editObjective = (objective) => {
    setObjectiveForm({ ...emptyObjective, ...objective, parent_objective_id: objective.parent_objective_id ?? '', weight: objective.weight ?? '', responsible_unit_id: assignmentFor(objective.id, 'responsible')[0]?.unit_id ?? '', supporting_unit_ids: assignmentFor(objective.id, 'supporting').map((item) => item.unit_id) })
    setObjectiveOpen(true); setError('')
  }
  const saveObjective = async (event) => {
    event.preventDefault(); if (!canAdmin || saving || !activePeriodId) return
    setSaving(true); setError(''); setMessage('')
    const payload = { organization_id: organizationId, management_period_id: activePeriodId, parent_objective_id: objectiveForm.parent_objective_id || null, code: objectiveForm.code.trim().toUpperCase(), title: objectiveForm.title.trim(), description: objectiveForm.description.trim() || null, objective_level: objectiveForm.objective_level, weight: objectiveForm.weight === '' ? null : Number(objectiveForm.weight), status: objectiveForm.status }
    const request = objectiveForm.id ? supabase.from('institutional_objective').update(payload).eq('id', objectiveForm.id).select('id').single() : supabase.from('institutional_objective').insert(payload).select('id').single()
    const { data, error: requestError } = await request
    if (requestError) setError(requestError.message)
    else {
      const objectiveId = data.id
      await supabase.from('objective_unit_assignment').delete().eq('objective_id', objectiveId)
      const rows = []
      if (objectiveForm.responsible_unit_id) rows.push({ organization_id: organizationId, objective_id: objectiveId, unit_id: objectiveForm.responsible_unit_id, assignment_type: 'responsible' })
      objectiveForm.supporting_unit_ids.filter((id) => id !== objectiveForm.responsible_unit_id).forEach((unitId) => rows.push({ organization_id: organizationId, objective_id: objectiveId, unit_id: unitId, assignment_type: 'supporting' }))
      if (rows.length) { const { error: relationError } = await supabase.from('objective_unit_assignment').insert(rows); if (relationError) setError(relationError.message) }
      setMessage(objectiveForm.id ? 'Objetivo actualizado.' : 'Objetivo creado.'); setObjectiveOpen(false); setObjectiveForm(emptyObjective); await reload()
    }
    setSaving(false)
  }
  const toggleSupporting = (id) => setObjectiveForm((current) => ({ ...current, supporting_unit_ids: current.supporting_unit_ids.includes(id) ? current.supporting_unit_ids.filter((value) => value !== id) : [...current.supporting_unit_ids, id] }))
  const generals = activeObjectives.filter((item) => item.objective_level === 'general')

  return <div className="management-panel">
    <div className="management-panel-heading"><div><p>PLANIFICACIÓN</p><h1>Períodos y objetivos</h1><span>Organiza objetivos generales, específicos y operativos para cada período de gestión.</span></div><div className="management-heading-actions">{canAdmin && <button className="secondary" onClick={() => { setPeriodForm(emptyPeriod()); setPeriodOpen(true) }}>＋ Período</button>}{canAdmin && <button onClick={() => { setObjectiveForm(emptyObjective); setObjectiveOpen(true) }} disabled={!activePeriodId}>＋ Objetivo</button>}</div></div>
    <Flash error={error} message={message} />
    <section className="management-period-strip"><div>{periods.map((period) => <button className={period.id === activePeriodId ? 'active' : ''} key={period.id} onClick={() => setActivePeriodId(period.id)}><strong>{period.name}</strong><span>{periodStatusLabels[period.status]}</span></button>)}</div>{canAdmin && activePeriodId && <button className="period-edit" onClick={() => editPeriod(periods.find((item) => item.id === activePeriodId))}>Editar período</button>}</section>
    {periodOpen && <form className="management-form-card compact" onSubmit={savePeriod}><div className="management-form-title"><div><small>PERÍODO DE GESTIÓN</small><h2>{periodForm.id ? 'Editar período' : 'Nuevo período'}</h2></div><button type="button" onClick={() => setPeriodOpen(false)}>Cerrar</button></div><div className="management-form-grid"><label className="wide"><span>Nombre *</span><input value={periodForm.name} onChange={(e) => setPeriodForm((c) => ({ ...c, name: e.target.value }))} required /></label><label><span>Inicio *</span><input type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm((c) => ({ ...c, start_date: e.target.value }))} required /></label><label><span>Cierre *</span><input type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm((c) => ({ ...c, end_date: e.target.value }))} required /></label><label><span>Estado</span><select value={periodForm.status} onChange={(e) => setPeriodForm((c) => ({ ...c, status: e.target.value }))}>{Object.entries(periodStatusLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Fecha límite de informe</span><input type="date" value={periodForm.reporting_due_date} onChange={(e) => setPeriodForm((c) => ({ ...c, reporting_due_date: e.target.value }))} /></label><label className="wide"><span>Observaciones</span><textarea value={periodForm.notes} onChange={(e) => setPeriodForm((c) => ({ ...c, notes: e.target.value }))} /></label></div><div className="management-form-actions"><button type="button" onClick={() => setPeriodOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Guardar período</button></div></form>}
    {objectiveOpen && <form className="management-form-card" onSubmit={saveObjective}><div className="management-form-title"><div><small>OBJETIVO INSTITUCIONAL</small><h2>{objectiveForm.id ? 'Editar objetivo' : 'Nuevo objetivo'}</h2></div><button type="button" onClick={() => setObjectiveOpen(false)}>Cerrar</button></div><div className="management-form-grid"><label><span>Código *</span><input value={objectiveForm.code} onChange={(e) => setObjectiveForm((c) => ({ ...c, code: e.target.value }))} placeholder="OG-01" required /></label><label><span>Nivel</span><select value={objectiveForm.objective_level} onChange={(e) => setObjectiveForm((c) => ({ ...c, objective_level: e.target.value }))}>{Object.entries(objectiveLevelLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="wide"><span>Título *</span><input value={objectiveForm.title} onChange={(e) => setObjectiveForm((c) => ({ ...c, title: e.target.value }))} required /></label><label><span>Objetivo superior</span><select value={objectiveForm.parent_objective_id} onChange={(e) => setObjectiveForm((c) => ({ ...c, parent_objective_id: e.target.value }))}><option value="">Sin objetivo superior</option>{activeObjectives.filter((item) => item.id !== objectiveForm.id).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label><label><span>Peso (%)</span><input type="number" min="0" max="100" step="0.01" value={objectiveForm.weight} onChange={(e) => setObjectiveForm((c) => ({ ...c, weight: e.target.value }))} /></label><label className="wide"><span>Descripción</span><textarea value={objectiveForm.description} onChange={(e) => setObjectiveForm((c) => ({ ...c, description: e.target.value }))} /></label><label><span>Unidad responsable</span><select value={objectiveForm.responsible_unit_id} onChange={(e) => setObjectiveForm((c) => ({ ...c, responsible_unit_id: e.target.value }))}><option value="">Sin asignar</option>{units.filter((unit) => unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label><div className="management-multiselect"><span>Unidades de apoyo</span><div>{units.filter((unit) => unit.active).map((unit) => <label key={unit.id}><input type="checkbox" checked={objectiveForm.supporting_unit_ids.includes(unit.id)} onChange={() => toggleSupporting(unit.id)} />{unit.code}</label>)}</div></div></div><div className="management-form-actions"><button type="button" onClick={() => setObjectiveOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Guardar objetivo</button></div></form>}
    <section className="management-objectives-card"><div className="management-card-heading"><div><small>MAPA DE OBJETIVOS</small><h2>{activeObjectives.length} objetivos del período</h2></div></div>{!activePeriodId ? <p className="management-empty">Crea un período de gestión para comenzar.</p> : !activeObjectives.length ? <p className="management-empty">Todavía no existen objetivos para este período.</p> : <div className="objective-tree">{generals.map((general) => <article className="objective-group" key={general.id}><div className="objective-main"><span>{general.code}</span><div><small>OBJETIVO GENERAL</small><strong>{general.title}</strong><p>{general.description}</p></div>{canAdmin && <button onClick={() => editObjective(general)}>Editar</button>}</div><div className="objective-children">{activeObjectives.filter((item) => item.parent_objective_id === general.id).map((child) => <div key={child.id}><span>{child.code}</span><div><small>{objectiveLevelLabels[child.objective_level]}</small><strong>{child.title}</strong><em>{assignmentFor(child.id, 'responsible').map((relation) => units.find((unit) => unit.id === relation.unit_id)?.code).filter(Boolean).join(', ') || 'Sin unidad responsable'}</em></div>{canAdmin && <button onClick={() => editObjective(child)}>Editar</button>}</div>)}</div></article>)}{activeObjectives.filter((item) => item.objective_level !== 'general' && !item.parent_objective_id).map((objective) => <article className="objective-orphan" key={objective.id}><span>{objective.code}</span><div><small>{objectiveLevelLabels[objective.objective_level]}</small><strong>{objective.title}</strong></div>{canAdmin && <button onClick={() => editObjective(objective)}>Editar</button>}</article>)}</div>}</section>
  </div>
}

function TrackingPanel({ organizationId, periods, units, objectives, projects, indicators, progress, memberships, access, activePeriodId, setActivePeriodId, reload }) {
  const [unitId, setUnitId] = useState('')
  const [indicatorForm, setIndicatorForm] = useState(emptyIndicator)
  const [progressForm, setProgressForm] = useState(emptyProgress)
  const [indicatorOpen, setIndicatorOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const manageableUnitIds = canAdmin ? units.map((unit) => unit.id) : memberships.filter((item) => item.active && ['director','manager','operator','reviewer'].includes(item.unit_role)).map((item) => item.unit_id)
  const visibleUnits = units.filter((unit) => manageableUnitIds.includes(unit.id) || !manageableUnitIds.length)
  useEffect(() => { if (!unitId && visibleUnits[0]) setUnitId(visibleUnits[0].id) }, [unitId, visibleUnits])
  const currentIndicators = indicators.filter((indicator) => indicator.management_period_id === activePeriodId && (!unitId || indicator.unit_id === unitId))
  const canManageSelected = canAdmin || manageableUnitIds.includes(unitId)

  const saveIndicator = async (event) => {
    event.preventDefault(); if (!canManageSelected || saving || !unitId || !activePeriodId) return
    setSaving(true); setError(''); setMessage('')
    const payload = { organization_id: organizationId, management_period_id: activePeriodId, unit_id: unitId, objective_id: indicatorForm.objective_id || null, project_id: indicatorForm.project_id || null, name: indicatorForm.name.trim(), description: indicatorForm.description.trim() || null, metric_type: indicatorForm.metric_type, unit_label: indicatorForm.unit_label.trim() || null, aggregation_method: indicatorForm.aggregation_method, target_value: indicatorForm.target_value === '' ? null : Number(indicatorForm.target_value), target_text: indicatorForm.target_text.trim() || null, currency: indicatorForm.metric_type === 'currency' ? indicatorForm.currency : null, frequency: indicatorForm.frequency, source_note: indicatorForm.source_note.trim() || null, active: true }
    const request = indicatorForm.id ? supabase.from('management_indicator').update(payload).eq('id', indicatorForm.id) : supabase.from('management_indicator').insert(payload)
    const { error: requestError } = await request
    if (requestError) setError(requestError.message); else { setMessage('Indicador guardado.'); setIndicatorForm(emptyIndicator); setIndicatorOpen(false); await reload() }
    setSaving(false)
  }
  const startProgress = (indicator) => { setProgressForm({ ...emptyProgress, indicator_id: indicator.id, unit_id: indicator.unit_id, reporting_period_end: new Date().toISOString().slice(0,10) }); setProgressOpen(true); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const saveProgress = async (event) => {
    event.preventDefault(); if (saving || !progressForm.indicator_id) return
    setSaving(true); setError(''); setMessage('')
    const indicator = indicators.find((item) => item.id === progressForm.indicator_id)
    const payload = { organization_id: organizationId, indicator_id: progressForm.indicator_id, unit_id: progressForm.unit_id, reporting_period_start: progressForm.reporting_period_start || null, reporting_period_end: progressForm.reporting_period_end || null, numeric_value: progressForm.numeric_value === '' ? null : Number(progressForm.numeric_value), text_value: progressForm.text_value.trim() || null, numerator: progressForm.numerator === '' ? null : Number(progressForm.numerator), denominator: progressForm.denominator === '' ? null : Number(progressForm.denominator), notes: progressForm.notes.trim() || null, status: progressForm.status }
    if (indicator?.aggregation_method === 'calculated' && Number(payload.denominator || 0) > 0) payload.numeric_value = (Number(payload.numerator || 0) / Number(payload.denominator)) * 100
    const { error: requestError } = await supabase.from('indicator_progress').insert(payload)
    if (requestError) setError(requestError.message); else { setMessage('Avance registrado.'); setProgressForm(emptyProgress); setProgressOpen(false); await reload() }
    setSaving(false)
  }

  return <div className="management-panel">
    <div className="management-panel-heading"><div><p>SEGUIMIENTO</p><h1>Indicadores y avances</h1><span>Registra meta vs. ejecución con reglas de consolidación que evitan sumar datos incompatibles.</span></div>{canManageSelected && <button onClick={() => { setIndicatorForm({ ...emptyIndicator, unit_id: unitId }); setIndicatorOpen(true) }} disabled={!activePeriodId || !unitId}>＋ Indicador</button>}</div>
    <Flash error={error} message={message} />
    <section className="management-filter-row"><label><span>Período</span><select value={activePeriodId} onChange={(e) => setActivePeriodId(e.target.value)}>{periods.map((period) => <option value={period.id} key={period.id}>{period.name}</option>)}</select></label><label><span>Unidad</span><select value={unitId} onChange={(e) => setUnitId(e.target.value)}>{visibleUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.code} · {unit.name}</option>)}</select></label></section>
    {indicatorOpen && <form className="management-form-card" onSubmit={saveIndicator}><div className="management-form-title"><div><small>INDICADOR</small><h2>Configurar indicador</h2></div><button type="button" onClick={() => setIndicatorOpen(false)}>Cerrar</button></div><div className="management-form-grid"><label className="wide"><span>Nombre *</span><input value={indicatorForm.name} onChange={(e) => setIndicatorForm((c) => ({ ...c, name: e.target.value }))} required /></label><label><span>Tipo de métrica</span><select value={indicatorForm.metric_type} onChange={(e) => setIndicatorForm((c) => ({ ...c, metric_type: e.target.value }))}>{Object.entries(metricTypeLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Método de consolidación</span><select value={indicatorForm.aggregation_method} onChange={(e) => setIndicatorForm((c) => ({ ...c, aggregation_method: e.target.value }))}>{Object.entries(aggregationLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Unidad / etiqueta</span><input value={indicatorForm.unit_label} onChange={(e) => setIndicatorForm((c) => ({ ...c, unit_label: e.target.value }))} placeholder="personas, iglesias, publicaciones..." /></label><label><span>Meta</span><input type="number" step="0.01" value={indicatorForm.target_value} onChange={(e) => setIndicatorForm((c) => ({ ...c, target_value: e.target.value }))} /></label>{indicatorForm.metric_type === 'currency' && <label><span>Moneda</span><select value={indicatorForm.currency} onChange={(e) => setIndicatorForm((c) => ({ ...c, currency: e.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>}<label><span>Frecuencia</span><select value={indicatorForm.frequency} onChange={(e) => setIndicatorForm((c) => ({ ...c, frequency: e.target.value }))}>{Object.entries(frequencyLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Objetivo relacionado</span><select value={indicatorForm.objective_id} onChange={(e) => setIndicatorForm((c) => ({ ...c, objective_id: e.target.value }))}><option value="">Sin objetivo</option>{objectives.filter((item) => item.management_period_id === activePeriodId).map((objective) => <option key={objective.id} value={objective.id}>{objective.code} · {objective.title}</option>)}</select></label><label><span>Proyecto relacionado</span><select value={indicatorForm.project_id} onChange={(e) => setIndicatorForm((c) => ({ ...c, project_id: e.target.value }))}><option value="">Sin proyecto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label><label className="wide"><span>Descripción</span><textarea value={indicatorForm.description} onChange={(e) => setIndicatorForm((c) => ({ ...c, description: e.target.value }))} /></label><label className="wide"><span>Fuente / criterio</span><textarea value={indicatorForm.source_note} onChange={(e) => setIndicatorForm((c) => ({ ...c, source_note: e.target.value }))} /></label></div><div className="management-form-actions"><button type="button" onClick={() => setIndicatorOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Guardar indicador</button></div></form>}
    {progressOpen && <form className="management-form-card compact" onSubmit={saveProgress}><div className="management-form-title"><div><small>AVANCE</small><h2>{indicators.find((item) => item.id === progressForm.indicator_id)?.name}</h2></div><button type="button" onClick={() => setProgressOpen(false)}>Cerrar</button></div><div className="management-form-grid"><label><span>Desde</span><input type="date" value={progressForm.reporting_period_start} onChange={(e) => setProgressForm((c) => ({ ...c, reporting_period_start: e.target.value }))} /></label><label><span>Hasta</span><input type="date" value={progressForm.reporting_period_end} onChange={(e) => setProgressForm((c) => ({ ...c, reporting_period_end: e.target.value }))} /></label>{indicators.find((item) => item.id === progressForm.indicator_id)?.aggregation_method === 'calculated' ? <><label><span>Numerador</span><input type="number" step="0.01" value={progressForm.numerator} onChange={(e) => setProgressForm((c) => ({ ...c, numerator: e.target.value }))} /></label><label><span>Denominador</span><input type="number" step="0.01" value={progressForm.denominator} onChange={(e) => setProgressForm((c) => ({ ...c, denominator: e.target.value }))} /></label></> : indicators.find((item) => item.id === progressForm.indicator_id)?.metric_type === 'text' ? <label className="wide"><span>Valor reportado</span><textarea value={progressForm.text_value} onChange={(e) => setProgressForm((c) => ({ ...c, text_value: e.target.value }))} /></label> : <label><span>Valor reportado</span><input type="number" step="0.01" value={progressForm.numeric_value} onChange={(e) => setProgressForm((c) => ({ ...c, numeric_value: e.target.value }))} /></label>}<label><span>Estado</span><select value={progressForm.status} onChange={(e) => setProgressForm((c) => ({ ...c, status: e.target.value }))}><option value="draft">Borrador</option><option value="submitted">Enviado</option><option value="verified">Verificado</option></select></label><label className="wide"><span>Observaciones</span><textarea value={progressForm.notes} onChange={(e) => setProgressForm((c) => ({ ...c, notes: e.target.value }))} /></label></div><div className="management-form-actions"><button type="button" onClick={() => setProgressOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Guardar avance</button></div></form>}
    <section className="management-indicators-card"><div className="management-card-heading"><div><small>TABLERO DE SEGUIMIENTO</small><h2>{currentIndicators.length} indicadores</h2></div></div>{!currentIndicators.length ? <p className="management-empty">Todavía no existen indicadores para esta unidad y período.</p> : <div className="indicator-grid">{currentIndicators.map((indicator) => { const result = aggregateIndicator(indicator, progress); return <article key={indicator.id}><header><span>{metricTypeLabels[indicator.metric_type]}</span><b>{aggregationLabels[indicator.aggregation_method]}</b></header><h3>{indicator.name}</h3><div className="indicator-values"><div><span>Meta</span><strong>{indicator.target_value === null ? (indicator.target_text || '—') : metricDisplay(indicator.target_value, indicator)}</strong></div><div><span>Ejecutado</span><strong>{result.text || metricDisplay(result.value, indicator)}</strong></div></div>{Number(indicator.target_value || 0) > 0 && <div className="indicator-progress"><span style={{ width: `${Math.min(result.completion, 100)}%` }} /><b>{result.completion}%</b></div>}<footer><small>{frequencyLabels[indicator.frequency]}</small>{canManageSelected && <button type="button" onClick={() => startProgress(indicator)}>Registrar avance</button>}</footer></article>})}</div>}</section>
  </div>
}

function ReportsPanel({ organizationId, periods, units, reports, indicators, progress, objectives, projects, memberships, access, activePeriodId, setActivePeriodId, reload }) {
  const [unitId, setUnitId] = useState('')
  const [form, setForm] = useState(emptyReport)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showConsolidated, setShowConsolidated] = useState(false)
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const manageableUnitIds = canAdmin ? units.map((unit) => unit.id) : memberships.filter((item) => item.active && ['director','manager','operator','reviewer'].includes(item.unit_role)).map((item) => item.unit_id)
  const visibleUnits = canAdmin ? units : units.filter((unit) => manageableUnitIds.includes(unit.id))
  useEffect(() => { if (!unitId && visibleUnits[0]) setUnitId(visibleUnits[0].id) }, [unitId, visibleUnits])
  useEffect(() => {
    const report = reports.find((item) => item.management_period_id === activePeriodId && item.unit_id === unitId)
    setForm(report ? { ...emptyReport, ...report, reviewer_notes: report.reviewer_notes ?? '', executive_summary: report.executive_summary ?? '', achievements: report.achievements ?? '', challenges: report.challenges ?? '', next_steps: report.next_steps ?? '' } : { ...emptyReport, unit_id: unitId })
  }, [activePeriodId, reports, unitId])
  const canManage = canAdmin || manageableUnitIds.includes(unitId)
  const periodReports = reports.filter((item) => item.management_period_id === activePeriodId)
  const saveReport = async (nextStatus = form.status) => {
    if (!canManage || saving || !activePeriodId || !unitId) return
    setSaving(true); setError(''); setMessage('')
    const payload = { organization_id: organizationId, management_period_id: activePeriodId, unit_id: unitId, status: nextStatus, executive_summary: form.executive_summary.trim() || null, achievements: form.achievements.trim() || null, challenges: form.challenges.trim() || null, next_steps: form.next_steps.trim() || null, reviewer_notes: form.reviewer_notes.trim() || null }
    const request = form.id ? supabase.from('unit_management_report').update(payload).eq('id', form.id) : supabase.from('unit_management_report').insert(payload)
    const { error: requestError } = await request
    if (requestError) setError(requestError.message); else { setMessage(nextStatus === 'submitted' ? 'Informe enviado para revisión.' : nextStatus === 'approved' ? 'Informe aprobado.' : 'Informe guardado.'); await reload() }
    setSaving(false)
  }
  const selectedUnit = units.find((unit) => unit.id === unitId)
  const approvedCount = periodReports.filter((item) => ['approved','closed'].includes(item.status)).length
  const submittedCount = periodReports.filter((item) => ['submitted','reviewed','approved','closed'].includes(item.status)).length
  const periodIndicators = indicators.filter((item) => item.management_period_id === activePeriodId)

  return <div className="management-panel reports-panel">
    <div className="management-panel-heading no-print"><div><p>INFORMES DE GESTIÓN</p><h1>Informes por unidad y consolidado</h1><span>Cada dirección, departamento o ministerio entrega su información; Edifica la reúne en una versión institucional.</span></div><button onClick={() => setShowConsolidated((value) => !value)}>{showConsolidated ? 'Volver a informes' : 'Ver consolidado'}</button></div>
    <Flash error={error} message={message} />
    <section className="management-report-summary no-print"><article><span>Unidades</span><strong>{units.length}</strong></article><article><span>Informes iniciados</span><strong>{periodReports.length}</strong></article><article><span>Enviados</span><strong>{submittedCount}</strong></article><article><span>Aprobados</span><strong>{approvedCount}</strong></article></section>
    {showConsolidated ? <section className="consolidated-report">
      <header><div><small>INFORME INSTITUCIONAL CONSOLIDADO</small><h1>{periods.find((item) => item.id === activePeriodId)?.name || 'Período de gestión'}</h1><p>{access.organizationName}</p></div><button className="no-print" onClick={() => window.print()}>Imprimir / PDF</button></header>
      <div className="consolidated-overview"><article><span>Unidades organizativas</span><strong>{units.length}</strong></article><article><span>Objetivos</span><strong>{objectives.filter((item) => item.management_period_id === activePeriodId).length}</strong></article><article><span>Indicadores</span><strong>{periodIndicators.length}</strong></article><article><span>Proyectos</span><strong>{projects.length}</strong></article></div>
      <section><h2>Objetivos institucionales</h2>{objectives.filter((item) => item.management_period_id === activePeriodId).map((objective) => <div className="consolidated-objective" key={objective.id}><span>{objective.code}</span><div><strong>{objective.title}</strong><p>{objective.description}</p></div></div>)}</section>
      <section><h2>Seguimiento de indicadores</h2><div className="consolidated-indicators">{periodIndicators.map((indicator) => { const result = aggregateIndicator(indicator, progress); return <article key={indicator.id}><small>{units.find((unit) => unit.id === indicator.unit_id)?.code}</small><strong>{indicator.name}</strong><span>Meta: {indicator.target_value === null ? indicator.target_text || '—' : metricDisplay(indicator.target_value, indicator)}</span><b>Ejecutado: {result.text || metricDisplay(result.value, indicator)}</b></article>})}</div></section>
      <section><h2>Gestión por unidad</h2>{units.map((unit) => { const report = periodReports.find((item) => item.unit_id === unit.id); if (!report) return null; return <article className="consolidated-unit" key={unit.id}><header><span>{unit.code}</span><div><h3>{unit.name}</h3><small>{reportStatusLabels[report.status]}</small></div></header>{report.executive_summary && <div><strong>Resumen ejecutivo</strong><p>{report.executive_summary}</p></div>}{report.achievements && <div><strong>Principales logros</strong><p>{report.achievements}</p></div>}{report.challenges && <div><strong>Retos y dificultades</strong><p>{report.challenges}</p></div>}{report.next_steps && <div><strong>Próximos pasos</strong><p>{report.next_steps}</p></div>}</article> })}</section>
    </section> : <>
      <section className="management-filter-row no-print"><label><span>Período</span><select value={activePeriodId} onChange={(e) => setActivePeriodId(e.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label><label><span>Unidad</span><select value={unitId} onChange={(e) => setUnitId(e.target.value)}>{visibleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label></section>
      {selectedUnit && <section className="management-form-card report-editor no-print"><div className="management-form-title"><div><small>INFORME DE LA UNIDAD</small><h2>{selectedUnit.code} · {selectedUnit.name}</h2><span className={`report-state ${form.status}`}>{reportStatusLabels[form.status]}</span></div></div><div className="report-editor-grid"><label><span>Resumen ejecutivo</span><textarea value={form.executive_summary} onChange={(e) => setForm((c) => ({ ...c, executive_summary: e.target.value }))} placeholder="Síntesis de la gestión realizada en el período." /></label><label><span>Principales logros</span><textarea value={form.achievements} onChange={(e) => setForm((c) => ({ ...c, achievements: e.target.value }))} /></label><label><span>Retos y dificultades</span><textarea value={form.challenges} onChange={(e) => setForm((c) => ({ ...c, challenges: e.target.value }))} /></label><label><span>Próximos pasos</span><textarea value={form.next_steps} onChange={(e) => setForm((c) => ({ ...c, next_steps: e.target.value }))} /></label>{canAdmin && <label className="wide"><span>Observaciones del revisor</span><textarea value={form.reviewer_notes} onChange={(e) => setForm((c) => ({ ...c, reviewer_notes: e.target.value }))} /></label>}</div><div className="report-actions"><button onClick={() => saveReport('draft')} disabled={saving}>Guardar borrador</button><button className="primary" onClick={() => saveReport('submitted')} disabled={saving}>Enviar informe</button>{canAdmin && form.id && <button onClick={() => saveReport('reviewed')} disabled={saving}>Marcar revisado</button>}{canAdmin && form.id && <button className="approve" onClick={() => saveReport('approved')} disabled={saving}>Aprobar</button>}</div></section>}
      <section className="management-report-status"><div className="management-card-heading"><div><small>ESTADO DE ENTREGA</small><h2>Informes por unidad</h2></div></div><div>{units.map((unit) => { const report = periodReports.find((item) => item.unit_id === unit.id); return <article key={unit.id}><span>{unit.code}</span><div><strong>{unit.name}</strong><small>{report ? `Actualizado ${formatDate(report.updated_at?.slice(0,10))}` : 'Sin informe iniciado'}</small></div><b className={`report-state ${report?.status || 'none'}`}>{report ? reportStatusLabels[report.status] : 'Pendiente'}</b></article> })}</div></section>
    </>}
  </div>
}

function ManagementDashboard({ periods, activePeriodId, units, objectives, indicators, progress, reports, projects, go }) {
  const period = periods.find((item) => item.id === activePeriodId)
  const periodObjectives = objectives.filter((item) => item.management_period_id === activePeriodId)
  const periodIndicators = indicators.filter((item) => item.management_period_id === activePeriodId)
  const periodReports = reports.filter((item) => item.management_period_id === activePeriodId)
  const averageCompletion = useMemo(() => {
    const measurable = periodIndicators.filter((indicator) => Number(indicator.target_value || 0) > 0)
    if (!measurable.length) return 0
    return Math.round(measurable.reduce((sum, indicator) => sum + Math.min(aggregateIndicator(indicator, progress).completion, 100), 0) / measurable.length)
  }, [periodIndicators, progress])
  return <div className="management-panel"><div className="management-panel-heading"><div><p>GESTIÓN ORGANIZACIONAL</p><h1>Vista ejecutiva</h1><span>Planificación, estructura, proyectos e informes dentro de un mismo período de gestión.</span></div><div className="management-period-chip"><span>PERÍODO</span><strong>{period?.name || 'Sin período'}</strong><small>{period ? `${formatDate(period.start_date)} — ${formatDate(period.end_date)}` : 'Crea un período para comenzar'}</small></div></div>
    <section className="management-executive-metrics"><article><span>Unidades</span><strong>{units.length}</strong><small>Direcciones, ministerios y áreas</small></article><article><span>Objetivos</span><strong>{periodObjectives.length}</strong><small>Generales y específicos</small></article><article><span>Proyectos</span><strong>{projects.length}</strong><small>Cartera compartida con Donaciones</small></article><article><span>Cumplimiento</span><strong>{averageCompletion}%</strong><small>Promedio de indicadores medibles</small></article><article><span>Informes aprobados</span><strong>{periodReports.filter((item) => ['approved','closed'].includes(item.status)).length}</strong><small>de {units.length} unidades</small></article></section>
    <section className="management-quick-grid"><button onClick={() => go('structure')}><span>01</span><div><small>ESTRUCTURA</small><strong>Organigrama</strong><p>Unidades, responsables y equipos.</p></div></button><button onClick={() => go('objectives')}><span>02</span><div><small>PLANIFICACIÓN</small><strong>Objetivos</strong><p>Objetivos generales, específicos y responsables.</p></div></button><button onClick={() => go('projects')}><span>03</span><div><small>PROYECTOS</small><strong>Cartera institucional</strong><p>Proyectos vinculados a unidades y objetivos.</p></div></button><button onClick={() => go('tracking')}><span>04</span><div><small>SEGUIMIENTO</small><strong>Indicadores</strong><p>Meta versus ejecución y avances periódicos.</p></div></button><button onClick={() => go('reports')}><span>05</span><div><small>CIERRE</small><strong>Informes</strong><p>Informe por unidad y consolidado institucional.</p></div></button></section>
    <section className="management-unit-dashboard"><div className="management-card-heading"><div><small>UNIDADES DE LA ORGANIZACIÓN</small><h2>Estado general</h2></div></div><div className="unit-dashboard-grid">{units.map((unit) => { const unitIndicators = periodIndicators.filter((indicator) => indicator.unit_id === unit.id); const report = periodReports.find((item) => item.unit_id === unit.id); const measurable = unitIndicators.filter((indicator) => Number(indicator.target_value || 0) > 0); const score = measurable.length ? Math.round(measurable.reduce((sum, indicator) => sum + Math.min(aggregateIndicator(indicator, progress).completion, 100), 0) / measurable.length) : 0; return <article key={unit.id}><header><span>{unit.code}</span><b>{report ? reportStatusLabels[report.status] : 'Sin informe'}</b></header><h3>{unit.name}</h3><div><span>{unitIndicators.length} indicadores</span><strong>{score}%</strong></div><div className="unit-score"><span style={{ width: `${score}%` }} /></div></article>})}</div></section>
  </div>
}

export default function OrganizationalManagementApp() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(readLanguage)
  const [organizations, setOrganizations] = useState([])
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [periods, setPeriods] = useState([])
  const [activePeriodId, setActivePeriodId] = useState('')
  const [units, setUnits] = useState([])
  const [memberships, setMemberships] = useState([])
  const [operators, setOperators] = useState([])
  const [objectives, setObjectives] = useState([])
  const [assignments, setAssignments] = useState([])
  const [indicators, setIndicators] = useState([])
  const [progress, setProgress] = useState([])
  const [reports, setReports] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const path = window.location.pathname.replace(/\/$/, '')
  const legacyChurch = path.startsWith('/app/church')
  const sectionFromPath = legacyChurch ? 'home' : (path.split('/')[3] || 'home')
  const section = ['home','structure','objectives','projects','tracking','reports'].includes(sectionFromPath) ? sectionFromPath : 'home'
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'

  const go = (target) => { window.location.assign(target === 'home' ? '/app/management' : `/app/management/${target}`) }
  useEffect(() => { document.documentElement.lang = language; window.localStorage.setItem('edifica-language', language) }, [language])
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
    const requests = await Promise.all([
      supabase.from('organization_unit').select('*').eq('organization_id', organizationId).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id', organizationId),
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('objective_unit_assignment').select('*').eq('organization_id', organizationId),
      supabase.from('management_indicator').select('*').eq('organization_id', organizationId).order('created_at'),
      supabase.from('indicator_progress').select('*').eq('organization_id', organizationId).order('created_at'),
      supabase.from('unit_management_report').select('*').eq('organization_id', organizationId).order('updated_at', { ascending: false }),
      supabase.from('project').select('id, organization_id, code, name, status, project_type, funding_source, objective, approved_budget, currency').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      canAdmin ? supabase.rpc('admin_list_operator_access') : Promise.resolve({ data: [], error: null }),
    ])
    const firstError = requests.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      setUnits(requests[0].data ?? []); setMemberships(requests[1].data ?? []); setPeriods(requests[2].data ?? []); setObjectives(requests[3].data ?? []); setAssignments(requests[4].data ?? []); setIndicators(requests[5].data ?? []); setProgress(requests[6].data ?? []); setReports(requests[7].data ?? []); setProjects(requests[8].data ?? []); setOperators((requests[9].data ?? []).filter((item) => !item.organization_id || item.organization_id === organizationId));
      setActivePeriodId((current) => current && (requests[2].data ?? []).some((item) => item.id === current) ? current : (requests[2].data ?? []).find((item) => item.status === 'active')?.id || requests[2].data?.[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, canAdmin, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language={language} onLanguageChange={() => setLanguage((current) => current === 'es' ? 'en' : 'es')} />

  const nav = [
    ['home','Resumen'], ['structure','Estructura'], ['objectives','Objetivos'], ['projects','Proyectos'], ['tracking','Seguimiento'], ['reports','Informes'],
  ]
  let content = <ManagementDashboard periods={periods} activePeriodId={activePeriodId} units={units} objectives={objectives} indicators={indicators} progress={progress} reports={reports} projects={projects} go={go} />
  if (section === 'structure') content = <StructurePanel organizationId={organizationId} units={units} memberships={memberships} operators={operators} canAdmin={canAdmin} reload={reload} />
  if (section === 'objectives') content = <ObjectivesPanel organizationId={organizationId} periods={periods} units={units} objectives={objectives} assignments={assignments} canAdmin={canAdmin} activePeriodId={activePeriodId} setActivePeriodId={setActivePeriodId} reload={reload} />
  if (section === 'projects') content = <ProjectsPanel access={access} managementMode />
  if (section === 'tracking') content = <TrackingPanel organizationId={organizationId} periods={periods} units={units} objectives={objectives} projects={projects} indicators={indicators} progress={progress} memberships={memberships} access={access} activePeriodId={activePeriodId} setActivePeriodId={setActivePeriodId} reload={reload} />
  if (section === 'reports') content = <ReportsPanel organizationId={organizationId} periods={periods} units={units} reports={reports} indicators={indicators} progress={progress} objectives={objectives} projects={projects} memberships={memberships} access={access} activePeriodId={activePeriodId} setActivePeriodId={setActivePeriodId} reload={reload} />

  return <div className="management-shell">
    <aside className="management-sidebar no-print"><div className="management-sidebar-top"><Brand /><small>GESTIÓN ORGANIZACIONAL</small></div><a className="management-back" href="/app">← Todos los módulos</a>{isSuperAdmin && <label className="management-org-selector"><span>Organización</span><select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>{organizations.map((org) => <option value={org.id} key={org.id}>{org.name}</option>)}</select></label>}<nav>{nav.map(([key,label], index) => <button className={section === key ? 'active' : ''} type="button" onClick={() => go(key)} key={key}><span>0{index + 1}</span>{label}</button>)}</nav><div className="management-sidebar-footer"><div><strong>{access.organizationName || organizations.find((item) => item.id === organizationId)?.name || 'Organización'}</strong><span>{access.displayName || access.email}</span></div><button onClick={access.signOut}>Cerrar sesión</button></div></aside>
    <main className="management-main"><div className="management-mobile-header no-print"><Brand /><button onClick={() => window.location.assign('/app')}>Módulos</button></div>{loading ? <div className="management-loading"><span /><p>Cargando gestión organizacional…</p></div> : error ? <div className="management-error-page"><h1>No fue posible cargar el módulo</h1><p>{error}</p><button onClick={reload}>Intentar nuevamente</button></div> : content}</main>
  </div>
}
