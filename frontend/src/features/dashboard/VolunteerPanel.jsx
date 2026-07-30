import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './operations.css'

const specialties = {
  medical: 'Médico / salud',
  kitchen: 'Cocina y alimentación',
  logistics: 'Logística',
  spiritual_care: 'Apoyo espiritual y emocional',
  communications: 'Comunicación',
  rescue: 'Rescate y respuesta inmediata',
  transport: 'Transporte',
  administration: 'Administración',
  other: 'Otra especialidad',
}

const emptyForm = {
  id: '',
  organization_id: '',
  project_id: '',
  full_name: '',
  email: '',
  phone: '',
  country: 'Venezuela',
  city: '',
  volunteer_type: 'general',
  specialties: [],
  profession: '',
  professional_license: '',
  availability: '',
  emergency_contact: '',
  status: 'active',
  notes: '',
}

export default function VolunteerPanel({ access }) {
  const [volunteers, setVolunteers] = useState([])
  const [projects, setProjects] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [form, setForm] = useState({ ...emptyForm, organization_id: access.organizationId || '' })
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeCount = useMemo(() => volunteers.filter((item) => item.status === 'active').length, [volunteers])
  const filteredVolunteers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return volunteers
    return volunteers.filter((volunteer) => [volunteer.full_name, volunteer.email, volunteer.phone, volunteer.organization?.name, volunteer.project?.name]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query)))
  }, [volunteers, search])

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')

    if (access.role === 'super_admin') {
      const { data } = await supabase.rpc('admin_list_organizations')
      setOrganizations(data ?? [])
    }

    const [{ data: projectData, error: projectError }, { data: volunteerData, error: volunteerError }] = await Promise.all([
      supabase.from('project').select('id, name, organization_id').order('name'),
      supabase.from('volunteer').select('id, organization_id, project_id, full_name, email, phone, country, city, volunteer_type, specialties, profession, professional_license, availability, emergency_contact, status, notes, created_at, updated_at, organization:organization(name), project:project(name)').order('created_at', { ascending: false }),
    ])

    if (projectError || volunteerError) {
      setError(projectError?.message ?? volunteerError?.message ?? 'No fue posible cargar el módulo.')
    } else {
      setProjects(projectData ?? [])
      setVolunteers(volunteerData ?? [])
    }
    setLoading(false)
  }, [access.role])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' })
    setFormOpen(false)
    setError('')
    setMessage('')
  }

  const startNew = () => {
    setForm({ ...emptyForm, organization_id: access.organizationId || organizations[0]?.id || '' })
    setFormOpen(true)
    setError('')
    setMessage('')
  }

  const toggleSpecialty = (value) => {
    setForm((current) => ({
      ...current,
      specialties: current.specialties.includes(value)
        ? current.specialties.filter((item) => item !== value)
        : [...current.specialties, value],
    }))
  }

  const edit = (volunteer) => {
    setForm({
      id: volunteer.id,
      organization_id: volunteer.organization_id,
      project_id: volunteer.project_id ?? '',
      full_name: volunteer.full_name,
      email: volunteer.email ?? '',
      phone: volunteer.phone ?? '',
      country: volunteer.country ?? '',
      city: volunteer.city ?? '',
      volunteer_type: volunteer.volunteer_type,
      specialties: volunteer.specialties ?? [],
      profession: volunteer.profession ?? '',
      professional_license: volunteer.professional_license ?? '',
      availability: volunteer.availability ?? '',
      emergency_contact: volunteer.emergency_contact ?? '',
      status: volunteer.status,
      notes: volunteer.notes ?? '',
    })
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving) return
    if (!form.organization_id) {
      setError('Asigna una organización antes de registrar voluntarios.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      organization_id: form.organization_id,
      project_id: form.project_id || null,
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      volunteer_type: form.volunteer_type,
      specialties: form.volunteer_type === 'general' ? [] : form.specialties,
      profession: form.profession.trim() || null,
      professional_license: form.professional_license.trim() || null,
      availability: form.availability.trim() || null,
      emergency_contact: form.emergency_contact.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      created_by: access.userId,
    }

    const request = form.id
      ? supabase.from('volunteer').update(payload).eq('id', form.id)
      : supabase.from('volunteer').insert(payload)

    const { error: requestError } = await request
    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(form.id ? 'Voluntario actualizado.' : 'Voluntario registrado.')
      reset()
      await load()
    }
    setSaving(false)
  }

  const availableProjects = projects.filter((project) => !form.organization_id || project.organization_id === form.organization_id)

  return (
    <div className="operations-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">EQUIPO DE RESPUESTA</p>
          <h1>Registro de voluntariado</h1>
          <p className="operations-intro">Registra voluntarios generales y perfiles especializados para salud, cocina, logística, apoyo espiritual, comunicación y otras áreas.</p>
        </div>
        <div className="operations-summary"><strong>{activeCount}</strong><span>voluntarios activos</span></div>
      </header>

      {!access.organizationId && access.role !== 'super_admin' && <p className="operations-empty-note">Tu usuario necesita una organización asignada para registrar voluntarios.</p>}

      {message && <p className="operations-feedback success">{message}</p>}
      {!formOpen && error && <p className="operations-feedback error">{error}</p>}

      {formOpen && (
      <section className="operations-card">
        <div className="module-form-breadcrumb"><button type="button" onClick={reset} title="Volver al listado de voluntarios">Voluntariado</button><span>/</span><strong>{form.id ? 'Editar' : 'Crear'}</strong></div>
        <div className="operations-card-heading"><div><p className="edifica-kicker">{form.id ? 'EDITAR VOLUNTARIO' : 'NUEVO VOLUNTARIO'}</p><h2>{form.id ? 'Actualizar registro' : 'Registrar voluntario'}</h2></div><button type="button" onClick={reset} title="Cerrar este formulario sin guardar">Cancelar</button></div>
        <form className="operations-form" onSubmit={save}>
          {access.role === 'super_admin' && <label><span>Organización</span><select value={form.organization_id} onChange={(event) => setForm((current) => ({ ...current, organization_id: event.target.value, project_id: '' }))} required><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}
          <label><span>Proyecto relacionado</span><select value={form.project_id} onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}><option value="">Sin proyecto específico</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="wide"><span>Nombre completo</span><input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} required /></label>
          <label><span>Correo</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span>Teléfono / WhatsApp</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label><span>País</span><input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} /></label>
          <label><span>Ciudad</span><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></label>
          <label><span>Tipo de voluntariado</span><select value={form.volunteer_type} onChange={(event) => setForm((current) => ({ ...current, volunteer_type: event.target.value, specialties: event.target.value === 'general' ? [] : current.specialties }))}><option value="general">Voluntario general</option><option value="specialized">Voluntario especializado</option></select></label>
          <label><span>Estado</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Activo</option><option value="unavailable">Temporalmente no disponible</option><option value="inactive">Inactivo</option></select></label>

          {form.volunteer_type === 'specialized' && <div className="operations-specialties"><span>Áreas de especialidad</span><div className="operations-specialty-grid">{Object.entries(specialties).map(([value, label]) => <label key={value}><input type="checkbox" checked={form.specialties.includes(value)} onChange={() => toggleSpecialty(value)} />{label}</label>)}</div></div>}

          <label><span>Profesión u oficio</span><input value={form.profession} onChange={(event) => setForm((current) => ({ ...current, profession: event.target.value }))} /></label>
          <label><span>Matrícula / licencia profesional</span><input value={form.professional_license} onChange={(event) => setForm((current) => ({ ...current, professional_license: event.target.value }))} /></label>
          <label className="wide"><span>Disponibilidad</span><textarea value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))} placeholder="Días, horarios, capacidad de movilización y duración disponible" /></label>
          <label className="wide"><span>Contacto de emergencia</span><input value={form.emergency_contact} onChange={(event) => setForm((current) => ({ ...current, emergency_contact: event.target.value }))} /></label>
          <label className="wide"><span>Observaciones</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <button className="edifica-primary-button" type="submit" disabled={saving} title={form.id ? 'Guardar los cambios de este voluntario' : 'Registrar este voluntario'}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar voluntario'}</button>
        </form>
        {error && <p className="operations-feedback error">{error}</p>}
      </section>
      )}

      {!formOpen && (
        <>
          <section className="module-search-bar operations-card">
            <label><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo, teléfono, organización o proyecto" /></label>
            <button type="button" onClick={() => setSearch('')} title="Limpiar la búsqueda">Limpiar</button>
          </section>

          <section className="operations-card">
            <div className="module-list-heading"><div><p className="edifica-kicker">DIRECTORIO</p><h2>Voluntarios registrados</h2></div><div className="module-list-actions"><span>{filteredVolunteers.length} personas</span><button type="button" onClick={startNew} title="Registrar un nuevo voluntario">＋ Nuevo voluntario</button></div></div>
            {loading ? <p className="edifica-empty">Cargando voluntarios…</p> : filteredVolunteers.length === 0 ? <p className="edifica-empty">Todavía no existen voluntarios registrados.</p> : (
              <div className="edifica-table-wrap"><table className="operations-table"><thead><tr><th>Voluntario</th><th>Tipo</th><th>Especialidades</th><th>Proyecto</th><th>Acciones</th></tr></thead><tbody>{filteredVolunteers.map((volunteer) => (
                <tr key={volunteer.id}><td><strong>{volunteer.full_name}</strong><span>{volunteer.phone || volunteer.email || volunteer.organization?.name}</span></td><td>{volunteer.volunteer_type === 'general' ? 'General' : 'Especializado'}</td><td><div className="volunteer-specialties">{(volunteer.specialties ?? []).length ? volunteer.specialties.map((item) => <span key={item}>{specialties[item] ?? item}</span>) : <span>Apoyo general</span>}</div></td><td>{volunteer.project?.name ?? 'Disponibilidad general'}</td><td><button type="button" onClick={() => edit(volunteer)} title={`Editar a ${volunteer.full_name}`}>Editar</button></td></tr>
              ))}</tbody></table></div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
