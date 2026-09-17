import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useToast } from '../notifications/ToastProvider.jsx'
import { friendlyMemberError, slugifyCatalogCode, validateCatalogEntry } from './members.js'
import './members.css'
import '../dashboard/operations.css'

const appliesToLabels = {
  person: 'Personas',
  organization: 'Organizaciones',
  both: 'Personas y organizaciones',
}

const emptyEntry = { id: '', code: '', name_es: '', name_en: '', applies_to: 'both', sort_order: 0, active: true }

// Both Mantenedores catalogs — member categories and relationship roles — are the
// same shape: a bilingual name, an order, and an active flag. The category catalog
// adds the applies_to field, which is the only difference between the two screens.
export default function MemberCatalogPanel({ access, table, kicker, title, description, itemLabel, createLabel, withAppliesTo = false }) {
  const { notify } = useToast()
  const organizationId = access.organizationId || ''
  const canManage = access.role === 'admin' || access.role === 'super_admin'
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({ ...emptyEntry })
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !organizationId) { setEntries([]); setLoading(false); return }
    setLoading(true); setError('')
    const { data, error: requestError } = await supabase
      .from(table)
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order')
      .order('name_es')
    if (requestError) { setEntries([]); setError(friendlyMemberError(requestError)) } else setEntries(data ?? [])
    setLoading(false)
  }, [organizationId, table])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesSearch = !query || [entry.name_es, entry.name_en, entry.code]
        .filter(Boolean).some((value) => value.toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? entry.active : !entry.active)
      return matchesSearch && matchesStatus
    })
  }, [entries, search, statusFilter])

  const startNew = () => {
    setForm({ ...emptyEntry, sort_order: (entries.at(-1)?.sort_order ?? 0) + 10 })
    setFieldError(''); setError(''); setFormOpen(true)
  }
  const edit = (entry) => {
    setForm({
      id: entry.id, code: entry.code, name_es: entry.name_es, name_en: entry.name_en,
      applies_to: entry.applies_to ?? 'both', sort_order: entry.sort_order, active: entry.active,
    })
    setFieldError(''); setError(''); setFormOpen(true)
  }
  const cancel = () => { setForm({ ...emptyEntry }); setFieldError(''); setFormOpen(false) }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canManage || !organizationId) return
    const validationMessage = validateCatalogEntry(form, { requireAppliesTo: withAppliesTo })
    if (validationMessage) { setFieldError(validationMessage); return }
    setSaving(true); setFieldError(''); setError('')
    const payload = {
      organization_id: organizationId,
      code: form.code.trim() || slugifyCatalogCode(form.name_es),
      name_es: form.name_es.trim(),
      name_en: form.name_en.trim(),
      sort_order: Number(form.sort_order) || 0,
      active: Boolean(form.active),
      updated_by: access.userId || null,
    }
    if (withAppliesTo) payload.applies_to = form.applies_to
    if (!form.id) payload.created_by = access.userId || null
    const request = form.id
      ? supabase.from(table).update(payload).eq('id', form.id).select('id').single()
      : supabase.from(table).insert(payload).select('id').single()
    const { error: requestError } = await request
    if (requestError) {
      const message = friendlyMemberError(requestError)
      setError(message); notify({ type: 'error', message }); setSaving(false); return
    }
    const successMessage = form.id ? `${itemLabel} actualizado correctamente.` : `${itemLabel} creado correctamente.`
    notify({ type: 'success', message: successMessage })
    setForm({ ...emptyEntry }); setFormOpen(false); await load(); setSaving(false)
  }

  const toggleActive = async (entry) => {
    if (!supabase || !canManage) return
    const { error: requestError } = await supabase
      .from(table)
      .update({ active: !entry.active, updated_by: access.userId || null })
      .eq('id', entry.id)
    if (requestError) { notify({ type: 'error', message: friendlyMemberError(requestError) }); return }
    notify({ type: 'success', message: entry.active ? `${itemLabel} desactivado.` : `${itemLabel} activado.` })
    await load()
  }

  return (
    <div className="operations-page member-catalog-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">{kicker}</p>
          <h1>{title}</h1>
          <p className="operations-intro">{description}</p>
        </div>
        <div className="operations-summary"><strong>{entries.filter((entry) => entry.active).length}</strong><span>valores activos</span></div>
      </header>

      {!organizationId && (
        <p className="operations-empty-note">Tu usuario necesita una organización asignada para configurar este mantenedor.</p>
      )}

      {formOpen && canManage && (
        <div className="module-form-portal">
          <div className="module-form-breadcrumb">
            <button type="button" onClick={cancel} title={`Volver al listado de ${title.toLowerCase()}`}>{title}</button>
            <span>/</span>
            <strong>{form.id ? 'Editar' : 'Crear'}</strong>
          </div>
          <section className="operations-card member-catalog-form">
            <form className="operations-form" onSubmit={save}>
              <label className="wide">
                <span>Nombre en español *</span>
                <input value={form.name_es} onChange={(event) => setForm((current) => ({ ...current, name_es: event.target.value }))} required />
              </label>
              <label className="wide">
                <span>Nombre en inglés *</span>
                <input value={form.name_en} onChange={(event) => setForm((current) => ({ ...current, name_en: event.target.value }))} required />
              </label>
              {withAppliesTo && (
                <label>
                  <span>Aplica a *</span>
                  <select value={form.applies_to} onChange={(event) => setForm((current) => ({ ...current, applies_to: event.target.value }))}>
                    {Object.entries(appliesToLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span>Orden en la lista</span>
                <input type="number" min="0" step="10" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} />
              </label>
              <label className="operations-checkbox">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                <span>Valor activo</span>
              </label>
              {fieldError && <p className="operations-feedback error wide">{fieldError}</p>}
              <div className="compliance-form-actions">
                <button type="button" onClick={cancel} title="Cerrar este formulario sin guardar">Cancelar</button>
                <button className="edifica-primary-button" type="submit" disabled={saving} title={form.id ? `Guardar los cambios de este ${itemLabel.toLowerCase()}` : `Crear este ${itemLabel.toLowerCase()}`}>
                  {saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear y guardar'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {!formOpen && (
        <>
          <section className="module-search-bar operations-card">
            <label><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre en español, en inglés o código" /></label>
            <label>
              <span>Estado</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>
            <button type="button" onClick={() => { setSearch(''); setStatusFilter('all') }} title="Limpiar la búsqueda y los filtros">Limpiar</button>
          </section>

          {error && <p className="operations-feedback error">{error}</p>}

          <section className="operations-card">
            <div className="module-list-heading">
              <div><p className="edifica-kicker">MANTENEDOR</p><h2>{title}</h2></div>
              <div className="module-list-actions">
                <span>{filtered.length} valores</span>
                {canManage && <button type="button" onClick={startNew} disabled={!organizationId} title={`Crear un nuevo ${itemLabel.toLowerCase()}`}>＋ {createLabel}</button>}
              </div>
            </div>
            {loading ? <p className="edifica-empty">Cargando valores…</p> : filtered.length === 0 ? (
              <p className="edifica-empty">Todavía faltan valores por registrar en este mantenedor.</p>
            ) : (
              <div className="edifica-table-wrap">
                <table className="operations-table member-catalog-table">
                  <thead>
                    <tr>
                      <th>Español</th>
                      <th>Inglés</th>
                      {withAppliesTo && <th>Aplica a</th>}
                      <th>Orden</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry) => (
                      <tr key={entry.id}>
                        <td><strong>{entry.name_es}</strong><span>{entry.code}</span></td>
                        <td>{entry.name_en}</td>
                        {withAppliesTo && <td>{appliesToLabels[entry.applies_to] ?? entry.applies_to}</td>}
                        <td>{entry.sort_order}</td>
                        <td><span className={`edifica-access-state ${entry.active ? 'active' : 'inactive'}`}>{entry.active ? 'Activo' : 'Inactivo'}</span></td>
                        <td>
                          <div className="member-row-actions">
                            {canManage && <button type="button" onClick={() => edit(entry)} title={`Editar ${entry.name_es}`}>Editar</button>}
                            {canManage && (
                              <button type="button" onClick={() => toggleActive(entry)} title={entry.active ? `Desactivar ${entry.name_es} sin borrar los registros que lo usan` : `Volver a activar ${entry.name_es}`}>
                                {entry.active ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
