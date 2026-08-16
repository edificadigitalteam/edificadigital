import { useCallback, useEffect, useMemo, useState } from 'react'
import DonorPicker from '../donors/DonorPicker.jsx'
import { supabase } from '../../lib/supabase.js'
import { useToast } from '../notifications/ToastProvider.jsx'
import './operations.css'
import './project-portal.css'

const emptyForm = {
  id: '', organization_id: '', code: '', name: '', project_type: 'funded_project', funding_source: 'external',
  funding_partner_actor_id: '', funding_partner: '', status: 'planning', start_date: '', end_date: '', approved_budget: '', currency: 'USD',
  responsible_unit_id: '', participant_unit_ids: [], objective_ids: [], objective: '', expected_results: '', reporting_requirements: '',
  beneficiary_detail_enabled: false, notes: '',
}

const statusLabels = { planning: 'En planificación', submitted: 'Presentado', approved: 'Aprobado', active: 'En ejecución', paused: 'Pausado', completed: 'Completado', cancelled: 'Cancelado' }
const projectTypeLabels = { funded_project: 'Proyecto financiado', institutional_project: 'Proyecto institucional', program: 'Programa', campaign: 'Campaña', initiative: 'Iniciativa', other: 'Otro' }
const fundingSourceLabels = { external: 'Financiamiento externo', own: 'Recursos propios', mixed: 'Financiamiento mixto', none: 'Sin componente financiero' }

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return 'Por definir'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'USD' }).format(Number(amount))
}
function formatDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) }

