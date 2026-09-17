import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useToast } from '../notifications/ToastProvider.jsx'
import { friendlyMemberError } from '../members/members.js'
import {
  isModuleLabelOverridden,
  moduleLabelColumns,
  renameableModules,
  resolveModuleLabel,
  validateModuleLabel,
} from './moduleLabels.js'
import '../dashboard/operations.css'

// Renaming a module used to live inside the module itself. It belongs here
// instead: it is configuration a tenant sets once, not part of the daily work
// of the directory, and it is the same action for every module.
export default function ModuleLabelsPanel({ access }) {
  const { notify } = useToast()
  const organizationId = access.organizationId || ''
  const canManage = access.role === 'admin' || access.role === 'super_admin'
  const [organization, setOrganization] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [editingKey, setEditingKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !organizationId) { setOrganization(null); setLoading(false); return }
    setLoading(true); setError('')
    const { data, error: requestError } = await supabase
      .from('organization')
      .select(moduleLabelColumns())
      .eq('id', organizationId)
      .single()
    if (requestError) setError(friendlyMemberError(requestError))
    else {
      setOrganization(data ?? null)
      setDrafts(Object.fromEntries(renameableModules.map((module) => [module.key, data?.[module.column] ?? ''])))
    }
    setLoading(false)
  }, [organizationId])

  useEffect(() => { load() }, [load])

  const startEdit = (module) => {
    setDrafts((current) => ({ ...current, [module.key]: organization?.[module.column] ?? '' }))
    setFieldError(''); setEditingKey(module.key)
  }
  const cancel = () => { setFieldError(''); setEditingKey('') }

  const save = async (module, event) => {
    event.preventDefault()
    if (!supabase || saving || !canManage) return
    const draft = drafts[module.key] ?? ''
    const validationMessage = validateModuleLabel(draft)
    if (validationMessage) { setFieldError(validationMessage); return }
    setSaving(true); setFieldError('')
    const { error: requestError } = await supabase.rpc(module.rpc, {
      target_organization_id: organizationId,
      new_label: draft,
    })
    if (requestError) {
      notify({ type: 'error', message: friendlyMemberError(requestError) }); setSaving(false); return
    }
    notify({ type: 'success', message: 'Nombre del módulo actualizado.' })
    setEditingKey(''); await load(); setSaving(false)
  }

  return (
    <div className="operations-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">MANTENEDORES</p>
          <h1>Nombres de los módulos</h1>
          <p className="operations-intro">Cambia cómo se llama cada módulo dentro de tu organización. El nombre que elijas reemplaza al predeterminado en el menú y en las pantallas del módulo.</p>
        </div>
        <div className="operations-summary"><strong>{renameableModules.length}</strong><span>módulos configurables</span></div>
      </header>

      {!organizationId && (
        <p className="operations-empty-note">Tu usuario necesita una organización asignada para configurar este mantenedor.</p>
      )}

      {error && <p className="operations-feedback error">{error}</p>}

      <section className="operations-card">
        <div className="module-list-heading">
          <div><p className="edifica-kicker">MANTENEDOR</p><h2>Nombres de los módulos</h2></div>
        </div>
        {loading ? <p className="edifica-empty">Cargando módulos…</p> : (
          <div className="edifica-table-wrap">
            <table className="operations-table">
              <thead>
                <tr><th>Módulo</th><th>Nombre en tu organización</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {renameableModules.map((module) => (
                  <tr key={module.key}>
                    <td><strong>{module.defaultLabel}</strong><span>{module.description}</span></td>
                    <td>
                      {editingKey === module.key ? (
                        <form className="module-label-form" onSubmit={(event) => save(module, event)}>
                          <input
                            value={drafts[module.key] ?? ''}
                            onChange={(event) => setDrafts((current) => ({ ...current, [module.key]: event.target.value }))}
                            placeholder={module.defaultLabel}
                            maxLength={60}
                            aria-label="Nombre del módulo en tu organización"
                          />
                          <button type="submit" disabled={saving} title="Guardar el nombre de este módulo para toda la organización">Guardar</button>
                          <button type="button" onClick={cancel} title="Cerrar sin guardar el nombre del módulo">Cancelar</button>
                        </form>
                      ) : (
                        <>
                          <strong data-no-translate>{resolveModuleLabel(module, organization)}</strong>
                          {!isModuleLabelOverridden(module, organization) && <span>Nombre predeterminado</span>}
                        </>
                      )}
                      {editingKey === module.key && fieldError && <p className="operations-feedback error">{fieldError}</p>}
                      {editingKey === module.key && <p className="module-label-hint">Déjalo vacío para volver al nombre predeterminado.</p>}
                    </td>
                    <td>
                      {canManage && editingKey !== module.key && (
                        <button type="button" onClick={() => startEdit(module)} disabled={!organizationId} title="Cambiar el nombre de este módulo en tu organización">Cambiar nombre</button>
                      )}
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
