import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './beneficiaries.css'

const emptyForm = {
  id: '',
  full_name: '',
  identification_number: '',
  email: '',
  phone: '',
  residence_country: '',
  residence_area: '',
  age_band: 'unknown',
  sex: 'unknown',
  benefit_received: '',
  household_members_represented: '1',
  notes: '',
  active: true,
  privacy_notice_acknowledged: false,
}

const ageLabels = {
  '0_5': '0 a 5 años',
  '6_12': '6 a 12 años',
  '13_17': '13 a 17 años',
  '18_59': '18 a 59 años',
  '60_plus': '60 años o más',
  unknown: 'Sin especificar',
}

const sexLabels = {
  female: 'Femenino',
  male: 'Masculino',
  intersex: 'Intersexual',
  prefer_not_to_say: 'Prefiere no indicar',
  unknown: 'Sin especificar',
}

export default function ProjectBeneficiariesPanel({ project, onChanged }) {
  const [beneficiaries, setBeneficiaries] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeCount = useMemo(
    () => beneficiaries.filter((beneficiary) => beneficiary.active).length,
    [beneficiaries],
  )

  const load = useCallback(async () => {
    if (!supabase || !project?.id) return
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('list_project_beneficiaries', {
      target_project_id: project.id,
    })
    if (requestError) {
      setBeneficiaries([])
      setError(requestError.message)
    } else {
      setBeneficiaries(data ?? [])
    }
    setLoading(false)
  }, [project?.id])

  useEffect(() => { load() }, [load])

  const reset = () => {
    setForm(emptyForm)
    setError('')
    setMessage('')
  }

  const edit = (beneficiary) => {
    setForm({
      id: beneficiary.id,
      full_name: beneficiary.full_name,
      identification_number: beneficiary.identification_number ?? '',
      email: beneficiary.email ?? '',
      phone: beneficiary.phone ?? '',
      residence_country: beneficiary.residence_country ?? '',
      residence_area: beneficiary.residence_area ?? '',
      age_band: beneficiary.age_band ?? 'unknown',
      sex: beneficiary.sex ?? 'unknown',
      benefit_received: beneficiary.benefit_received ?? '',
      household_members_represented: String(beneficiary.household_members_represented ?? 1),
      notes: beneficiary.notes ?? '',
      active: beneficiary.active,
      privacy_notice_acknowledged: true,
    })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !project?.id) return
    setSaving(true)
    setError('')
    setMessage('')

    const { error: requestError } = await supabase.rpc('save_project_beneficiary', {
      payload: {
        ...form,
        id: form.id || null,
        project_id: project.id,
        household_members_represented: Number(form.household_members_represented || 1),
      },
    })

    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(form.id ? 'Persona beneficiaria actualizada.' : 'Persona beneficiaria registrada.')
      setForm(emptyForm)
      await load()
      await onChanged?.()
    }
    setSaving(false)
  }

  return (
    <section className="operations-card beneficiary-registry no-print">
      <div className="edifica-section-heading">
        <div><p className="edifica-kicker">REGISTRO NOMINAL OPCIONAL</p><h2>Personas beneficiadas</h2></div>
        <span>{activeCount} activas</span>
      </div>
      <p className="beneficiary-intro">Este proyecto exige detalle individual. Registra únicamente los datos solicitados por el convenio y conserva la aceptación del aviso de privacidad.</p>

      <form className="operations-form beneficiary-form" onSubmit={save} key={form.id || 'new-beneficiary'}>
        <label className="wide"><span>Nombre completo *</span><input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} required /></label>
        <label><span>Documento o identificación</span><input value={form.identification_number} onChange={(event) => setForm((current) => ({ ...current, identification_number: event.target.value }))} /></label>
        <label><span>Teléfono</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
        <label><span>Correo electrónico</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
        <label><span>País</span><input value={form.residence_country} onChange={(event) => setForm((current) => ({ ...current, residence_country: event.target.value }))} /></label>
        <label><span>Ciudad, comunidad o zona</span><input value={form.residence_area} onChange={(event) => setForm((current) => ({ ...current, residence_area: event.target.value }))} /></label>
        <label><span>Rango de edad</span><select value={form.age_band} onChange={(event) => setForm((current) => ({ ...current, age_band: event.target.value }))}>{Object.entries(ageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Sexo</span><select value={form.sex} onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}>{Object.entries(sexLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Personas representadas</span><input type="number" min="1" step="1" value={form.household_members_represented} onChange={(event) => setForm((current) => ({ ...current, household_members_represented: event.target.value }))} /></label>
        <label className="wide"><span>Beneficio, servicio o entrega recibida</span><input value={form.benefit_received} onChange={(event) => setForm((current) => ({ ...current, benefit_received: event.target.value }))} placeholder="Ej.: kit de alimentos, consulta médica, hidratación" /></label>
        <label className="wide"><span>Observaciones</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
        <label className="operations-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><span>Registro activo</span></label>
        <label className="operations-checkbox wide"><input type="checkbox" checked={form.privacy_notice_acknowledged} onChange={(event) => setForm((current) => ({ ...current, privacy_notice_acknowledged: event.target.checked }))} required /><span>Confirmo que la persona fue informada sobre el uso y resguardo de sus datos.</span></label>
        <div className="compliance-form-actions"><button type="button" onClick={reset}>{form.id ? 'Cancelar edición' : 'Limpiar'}</button><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar persona'}</button></div>
      </form>

      {message && <p className="operations-feedback success">{message}</p>}
      {error && <p className="operations-feedback error">{error}</p>}

      {loading ? <p className="edifica-empty">Cargando personas beneficiadas…</p> : beneficiaries.length === 0 ? <p className="edifica-empty">Todavía no existen personas registradas para este proyecto.</p> : (
        <div className="edifica-table-wrap"><table className="operations-table beneficiary-table"><thead><tr><th>Persona</th><th>Contacto</th><th>Ubicación</th><th>Beneficio</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{beneficiaries.map((beneficiary) => (
          <tr key={beneficiary.id}><td><strong>{beneficiary.full_name}</strong><span>{beneficiary.identification_number || 'Sin identificación'}</span></td><td>{beneficiary.email || beneficiary.phone || '—'}</td><td>{[beneficiary.residence_area, beneficiary.residence_country].filter(Boolean).join(', ') || '—'}</td><td>{beneficiary.benefit_received || '—'}</td><td><span className={`edifica-access-state ${beneficiary.active ? 'active' : 'inactive'}`}>{beneficiary.active ? 'Activo' : 'Inactivo'}</span></td><td><button type="button" onClick={() => edit(beneficiary)}>Editar</button></td></tr>
        ))}</tbody></table></div>
      )}
    </section>
  )
}
