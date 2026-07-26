import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './donors.css'
import '../dashboard/operations.css'

const emptyForm = {
  id: '',
  organization_id: '',
  donor_type: 'organization',
  name: '',
  email: '',
  phone: '',
  country: '',
  active: true,
}

export default function DonorDirectoryPanel({ access }) {
  const [organizations, setOrganizations] = useState([])
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [donors, setDonors] = useState([])
  const [form, setForm] = useState({ ...emptyForm, organization_id: access.organizationId || '' })
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.role !== 'super_admin') return
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) {
      setError(requestError.message)
      return
    }
    const next = data ?? []
    setOrganizations(next)
    setOrganizationId((current) => current || next[0]?.id || '')
  }, [access.role])

  const loadDonors = useCallback(async () => {
    if (!supabase || !organizationId) {
      setDonors([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('list_donor_directory', {
      target_organization_id: organizationId,
    })
    if (requestError) {
      setDonors([])
      setError(requestError.message)
    } else {
      setDonors(data ?? [])
    }
    setLoading(false)
  }, [organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { loadDonors() }, [loadDonors])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return donors
    return donors.filter((donor) => [donor.name, donor.email, donor.phone, donor.country]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query)))
  }, [donors, search])

  const startNew = () => {
    setForm({ ...emptyForm, organization_id: organizationId })
    setFormOpen(true)
    setError('')
    setMessage('')
  }

  const edit = (donor) => {
    setForm({
      id: donor.id,
      organization_id: donor.organization_id,
      donor_type: donor.is_anonymous ? 'anonymous' : donor.is_organization ? 'organization' : 'person',
      name: donor.is_anonymous ? '' : donor.name,
      email: donor.email ?? '',
      phone: donor.phone ?? '',
      country: donor.country ?? '',
      active: donor.active,
    })
    setFormOpen(true)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancel = () => {
    setForm({ ...emptyForm, organization_id: organizationId })
    setFormOpen(false)
    setError('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !form.organization_id) return
    setSaving(true)
    setError('')
    setMessage('')
    const anonymous = form.donor_type === 'anonymous'
    const { error: requestError } = await supabase.rpc('save_donor_directory', {
      payload: {
        id: form.id || null,
        organization_id: form.organization_id,
        name: anonymous ? 'Donante anónimo' : form.name.trim(),
        email: anonymous ? null : form.email.trim() || null,
        phone: anonymous ? null : form.phone.trim() || null,
        country: form.country.trim() || null,
        is_organization: form.donor_type === 'organization',
        is_anonymous: anonymous,
        active: form.active,
      },
    })
    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(form.id ? 'Aliado o donante actualizado.' : 'Aliado o donante creado y disponible en los formularios.')
      setFormOpen(false)
      setForm({ ...emptyForm, organization_id: organizationId })
      await loadDonors()
    }
    setSaving(false)
  }

  return (
    <div className="operations-page donor-directory-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">DIRECTORIO INSTITUCIONAL</p>
          <h1>Aliados y donantes</h1>
          <p className="operations-intro">Crea una sola vez a cada organización, persona o donante anónimo y reutilízalo en proyectos y donaciones.</p>
        </div>
        <div className="operations-summary"><strong>{donors.filter((donor) => donor.active).length}</strong><span>registros activos</span></div>
      </header>

      <section className="operations-card donor-directory-toolbar">
        <label><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo, teléfono o país" /></label>
        {access.role === 'super_admin' && <label><span>Organización</span><select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setFormOpen(false) }}><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}
        <button type="button" onClick={startNew} disabled={!organizationId}>＋ Crear aliado o donante</button>
      </section>

      {formOpen && (
        <section className="operations-card donor-directory-form">
          <form className="operations-form" onSubmit={save}>
            <label><span>Tipo</span><select value={form.donor_type} onChange={(event) => setForm((current) => ({ ...current, donor_type: event.target.value }))}><option value="organization">Organización</option><option value="person">Persona</option><option value="anonymous">Anónimo</option></select></label>
            {form.donor_type !== 'anonymous' && <label className="wide"><span>Nombre *</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>}
            {form.donor_type !== 'anonymous' && <><label><span>Correo</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label><label><span>Teléfono</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label></>}
            <label><span>País</span><input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} /></label>
            <label className="operations-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Registro activo</span></label>
            {error && <p className="operations-feedback error wide">{error}</p>}
            <div className="compliance-form-actions"><button type="button" onClick={cancel}>Cancelar</button><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear y guardar'}</button></div>
          </form>
        </section>
      )}

      {message && <p className="operations-feedback success">{message}</p>}
      {!formOpen && error && <p className="operations-feedback error">{error}</p>}

      <section className="operations-card">
        <div className="edifica-section-heading"><div><p className="edifica-kicker">DIRECTORIO</p><h2>Registros disponibles</h2></div><span>{filtered.length} registros</span></div>
        {loading ? <p className="edifica-empty">Cargando aliados y donantes…</p> : filtered.length === 0 ? <p className="edifica-empty">Todavía faltan aliados o donantes por registrar.</p> : (
          <div className="edifica-table-wrap"><table className="operations-table donor-directory-table"><thead><tr><th>Aliado o donante</th><th>Contacto</th><th>País</th><th>Uso</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{filtered.map((donor) => (
            <tr key={donor.id}>
              <td><strong>{donor.name}</strong><span className="donor-type-chip">{donor.is_anonymous ? 'Anónimo' : donor.is_organization ? 'Organización' : 'Persona'}</span></td>
              <td><span>{donor.email || '—'}</span><span>{donor.phone || '—'}</span></td>
              <td>{donor.country || '—'}</td>
              <td><span>{donor.project_count} proyectos</span><span>{donor.donation_count} donaciones</span></td>
              <td><span className={`edifica-access-state ${donor.active ? 'active' : 'inactive'}`}>{donor.active ? 'Activo' : 'Inactivo'}</span></td>
              <td><button type="button" onClick={() => edit(donor)}>Editar</button></td>
            </tr>
          ))}</tbody></table></div>
        )}
      </section>
    </div>
  )
}
