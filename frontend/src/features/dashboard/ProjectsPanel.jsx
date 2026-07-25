import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './operations.css'

const emptyForm = {
  id: '',
  organization_id: '',
  code: '',
  name: '',
  funding_partner: '',
  status: 'planning',
  start_date: '',
  end_date: '',
  approved_budget: '',
  currency: 'USD',
  objective: '',
  expected_results: '',
  reporting_requirements: '',
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

export default function ProjectsPanel({ access }) {
  const [projects, setProjects] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [form, setForm] = useState({ ...emptyForm, organization_id: access.organizationId || '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = access.role === 'admin' || access.role === 'super_admin'
  const activeCount = useMemo(() => projects.filter((item) => ['approved', 'active'].includes(item.status)).length, [projects])

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
      .select('id, organization_id, code, name, funding_partner, status, start_date, end_date, approved_budget, currency, objective, expected_results, reporting_requirements, notes, created_at, updated_at, organization:organization(name)')
      .order('created_at', { ascending: false })

    if (projectError) {
      setProjects([])
      setError(projectError.message)
    } else {
      setProjects(data ?? [])
      setForm((current) => ({
        ...current,
        organization_id: current.organization_id || access.organizationId || organizationData[0]?.id || '',
      }))
    }
    setLoading(false)
  }, [access.organizationId, canManage])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' })
    setError('')
    setMessage('')
  }

  const edit = (project) => {
    setForm({
      id: project.id,
      organization_id: project.organization_id,
      code: project.code,
      name: project.name,
      funding_partner: project.funding_partner,
      status: project.status,
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      approved_budget: project.approved_budget ?? '',
      currency: project.currency,
      objective: project.objective,
      expected_results: project.expected_results ?? '',
      reporting_requirements: project.reporting_requirements ?? '',
      notes: project.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canManage) return
    if (!form.organization_id) {
      setError('Crea o selecciona una organización antes de registrar el proyecto.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      organization_id: form.organization_id,
      code: form.code.trim(),
      name: form.name.trim(),
      funding_partner: form.funding_partner.trim(),
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      approved_budget: form.approved_budget === '' ? null : Number(form.approved_budget),
      currency: form.currency,
      objective: form.objective.trim(),
      expected_results: form.expected_results.trim() || null,
      reporting_requirements: form.reporting_requirements.trim() || null,
      notes: form.notes.trim() || null,
      created_by: access.userId,
    }

    const request = form.id
      ? supabase.from('project').update(payload).eq('id', form.id)
      : supabase.from('project').insert(payload)

    const { error: requestError } = await request
    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(form.id ? 'Proyecto actualizado.' : 'Proyecto registrado.')
      reset()
      await load()
    }
    setSaving(false)
  }

  return (
    <div className="operations-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">CUMPLIMIENTO Y TRAZABILIDAD</p>
          <h1>Proyectos financiados</h1>
          <p className="operations-intro">Registra los proyectos aprobados por aliados internacionales y concentra su presupuesto, objetivos, resultados, donaciones, facturas, comprobantes e informes.</p>
        </div>
        <div className="operations-summary"><strong>{activeCount}</strong><span>proyectos activos</span></div>
      </header>

      {!access.organizationId && access.role !== 'super_admin' && (
        <p className="operations-empty-note">Tu usuario necesita una organización asignada para utilizar este módulo. Un superadministrador puede asociarla desde Personas habilitadas.</p>
      )}

      {canManage && (
        <section className="operations-card">
          <div className="operations-card-heading"><div><p className="edifica-kicker">{form.id ? 'EDITAR PROYECTO' : 'NUEVO PROYECTO'}</p><h2>{form.id ? 'Actualizar proyecto' : 'Cargar proyecto'}</h2></div>{form.id && <button type="button" onClick={reset}>Cancelar edición</button>}</div>
          <form className="operations-form" onSubmit={save}>
            <label><span>Organización usuaria</span><select value={form.organization_id} onChange={(event) => setForm((current) => ({ ...current, organization_id: event.target.value }))} disabled={access.role !== 'super_admin'} required><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
            <label><span>Código del proyecto</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="AGUA-2026-01" required /></label>
            <label className="wide"><span>Nombre del proyecto</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
            <label className="wide"><span>Aliado u organización financiadora</span><input value={form.funding_partner} onChange={(event) => setForm((current) => ({ ...current, funding_partner: event.target.value }))} placeholder="Nombre de la organización internacional" required /></label>
            <label><span>Estado</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Moneda del presupuesto</span><select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
            <label><span>Fecha de inicio</span><input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} /></label>
            <label><span>Fecha de cierre</span><input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></label>
            <label><span>Presupuesto aprobado</span><input type="number" min="0" step="0.01" value={form.approved_budget} onChange={(event) => setForm((current) => ({ ...current, approved_budget: event.target.value }))} /></label>
            <label className="wide"><span>Objetivo</span><textarea value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} required /></label>
            <label className="wide"><span>Resultados esperados</span><textarea value={form.expected_results} onChange={(event) => setForm((current) => ({ ...current, expected_results: event.target.value }))} /></label>
            <label className="wide"><span>Exigencias de reporte y cumplimiento</span><textarea value={form.reporting_requirements} onChange={(event) => setForm((current) => ({ ...current, reporting_requirements: event.target.value }))} placeholder="Frecuencia, formatos, indicadores y evidencias requeridas" /></label>
            <label className="wide"><span>Observaciones</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar proyecto'}</button>
          </form>
          {message && <p className="operations-feedback success">{message}</p>}
          {error && <p className="operations-feedback error">{error}</p>}
        </section>
      )}

      <section className="operations-card">
        <div className="edifica-section-heading"><div><p className="edifica-kicker">CARTERA</p><h2>Proyectos de la organización</h2></div><span>{projects.length} proyectos</span></div>
        <p className="operations-empty-note">La base ya contempla gastos, facturas, recibos, presupuestos e informes por proyecto. La siguiente pantalla será el expediente detallado de cada proyecto.</p>
        {loading ? <p className="edifica-empty">Cargando proyectos…</p> : projects.length === 0 ? <p className="edifica-empty">Todavía no existen proyectos registrados.</p> : (
          <div className="edifica-table-wrap"><table className="operations-table"><thead><tr><th>Proyecto</th><th>Financiador</th><th>Presupuesto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{projects.map((project) => (
            <tr key={project.id}><td><strong>{project.name}</strong><span>{project.code} · {project.organization?.name ?? 'Organización'}</span></td><td>{project.funding_partner}</td><td className="project-budget">{formatMoney(project.approved_budget, project.currency)}</td><td><span className={`project-status ${project.status}`}>{statusLabels[project.status] ?? project.status}</span></td><td>{canManage ? <button type="button" onClick={() => edit(project)}>Editar</button> : 'Consultar'}</td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </div>
  )
}
