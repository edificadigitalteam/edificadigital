import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './operations.css'
import './operator-admin.css'

const emptyForm = {
  id: '',
  display_name: '',
  email: '',
  role: 'operator',
  organization_id: '',
  active: true,
}

const roleLabels = {
  operator: 'Operador',
  admin: 'Administrador',
  super_admin: 'Superadministrador',
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(value))
}

export default function OperatorAdminPanel({ access }) {
  const [operators, setOperators] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [billingOverview, setBillingOverview] = useState(null)
  const [form, setForm] = useState({ ...emptyForm, organization_id: access.organizationId || '' })
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [organizationFilter, setOrganizationFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isSuperAdmin = access.role === 'super_admin'
  const activeCount = useMemo(() => operators.filter((operator) => operator.active).length, [operators])
  const filteredOperators = useMemo(() => {
    const query = search.trim().toLowerCase()
    return operators
      .filter((operator) => organizationFilter === 'all' || operator.organization_id === organizationFilter)
      .filter((operator) => !query || [operator.display_name, operator.email, operator.organization_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)))
  }, [operators, search, organizationFilter])

  const loadOperators = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    const operatorRequest = supabase.rpc('admin_list_operator_access')
    const organizationRequest = isSuperAdmin
      ? supabase.rpc('admin_list_organizations')
      : Promise.resolve({ data: access.organizationId ? [{ id: access.organizationId, name: access.organizationName || 'Mi organización' }] : [], error: null })
    const [{ data, error: requestError }, { data: organizationData, error: organizationError }] = await Promise.all([operatorRequest, organizationRequest])
    if (requestError || organizationError) {
      setOperators([])
      setError(requestError?.message ?? organizationError?.message ?? 'No fue posible cargar los accesos.')
    } else {
      setOperators(data ?? [])
      setOrganizations(organizationData ?? [])
      setForm((current) => ({ ...current, organization_id: current.organization_id || access.organizationId || organizationData?.[0]?.id || '' }))
    }
    setLoading(false)
  }, [access.organizationId, access.organizationName, isSuperAdmin])

  const loadBilling = useCallback(async (organizationId) => {
    if (!supabase || !organizationId) {
      setBillingOverview(null)
      return
    }
    const { data, error: requestError } = await supabase.rpc('organization_billing_overview', {
      target_organization_id: organizationId,
    })
    if (requestError) {
      setBillingOverview(null)
      setError((current) => current || requestError.message)
    } else setBillingOverview(data ?? null)
  }, [])

  useEffect(() => { loadOperators() }, [loadOperators])
  useEffect(() => { loadBilling(form.organization_id) }, [form.organization_id, loadBilling])

  const resetForm = () => {
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

  const editOperator = (operator) => {
    if (!operator.can_edit) return
    setForm({
      id: operator.id,
      display_name: operator.display_name,
      email: operator.email,
      role: operator.role,
      organization_id: operator.organization_id ?? '',
      active: operator.active,
    })
    setFormOpen(true)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveOperator = async (event) => {
    event.preventDefault()
    if (!supabase || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: requestError } = await supabase.rpc('admin_save_operator_access', {
      payload: {
        id: form.id || null,
        display_name: form.display_name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        organization_id: form.organization_id || null,
        active: form.active,
      },
    })
    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(form.id ? 'Acceso actualizado correctamente.' : 'Persona habilitada correctamente.')
      const organizationId = form.organization_id
      resetForm()
      await loadOperators()
      await loadBilling(organizationId)
    }
    setSaving(false)
  }

  const toggleOperator = async (operator) => {
    if (!operator.can_edit || !supabase) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: requestError } = await supabase.rpc('admin_save_operator_access', {
      payload: {
        id: operator.id,
        display_name: operator.display_name,
        email: operator.email,
        role: operator.role,
        organization_id: operator.organization_id,
        active: !operator.active,
      },
    })
    if (requestError) setError(requestError.message)
    else {
      setMessage(operator.active ? 'Acceso suspendido.' : 'Acceso reactivado.')
      await loadOperators()
      await loadBilling(operator.organization_id)
    }
    setSaving(false)
  }

  const resendInvitation = async (operator) => {
    if (!operator.can_resend_invitation || !supabase) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: requestError } = await supabase.rpc('resend_operator_activation', {
      target_operator_id: operator.id,
    })
    if (requestError) setError(requestError.message)
    else {
      setMessage(`Invitación reenviada a ${operator.email}.`)
      await loadOperators()
    }
    setSaving(false)
  }

  const seatLimitReached = Boolean(billingOverview?.seat_limit && billingOverview.active_users >= billingOverview.seat_limit && !form.id)

  return (
    <div className="edifica-admin-page">
      <header className="edifica-dashboard-header">
        <div><p className="edifica-kicker">ADMINISTRACIÓN</p><h1>Personas habilitadas</h1><p className="edifica-admin-intro">Cada persona utiliza un acceso individual dentro de la organización y ocupa uno de los cupos de su plan.</p></div>
        <div className="edifica-admin-summary"><strong>{activeCount}</strong><span>accesos activos</span></div>
      </header>

      {billingOverview?.organization_id && (
        <section className={`operator-seat-card ${seatLimitReached ? 'limit' : ''}`}>
          <div><p className="edifica-kicker">CUPO DEL PLAN</p><h2>{billingOverview.organization_name}</h2><span>{billingOverview.plan_name_es || 'Plan personalizado'} · {billingOverview.status}</span></div>
          <div className="operator-seat-count"><strong>{billingOverview.active_users} / {billingOverview.seat_limit}</strong><span>{billingOverview.available_seats} cupos disponibles</span></div>
          <a href="/app/admin/billing">Ver plan y facturación</a>
        </section>
      )}

      <section className="module-search-bar operations-card">
        <label><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo u organización" /></label>
        {isSuperAdmin && <label><span>Organización</span><select value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value)}><option value="all">Todas las organizaciones</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}
        <button type="button" onClick={() => { setSearch(''); setOrganizationFilter('all') }} title="Limpiar la búsqueda y el filtro de organización">Limpiar</button>
      </section>

      {message && <p className="edifica-admin-feedback success">{message}</p>}
      {!formOpen && error && <p className="edifica-admin-feedback error">{error}</p>}

      {formOpen && (
        <section className="edifica-admin-form-card">
          <div className="edifica-admin-card-heading"><div><p className="edifica-kicker">{form.id ? 'EDITAR ACCESO' : 'NUEVO ACCESO'}</p><h2>{form.id ? 'Actualizar persona' : 'Habilitar una persona'}</h2></div><button type="button" onClick={resetForm} title="Cerrar este formulario sin guardar">Cancelar</button></div>
          <form className="edifica-admin-form" onSubmit={saveOperator}>
            <label><span>Nombre</span><input type="text" value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} placeholder="Nombre y apellido" required /></label>
            <label><span>Correo electrónico</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="persona@organizacion.org" required /></label>
            <label><span>Organización</span><select value={form.organization_id} onChange={(event) => setForm((current) => ({ ...current, organization_id: event.target.value }))} disabled={!isSuperAdmin}><option value="">Sin asignar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
            <label><span>Rol</span><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} disabled={!isSuperAdmin}><option value="operator">Operador</option>{isSuperAdmin && <option value="admin">Administrador</option>}{isSuperAdmin && <option value="super_admin">Superadministrador</option>}</select></label>
            <label className="edifica-admin-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Acceso activo</span></label>
            <button className="edifica-primary-button" type="submit" disabled={saving || seatLimitReached} title={form.id ? 'Guardar los cambios de este acceso' : 'Habilitar el acceso de esta persona'}>{saving ? 'Guardando…' : seatLimitReached ? 'Cupo de usuarios completo' : form.id ? 'Guardar cambios' : 'Habilitar persona'}</button>
          </form>
          {error && <p className="edifica-admin-feedback error">{error}</p>}
        </section>
      )}

      <section className="edifica-admin-list-card">
        <div className="module-list-heading"><div><p className="edifica-kicker">DIRECTORIO</p><h2>Usuarios del sistema</h2></div><div className="module-list-actions"><span>{filteredOperators.length} personas</span><button type="button" onClick={startNew} title="Habilitar el acceso de una nueva persona">＋ Habilitar persona</button></div></div>
        {loading ? <p className="edifica-empty">Cargando personas habilitadas…</p> : filteredOperators.length === 0 ? <p className="edifica-empty">Todavía no existen personas habilitadas.</p> : (
          <div className="edifica-table-wrap"><table className="edifica-admin-table"><thead><tr><th>Persona</th><th>Organización</th><th>Rol</th><th>Estado</th><th>Actualizado</th><th>Acciones</th></tr></thead><tbody>{filteredOperators.map((operator) => (
            <tr key={operator.id}><td><strong>{operator.display_name}</strong><span>{operator.email}</span></td><td>{operator.organization_name ?? 'HOST'}</td><td>{roleLabels[operator.role] ?? operator.role}</td><td><span className={`edifica-access-state ${operator.active ? 'active' : 'inactive'}`}>{operator.active ? 'Activo' : 'Suspendido'}</span>{!operator.email_confirmed_at && <span className="edifica-access-state pending">Confirmación pendiente</span>}</td><td>{formatDate(operator.updated_at)}</td><td><div className="edifica-admin-row-actions"><button type="button" onClick={() => editOperator(operator)} disabled={!operator.can_edit || saving} title={`Editar a ${operator.display_name}`}>Editar</button><button type="button" onClick={() => toggleOperator(operator)} disabled={!operator.can_edit || saving} title={operator.active ? `Suspender el acceso de ${operator.display_name}` : `Reactivar el acceso de ${operator.display_name}`}>{operator.active ? 'Suspender' : 'Reactivar'}</button>{operator.can_resend_invitation && <button type="button" onClick={() => resendInvitation(operator)} disabled={saving} title={`Reenviar el correo de invitación a ${operator.email}`}>Reenviar invitación</button>}</div></td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </div>
  )
}
