import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './operator-admin.css'

const emptyForm = {
  id: '',
  display_name: '',
  email: '',
  role: 'operator',
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
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isSuperAdmin = access.role === 'super_admin'
  const activeCount = useMemo(() => operators.filter((operator) => operator.active).length, [operators])

  const loadOperators = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('admin_list_operator_access')
    if (requestError) {
      setOperators([])
      setError(requestError.message)
    } else {
      setOperators(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadOperators()
  }, [loadOperators])

  const resetForm = () => {
    setForm(emptyForm)
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
      active: operator.active,
    })
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
        active: form.active,
      },
    })

    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(form.id ? 'Acceso actualizado correctamente.' : 'Persona habilitada correctamente.')
      setForm(emptyForm)
      await loadOperators()
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
        active: !operator.active,
      },
    })

    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(operator.active ? 'Acceso suspendido.' : 'Acceso reactivado.')
      await loadOperators()
    }
    setSaving(false)
  }

  return (
    <div className="edifica-admin-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">ADMINISTRACIÓN</p>
          <h1>Personas habilitadas</h1>
          <p className="edifica-admin-intro">Agrega usuarios, asigna su nivel de acceso y administra su estado dentro de Edifica.</p>
        </div>
        <div className="edifica-admin-summary">
          <strong>{activeCount}</strong>
          <span>accesos activos</span>
        </div>
      </header>

      <section className="edifica-admin-form-card">
        <div className="edifica-admin-card-heading">
          <div>
            <p className="edifica-kicker">{form.id ? 'EDITAR ACCESO' : 'NUEVO ACCESO'}</p>
            <h2>{form.id ? 'Actualizar persona' : 'Habilitar una persona'}</h2>
          </div>
          {form.id && <button type="button" onClick={resetForm}>Cancelar edición</button>}
        </div>

        <form className="edifica-admin-form" onSubmit={saveOperator}>
          <label>
            <span>Nombre</span>
            <input
              type="text"
              value={form.display_name}
              onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
              placeholder="Nombre y apellido"
              required
            />
          </label>
          <label>
            <span>Correo electrónico</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="persona@organizacion.org"
              required
            />
          </label>
          <label>
            <span>Rol</span>
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              disabled={!isSuperAdmin}
            >
              <option value="operator">Operador</option>
              {isSuperAdmin && <option value="admin">Administrador</option>}
              {isSuperAdmin && <option value="super_admin">Superadministrador</option>}
            </select>
          </label>
          <label className="edifica-admin-checkbox">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
            <span>Acceso activo</span>
          </label>
          <button className="edifica-primary-button" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Habilitar persona'}
          </button>
        </form>

        {message && <p className="edifica-admin-feedback success">{message}</p>}
        {error && <p className="edifica-admin-feedback error">{error}</p>}
      </section>

      <section className="edifica-admin-list-card">
        <div className="edifica-section-heading">
          <div><p className="edifica-kicker">DIRECTORIO</p><h2>Usuarios del sistema</h2></div>
          <span>{operators.length} personas</span>
        </div>

        {loading ? (
          <p className="edifica-empty">Cargando personas habilitadas…</p>
        ) : operators.length === 0 ? (
          <p className="edifica-empty">Todavía no existen personas habilitadas.</p>
        ) : (
          <div className="edifica-table-wrap">
            <table className="edifica-admin-table">
              <thead>
                <tr><th>Persona</th><th>Rol</th><th>Estado</th><th>Actualizado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id}>
                    <td><strong>{operator.display_name}</strong><span>{operator.email}</span></td>
                    <td>{roleLabels[operator.role] ?? operator.role}</td>
                    <td><span className={`edifica-access-state ${operator.active ? 'active' : 'inactive'}`}>{operator.active ? 'Activo' : 'Suspendido'}</span></td>
                    <td>{formatDate(operator.updated_at)}</td>
                    <td>
                      <div className="edifica-admin-row-actions">
                        <button type="button" onClick={() => editOperator(operator)} disabled={!operator.can_edit || saving}>Editar</button>
                        <button type="button" onClick={() => toggleOperator(operator)} disabled={!operator.can_edit || saving}>
                          {operator.active ? 'Suspender' : 'Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
