import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import OrganizationTree from './OrganizationTree.jsx'
import { buildLeaderPayload, normalizeLeaderEmail, validateUnitLeader } from './unitLeader.js'
import './management-structure.css'
import './unit-leader-layout.css'

const unitTypes = {
  directorate: 'Dirección', department: 'Departamento', ministry: 'Ministerio', committee: 'Comité', auxiliary: 'Unión / auxiliar',
  academy: 'Academia', foundation: 'Fundación', campus: 'Sede / campus', church_area: 'Área de iglesia', other: 'Otra unidad',
}
const teamRoles = { manager: 'Coordinador', operator: 'Operador', reviewer: 'Revisor', member: 'Miembro' }
const emptyTeamMember = () => ({ key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, display_name: '', email: '', unit_role: 'operator', operator_access_id: '' })
const emptyForm = () => ({ id: '', code: '', name: '', unit_type: 'directorate', parent_unit_id: '', description: '', sort_order: 0, active: true, leader: { display_name: '', email: '', operator_access_id: '', create_access: false }, members: [] })

function normalizeEmail(value) { return normalizeLeaderEmail(value) }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)) }

export default function ManagementStructurePage() {
  const access = useOperatorAccess()
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [organizations, setOrganizations] = useState([])
  const [units, setUnits] = useState([])
  const [memberships, setMemberships] = useState([])
  const [operators, setOperators] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'

  useEffect(() => { if (access.status === 'authorized' && !isSuperAdmin) setOrganizationId(access.organizationId || '') }, [access.organizationId, access.status, isSuperAdmin])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) { setOrganizations(access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : []); return }
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) { setError(requestError.message); return }
    const rows = data ?? []
    setOrganizations(rows)
    setOrganizationId((current) => current || rows.find((item) => item.code === 'cnbv')?.id || rows[0]?.id || '')
  }, [access.organizationId, access.organizationName, access.status, isSuperAdmin])

  const reload = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const [unitResponse, memberResponse, operatorResponse] = await Promise.all([
      supabase.from('organization_unit').select('*').eq('organization_id', organizationId).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id', organizationId),
      canAdmin ? supabase.rpc('admin_list_operator_access') : Promise.resolve({ data: [], error: null }),
    ])
    const firstError = unitResponse.error || memberResponse.error || operatorResponse.error
    if (firstError) setError(firstError.message)
    else {
      setUnits(unitResponse.data ?? [])
      setMemberships(memberResponse.data ?? [])
      setOperators((operatorResponse.data ?? []).filter((item) => item.organization_id === organizationId))
    }
    setLoading(false)
  }, [access.status, canAdmin, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const membershipsByUnit = useMemo(() => {
    const map = new Map()
    memberships.filter((item) => item.active).forEach((item) => {
      const rows = map.get(item.unit_id) ?? []
      rows.push(item); map.set(item.unit_id, rows)
    })
    return map
  }, [memberships])

  const operatorById = useMemo(() => new Map(operators.map((item) => [item.id, item])), [operators])
  const activeOperators = useMemo(() => operators.filter((item) => item.active), [operators])

  const reset = () => { setForm(emptyForm()); setOpen(false); setError('') }
  const startNew = () => { setForm(emptyForm()); setOpen(true); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const editUnit = (unit) => {
    const rows = membershipsByUnit.get(unit.id) ?? []
    const primary = rows.find((item) => item.is_primary) ?? rows.find((item) => item.unit_role === 'director')
    const primaryOperator = primary ? operatorById.get(primary.operator_access_id) : null
    const team = rows.filter((item) => item.id !== primary?.id).map((item) => {
      const operator = operatorById.get(item.operator_access_id)
      return { ...emptyTeamMember(), operator_access_id: operator?.id || '', display_name: operator?.display_name || '', email: operator?.email || '', unit_role: item.unit_role || 'operator' }
    })
    setForm({
      id: unit.id, code: unit.code, name: unit.name, unit_type: unit.unit_type, parent_unit_id: unit.parent_unit_id || '', description: unit.description || '', sort_order: unit.sort_order || 0, active: unit.active,
      leader: { operator_access_id: primaryOperator?.id || '', display_name: primaryOperator?.display_name || unit.manager_name || '', email: primaryOperator?.email || unit.manager_email || '', create_access: Boolean(primaryOperator) },
      members: team,
    })
    setOpen(true); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectLeader = (operatorId) => {
    const operator = operatorById.get(operatorId)
    setForm((current) => ({ ...current, leader: operator ? { operator_access_id: operator.id, display_name: operator.display_name || '', email: operator.email || '', create_access: true } : { ...current.leader, operator_access_id: '' } }))
  }

  const addMember = () => setForm((current) => ({ ...current, members: [...current.members, emptyTeamMember()] }))
  const updateMember = (key, field, value) => setForm((current) => ({ ...current, members: current.members.map((item) => item.key === key ? { ...item, [field]: value } : item) }))
  const selectMember = (key, operatorId) => {
    const operator = operatorById.get(operatorId)
    setForm((current) => ({ ...current, members: current.members.map((item) => item.key === key ? (operator ? { ...item, operator_access_id: operator.id, display_name: operator.display_name || '', email: operator.email || '' } : { ...item, operator_access_id: '', display_name: '', email: '' }) : item) }))
  }
  const removeMember = (key) => setForm((current) => ({ ...current, members: current.members.filter((item) => item.key !== key) }))

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || !canAdmin || saving) return
    if (!form.code.trim() || !form.name.trim()) { setError('Código y nombre de la unidad son obligatorios.'); return }
    const leaderError = validateUnitLeader(form.leader)
    if (leaderError) { setError(leaderError); return }
    const leaderEmail = normalizeEmail(form.leader.email)
    const cleanedMembers = form.members.filter((item) => item.display_name.trim() || item.email.trim()).map((item) => ({ display_name: item.display_name.trim(), email: normalizeEmail(item.email), unit_role: item.unit_role }))
    if (cleanedMembers.some((item) => !item.display_name || !validEmail(item.email))) { setError('Cada persona del equipo debe tener nombre y un correo válido.'); return }
    const emails = [leaderEmail, ...cleanedMembers.map((item) => item.email)].filter(Boolean)
    if (new Set(emails).size !== emails.length) { setError('Un mismo correo no puede aparecer dos veces dentro de la unidad.'); return }

    setSaving(true); setError(''); setMessage('')
    const { data, error: requestError } = await supabase.rpc('admin_save_organization_unit_v2', { payload: {
      id: form.id || null,
      organization_id: organizationId,
      parent_unit_id: form.parent_unit_id || null,
      code: form.code.trim(), name: form.name.trim(), unit_type: form.unit_type,
      description: form.description.trim() || null, sort_order: Number(form.sort_order || 0), active: form.active,
      leader: buildLeaderPayload(form.leader),
      members: cleanedMembers,
    } })
    if (requestError) setError(requestError.message)
    else {
      const invited = Array.isArray(data?.invited_emails) ? data.invited_emails : []
      setMessage(invited.length ? `Unidad guardada. Se enviaron ${invited.length} invitación${invited.length === 1 ? '' : 'es'} de acceso.` : 'Unidad y equipo actualizados.')
      setForm(emptyForm()); setOpen(false); await reload()
    }
    setSaving(false)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel management-structure-page">
      <div className="management-panel-heading"><div><p>ESTRUCTURA ORGANIZACIONAL</p><h1>Organigrama, responsables y equipos</h1><span>Cada unidad tiene una persona líder con acceso a Edifica y puede incorporar tantas personas de trabajo como necesite la organización.</span></div>{canAdmin && <button type="button" onClick={startNew}>＋ Nueva unidad</button>}</div>
      {isSuperAdmin && <section className="management-filter-row structure-org-filter"><label><span>Organización</span><select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setOpen(false) }}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>}
      {error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}

      {open && <form className="management-form-card structure-editor" onSubmit={save}>
        <div className="management-form-title"><div><small>{form.id ? 'EDITAR UNIDAD' : 'NUEVA UNIDAD'}</small><h2>{form.id ? form.name : 'Agregar al organigrama'}</h2><p>Los datos identifican a las personas dentro de la unidad. Solo quienes necesiten acceso a Edifica recibirán una invitación.</p></div><button type="button" onClick={reset}>Cerrar</button></div>
        <div className="management-form-grid">
          <label><span>Código *</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="DIPROM" required /></label>
          <label className="wide"><span>Nombre de la unidad *</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
          <label><span>Tipo de unidad</span><select value={form.unit_type} onChange={(event) => setForm((current) => ({ ...current, unit_type: event.target.value }))}>{Object.entries(unitTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Depende de</span><select value={form.parent_unit_id} onChange={(event) => setForm((current) => ({ ...current, parent_unit_id: event.target.value }))}><option value="">Nivel principal</option>{units.filter((unit) => unit.id !== form.id).map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
          <label><span>Orden dentro de la unidad superior</span><input type="number" min="1" value={form.sort_order || ''} placeholder="1" onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} /><small className="management-field-help">Ordena esta unidad junto a otras que dependan de la misma área.</small></label>
          <label className="management-check"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Unidad activa</span></label>
          <label className="wide"><span>Descripción</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
        </div>

        <section className="structure-people-section leader-section">
          <div className="structure-section-heading"><div><small>RESPONSABLE PRINCIPAL</small><h3>¿Quién lidera esta unidad?</h3><p>El nombre identifica a la persona responsable. Puedes guardar su correo como contacto y decidir por separado si necesita acceso a Edifica.</p></div></div>
          <label className="existing-user-select"><span>Seleccionar un usuario ya existente (opcional)</span><select value={form.leader.operator_access_id} onChange={(event) => selectLeader(event.target.value)}><option value="">Ingresar los datos de la persona responsable</option>{activeOperators.map((operator) => <option key={operator.id} value={operator.id}>{operator.display_name} · {operator.email}</option>)}</select></label>
          <div className="structure-person-grid"><label><span>Nombre y apellido *</span><input value={form.leader.display_name} onChange={(event) => setForm((current) => ({ ...current, leader: { ...current.leader, display_name: event.target.value, operator_access_id: '' } }))} required /></label><label><span>{form.leader.create_access ? 'Correo electrónico *' : 'Correo electrónico (opcional)'}</span><input type="email" value={form.leader.email} onChange={(event) => setForm((current) => ({ ...current, leader: { ...current.leader, email: event.target.value, operator_access_id: '' } }))} required={form.leader.create_access} aria-describedby="leader-email-help" /><small className="management-field-help" id="leader-email-help">{form.leader.create_access ? 'Necesario para enviar la invitación de acceso.' : 'Puedes conservarlo solo como dato de contacto.'}</small></label><div className="structure-fixed-role"><span>Rol en esta unidad</span><strong>Director / responsable</strong></div></div>
          <label className="structure-access-choice"><input type="checkbox" checked={form.leader.create_access} disabled={Boolean(form.leader.operator_access_id)} onChange={(event) => setForm((current) => ({ ...current, leader: { ...current.leader, create_access: event.target.checked } }))} /><span><strong>Crear o vincular acceso a Edifica</strong><small>{form.leader.operator_access_id ? 'Esta persona ya tiene un usuario y quedará vinculada a la unidad.' : 'Al activarlo, enviaremos una invitación al correo indicado.'}</small></span></label>
        </section>

        <section className="structure-people-section team-section">
          <div className="structure-section-heading"><div><small>EQUIPO DE TRABAJO</small><h3>¿Quiénes podrán trabajar dentro de esta unidad?</h3><p>Puedes agregar tantas personas como requiera la unidad. Cada una tendrá acceso según el plan contratado y quedará vinculada únicamente a esta organización.</p></div><button type="button" onClick={addMember}>＋ Agregar persona</button></div>
          {!form.members.length ? <p className="structure-empty-team">Todavía no has agregado colaboradores. El líder siempre queda vinculado automáticamente.</p> : <div className="structure-team-list">{form.members.map((member, index) => <article key={member.key}>
            <header><strong>Persona {index + 1}</strong><button type="button" onClick={() => removeMember(member.key)}>Eliminar</button></header>
            <label className="existing-user-select"><span>Usuario existente (opcional)</span><select value={member.operator_access_id} onChange={(event) => selectMember(member.key, event.target.value)}><option value="">Crear o identificar por correo</option>{activeOperators.filter((operator) => normalizeEmail(operator.email) !== normalizeEmail(form.leader.email)).map((operator) => <option key={operator.id} value={operator.id}>{operator.display_name} · {operator.email}</option>)}</select></label>
            <div className="structure-person-grid"><label><span>Nombre y apellido *</span><input value={member.display_name} onChange={(event) => { updateMember(member.key, 'display_name', event.target.value); updateMember(member.key, 'operator_access_id', '') }} required /></label><label><span>Correo electrónico *</span><input type="email" value={member.email} onChange={(event) => { updateMember(member.key, 'email', event.target.value); updateMember(member.key, 'operator_access_id', '') }} required /></label><label><span>Función en la unidad</span><select value={member.unit_role} onChange={(event) => updateMember(member.key, 'unit_role', event.target.value)}>{Object.entries(teamRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          </article>)}</div>}
        </section>

        <div className="management-form-actions"><button type="button" onClick={reset}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Guardando unidad y accesos…' : 'Guardar unidad y equipo'}</button></div>
      </form>}

      <section className="management-tree-card structure-tree"><div className="management-card-heading"><div><small>ORGANIGRAMA</small><h2>{units.length} unidades registradas</h2><p>Selecciona una unidad principal para mostrar u ocultar las áreas que dependen de ella.</p></div></div>{loading ? <p className="management-empty">Cargando estructura…</p> : !units.length ? <p className="management-empty">Todavía no existe una estructura organizacional.</p> : <OrganizationTree units={units} unitTypeLabels={unitTypes} canAdmin={canAdmin} onEdit={editUnit} renderPeople={(unit) => {
        const rows = membershipsByUnit.get(unit.id) ?? []
        const primary = rows.find((item) => item.is_primary) ?? rows.find((item) => item.unit_role === 'director')
        const leader = primary ? operatorById.get(primary.operator_access_id) : null
        return <><strong>{leader?.display_name || unit.manager_name || 'Responsable pendiente'}</strong><span>{leader?.email || unit.manager_email || 'Sin correo'} · {rows.length} usuario{rows.length === 1 ? '' : 's'} vinculado{rows.length === 1 ? '' : 's'}</span></>
      }} />}</section>
    </div>
  </ManagementStandaloneShell>
}
