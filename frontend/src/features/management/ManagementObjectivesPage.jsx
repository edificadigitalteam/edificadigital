import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management.css'
import './management-objectives.css'

const objectiveLevelLabels = { general: 'General', specific: 'Específico', operational: 'Operativo' }
const objectiveLevelPrefixes = { general: 'OG', specific: 'OE', operational: 'OP' }
const periodStatusLabels = { planning: 'Planificación', active: 'Activo', reporting: 'En informes', closed: 'Cerrado' }

const emptyPeriod = () => ({ id: '', name: `Gestión ${new Date().getFullYear()}`, start_date: `${new Date().getFullYear()}-01-01`, end_date: `${new Date().getFullYear()}-12-31`, status: 'planning', reporting_due_date: '', notes: '' })
const emptyObjective = { id: '', code: '', title: '', description: '', objective_level: 'general', parent_objective_id: '', weight: '', status: 'active', responsible_unit_id: '', supporting_unit_ids: [] }

function normalizeUnitCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 16)
}

function buildNextObjectiveCode({ unitId, level, units, objectives, periodId, currentId = '' }) {
  const unit = units.find((item) => item.id === unitId)
  const unitCode = normalizeUnitCode(unit?.code)
  const levelCode = objectiveLevelPrefixes[level] || 'OBJ'
  if (!unitCode || !periodId) return ''
  const prefix = `${unitCode}-${levelCode}-`
  const numbers = objectives
    .filter((item) => item.management_period_id === periodId && item.id !== currentId && String(item.code || '').startsWith(prefix))
    .map((item) => Number.parseInt(String(item.code).slice(prefix.length), 10))
    .filter(Number.isFinite)
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  return `${prefix}${String(next).padStart(2, '0')}`
}

