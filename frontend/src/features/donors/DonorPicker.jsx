import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useToast } from '../notifications/ToastProvider.jsx'
import './donors.css'

const copy = {
  es: {
    label: 'Aliado o donante',
    select: 'Buscar o seleccionar',
    create: '＋ Crear aliado o donante',
    type: 'Tipo',
    organization: 'Organización',
    person: 'Persona',
    anonymous: 'Anónimo',
    name: 'Nombre',
    email: 'Correo',
    phone: 'Teléfono',
    country: 'País',
    save: 'Guardar y seleccionar',
    cancel: 'Cancelar',
    loading: 'Cargando directorio…',
    required: 'Selecciona o crea un aliado o donante.',
    created: 'Aliado creado y seleccionado.',
    accessDenied: 'No tienes acceso para esta acción. Confirma tu correo o contacta al administrador.',
  },
  en: {
    label: 'Partner or donor',
    select: 'Search or select',
    create: '＋ Create partner or donor',
    type: 'Type',
    organization: 'Organization',
    person: 'Person',
    anonymous: 'Anonymous',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    country: 'Country',
    save: 'Save and select',
    cancel: 'Cancel',
    loading: 'Loading directory…',
    required: 'Select or create a partner or donor.',
    created: 'Partner created and selected.',
    accessDenied: 'You do not have access for this action. Confirm your email or contact your administrator.',
  },
}

const emptyQuickForm = {
  donor_type: 'organization',
  name: '',
  email: '',
  phone: '',
  country: '',
}

export default function DonorPicker({
  organizationId,
  value = '',
  onChange,
  language = 'es',
  label,
  required = false,
  allowCreate = true,
}) {
  const text = copy[language] ?? copy.es
  const { notify } = useToast()
  const [donors, setDonors] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quickForm, setQuickForm] = useState(emptyQuickForm)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !organizationId) {
      setDonors([])
      return
    }
    setLoading(true)
    const { data, error: requestError } = await supabase.rpc('list_donor_directory', {
      target_organization_id: organizationId,
    })
    if (requestError) {
      setError(requestError.message)
      setDonors([])
    } else {
      setError('')
      setDonors((data ?? []).filter((donor) => donor.active))
    }
    setLoading(false)
  }, [organizationId])

  useEffect(() => { load() }, [load])

  const selected = useMemo(() => donors.find((donor) => donor.id === value) ?? null, [donors, value])

  const choose = (event) => {
    const next = event.target.value
    if (next === '__create__') {
      setCreating(true)
      setQuickForm(emptyQuickForm)
      setError('')
      return
    }
    const donor = donors.find((item) => item.id === next) ?? null
    onChange?.(donor)
  }

  const saveQuick = async (event) => {
    event?.preventDefault()
    if (!supabase || !organizationId || saving) return
    const anonymous = quickForm.donor_type === 'anonymous'
    if (!anonymous && !quickForm.name.trim()) {
      setError(text.required)
      return
    }
    setSaving(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('save_donor_directory', {
      payload: {
        organization_id: organizationId,
        name: anonymous ? (language === 'en' ? 'Anonymous donor' : 'Donante anónimo') : quickForm.name.trim(),
        email: anonymous ? null : quickForm.email.trim() || null,
        phone: anonymous ? null : quickForm.phone.trim() || null,
        country: quickForm.country.trim() || null,
        is_organization: quickForm.donor_type === 'organization',
        is_anonymous: anonymous,
        active: true,
      },
    })
    if (requestError) {
      const friendlyMessage = requestError.code === '42501' ? text.accessDenied : requestError.message
      setError(friendlyMessage)
      notify({ type: 'error', message: friendlyMessage })
    } else {
      const saved = data
      setDonors((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)))
      onChange?.(saved)
      setCreating(false)
      setQuickForm(emptyQuickForm)
      notify({ type: 'success', message: text.created })
    }
    setSaving(false)
  }

  return (
    <div className="donor-picker">
      <label className="donor-picker-select">
        <span>{label || text.label}{required ? ' *' : ''}</span>
        <select value={selected?.id ?? ''} onChange={choose} required={required} disabled={!organizationId || loading}>
          <option value="">{loading ? text.loading : text.select}</option>
          {donors.map((donor) => (
            <option key={donor.id} value={donor.id}>
              {donor.name}{donor.is_anonymous ? ` · ${text.anonymous}` : donor.is_organization ? ` · ${text.organization}` : ` · ${text.person}`}
            </option>
          ))}
          {allowCreate && <option value="__create__">{text.create}</option>}
        </select>
      </label>

      {selected && (
        <div className="donor-picker-summary">
          <strong>{selected.name}</strong>
          <span>{[selected.email, selected.phone, selected.country].filter(Boolean).join(' · ') || (selected.is_anonymous ? text.anonymous : '—')}</span>
        </div>
      )}

      {creating && (
        // Rendered as a <div>, not a <form>: DonorPicker is itself always used
        // inside another form (monetary/in-kind/project), and browsers do not
        // fire submit events for a <form> nested inside another <form> --
        // clicking "save" silently did nothing. saveQuick is called directly
        // from the button's onClick instead of relying on form submission.
        <div className="donor-quick-form">
          <label><span>{text.type}</span><select value={quickForm.donor_type} onChange={(event) => setQuickForm((current) => ({ ...current, donor_type: event.target.value }))}><option value="organization">{text.organization}</option><option value="person">{text.person}</option><option value="anonymous">{text.anonymous}</option></select></label>
          {quickForm.donor_type !== 'anonymous' && <label className="wide"><span>{text.name} *</span><input value={quickForm.name} onChange={(event) => setQuickForm((current) => ({ ...current, name: event.target.value }))} /></label>}
          {quickForm.donor_type !== 'anonymous' && <><label><span>{text.email}</span><input type="email" value={quickForm.email} onChange={(event) => setQuickForm((current) => ({ ...current, email: event.target.value }))} /></label><label><span>{text.phone}</span><input value={quickForm.phone} onChange={(event) => setQuickForm((current) => ({ ...current, phone: event.target.value }))} /></label></>}
          <label><span>{text.country}</span><input value={quickForm.country} onChange={(event) => setQuickForm((current) => ({ ...current, country: event.target.value }))} /></label>
          {error && <p className="donor-picker-error wide">{error}</p>}
          <div className="donor-quick-actions wide"><button type="button" onClick={() => { setCreating(false); setError('') }} title={text.cancel}>{text.cancel}</button><button type="button" onClick={saveQuick} disabled={saving} title={text.save}>{saving ? '…' : text.save}</button></div>
        </div>
      )}

      {!creating && error && <p className="donor-picker-error">{error}</p>}
    </div>
  )
}
