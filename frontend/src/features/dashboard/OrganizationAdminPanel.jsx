import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './operations.css'

const emptyForm = {
  id: '',
  code: '',
  name: '',
  legal_name: '',
  tax_id: '',
  country: '',
  city: '',
  contact_email: '',
  contact_phone: '',
  subscription_status: 'trial',
  active: true,
}

const subscriptionLabels = {
  trial: 'Prueba',
  active: 'Activa',
  past_due: 'Pago pendiente',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
}

export default function OrganizationAdminPanel({ access }) {
  const [organizations, setOrganizations] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeCount = useMemo(() => organizations.filter((item) => item.active).length, [organizations])
  const canEdit = access.role === 'super_admin'

  const loadOrganizations = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) {
      setOrganizations([])
      setError(requestError.message)
    } else {
      setOrganizations(data ?? [])
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  const reset = () => {
    setForm(emptyForm)
    setError('')
    setMessage('')
  }

  const edit = (organization) => {
    if (!organization.can_edit) return
    setForm({
      id: organization.id,
      code: organization.code,
      name: organization.name,
      legal_name: organization.legal_name ?? '',
      tax_id: organization.tax_id ?? '',
      country: organization.country ?? '',
      city: organization.city ?? '',
      contact_email: organization.contact_email ?? '',
      contact_phone: organization.contact_phone ?? '',
      subscription_status: organization.subscription_status,
      active: organization.active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canEdit) return
    setSaving(true)
    setError('')
    setMessage('')

    const { error: requestError } = await supabase.rpc('admin_save_organization', {
      payload: {
        ...form,
        id: form.id || null,
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
      },
    })

    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(form.id ? 'Organización actualizada.' : 'Organización creada y asignada a tu perfil.')
      setForm(emptyForm)
      await loadOrganizations()
    }
    setSaving(false)
  }

  return (
    <div className="operations-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">ADMINISTRACIÓN</p>
          <h1>Organizaciones</h1>
          <p className="operations-intro">Cada organización representa una cuenta de Edifica. Sus usuarios, proyectos, donaciones y voluntarios quedarán asociados a ella.</p>
        </div>
        <div className="operations-summary"><strong>{activeCount}</strong><span>organizaciones activas</span></div>
      </header>

      {canEdit && (
        <section className="operations-card">
          <div className="operations-card-heading">
            <div><p className="edifica-kicker">{form.id ? 'EDITAR ORGANIZACIÓN' : 'NUEVA ORGANIZACIÓN'}</p><h2>{form.id ? 'Actualizar organización' : 'Crear organización'}</h2></div>
            {form.id && <button type="button" onClick={reset}>Cancelar edición</button>}
          </div>
          <form className="operations-form" onSubmit={save}>
            <label><span>Nombre visible</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
            <label><span>Código interno</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="cnbv" required /></label>
            <label className="wide"><span>Razón social</span><input value={form.legal_name} onChange={(event) => setForm((current) => ({ ...current, legal_name: event.target.value }))} /></label>
            <label><span>RIF / identificación fiscal</span><input value={form.tax_id} onChange={(event) => setForm((current) => ({ ...current, tax_id: event.target.value }))} /></label>
            <label><span>País</span><input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} /></label>
            <label><span>Ciudad</span><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></label>
            <label><span>Correo de contacto</span><input type="email" value={form.contact_email} onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))} /></label>
            <label><span>Teléfono</span><input value={form.contact_phone} onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))} /></label>
            <label><span>Suscripción</span><select value={form.subscription_status} onChange={(event) => setForm((current) => ({ ...current, subscription_status: event.target.value }))}>{Object.entries(subscriptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="operations-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Organización activa</span></label>
            <button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear organización'}</button>
          </form>
          {message && <p className="operations-feedback success">{message}</p>}
          {error && <p className="operations-feedback error">{error}</p>}
        </section>
      )}

      <section className="operations-card">
        <div className="edifica-section-heading"><div><p className="edifica-kicker">CUENTAS</p><h2>Organizaciones registradas</h2></div><span>{organizations.length} registros</span></div>
        {loading ? <p className="edifica-empty">Cargando organizaciones…</p> : organizations.length === 0 ? <p className="edifica-empty">Crea la primera organización para comenzar a asociar usuarios y proyectos.</p> : (
          <div className="edifica-table-wrap"><table className="operations-table"><thead><tr><th>Organización</th><th>Ubicación</th><th>Suscripción</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{organizations.map((organization) => (
            <tr key={organization.id}><td><strong>{organization.name}</strong><span>{organization.legal_name || organization.code}</span></td><td>{[organization.city, organization.country].filter(Boolean).join(', ') || '—'}</td><td>{subscriptionLabels[organization.subscription_status] ?? organization.subscription_status}</td><td><span className={`edifica-access-state ${organization.active ? 'active' : 'inactive'}`}>{organization.active ? 'Activa' : 'Inactiva'}</span></td><td><button type="button" onClick={() => edit(organization)} disabled={!organization.can_edit}>Editar</button></td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </div>
  )
}