export default function ManagementObjectivesPage() {
  const access = useOperatorAccess()
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [organizations, setOrganizations] = useState([])
  const [periods, setPeriods] = useState([])
  const [activePeriodId, setActivePeriodId] = useState('')
  const [units, setUnits] = useState([])
  const [objectives, setObjectives] = useState([])
  const [assignments, setAssignments] = useState([])
  const [periodForm, setPeriodForm] = useState(emptyPeriod)
  const [objectiveForm, setObjectiveForm] = useState(emptyObjective)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'

  useEffect(() => {
    if (access.status === 'authorized') setOrganizationId((current) => current || access.organizationId || '')
  }, [access.organizationId, access.status])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) {
      setOrganizations(access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : [])
      return
    }
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) setError(requestError.message)
    else {
      setOrganizations(data ?? [])
      setOrganizationId((current) => current || data?.find((item) => item.code === 'cnbv')?.id || data?.[0]?.id || '')
    }
  }, [access.organizationId, access.organizationName, access.status, isSuperAdmin])

  const load = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const responses = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('organization_unit').select('id, code, name, active, sort_order').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('objective_unit_assignment').select('*').eq('organization_id', organizationId),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      const nextPeriods = responses[0].data ?? []
      setPeriods(nextPeriods)
      setUnits(responses[1].data ?? [])
      setObjectives(responses[2].data ?? [])
      setAssignments(responses[3].data ?? [])
      setActivePeriodId((current) => current && nextPeriods.some((item) => item.id === current)
        ? current
        : nextPeriods.find((item) => item.status === 'active')?.id || nextPeriods[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { load() }, [load])

  const activeObjectives = useMemo(() => objectives.filter((item) => item.management_period_id === activePeriodId), [activePeriodId, objectives])
  const assignmentFor = useCallback((id, type) => assignments.filter((item) => item.objective_id === id && item.assignment_type === type), [assignments])
  const unitForObjective = useCallback((id) => units.find((unit) => unit.id === assignmentFor(id, 'responsible')[0]?.unit_id), [assignmentFor, units])

  const newObjective = () => {
    setObjectiveForm(emptyObjective)
    setObjectiveOpen(true)
    setError(''); setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const editObjective = (objective) => {
    setObjectiveForm({
      ...emptyObjective,
      ...objective,
      parent_objective_id: objective.parent_objective_id ?? '',
      weight: objective.weight ?? '',
      responsible_unit_id: assignmentFor(objective.id, 'responsible')[0]?.unit_id ?? '',
      supporting_unit_ids: assignmentFor(objective.id, 'supporting').map((item) => item.unit_id),
    })
    setObjectiveOpen(true); setError(''); setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const changeLeader = (unitId) => {
    setObjectiveForm((current) => ({
      ...current,
      responsible_unit_id: unitId,
      supporting_unit_ids: current.supporting_unit_ids.filter((id) => id !== unitId),
      code: current.id ? current.code : buildNextObjectiveCode({ unitId, level: current.objective_level, units, objectives, periodId: activePeriodId }),
    }))
  }

  const changeLevel = (level) => {
    setObjectiveForm((current) => ({
      ...current,
      objective_level: level,
      parent_objective_id: level === 'general' ? '' : current.parent_objective_id,
      code: current.id ? current.code : buildNextObjectiveCode({ unitId: current.responsible_unit_id, level, units, objectives, periodId: activePeriodId }),
    }))
  }

  const toggleSupporting = (id) => setObjectiveForm((current) => ({
    ...current,
    supporting_unit_ids: current.supporting_unit_ids.includes(id)
      ? current.supporting_unit_ids.filter((value) => value !== id)
      : [...current.supporting_unit_ids, id],
  }))

  const savePeriod = async (event) => {
    event.preventDefault()
    if (!supabase || !canAdmin || saving) return
    setSaving(true); setError(''); setMessage('')
    const payload = {
      organization_id: organizationId,
      name: periodForm.name.trim(),
      start_date: periodForm.start_date,
      end_date: periodForm.end_date,
      status: periodForm.status,
      reporting_due_date: periodForm.reporting_due_date || null,
      notes: periodForm.notes.trim() || null,
    }
    const request = periodForm.id
      ? supabase.from('management_period').update(payload).eq('id', periodForm.id).select('id').single()
      : supabase.from('management_period').insert(payload).select('id').single()
    const { data, error: requestError } = await request
    if (requestError) setError(requestError.message)
    else {
      setMessage('Período guardado.')
      setPeriodOpen(false); setPeriodForm(emptyPeriod())
      await load()
      if (data?.id) setActivePeriodId(data.id)
    }
    setSaving(false)
  }

  const saveObjective = async (event) => {
    event.preventDefault()
    if (!supabase || !canAdmin || saving || !activePeriodId) return
    if (!objectiveForm.responsible_unit_id) { setError('Selecciona primero el área que lidera este objetivo.'); return }
    const code = objectiveForm.id
      ? objectiveForm.code
      : buildNextObjectiveCode({ unitId: objectiveForm.responsible_unit_id, level: objectiveForm.objective_level, units, objectives, periodId: activePeriodId })
    if (!code) { setError('No fue posible generar el código. Verifica el área líder y el período de gestión.'); return }

    setSaving(true); setError(''); setMessage('')
    const payload = {
      organization_id: organizationId,
      management_period_id: activePeriodId,
      parent_objective_id: objectiveForm.objective_level === 'general' ? null : objectiveForm.parent_objective_id || null,
      code,
      title: objectiveForm.title.trim(),
      description: objectiveForm.description.trim() || null,
      objective_level: objectiveForm.objective_level,
      weight: objectiveForm.weight === '' ? null : Number(objectiveForm.weight),
      status: objectiveForm.status,
      updated_by: access.userId,
      ...(objectiveForm.id ? {} : { created_by: access.userId }),
    }
    const request = objectiveForm.id
      ? supabase.from('institutional_objective').update(payload).eq('id', objectiveForm.id).select('id').single()
      : supabase.from('institutional_objective').insert(payload).select('id').single()
    const { data, error: requestError } = await request
    if (requestError) {
      setError(requestError.code === '23505' ? 'El código automático ya existe. Cierra y vuelve a abrir el formulario para generar el siguiente.' : requestError.message)
      setSaving(false)
      return
    }

    const objectiveId = data.id
    const { error: deleteError } = await supabase.from('objective_unit_assignment').delete().eq('objective_id', objectiveId)
    if (deleteError) { setError(deleteError.message); setSaving(false); return }
    const rows = [{ organization_id: organizationId, objective_id: objectiveId, unit_id: objectiveForm.responsible_unit_id, assignment_type: 'responsible' }]
    objectiveForm.supporting_unit_ids.filter((id) => id !== objectiveForm.responsible_unit_id).forEach((unitId) => rows.push({ organization_id: organizationId, objective_id: objectiveId, unit_id: unitId, assignment_type: 'supporting' }))
    const { error: relationError } = await supabase.from('objective_unit_assignment').insert(rows)
    if (relationError) { setError(relationError.message); setSaving(false); return }

    setMessage(objectiveForm.id ? 'Objetivo actualizado.' : `Objetivo creado con código ${code}.`)
    setObjectiveOpen(false); setObjectiveForm(emptyObjective)
    await load(); setSaving(false)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  const generals = activeObjectives.filter((item) => item.objective_level === 'general')
  const orphans = activeObjectives.filter((item) => item.objective_level !== 'general' && !item.parent_objective_id)

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-panel management-objectives-page">
        <div className="management-panel-heading">
          <div><p>PLANIFICACIÓN</p><h1>Períodos y objetivos</h1><span>Define quién lidera cada objetivo, establece su jerarquía y deja que Edifica genere el código institucional.</span></div>
          <div className="management-heading-actions">{canAdmin && <button className="secondary" onClick={() => { setPeriodForm(emptyPeriod()); setPeriodOpen(true) }}>＋ Período</button>}{canAdmin && <button onClick={newObjective} disabled={!activePeriodId || !units.length}>＋ Objetivo</button>}</div>
        </div>

        {isSuperAdmin && <section className="management-filter-row"><label><span>Organización</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((org) => <option value={org.id} key={org.id}>{org.name}</option>)}</select></label></section>}
        {error && <p className="management-flash error">{error}</p>}
        {message && <p className="management-flash success">{message}</p>}

        <section className="management-period-strip"><div>{periods.map((period) => <button className={period.id === activePeriodId ? 'active' : ''} key={period.id} onClick={() => setActivePeriodId(period.id)}><strong>{period.name}</strong><span>{periodStatusLabels[period.status] || period.status}</span></button>)}</div>{canAdmin && activePeriodId && <button className="period-edit" onClick={() => { const period = periods.find((item) => item.id === activePeriodId); setPeriodForm({ ...emptyPeriod(), ...period, reporting_due_date: period?.reporting_due_date ?? '', notes: period?.notes ?? '' }); setPeriodOpen(true) }}>Editar período</button>}</section>

        {periodOpen && <form className="management-form-card compact" onSubmit={savePeriod}><div className="management-form-title"><div><small>PERÍODO DE GESTIÓN</small><h2>{periodForm.id ? 'Editar período' : 'Nuevo período'}</h2></div><button type="button" onClick={() => setPeriodOpen(false)}>Cerrar</button></div><div className="management-form-grid"><label className="wide"><span>Nombre *</span><input value={periodForm.name} onChange={(e) => setPeriodForm((c) => ({ ...c, name: e.target.value }))} required /></label><label><span>Inicio *</span><input type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm((c) => ({ ...c, start_date: e.target.value }))} required /></label><label><span>Cierre *</span><input type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm((c) => ({ ...c, end_date: e.target.value }))} required /></label><label><span>Estado</span><select value={periodForm.status} onChange={(e) => setPeriodForm((c) => ({ ...c, status: e.target.value }))}>{Object.entries(periodStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Fecha límite de informe</span><input type="date" value={periodForm.reporting_due_date} onChange={(e) => setPeriodForm((c) => ({ ...c, reporting_due_date: e.target.value }))} /></label><label className="wide"><span>Observaciones</span><textarea value={periodForm.notes} onChange={(e) => setPeriodForm((c) => ({ ...c, notes: e.target.value }))} /></label></div><div className="management-form-actions"><button type="button" onClick={() => setPeriodOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>Guardar período</button></div></form>}

        {objectiveOpen && <form className="management-form-card objective-guided-form" onSubmit={saveObjective}><div className="management-form-title"><div><small>OBJETIVO INSTITUCIONAL</small><h2>{objectiveForm.id ? 'Editar objetivo' : 'Nuevo objetivo'}</h2><p>Empieza seleccionando el área que responde por el objetivo. Edifica generará el código automáticamente.</p></div><button type="button" onClick={() => setObjectiveOpen(false)}>Cerrar</button></div><div className="management-form-grid">
          <label className="wide objective-leader-field"><span>¿Qué área lidera este objetivo? *</span><select value={objectiveForm.responsible_unit_id} onChange={(e) => changeLeader(e.target.value)} required><option value="">Seleccionar área responsable</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select><small>Esta unidad será la responsable principal del objetivo y aparecerá en informes y seguimiento.</small></label>
          <label><span>Código automático</span><input value={objectiveForm.code} readOnly placeholder="Se genera al elegir el área" /><small>{objectiveForm.id ? 'Se conserva el código histórico del objetivo.' : 'Formato: ÁREA + nivel + consecutivo. Ej.: DIAF-OG-01.'}</small></label>
          <label><span>Nivel del objetivo</span><select value={objectiveForm.objective_level} onChange={(e) => changeLevel(e.target.value)}>{Object.entries(objectiveLevelLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>General: propósito amplio. Específico: resultado concreto. Operativo: acción medible.</small></label>
          <label className="wide"><span>¿Qué queremos lograr? *</span><input value={objectiveForm.title} onChange={(e) => setObjectiveForm((c) => ({ ...c, title: e.target.value }))} required /></label>
          {objectiveForm.objective_level !== 'general' && <label><span>Objetivo superior</span><select value={objectiveForm.parent_objective_id} onChange={(e) => setObjectiveForm((c) => ({ ...c, parent_objective_id: e.target.value }))}><option value="">Sin objetivo superior</option>{activeObjectives.filter((item) => item.id !== objectiveForm.id && (objectiveForm.objective_level === 'specific' ? item.objective_level === 'general' : item.objective_level !== 'operational')).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label>}
          <label><span>Peso dentro del período (%)</span><input type="number" min="0" max="100" step="0.01" value={objectiveForm.weight} onChange={(e) => setObjectiveForm((c) => ({ ...c, weight: e.target.value }))} /><small>Opcional. Úsalo si algunos objetivos tienen mayor importancia en el cumplimiento global.</small></label>
          <label className="wide"><span>Descripción</span><textarea value={objectiveForm.description} onChange={(e) => setObjectiveForm((c) => ({ ...c, description: e.target.value }))} placeholder="Explica alcance, intención y resultado esperado." /></label>
          <div className="management-multiselect wide"><span>Áreas que apoyan este objetivo</span><div>{units.filter((unit) => unit.id !== objectiveForm.responsible_unit_id).map((unit) => <label key={unit.id}><input type="checkbox" checked={objectiveForm.supporting_unit_ids.includes(unit.id)} onChange={() => toggleSupporting(unit.id)} />{unit.code} · {unit.name}</label>)}</div></div>
        </div><div className="management-form-actions"><button type="button" onClick={() => setObjectiveOpen(false)}>Cancelar</button><button className="primary" disabled={saving || !objectiveForm.responsible_unit_id || !objectiveForm.code}>{saving ? 'Guardando…' : 'Guardar objetivo'}</button></div></form>}

        <section className="management-objectives-card"><div className="management-card-heading"><div><small>MAPA DE OBJETIVOS</small><h2>{activeObjectives.length} objetivos del período</h2></div></div>{loading ? <p className="management-empty">Cargando objetivos…</p> : !activePeriodId ? <p className="management-empty">Crea un período de gestión para comenzar.</p> : !activeObjectives.length ? <p className="management-empty">Todavía no existen objetivos para este período.</p> : <div className="objective-tree">{generals.map((general) => <article className="objective-group" key={general.id}><div className="objective-main"><span>{general.code}</span><div><small>OBJETIVO GENERAL · LIDERA {unitForObjective(general.id)?.code || 'POR ASIGNAR'}</small><strong>{general.title}</strong><p>{general.description}</p></div>{canAdmin && <button onClick={() => editObjective(general)}>Editar</button>}</div><div className="objective-children">{activeObjectives.filter((item) => item.parent_objective_id === general.id).map((child) => <div key={child.id}><span>{child.code}</span><div><small>{objectiveLevelLabels[child.objective_level]} · LIDERA {unitForObjective(child.id)?.code || 'POR ASIGNAR'}</small><strong>{child.title}</strong><em>{unitForObjective(child.id)?.name || 'Responsable pendiente'}</em></div>{canAdmin && <button onClick={() => editObjective(child)}>Editar</button>}</div>)}</div></article>)}{orphans.map((objective) => <article className="objective-orphan" key={objective.id}><span>{objective.code}</span><div><small>{objectiveLevelLabels[objective.objective_level]} · LIDERA {unitForObjective(objective.id)?.code || 'POR ASIGNAR'}</small><strong>{objective.title}</strong></div>{canAdmin && <button onClick={() => editObjective(objective)}>Editar</button>}</article>)}</div>}</section>
      </div>
    </ManagementStandaloneShell>
  )
}