export default function ProjectsPanel({ access, managementMode = false }) {
  const { notify } = useToast()
  const [projects, setProjects] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [units, setUnits] = useState([])
  const [objectives, setObjectives] = useState([])
  const [periods, setPeriods] = useState([])
  const [unitRelations, setUnitRelations] = useState([])
  const [objectiveRelations, setObjectiveRelations] = useState([])
  const [form, setForm] = useState({ ...emptyForm, organization_id: access.organizationId || '' })
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [organizationFilter, setOrganizationFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = access.role === 'admin' || access.role === 'super_admin'
  const activeCount = useMemo(() => projects.filter((item) => ['approved', 'active'].includes(item.status)).length, [projects])
  const responsibleUnitFor = useCallback((projectId) => {
    const relation = unitRelations.find((item) => item.project_id === projectId && item.relationship === 'responsible')
    return units.find((unit) => unit.id === relation?.unit_id) ?? null
  }, [unitRelations, units])
  const participantUnitsFor = useCallback((projectId) => unitRelations.filter((item) => item.project_id === projectId && item.relationship === 'participant').map((relation) => relation.unit_id), [unitRelations])
  const objectivesFor = useCallback((projectId) => objectiveRelations.filter((item) => item.project_id === projectId).map((relation) => relation.objective_id), [objectiveRelations])

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      const responsible = responsibleUnitFor(project.id)
      const matchesSearch = !query || [project.code, project.name, project.funding_partner, project.organization?.name, responsible?.name, responsible?.code]
        .filter(Boolean).some((value) => value.toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      const matchesOrganization = organizationFilter === 'all' || project.organization_id === organizationFilter
      return matchesSearch && matchesStatus && matchesOrganization
    })
  }, [organizationFilter, projects, responsibleUnitFor, search, statusFilter])

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true); setError('')
    const organizationRequest = canManage ? supabase.rpc('admin_list_organizations') : Promise.resolve({ data: access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : [], error: null })
    const responses = await Promise.all([
      organizationRequest,
      supabase.from('project').select('id, organization_id, code, name, project_type, funding_source, funding_partner_actor_id, funding_partner, status, start_date, end_date, approved_budget, currency, objective, expected_results, reporting_requirements, beneficiary_detail_enabled, notes, created_at, updated_at, organization:organization(name)').order('created_at', { ascending: false }),
      supabase.from('organization_unit').select('id, organization_id, code, name, unit_type, active, sort_order').eq('active', true).order('sort_order').order('name'),
      supabase.from('management_period').select('id, organization_id, name, status, start_date, end_date').order('start_date', { ascending: false }),
      supabase.from('institutional_objective').select('id, organization_id, management_period_id, code, title, objective_level, status').neq('status', 'cancelled').order('code'),
      supabase.from('project_organization_unit').select('id, organization_id, project_id, unit_id, relationship'),
      supabase.from('project_objective').select('id, organization_id, project_id, objective_id, relationship'),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) {
      setProjects([]); setError(firstError.message)
    } else {
      const organizationData = responses[0].data ?? []
      setOrganizations(organizationData); setProjects(responses[1].data ?? []); setUnits(responses[2].data ?? []); setPeriods(responses[3].data ?? []); setObjectives(responses[4].data ?? []); setUnitRelations(responses[5].data ?? []); setObjectiveRelations(responses[6].data ?? [])
      setForm((current) => ({ ...current, organization_id: current.organization_id || access.organizationId || organizationData.find((item) => item.code === 'cnbv')?.id || organizationData[0]?.id || '' }))
    }
    setLoading(false)
  }, [access.organizationId, access.organizationName, canManage])

  useEffect(() => { load() }, [load])

  const reset = () => { setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' }); setError(''); setMessage(''); setFormOpen(false) }
  const startNew = () => { setForm({ ...emptyForm, organization_id: access.organizationId || organizations.find((item) => item.code === 'cnbv')?.id || organizations[0]?.id || '' }); setError(''); setMessage(''); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const edit = (project) => {
    setForm({
      id: project.id, organization_id: project.organization_id, code: project.code, name: project.name,
      project_type: project.project_type || 'funded_project', funding_source: project.funding_source || 'external',
      funding_partner_actor_id: project.funding_partner_actor_id ?? '', funding_partner: project.funding_partner ?? '', status: project.status,
      start_date: project.start_date ?? '', end_date: project.end_date ?? '', approved_budget: project.approved_budget ?? '', currency: project.currency,
      responsible_unit_id: responsibleUnitFor(project.id)?.id ?? '', participant_unit_ids: participantUnitsFor(project.id), objective_ids: objectivesFor(project.id),
      objective: project.objective, expected_results: project.expected_results ?? '', reporting_requirements: project.reporting_requirements ?? '',
      beneficiary_detail_enabled: Boolean(project.beneficiary_detail_enabled), notes: project.notes ?? '',
    })
    setFormOpen(true); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleParticipant = (unitId) => setForm((current) => ({ ...current, participant_unit_ids: current.participant_unit_ids.includes(unitId) ? current.participant_unit_ids.filter((id) => id !== unitId) : [...current.participant_unit_ids, unitId] }))
  const toggleObjective = (objectiveId) => setForm((current) => ({ ...current, objective_ids: current.objective_ids.includes(objectiveId) ? current.objective_ids.filter((id) => id !== objectiveId) : [...current.objective_ids, objectiveId] }))

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canManage) return
    if (!form.organization_id) { setError('Crea o selecciona una organización antes de registrar el proyecto.'); return }
    const donorRequired = ['external', 'mixed'].includes(form.funding_source)
    if (donorRequired && (!form.funding_partner_actor_id || !form.funding_partner.trim())) { setError('Selecciona o crea el aliado o donante que financia este proyecto.'); return }
    setSaving(true); setError(''); setMessage('')
    const payload = {
      organization_id: form.organization_id, code: form.code.trim(), name: form.name.trim(), project_type: form.project_type, funding_source: form.funding_source,
      funding_partner_actor_id: donorRequired ? form.funding_partner_actor_id : null, funding_partner: donorRequired ? form.funding_partner.trim() : null,
      status: form.status, start_date: form.start_date || null, end_date: form.end_date || null,
      approved_budget: form.approved_budget === '' ? null : Number(form.approved_budget), currency: form.currency,
      objective: form.objective.trim(), expected_results: form.expected_results.trim() || null, reporting_requirements: form.reporting_requirements.trim() || null,
      beneficiary_detail_enabled: Boolean(form.beneficiary_detail_enabled), notes: form.notes.trim() || null,
      created_by: access.userId, updated_by: access.userId,
    }
    const request = form.id ? supabase.from('project').update(payload).eq('id', form.id).select('id').single() : supabase.from('project').insert(payload).select('id').single()
    const { data: savedProject, error: requestError } = await request
    if (requestError) {
      const friendlyMessage = requestError.code === '42501' ? 'No tienes acceso para esta acción. Confirma tu correo o contacta al administrador.' : requestError.message
      setError(friendlyMessage); notify({ type: 'error', message: friendlyMessage }); setSaving(false); return
    }
    const projectId = savedProject.id
    const { error: clearUnitError } = await supabase.from('project_organization_unit').delete().eq('project_id', projectId)
    if (clearUnitError) { setError(clearUnitError.message); setSaving(false); return }
    const unitRows = []
    if (form.responsible_unit_id) unitRows.push({ organization_id: form.organization_id, project_id: projectId, unit_id: form.responsible_unit_id, relationship: 'responsible' })
    form.participant_unit_ids.filter((id) => id !== form.responsible_unit_id).forEach((unitId) => unitRows.push({ organization_id: form.organization_id, project_id: projectId, unit_id: unitId, relationship: 'participant' }))
    if (unitRows.length) { const { error: unitError } = await supabase.from('project_organization_unit').insert(unitRows); if (unitError) { setError(unitError.message); setSaving(false); return } }
    const { error: clearObjectiveError } = await supabase.from('project_objective').delete().eq('project_id', projectId)
    if (clearObjectiveError) { setError(clearObjectiveError.message); setSaving(false); return }
    if (form.objective_ids.length) {
      const objectiveRows = form.objective_ids.map((objectiveId, index) => ({ organization_id: form.organization_id, project_id: projectId, objective_id: objectiveId, relationship: index === 0 ? 'primary' : 'supporting' }))
      const { error: objectiveError } = await supabase.from('project_objective').insert(objectiveRows); if (objectiveError) { setError(objectiveError.message); setSaving(false); return }
    }
    const successMessage = form.id ? 'Proyecto actualizado correctamente.' : 'Proyecto registrado correctamente.'
    setMessage(successMessage); setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' }); setFormOpen(false); await load(); notify({ type: 'success', message: successMessage }); setSaving(false)
  }

  const availableUnits = units.filter((unit) => unit.organization_id === form.organization_id)
  const availableObjectives = objectives.filter((objective) => objective.organization_id === form.organization_id)
  const periodName = (id) => periods.find((period) => period.id === id)?.name || ''
  const donorRequired = ['external', 'mixed'].includes(form.funding_source)

  return (
    <div className="operations-page project-portal-page">
      <header className="edifica-dashboard-header project-portal-header">
        <div><p className="edifica-kicker">{managementMode ? 'CARTERA INSTITUCIONAL' : 'CUMPLIMIENTO Y TRAZABILIDAD'}</p><h1>{managementMode ? 'Proyectos de la organización' : 'Proyectos'}</h1><p className="operations-intro">Un mismo proyecto reúne su unidad responsable, objetivos, presupuesto, aportes y recursos, ejecución, beneficiarios, evidencias y rendición final.</p></div>
        <div className="project-header-actions"><div className="operations-summary"><strong>{activeCount}</strong><span>proyectos activos</span></div></div>
      </header>

      {!access.organizationId && access.role !== 'super_admin' && <p className="operations-empty-note">Tu usuario necesita una organización asignada. Un superadministrador puede asociarla desde Personas habilitadas.</p>}

      {formOpen && canManage && (
        <section className="project-form-portal">
          <div className="module-form-breadcrumb"><button type="button" onClick={reset}>Proyectos</button><span>/</span><strong>{form.id ? 'Editar' : 'Crear'}</strong></div>
          <form onSubmit={save} key={form.id || 'new-project'}>
            <section className="project-form-section">
              <header><div><span>01</span><h2>Identificación del proyecto</h2></div><p>Define el tipo de iniciativa, la organización responsable y su contexto financiero.</p></header>
              <div className="project-form-grid">
                <label><span>Organización usuaria</span><select value={form.organization_id} onChange={(event) => setForm((current) => ({ ...current, organization_id: event.target.value, funding_partner_actor_id: '', funding_partner: '', responsible_unit_id: '', participant_unit_ids: [], objective_ids: [] }))} disabled={access.role !== 'super_admin'} required><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
                <label><span>Código del proyecto</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="PROY-2026-01" required /></label>
                <label className="wide"><span>Nombre del proyecto</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                <label><span>Tipo</span><select value={form.project_type} onChange={(event) => setForm((current) => ({ ...current, project_type: event.target.value }))}>{Object.entries(projectTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Fuente de financiamiento</span><select value={form.funding_source} onChange={(event) => setForm((current) => ({ ...current, funding_source: event.target.value, funding_partner_actor_id: ['external','mixed'].includes(event.target.value) ? current.funding_partner_actor_id : '', funding_partner: ['external','mixed'].includes(event.target.value) ? current.funding_partner : '' }))}>{Object.entries(fundingSourceLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {donorRequired && <div className="wide"><DonorPicker organizationId={form.organization_id} value={form.funding_partner_actor_id} required label="Aliado o donante financiador" onChange={(donor) => setForm((current) => ({ ...current, funding_partner_actor_id: donor?.id ?? '', funding_partner: donor?.name ?? '' }))} /></div>}
              </div>
            </section>

            <section className="project-form-section">
              <header><div><span>02</span><h2>Vinculación institucional</h2></div><p>Relaciona el proyecto con el organigrama y los objetivos de gestión.</p></header>
              <div className="project-form-grid">
                <label className="wide"><span>Unidad responsable</span><select value={form.responsible_unit_id} onChange={(event) => setForm((current) => ({ ...current, responsible_unit_id: event.target.value }))}><option value="">Sin unidad asignada</option>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
                <div className="wide project-checkbox-group"><span>Unidades participantes</span><div>{availableUnits.map((unit) => <label key={unit.id}><input type="checkbox" checked={form.participant_unit_ids.includes(unit.id)} onChange={() => toggleParticipant(unit.id)} />{unit.code} · {unit.name}</label>)}</div></div>
                <div className="wide project-checkbox-group objectives"><span>Objetivos institucionales relacionados</span><div>{availableObjectives.map((objective) => <label key={objective.id}><input type="checkbox" checked={form.objective_ids.includes(objective.id)} onChange={() => toggleObjective(objective.id)} /><b>{objective.code}</b> {objective.title}<small>{periodName(objective.management_period_id)}</small></label>)}</div></div>
              </div>
            </section>

            <section className="project-form-section">
              <header><div><span>03</span><h2>Financiamiento y vigencia</h2></div><p>Presupuesto, moneda, fechas y situación operativa.</p></header>
              <div className="project-form-grid three-columns">
                <label><span>Estado</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Moneda</span><select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
                <label><span>Presupuesto aprobado u otorgado</span><input type="number" min="0" step="0.01" value={form.approved_budget} onChange={(event) => setForm((current) => ({ ...current, approved_budget: event.target.value }))} /></label>
                <label><span>Fecha de inicio</span><input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></label>
                <label><span>Fecha de cierre</span><input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></label>
              </div>
            </section>

            <section className="project-form-section">
              <header><div><span>04</span><h2>Compromisos y beneficiarios</h2></div><p>Define objetivos operativos, resultados esperados y nivel de detalle de beneficiarios.</p></header>
              <div className="project-form-grid">
                <label className="wide"><span>Objetivo del proyecto</span><textarea value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} required /></label>
                <label className="wide"><span>Resultados esperados</span><textarea value={form.expected_results} onChange={(event) => setForm((current) => ({ ...current, expected_results: event.target.value }))} placeholder="Metas cuantitativas, productos y personas previstas" /></label>
                <label className="wide"><span>Exigencias de reporte</span><textarea value={form.reporting_requirements} onChange={(event) => setForm((current) => ({ ...current, reporting_requirements: event.target.value }))} placeholder="Frecuencia, formatos, indicadores, facturas y evidencias requeridas" /></label>
                <div className={`beneficiary-project-choice wide ${form.beneficiary_detail_enabled ? 'enabled' : ''}`}><div><strong>Registro individual de personas beneficiadas</strong><span>Actívalo cuando el convenio solicite nombres, contacto o detalle por persona. En el expediente del proyecto también podrás cargar listas escaneadas en PDF o Excel.</span></div><label><input type="checkbox" checked={form.beneficiary_detail_enabled} onChange={(event) => setForm((current) => ({ ...current, beneficiary_detail_enabled: event.target.checked }))} /><span>{form.beneficiary_detail_enabled ? 'Activado' : 'Activar'}</span></label></div>
                <label className="wide"><span>Observaciones</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
              </div>
            </section>

            {error && <p className="operations-feedback error">{error}</p>}
            <div className="project-form-actions"><button type="button" onClick={reset}>Cancelar</button><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar proyecto'}</button></div>
          </form>
        </section>
      )}

      {message && <p className="operations-feedback success">{message}</p>}
      {!formOpen && error && <p className="operations-feedback error">{error}</p>}

      {!formOpen && <>
        <section className="module-search-bar operations-card"><label><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, proyecto, organización o unidad" /></label><label><span>Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>{access.role === 'super_admin' && <label><span>Organización</span><select value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value)}><option value="all">Todas las organizaciones</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}<button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setOrganizationFilter('all') }}>Limpiar</button></section>
        <section className="project-list-card operations-card"><div className="module-list-heading"><div><p className="edifica-kicker">CARTERA DE PROYECTOS</p><h2>Proyectos registrados</h2></div>{canManage && <button type="button" onClick={startNew}>＋ Nuevo proyecto</button>}</div>{loading ? <p className="edifica-empty">Cargando proyectos…</p> : filteredProjects.length === 0 ? <p className="edifica-empty">No existen proyectos que coincidan con los filtros.</p> : <div className="edifica-table-wrap"><table className="project-portal-table"><thead><tr><th>Proyecto</th><th>Unidad / organización</th><th>Financiamiento</th><th>Vigencia</th><th>Presupuesto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredProjects.map((project) => { const responsible = responsibleUnitFor(project.id); return <tr key={project.id}><td><strong>{project.name}</strong><span>{project.code} · {projectTypeLabels[project.project_type] || project.project_type}</span></td><td><strong>{responsible ? `${responsible.code} · ${responsible.name}` : 'Sin unidad responsable'}</strong><span>{project.organization?.name ?? 'Organización'}</span></td><td><strong>{fundingSourceLabels[project.funding_source] || project.funding_source}</strong><span>{project.funding_partner || 'Sin aliado financiador'}</span></td><td><span>{formatDate(project.start_date)}</span><small>hasta {formatDate(project.end_date)}</small></td><td className="project-budget">{formatMoney(project.approved_budget, project.currency)}</td><td><span className={`project-status ${project.status}`}>{statusLabels[project.status] ?? project.status}</span></td><td><div className="project-row-actions"><a href={`/app/management/projects/workspace?project=${project.id}`}>Abrir expediente</a><a href={`/app/management/projects/workspace?project=${project.id}&section=beneficiary`}>Beneficiarios</a>{canManage && <button type="button" onClick={() => edit(project)}>Editar</button>}</div></td></tr> })}</tbody></table></div>}</section>
      </>}
    </div>
  )
}
