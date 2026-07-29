import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const paymentMethods = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia bancaria',
  mobile_payment: 'Pago móvil',
  digital_wallet: 'Billetera digital',
  crypto: 'Criptoactivo',
  other: 'Otro',
}

const categoryLabels = {
  food: 'Alimentos',
  clothing: 'Ropa',
  hygiene: 'Higiene',
  medical: 'Medicinas e insumos médicos',
  household: 'Hogar',
  other: 'Otros',
}

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

export default function DonationEditModal({ donation, onClose, onSaved }) {
  const firstDetail = donation.details?.[0]
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState(() => ({
    project_id: donation.project_id ?? '',
    status: donation.status ?? 'received',
    received_at: toLocalDateTime(donation.received_at),
    notes: donation.notes ?? '',
    donor_name: donation.donor?.name ?? '',
    donor_email: donation.donor?.email ?? '',
    donor_phone: donation.donor?.phone ?? '',
    donor_country: donation.donor?.country ?? '',
    amount: firstDetail?.amount ?? '',
    currency: firstDetail?.currency ?? 'USD',
    payment_method: firstDetail?.monetary?.payment_method ?? 'bank_transfer',
    usd_base_amount: firstDetail?.monetary?.usd_base_amount ?? '',
    exchange_rate_to_usd: firstDetail?.monetary?.exchange_rate_to_usd ?? '1',
    exchange_rate_source: firstDetail?.monetary?.exchange_rate_source ?? '',
    exchange_rate_date: firstDetail?.monetary?.exchange_rate_date ?? '',
    sender_institution: firstDetail?.monetary?.sender_institution ?? '',
    receiver_account_label: firstDetail?.monetary?.receiver_account_label ?? '',
    transaction_reference: firstDetail?.monetary?.transaction_reference ?? '',
    transport_mode: donation.shipment?.transport_mode ?? 'sea',
    shipment_status: donation.shipment?.status ?? 'announced',
    shipment_scope: donation.shipment?.shipment_scope ?? 'international',
    origin_country: donation.shipment?.origin_country ?? '',
    origin_city: donation.shipment?.origin_city ?? '',
    destination_country: donation.shipment?.destination_country ?? 'Venezuela',
    destination_city: donation.shipment?.destination_city ?? '',
    container_number: donation.shipment?.container_number ?? '',
    tracking_number: donation.shipment?.tracking_number ?? '',
    departure_date: donation.shipment?.departure_date ?? '',
    estimated_arrival: donation.shipment?.estimated_arrival ?? '',
    actual_arrival: donation.shipment?.actual_arrival ?? '',
    category_codes: donation.shipment?.category_codes ?? [],
    contents_summary: donation.shipment?.contents_summary ?? firstDetail?.item_description ?? '',
    declared_package_count: donation.shipment?.declared_package_count ?? firstDetail?.quantity ?? '',
    package_unit_code: donation.shipment?.package_unit_code ?? 'lot',
    shipment_notes: donation.shipment?.notes ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isMonetary = donation.donation_type === 'monetary'
  const categories = useMemo(() => form.category_codes ?? [], [form.category_codes])

  useEffect(() => {
    if (!supabase) return
    let query = supabase.from('project').select('id, code, name').order('name')
    if (donation.organization_id) query = query.eq('organization_id', donation.organization_id)
    query.then(({ data }) => setProjects(data ?? []))
  }, [donation.organization_id])

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const toggleCategory = (category) => update('category_codes', categories.includes(category)
    ? categories.filter((item) => item !== category)
    : [...categories, category])

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving) return
    setSaving(true)
    setError('')

    const payload = {
      id: donation.id,
      project_id: form.project_id || null,
      status: form.status,
      received_at: form.received_at ? new Date(form.received_at).toISOString() : null,
      notes: form.notes,
      donor: {
        name: form.donor_name,
        email: form.donor_email,
        phone: form.donor_phone,
        country: form.donor_country,
      },
    }

    if (isMonetary) {
      payload.monetary = {
        amount: form.amount,
        currency: form.currency,
        payment_method: form.payment_method,
        usd_base_amount: form.usd_base_amount,
        exchange_rate_to_usd: form.exchange_rate_to_usd,
        exchange_rate_source: form.exchange_rate_source,
        exchange_rate_date: form.exchange_rate_date,
        sender_institution: form.sender_institution,
        receiver_account_label: form.receiver_account_label,
        transaction_reference: form.transaction_reference,
      }
    } else {
      payload.shipment = {
        transport_mode: form.transport_mode,
        status: form.shipment_status,
        shipment_scope: form.shipment_scope,
        origin_country: form.origin_country,
        origin_city: form.origin_city,
        destination_country: form.destination_country,
        destination_city: form.destination_city,
        container_number: form.container_number,
        tracking_number: form.tracking_number,
        departure_date: form.departure_date,
        estimated_arrival: form.estimated_arrival,
        actual_arrival: form.actual_arrival,
        category_codes: form.category_codes,
        contents_summary: form.contents_summary,
        declared_package_count: form.declared_package_count,
        package_unit_code: form.package_unit_code,
        notes: form.shipment_notes,
      }
    }

    const { error: requestError } = await supabase.rpc('update_donation_record', { payload })
    if (requestError) setError(requestError.message)
    else await onSaved()
    setSaving(false)
  }

  return (
    <div className="edifica-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="edifica-modal edifica-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-donation-title">
        <header className="edifica-modal-header">
          <div><p className="edifica-kicker">EDITAR REGISTRO</p><h2 id="edit-donation-title">{donation.reference_code ?? 'Donación'}</h2></div>
          <button className="edifica-modal-close" type="button" onClick={onClose} aria-label="Cerrar edición" title="Cerrar edición">×</button>
        </header>

        <form className="edifica-edit-form" onSubmit={save}>
          <section><h3>Información general</h3><div className="edifica-edit-grid">
            <label className="wide"><span>Proyecto relacionado</span><select value={form.project_id} onChange={(event) => update('project_id', event.target.value)}><option value="">Sin proyecto específico</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
            <label><span>Estado</span><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="draft">Borrador</option><option value="announced">Anunciada</option><option value="received">Recibida</option><option value="verified">Verificada</option><option value="closed">Cerrada</option></select></label>
            <label><span>Fecha de recepción</span><input type="datetime-local" value={form.received_at} onChange={(event) => update('received_at', event.target.value)} /></label>
            <label className="wide"><span>Observaciones</span><textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          </div></section>

          <section><h3>Donante</h3><div className="edifica-edit-grid">
            <label className="wide"><span>Nombre</span><input value={form.donor_name} onChange={(event) => update('donor_name', event.target.value)} required /></label>
            <label><span>Correo</span><input type="email" value={form.donor_email} onChange={(event) => update('donor_email', event.target.value)} /></label>
            <label><span>Teléfono</span><input value={form.donor_phone} onChange={(event) => update('donor_phone', event.target.value)} /></label>
            <label><span>País</span><input value={form.donor_country} onChange={(event) => update('donor_country', event.target.value)} /></label>
          </div></section>

          {isMonetary ? <section><h3>Información monetaria</h3><div className="edifica-edit-grid">
            <label><span>Monto recibido</span><input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} required /></label>
            <label><span>Moneda</span><select value={form.currency} onChange={(event) => update('currency', event.target.value)}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
            <label><span>Método</span><select value={form.payment_method} onChange={(event) => update('payment_method', event.target.value)}>{Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Base USD</span><input type="number" min="0" step="0.01" value={form.usd_base_amount} onChange={(event) => update('usd_base_amount', event.target.value)} required /></label>
            <label><span>Tasa hacia USD</span><input type="number" min="0" step="0.0000000001" value={form.exchange_rate_to_usd} onChange={(event) => update('exchange_rate_to_usd', event.target.value)} required /></label>
            <label><span>Fecha de tasa</span><input type="date" value={form.exchange_rate_date} onChange={(event) => update('exchange_rate_date', event.target.value)} /></label>
            <label className="wide"><span>Fuente de tasa</span><input value={form.exchange_rate_source} onChange={(event) => update('exchange_rate_source', event.target.value)} /></label>
            <label><span>Institución emisora</span><input value={form.sender_institution} onChange={(event) => update('sender_institution', event.target.value)} /></label>
            <label><span>Cuenta receptora</span><input value={form.receiver_account_label} onChange={(event) => update('receiver_account_label', event.target.value)} /></label>
            <label className="wide"><span>Referencia de transacción</span><input value={form.transaction_reference} onChange={(event) => update('transaction_reference', event.target.value)} /></label>
          </div></section> : <section><h3>Resumen del envío</h3><div className="edifica-edit-grid">
            <label><span>Alcance</span><select value={form.shipment_scope} onChange={(event) => update('shipment_scope', event.target.value)}><option value="international">Internacional</option><option value="national">Nacional</option></select></label>
            <label><span>Transporte</span><select value={form.transport_mode} onChange={(event) => update('transport_mode', event.target.value)}><option value="sea">Marítimo</option><option value="air">Aéreo</option></select></label>
            <label><span>Estado del envío</span><select value={form.shipment_status} onChange={(event) => update('shipment_status', event.target.value)}><option value="announced">Anunciado</option><option value="in_transit">En tránsito</option><option value="customs">Aduana</option><option value="received">Recibido</option><option value="closed">Cerrado</option></select></label>
            <label><span>País de origen</span><input value={form.origin_country} onChange={(event) => update('origin_country', event.target.value)} required /></label>
            <label><span>Ciudad de origen</span><input value={form.origin_city} onChange={(event) => update('origin_city', event.target.value)} /></label>
            <label><span>Destino</span><input value={form.destination_city} onChange={(event) => update('destination_city', event.target.value)} /></label>
            <label><span>Contenedor</span><input value={form.container_number} onChange={(event) => update('container_number', event.target.value)} /></label>
            <label><span>Seguimiento</span><input value={form.tracking_number} onChange={(event) => update('tracking_number', event.target.value)} /></label>
            <label><span>Salida</span><input type="date" value={form.departure_date} onChange={(event) => update('departure_date', event.target.value)} /></label>
            <label><span>Llegada estimada</span><input type="date" value={form.estimated_arrival} onChange={(event) => update('estimated_arrival', event.target.value)} /></label>
            <label><span>Llegada real</span><input type="date" value={form.actual_arrival} onChange={(event) => update('actual_arrival', event.target.value)} /></label>
            <label><span>Cantidad de bultos</span><input type="number" min="0" step="0.001" value={form.declared_package_count} onChange={(event) => update('declared_package_count', event.target.value)} /></label>
            <label><span>Unidad</span><select value={form.package_unit_code} onChange={(event) => update('package_unit_code', event.target.value)}><option value="lot">Lote</option><option value="box">Cajas</option><option value="pallet">Paletas</option><option value="bag">Sacos</option><option value="unit">Unidades</option></select></label>
            <div className="wide edifica-edit-categories"><span>Categorías</span>{Object.entries(categoryLabels).map(([value, label]) => <label key={value}><input type="checkbox" checked={categories.includes(value)} onChange={() => toggleCategory(value)} />{label}</label>)}</div>
            <label className="wide"><span>Resumen del contenido</span><textarea value={form.contents_summary} onChange={(event) => update('contents_summary', event.target.value)} /></label>
            <label className="wide"><span>Notas del envío</span><textarea value={form.shipment_notes} onChange={(event) => update('shipment_notes', event.target.value)} /></label>
          </div></section>}

          {error && <p className="operations-feedback error">{error}</p>}
          <div className="edifica-edit-actions"><button type="button" onClick={onClose} title="Cerrar sin guardar">Cancelar</button><button className="edifica-primary-button" type="submit" disabled={saving} title="Guardar los cambios de esta donación">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </form>
      </section>
    </div>
  )
}
