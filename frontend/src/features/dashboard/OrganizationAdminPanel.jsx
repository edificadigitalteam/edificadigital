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
  language: 'en',
  active: true,
}

const languageLabels = {
  en: 'English',
  es: 'Español',
}

const emptyHostForm = {
  id: '',
  organization_id: '',
  hostname: '',
  is_primary: true,
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
  const [hosts, setHosts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [hostForm, setHostForm] = useState(emptyHostForm)
  const [hostFormOpen, setHostFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [hostSearch, setHostSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeCount = useMemo(() => organizations.filter((item) => item.active).length, [organizations])
  const canEdit = access.role === 'super_admin'
  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return organizations
    return organizations.filter((organization) => [organization.name, organization.code, organization.legal_name, organization.country, organization.city]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query)))
  }, [organizations, search])
  const filteredHosts = useMemo(() => {
    const query = hostSearch.trim().toLowerCase()
    if (!query) return hosts
    return hosts.filter((host) => [host.hostname, host.organization_name]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query)))
  }, [hosts, hostSearch])

  const loadOrganizations = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const organizationResponse = await supabase.rpc('admin_list_organizations')
    const hostResponse = canEdit ? await supabase.rpc('admin_list_organization_hosts') : { data: [], error: null }

    if (organizationResponse.error || hostResponse.error) {
      setOrganizations([])
      setHosts([])
      setError(organizationResponse.error?.message ?? hostResponse.error?.message ?? 'No fue posible cargar las organizaciones.')
    } else {
      const nextOrganizations = organizationResponse.data ?? []
      setOrganizations(nextOrganizations)
      setHosts(hostResponse.data ?? [])
      setHostForm((current) => ({ ...current, organization_id: current.organization_id || nextOrganizations[0]?.id || '' }))
      setError('')
    }
    setLoading(false)
  }, [canEdit])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])

  const reset = () => {
    setForm(emptyForm)
    setFormOpen(false)
    setError('')
    setMessage('')
  }

  const startNew = () => {
    setForm(emptyForm)
    setFormOpen(true)
    setError('')
    setMessage('')
  }

  const resetHost = () => {
    setHostForm({ ...emptyHostForm, organization_id: organizations[0]?.id || '' })
    setHostFormOpen(false)
    setError('')
    setMessage('')
  }

  const startNewHost = () => {
    setHostForm({ ...emptyHostForm, organization_id: organizations[0]?.id || '' })
    setHostFormOpen(true)
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
      language: organization.language ?? 'en',
      active: organization.active,
    })
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const editHost = (host) => {
    setHostForm({
      id: host.id,
      organization_id: host.organization_id,
      hostname: host.hostname,
      is_primary: host.is_primary,
      active: host.active,
    })
    setHostFormOpen(true)
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
      setFormOpen(false)
      await loadOrganizations()
    }
    setSaving(false)
  }

  const saveHost = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canEdit) return
    setSaving(true)
    setError('')
    setMessage('')

    const { error: requestError } = await supabase.rpc('admin_save_organization_host', {
      payload: {
        ...hostForm,
        id: hostForm.id || null,
        hostname: hostForm.hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      },
    })

    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(hostForm.id ? 'Host actualizado.' : 'Host asociado al tenant.')
      resetHost()
      await loadOrganizations()
    }
    setSaving(false)
  }

  return (
    <div className="operations-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">ADMINISTRACIÓN MULTITENANT</p>
          <h1>Organizaciones y hosts</h1>
          <p className="operations-intro">Cada organización funciona como un tenant independiente. Sus usuarios, proyectos, donaciones, archivos y reportes quedan aislados mediante políticas de base de datos y pueden asociarse a un dominio o subdominio propio.</p>
        </div>
        <div className="operations-summary"><strong>{activeCount}</strong><span>organizaciones activas</span></div>
      </header>

      {message && <p className="operations-feedback success">{message}</p>}
      {!formOpen && !hostFormOpen && error && <p className="operations-feedback error">{error}</p>}

      {canEdit && formOpen && (
        <section className="operations-card">
          <div className="operations-card-heading">
            <div><p className="edifica-kicker">{form.id ? 'EDITAR ORGANIZACIÓN' : 'NUEVA ORGANIZACIÓN'}</p><h2>{form.id ? 'Actualizar tenant' : 'Crear tenant'}</h2></div>
            <button type="button" onClick={reset}>Cancelar</button>
          </div>
          <form className="operations-form" onSubmit={save}>
            <label><span>Nombre visible</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
            <label><span>Código del tenant</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="cnbv" required /></label>
            <label className="wide"><span>Razón social</span><input value={form.legal_name} onChange={(event) => setForm((current) => ({ ...current, legal_name: event.target.value }))} /></label>
            <label><span>RIF / identificación fiscal</span><input value={form.tax_id} onChange={(event) => setForm((current) => ({ ...current, tax_id: event.target.value }))} /></label>
            <label><span>País</span><input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} /></label>
            <label><span>Ciudad</span><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></label>
            <label><span>Correo de contacto</span><input type="email" value={form.contact_email} onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))} /></label>
            <label><span>Teléfono</span><input value={form.contact_phone} onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))} /></label>
            <label><span>Suscripción</span><select value={form.subscription_status} onChange={(event) => setForm((current) => ({ ...current, subscription_status: event.target.value }))}>{Object.entries(subscriptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Idioma predeterminado</span><select value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}>{Object.entries(languageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="operations-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Organización activa</span></label>
            <button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear organización'}</button>
          </form>
          {error && <p className="operations-feedback error">{error}</p>}
        </section>
      )}

      {canEdit && hostFormOpen && (
        <section className="operations-card">
          <div className="operations-card-heading">
            <div><p className="edifica-kicker">HOST Y TENANT</p><h2>Dominio de acceso</h2></div>
            <button type="button" onClick={resetHost}>Cancelar</button>
          </div>
          <form className="operations-form" onSubmit={saveHost}>
            <label><span>Organización</span><select value={hostForm.organization_id} onChange={(event) => setHostForm((current) => ({ ...current, organization_id: event.target.value }))} required><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
            <label><span>Hostname</span><input value={hostForm.hostname} onChange={(event) => setHostForm((current) => ({ ...current, hostname: event.target.value }))} placeholder="organizacion.edifica.app" required /></label>
            <label className="operations-checkbox"><input type="checkbox" checked={hostForm.is_primary} onChange={(event) => setHostForm((current) => ({ ...current, is_primary: event.target.checked }))} /><span>Host principal</span></label>
            <label className="operations-checkbox"><input type="checkbox" checked={hostForm.active} onChange={(event) => setHostForm((current) => ({ ...current, active: event.target.checked }))} /><span>Host activo</span></label>
            <button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : hostForm.id ? 'Guardar host' : 'Asociar host'}</button>
          </form>
          <p className="operations-empty-note">El host identifica el tenant antes del inicio de sesión. La autorización del usuario y las políticas RLS confirman después que su organización coincide con la cuenta solicitada.</p>
          {error && <p className="operations-feedback error">{error}</p>}
        </section>
      )}

      <section className="module-search-bar operations-card">
        <label><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, código, país o ciudad" /></label>
        <button type="button" onClick={() => setSearch('')}>Limpiar</button>
      </section>

      <section className="operations-card">
        <div className="module-list-heading"><div><p className="edifica-kicker">CUENTAS</p><h2>Organizaciones registradas</h2></div><div className="module-list-actions"><span>{filteredOrganizations.length} registros</span>{canEdit && <button type="button" onClick={startNew}>＋ Nueva organización</button>}</div></div>
        {loading ? <p className="edifica-empty">Cargando organizaciones…</p> : filteredOrganizations.length === 0 ? <p className="edifica-empty">Crea la primera organización para comenzar a asociar usuarios y proyectos.</p> : (
          <div className="edifica-table-wrap"><table className="operations-table"><thead><tr><th>Organización</th><th>Ubicación</th><th>Suscripción</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredOrganizations.map((organization) => (
            <tr key={organization.id}><td><strong>{organization.name}</strong><span>{organization.legal_name || organization.code}</span></td><td>{[organization.city, organization.country].filter(Boolean).join(', ') || '—'}</td><td>{subscriptionLabels[organization.subscription_status] ?? organization.subscription_status}</td><td><span className={`edifica-access-state ${organization.active ? 'active' : 'inactive'}`}>{organization.active ? 'Activa' : 'Inactiva'}</span></td><td><button type="button" onClick={() => edit(organization)} disabled={!organization.can_edit}>Editar</button></td></tr>
          ))}</tbody></table></div>
        )}
      </section>

      {canEdit && (
        <>
          <section className="module-search-bar operations-card">
            <label><span>Buscar</span><input type="search" value={hostSearch} onChange={(event) => setHostSearch(event.target.value)} placeholder="Hostname u organización" /></label>
            <button type="button" onClick={() => setHostSearch('')}>Limpiar</button>
          </section>

          <section className="operations-card">
            <div className="module-list-heading"><div><p className="edifica-kicker">ENRUTAMIENTO</p><h2>Hosts registrados</h2></div><div className="module-list-actions"><span>{filteredHosts.length} hosts</span><button type="button" onClick={startNewHost} disabled={organizations.length === 0}>＋ Asociar host</button></div></div>
            {filteredHosts.length === 0 ? <p className="edifica-empty">Todavía no existen dominios o subdominios asociados.</p> : (
              <div className="edifica-table-wrap"><table className="operations-table"><thead><tr><th>Hostname</th><th>Organización</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredHosts.map((host) => (
                <tr key={host.id}><td><strong>{host.hostname}</strong><span>https://{host.hostname}</span></td><td>{host.organization_name}</td><td>{host.is_primary ? 'Principal' : 'Alternativo'}</td><td><span className={`edifica-access-state ${host.active ? 'active' : 'inactive'}`}>{host.active ? 'Activo' : 'Inactivo'}</span></td><td><button type="button" onClick={() => editHost(host)}>Editar</button></td></tr>
              ))}</tbody></table></div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
