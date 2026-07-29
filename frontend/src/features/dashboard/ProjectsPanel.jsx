import { useCallback, useEffect, useMemo, useState } from 'react'
import DonorPicker from '../donors/DonorPicker.jsx'
import { supabase } from '../../lib/supabase.js'
import { useToast } from '../notifications/ToastProvider.jsx'
import './operations.css'
import './project-portal.css'

const emptyForm = {
  id: '',
  organization_id: '',
  code: '',
  name: '',
  funding_partner_actor_id: '',
  funding_partner: '',
  status: 'planning',
  start_date: '',
  end_date: '',
  approved_budget: '',
  currency: 'USD',
  objective: '',
  expected_results: '',
  reporting_requirements: '',
  beneficiary_detail_enabled: false,
  notes: '',
}

const statusLabels = {
  planning: 'En planificación',
  submitted: 'Presentado',
  approved: 'Aprobado',
  active: 'En ejecución',
  paused: 'Pausado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return 'Por definir'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'USD' }).format(Number(amount))
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export default function ProjectsPanel({ access }) {
  const { notify } = useToast()
  const [projects, setProjects] = useState([])
  const [organizations, setOrganizations] = useState([])
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

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesSearch = !query || [project.code, project.name, project.funding_partner, project.organization?.name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      const matchesOrganization = organizationFilter === 'all' || project.organization_id === organizationFilter
      return matchesSearch && matchesStatus && matchesOrganization
    })
  }, [organizationFilter, projects, search, statusFilter])

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    let organizationData = []
    if (canManage) {
      const { data, error: organizationError } = await supabase.rpc('admin_list_organizations')
      if (organizationError) {
        setError(organizationError.message)
        setLoading(false)
        return
      }
      organizationData = data ?? []
      setOrganizations(organizationData)
    }
    const { data, error: projectError } = await supabase
      .from('project')
      .select('id, organization_id, code, name, funding_partner_actor_id, funding_partner, status, start_date, end_date, approved_budget, currency, objective, expected_results, reporting_requirements, beneficiary_detail_enabled, notes, created_at, updated_at, organization:organization(name)')
      .order('created_at', { ascending: false })
    if (projectError) {
      setProjects([])
      setError(projectError.message)
    } else {
      setProjects(data ?? [])
      setForm((current) => ({ ...current, organization_id: current.organization_id || access.organizationId || organizationData[0]?.id || '' }))
    }
    setLoading(false)
  }, [access.organizationId, canManage])

  useEffect(() => { load() }, [load])

  const reset = () => {
    setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' })
    setError('')
    setMessage('')
    setFormOpen(false)
  }

  const startNew = () => {
    setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' })
    setError('')
    setMessage('')
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const edit = (project) => {
    setForm({
      id: project.id,
      organization_id: project.organization_id,
      code: project.code,
      name: project.name,
      funding_partner_actor_id: project.funding_partner_actor_id ?? '',
      funding_partner: project.funding_partner,
      status: project.status,
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      approved_budget: project.approved_budget ?? '',
      currency: project.currency,
      objective: project.objective,
      expected_results: project.expected_results ?? '',
      reporting_requirements: project.reporting_requirements ?? '',
      beneficiary_detail_enabled: Boolean(project.beneficiary_detail_enabled),
      notes: project.notes ?? '',
    })
    setFormOpen(true)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canManage) return
    if (!form.organization_id) {
      setError('Crea o selecciona una organización antes de registrar el proyecto.')
      return
    }
    if (!form.funding_partner_actor_id || !form.funding_partner.trim()) {
      setError('Selecciona o crea el aliado o donante que financia este proyecto.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    const payload = {
      organization_id: form.organization_id,
      code: form.code.trim(),
      name: form.name.trim(),
      funding_partner_actor_id: form.funding_partner_actor_id,
      funding_partner: form.funding_partner.trim(),
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      approved_budget: form.approved_budget === '' ? null : Number(form.approved_budget),
      currency: form.currency,
      objective: form.objective.trim(),
      expected_results: form.expected_results.trim() || null,
      reporting_requirements: form.reporting_requirements.trim() || null,
      beneficiary_detail_enabled: Boolean(form.beneficiary_detail_enabled),
      notes: form.notes.trim() || null,
      created_by: access.userId,
      updated_by: access.userId,
    }
    const request = form.id ? supabase.from('project').update(payload).eq('id', form.id) : supabase.from('project').insert(payload)
    const { error: requestError } = await request
    if (requestError) {
      const friendlyMessage = requestError.code === '42501'
        ? 'No tienes acceso para esta acción. Confirma tu correo o contacta al administrador.'
        : requestError.message
      setError(friendlyMessage)
      notify({ type: 'error', message: friendlyMessage })
    } else {
      const successMessage = form.id ? 'Proyecto actualizado correctamente.' : 'Proyecto registrado correctamente.'
      setMessage(successMessage)
      setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' })
      setFormOpen(false)
      await load()
      notify({ type: 'success', message: successMessage })
    }
    setSaving(false)
  }

  return (
    <div className="operations-page project-portal-page">
      <header className="edifica-dashboard-header project-portal-header">
        <div><p className="edifica-kicker">CUMPLIMIENTO Y TRAZABILIDAD</p><h1>Proyectos financiados</h1><p className="operations-intro">Administra la cartera de proyectos, sus aliados o donantes, presupuesto, objetivos y exigencias de cumplimiento desde una vista institucional.</p></div>
        <div className="project-header-actions"><div className="operations-summary"><strong>{activeCount}</strong><span>proyectos activos</span></div></div>
      </header>

      {!access.organizationId && access.role !== 'super_admin' && <p className="operations-empty-note">Tu usuario necesita una organización asignada. Un superadministrador puede asociarla desde Personas habilitadas.</p>}

      {formOpen && canManage && (
        <section className="project-form-portal">
          <div className="project-form-breadcrumb"><button type="button" onClick={reset}>Proyectos</button><span>/</span><strong>{form.id ? 'Editar' : 'Crear'}</strong></div>
          <form onSubmit={save} key={form.id || 'new-project'}>
            <section className="project-form-section">
              <header><div><span>01</span><h2>Identificación del proyecto</h2></div><p>Datos de la organización responsable y del aliado o donante que financia.</p></header>
              <div className="project-form-grid">
                <label><span>Organización usuaria</span><select value={form.organization_id} onChange={(event) => setForm((current) => ({ ...current, organization_id: event.target.value, funding_partner_actor_id: '', funding_partner: '' }))} disabled={access.role !== 'super_admin'} required><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
                <label><span>Código del proyecto</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="AGUA-2026-01" required /></label>
                <label className="wide"><span>Nombre del proyecto</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Proyecto de agua y salud" required /></label>
                <div className="wide"><DonorPicker organizationId={form.organization_id} value={form.funding_partner_actor_id} required label="Aliado o donante financiador" onChange={(donor) => setForm((current) => ({ ...current, funding_partner_actor_id: donor?.id ?? '', funding_partner: donor?.name ?? '' }))} /></div>
              </div>
            </section>

            <section className="project-form-section">
              <header><div><span>02</span><h2>Financiamiento y vigencia</h2></div><p>Presupuesto aprobado, moneda, fechas y situación operativa.</p></header>
              <div className="project-form-grid three-columns">
                <label><span>Estado</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Moneda</span><select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
                <label><span>Presupuesto aprobado u otorgado</span><input type="number" min="0" step="0.01" value={form.approved_budget} onChange={(event) => setForm((current) => ({ ...current, approved_budget: event.target.value }))} /></label>
                <label><span>Fecha de inicio</span><input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></label>
                <label><span>Fecha de cierre</span><input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></label>
              </div>
            </section>

            <section className="project-form-section">
              <header><div><span>03</span><h2>Compromisos y beneficiarios</h2></div><p>Define el nivel de detalle requerido para cotejar lo aprobado frente a la ejecución final.</p></header>
              <div className="project-form-grid">
                <label className="wide"><span>Objetivo</span><textarea value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} required /></label>
                <label className="wide"><span>Resultados esperados</span><textarea value={form.expected_results} onChange={(event) => setForm((current) => ({ ...current, expected_results: event.target.value }))} placeholder="Metas cuantitativas, productos y personas previstas" /></label>
                <label className="wide"><span>Exigencias de reporte</span><textarea value={form.reporting_requirements} onChange={(event) => setForm((current) => ({ ...current, reporting_requirements: event.target.value }))} placeholder="Frecuencia, formatos, indicadores, facturas y evidencias requeridas" /></label>
                <div className={`beneficiary-project-choice wide ${form.beneficiary_detail_enabled ? 'enabled' : ''}`}>
                  <div><strong>Registro individual de personas beneficiadas</strong><span>Actívalo cuando el convenio solicite nombres, contacto o detalle por persona.</span></div>
                  <label><input type="checkbox" checked={form.beneficiary_detail_enabled} onChange={(event) => setForm((current) => ({ ...current, beneficiary_detail_enabled: event.target.checked }))} /><span>{form.beneficiary_detail_enabled ? 'Activado' : 'Activar'}</span></label>
                </div>
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

      <section className="module-search-bar operations-card">
        <label><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, proyecto, organización o aliado/donante" /></label>
        <label><span>Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {access.role === 'super_admin' && <label><span>Organización</span><select value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value)}><option value="all">Todas las organizaciones</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}
        <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setOrganizationFilter('all') }}>Limpiar</button>
      </section>

      <section className="project-list-card operations-card">
        <div className="module-list-heading"><div><p className="edifica-kicker">CARTERA DE PROYECTOS</p><h2>Proyectos registrados</h2></div>{canManage && <button type="button" onClick={startNew}>＋ Nuevo proyecto</button>}</div>
        {loading ? <p className="edifica-empty">Cargando proyectos…</p> : filteredProjects.length === 0 ? <p className="edifica-empty">No existen proyectos que coincidan con los filtros.</p> : (
          <div className="edifica-table-wrap"><table className="project-portal-table"><thead><tr><th>Proyecto</th><th>Organización / aliado o donante</th><th>Vigencia</th><th>Presupuesto</th><th>Beneficiarios</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredProjects.map((project) => (
            <tr key={project.id}>
              <td><strong>{project.name}</strong><span>{project.code}</span></td>
              <td><strong>{project.organization?.name ?? 'Organización'}</strong><span>{project.funding_partner}</span></td>
              <td><span>{formatDate(project.start_date)}</span><small>hasta {formatDate(project.end_date)}</small></td>
              <td className="project-budget">{formatMoney(project.approved_budget, project.currency)}</td>
              <td><span className={`beneficiary-mode-badge ${project.beneficiary_detail_enabled ? 'enabled' : ''}`}>{project.beneficiary_detail_enabled ? 'Registro individual' : 'Cifra agregada'}</span></td>
              <td><span className={`project-status ${project.status}`}>{statusLabels[project.status] ?? project.status}</span></td>
              <td><div className="project-row-actions"><a href={`/app/compliance?project=${project.id}`}>Cumplimiento</a><a href={`/app/compliance?project=${project.id}&section=beneficiary`}>Beneficiarios</a>{canManage && <button type="button" onClick={() => edit(project)}>Editar</button>}</div></td>
            </tr>
          ))}</tbody></table></div>
        )}
      </section>
    </div>
  )
}
