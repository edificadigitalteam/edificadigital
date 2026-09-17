import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useToast } from '../notifications/ToastProvider.jsx'
import {
  DEFAULT_MEMBERS_MODULE_LABEL,
  catalogLabel,
  categoryFitsMemberType,
  filterMembers,
  friendlyMemberError,
  resolveMembersModuleLabel,
  validateMember,
} from './members.js'
import './members.css'
import '../dashboard/operations.css'

const memberTypeLabels = { person: 'Persona', organization: 'Organización' }
const statusLabels = { active: 'Activo', inactive: 'Inactivo' }

const emptyForm = {
  id: '', member_type: 'organization', member_category_id: '', name: '',
  email: '', phone: '', notes: '', status: 'active',
}

const emptyRelationship = { related_member_id: '', relationship_role_id: '' }

export default function MembersPanel({ access }) {
  const { notify } = useToast()
  const organizationId = access.organizationId || ''
  const canManage = access.role === 'admin' || access.role === 'super_admin'

  const [organization, setOrganization] = useState(null)
  const [members, setMembers] = useState([])
  const [categories, setCategories] = useState([])
  const [roles, setRoles] = useState([])
  const [relationships, setRelationships] = useState([])
  const [form, setForm] = useState({ ...emptyForm })
  const [formOpen, setFormOpen] = useState(false)
  const [relationshipDraft, setRelationshipDraft] = useState({ ...emptyRelationship })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [labelDraft, setLabelDraft] = useState('')
  const [labelOpen, setLabelOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')

  const moduleLabel = resolveMembersModuleLabel(organization)

  const load = useCallback(async () => {
    if (!supabase || !organizationId) { setMembers([]); setLoading(false); return }
    setLoading(true); setError('')
    const responses = await Promise.all([
      supabase.from('organization').select('id, name, members_module_label').eq('id', organizationId).single(),
      supabase.from('organization_member').select('*').eq('organization_id', organizationId).order('name'),
      supabase.from('organization_member_category').select('*').eq('organization_id', organizationId).order('sort_order').order('name_es'),
      supabase.from('organization_member_relationship_role').select('*').eq('organization_id', organizationId).order('sort_order').order('name_es'),
      supabase.from('organization_member_relationship').select('*').eq('organization_id', organizationId),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) { setError(friendlyMemberError(firstError)) } else {
      setOrganization(responses[0].data ?? null)
      setMembers(responses[1].data ?? [])
      setCategories(responses[2].data ?? [])
      setRoles(responses[3].data ?? [])
      setRelationships(responses[4].data ?? [])
      setLabelDraft(responses[0].data?.members_module_label ?? '')
    }
    setLoading(false)
  }, [organizationId])

  useEffect(() => { load() }, [load])

  const categoryById = useMemo(() => new Map(categories.map((entry) => [entry.id, entry])), [categories])
  const roleById = useMemo(() => new Map(roles.map((entry) => [entry.id, entry])), [roles])
  const memberById = useMemo(() => new Map(members.map((entry) => [entry.id, entry])), [members])

  const filtered = useMemo(
    () => filterMembers(members, { search, memberType: typeFilter, status: statusFilter, categoryId: categoryFilter }),
    [categoryFilter, members, search, statusFilter, typeFilter],
  )

  const availableCategories = useMemo(
    () => categories.filter((entry) => entry.active && categoryFitsMemberType(entry, form.member_type)),
    [categories, form.member_type],
  )
  const organizationMembers = useMemo(
    () => members.filter((entry) => entry.member_type === 'organization' && entry.id !== form.id),
    [members, form.id],
  )
  const formRelationships = useMemo(
    () => relationships.filter((entry) => entry.member_id === form.id),
    [relationships, form.id],
  )
  const relationshipCount = useCallback(
    (memberId) => relationships.filter((entry) => entry.member_id === memberId || entry.related_member_id === memberId).length,
    [relationships],
  )

  const startNew = () => {
    setForm({ ...emptyForm })
    setRelationshipDraft({ ...emptyRelationship })
    setFieldError(''); setError(''); setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const edit = (member) => {
    setForm({
      id: member.id, member_type: member.member_type, member_category_id: member.member_category_id ?? '',
      name: member.name, email: member.email ?? '', phone: member.phone ?? '',
      notes: member.notes ?? '', status: member.status,
    })
    setRelationshipDraft({ ...emptyRelationship })
    setFieldError(''); setError(''); setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancel = () => { setForm({ ...emptyForm }); setRelationshipDraft({ ...emptyRelationship }); setFieldError(''); setFormOpen(false) }

  const changeMemberType = (memberType) => setForm((current) => {
    const category = categoryById.get(current.member_category_id)
    const keepCategory = categoryFitsMemberType(category, memberType)
    return { ...current, member_type: memberType, member_category_id: keepCategory ? current.member_category_id : '' }
  })

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canManage || !organizationId) return
    const validationMessage = validateMember(form, categories)
    if (validationMessage) { setFieldError(validationMessage); return }
    setSaving(true); setFieldError(''); setError('')
    const payload = {
      organization_id: organizationId,
      member_type: form.member_type,
      member_category_id: form.member_category_id || null,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      updated_by: access.userId || null,
    }
    if (!form.id) payload.created_by = access.userId || null
    const request = form.id
      ? supabase.from('organization_member').update(payload).eq('id', form.id).select('id').single()
      : supabase.from('organization_member').insert(payload).select('id').single()
    const { data, error: requestError } = await request
    if (requestError) {
      const message = friendlyMemberError(requestError)
      setError(message); notify({ type: 'error', message }); setSaving(false); return
    }
    const successMessage = form.id ? 'Miembro actualizado correctamente.' : 'Miembro registrado correctamente.'
    notify({ type: 'success', message: successMessage })
    await load()
    // A new person member stays open so its relationships can be added right away.
    if (!form.id && form.member_type === 'person') setForm((current) => ({ ...current, id: data.id }))
    else { setForm({ ...emptyForm }); setFormOpen(false) }
    setSaving(false)
  }

  const addRelationship = async () => {
    if (!supabase || !canManage || !form.id) return
    if (!relationshipDraft.related_member_id || !relationshipDraft.relationship_role_id) {
      setFieldError('Elige la organización y el rol antes de agregar la relación.')
      return
    }
    setFieldError('')
    const { error: requestError } = await supabase.from('organization_member_relationship').insert({
      organization_id: organizationId,
      member_id: form.id,
      related_member_id: relationshipDraft.related_member_id,
      relationship_role_id: relationshipDraft.relationship_role_id,
      created_by: access.userId || null,
      updated_by: access.userId || null,
    })
    if (requestError) { notify({ type: 'error', message: friendlyMemberError(requestError) }); return }
    notify({ type: 'success', message: 'Relación agregada correctamente.' })
    setRelationshipDraft({ ...emptyRelationship })
    await load()
  }

  const removeRelationship = async (relationshipId) => {
    if (!supabase || !canManage) return
    const { error: requestError } = await supabase.from('organization_member_relationship').delete().eq('id', relationshipId)
    if (requestError) { notify({ type: 'error', message: friendlyMemberError(requestError) }); return }
    notify({ type: 'success', message: 'Relación eliminada correctamente.' })
    await load()
  }

  const saveLabel = async (event) => {
    event.preventDefault()
    if (!supabase || !canManage) return
    const { error: requestError } = await supabase.rpc('admin_set_members_module_label', {
      target_organization_id: organizationId,
      new_label: labelDraft,
    })
    if (requestError) { notify({ type: 'error', message: friendlyMemberError(requestError) }); return }
    notify({ type: 'success', message: 'Nombre del módulo actualizado.' })
    setLabelOpen(false)
    await load()
  }

  return (
    <div className="operations-page members-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">DIRECTORIO DE MIEMBROS</p>
          <h1>{moduleLabel}</h1>
          <p className="operations-intro">Registra las organizaciones y las personas afiliadas a tu organización, y vincula a cada persona con la organización donde ejerce un rol.</p>
        </div>
        <div className="operations-summary"><strong>{members.filter((member) => member.status === 'active').length}</strong><span>miembros activos</span></div>
      </header>

      {!organizationId && (
        <p className="operations-empty-note">Tu usuario necesita una organización asignada para usar el directorio de miembros.</p>
      )}

      {canManage && !formOpen && organizationId && (
        <section className="operations-card members-label-card">
          {labelOpen ? (
            <form className="members-label-form" onSubmit={saveLabel}>
              <label>
                <span>Nombre de este módulo en tu organización</span>
                <input value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} placeholder={DEFAULT_MEMBERS_MODULE_LABEL} maxLength={60} />
              </label>
              <p className="members-label-hint">Déjalo vacío para volver al nombre predeterminado.</p>
              <div className="members-label-actions">
                <button type="button" onClick={() => { setLabelDraft(organization?.members_module_label ?? ''); setLabelOpen(false) }} title="Cerrar sin guardar el nombre del módulo">Cancelar</button>
                <button className="edifica-primary-button" type="submit" title="Guardar el nombre de este módulo para toda la organización">Guardar nombre</button>
              </div>
            </form>
          ) : (
            <div className="members-label-summary">
              <div><strong>Nombre del módulo: <span data-no-translate>{moduleLabel}</span></strong><span>Cambia cómo se llama este módulo dentro de tu organización.</span></div>
              <button type="button" onClick={() => setLabelOpen(true)} title="Cambiar el nombre de este módulo en tu organización">Cambiar nombre</button>
            </div>
          )}
        </section>
      )}

      {formOpen && canManage && (
        <div className="module-form-portal">
          <div className="module-form-breadcrumb">
            <button type="button" onClick={cancel} title="Volver al listado">{moduleLabel}</button>
            <span>/</span>
            <strong>{form.id ? 'Editar' : 'Crear'}</strong>
          </div>

          <form onSubmit={save} key={form.id || 'new-member'}>
            <section className="operations-card member-form-section">
              <header className="member-form-section-header">
                <div><span>01</span><h2>Datos del miembro</h2></div>
                <p>Indica si el miembro es una persona o una organización y elige su categoría.</p>
              </header>
              <div className="operations-form">
                <label>
                  <span>Tipo de miembro *</span>
                  <select value={form.member_type} onChange={(event) => changeMemberType(event.target.value)}>
                    {Object.entries(memberTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Categoría</span>
                  <select value={form.member_category_id} onChange={(event) => setForm((current) => ({ ...current, member_category_id: event.target.value }))}>
                    <option value="">Sin categoría</option>
                    {availableCategories.map((category) => <option key={category.id} value={category.id}>{catalogLabel(category)}</option>)}
                  </select>
                </label>
                <label className="wide">
                  <span>Nombre *</span>
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label><span>Correo</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
                <label><span>Teléfono</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                <label>
                  <span>Estado</span>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="wide"><span>Observaciones</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                {fieldError && <p className="operations-feedback error wide">{fieldError}</p>}
              </div>
            </section>

            {form.member_type === 'person' && (
              <section className="operations-card member-form-section">
                <header className="member-form-section-header">
                  <div><span>02</span><h2>Relaciones con organizaciones</h2></div>
                  <p>Una persona puede ejercer varios roles a la vez, cada uno en una organización distinta.</p>
                </header>
                {!form.id ? (
                  <p className="edifica-empty">Guarda primero al miembro para agregar sus relaciones.</p>
                ) : (
                  <>
                    <div className="member-relationship-form">
                      <label>
                        <span>Organización</span>
                        <select value={relationshipDraft.related_member_id} onChange={(event) => setRelationshipDraft((current) => ({ ...current, related_member_id: event.target.value }))}>
                          <option value="">Seleccionar</option>
                          {organizationMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Rol</span>
                        <select value={relationshipDraft.relationship_role_id} onChange={(event) => setRelationshipDraft((current) => ({ ...current, relationship_role_id: event.target.value }))}>
                          <option value="">Seleccionar</option>
                          {roles.filter((role) => role.active).map((role) => <option key={role.id} value={role.id}>{catalogLabel(role)}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={addRelationship} title="Agregar esta relación entre la persona y la organización">Agregar relación</button>
                    </div>
                    {formRelationships.length === 0 ? (
                      <p className="edifica-empty">Esta persona todavía carece de relaciones registradas.</p>
                    ) : (
                      <ul className="member-relationship-list">
                        {formRelationships.map((relationship) => (
                          <li key={relationship.id}>
                            <div>
                              <strong data-no-translate>{memberById.get(relationship.related_member_id)?.name ?? 'Organización'}</strong>
                              <span>{catalogLabel(roleById.get(relationship.relationship_role_id))}</span>
                            </div>
                            <button type="button" onClick={() => removeRelationship(relationship.id)} title="Eliminar esta relación">Eliminar</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            )}

            {error && <p className="operations-feedback error">{error}</p>}
            <div className="compliance-form-actions member-form-actions">
              <button type="button" onClick={cancel} title="Cerrar este formulario sin guardar">{form.id ? 'Volver al listado' : 'Cancelar'}</button>
              <button className="edifica-primary-button" type="submit" disabled={saving} title={form.id ? 'Guardar los cambios de este miembro' : 'Registrar este miembro'}>
                {saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar miembro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!formOpen && (
        <>
          <section className="module-search-bar operations-card">
            <label><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo o teléfono" /></label>
            <label>
              <span>Tipo</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">Todos los tipos</option>
                {Object.entries(memberTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Categoría</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Todas las categorías</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{catalogLabel(category)}</option>)}
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setCategoryFilter('all') }} title="Limpiar la búsqueda y los filtros">Limpiar</button>
          </section>

          {error && <p className="operations-feedback error">{error}</p>}

          <section className="operations-card">
            <div className="module-list-heading">
              <div><p className="edifica-kicker">DIRECTORIO</p><h2>{moduleLabel}</h2></div>
              <div className="module-list-actions">
                <span>{filtered.length} registros</span>
                {canManage && <button type="button" onClick={startNew} disabled={!organizationId} title="Crear un nuevo miembro">＋ Nuevo miembro</button>}
              </div>
            </div>
            {loading ? <p className="edifica-empty">Cargando miembros…</p> : filtered.length === 0 ? (
              <p className="edifica-empty">Todavía faltan miembros que coincidan con los filtros.</p>
            ) : (
              <div className="edifica-table-wrap">
                <table className="operations-table members-table">
                  <thead>
                    <tr><th>Miembro</th><th>Categoría</th><th>Contacto</th><th>Relaciones</th><th>Estado</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((member) => (
                      <tr key={member.id}>
                        <td><strong data-no-translate>{member.name}</strong><span>{memberTypeLabels[member.member_type] ?? member.member_type}</span></td>
                        <td>{catalogLabel(categoryById.get(member.member_category_id)) || '—'}</td>
                        <td data-no-translate><span>{member.email || '—'}</span><span>{member.phone || '—'}</span></td>
                        <td>{relationshipCount(member.id)}</td>
                        <td><span className={`edifica-access-state ${member.status === 'active' ? 'active' : 'inactive'}`}>{statusLabels[member.status] ?? member.status}</span></td>
                        <td>
                          <div className="member-row-actions">
                            {canManage && <button type="button" onClick={() => edit(member)} title="Editar este miembro">Editar</button>}
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
