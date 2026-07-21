import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './dashboard.css'

const typeLabels = {
  monetary: 'Monetaria',
  in_kind: 'En especies',
  mixed: 'Mixta',
}

const statusLabels = {
  draft: 'Borrador',
  announced: 'Anunciada',
  received: 'Recibida',
  verified: 'Verificada',
  closed: 'Cerrada',
}

const roleLabels = {
  operator: 'Operador',
  admin: 'Administrador',
  super_admin: 'Superadministrador',
}

const paymentMethodLabels = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia bancaria',
  mobile_payment: 'Pago móvil',
  digital_wallet: 'Billetera digital',
  crypto: 'Criptoactivo',
  other: 'Otro',
}

function LoginCard({ access }) {
  const [email, setEmail] = useState(access.email ?? '')
  const busy = access.status === 'loading' || access.status === 'sending_link'

  const submit = async (event) => {
    event.preventDefault()
    if (email.trim()) await access.requestMagicLink(email.trim().toLowerCase())
  }

  return (
    <main className="edifica-login-shell">
      <section className="edifica-login-card">
        <a className="edifica-wordmark" href="/">edifica<span>digital</span></a>
        <p className="edifica-kicker">ACCESO AL SISTEMA</p>
        <h1>Ingresa al panel de Edifica</h1>
        <p>Usa el correo habilitado por el administrador. Recibirás un enlace seguro para iniciar sesión.</p>

        {access.status === 'link_sent' ? (
          <div className="edifica-message success">
            Revisa tu correo. El enlace de acceso fue enviado a <strong>{access.email}</strong>.
          </div>
        ) : access.status === 'restricted' ? (
          <div className="edifica-message error">
            Este correo todavía requiere autorización administrativa.
            <button type="button" onClick={access.signOut}>Cerrar sesión</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="dashboard-email">Correo electrónico</label>
            <input
              id="dashboard-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@organizacion.org"
              required
            />
            {access.message && <p className="edifica-form-error">{access.message}</p>}
            <button className="edifica-primary-button" type="submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar enlace de acceso'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-VE', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(new Date(value))
}

function formatNumber(value, maximumFractionDigits = 3) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits }).format(Number(value))
}

function DetailField({ label, children }) {
  return (
    <div className="edifica-detail-field">
      <span>{label}</span>
      <strong>{children || '—'}</strong>
    </div>
  )
}

function DonationDetailModal({ donation, loading, error, onClose }) {
  return (
    <div className="edifica-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="edifica-modal" role="dialog" aria-modal="true" aria-labelledby="donation-detail-title">
        <header className="edifica-modal-header">
          <div>
            <p className="edifica-kicker">DETALLE DE LA DONACIÓN</p>
            <h2 id="donation-detail-title">{donation?.reference_code ?? 'Registro de Edifica'}</h2>
          </div>
          <button className="edifica-modal-close" type="button" onClick={onClose} aria-label="Cerrar detalle">×</button>
        </header>

        {loading ? (
          <p className="edifica-modal-state">Cargando información…</p>
        ) : error ? (
          <p className="edifica-modal-state error">{error}</p>
        ) : donation ? (
          <div className="edifica-modal-content">
            <section className="edifica-detail-section">
              <h3>Información general</h3>
              <div className="edifica-detail-grid">
                <DetailField label="Tipo">{typeLabels[donation.donation_type] ?? donation.donation_type}</DetailField>
                <DetailField label="Estado">{statusLabels[donation.status] ?? donation.status}</DetailField>
                <DetailField label="Fecha de registro">{formatDate(donation.created_at, true)}</DetailField>
                <DetailField label="Fecha de recepción">{formatDate(donation.received_at, true)}</DetailField>
              </div>
            </section>

            <section className="edifica-detail-section">
              <h3>Donante</h3>
              <div className="edifica-detail-grid">
                <DetailField label="Nombre">{donation.donor?.name}</DetailField>
                <DetailField label="Correo">{donation.donor?.email}</DetailField>
                <DetailField label="Teléfono">{donation.donor?.phone}</DetailField>
                <DetailField label="País">{donation.donor?.country}</DetailField>
              </div>
            </section>

            <section className="edifica-detail-section">
              <h3>{donation.donation_type === 'monetary' ? 'Información monetaria' : 'Artículos registrados'}</h3>
              <div className="edifica-detail-items">
                {donation.details?.map((detail, index) => (
                  <article key={detail.id}>
                    <span className="edifica-item-number">{String(index + 1).padStart(2, '0')}</span>
                    {detail.type === 'monetary' ? (
                      <div>
                        <strong>{formatNumber(detail.amount, 2)} {detail.currency}</strong>
                        <p>{paymentMethodLabels[detail.monetary?.payment_method] ?? detail.monetary?.payment_method ?? 'Método pendiente'}</p>
                        <dl>
                          <div><dt>Base USD</dt><dd>{formatNumber(detail.monetary?.usd_base_amount, 2)} USD</dd></div>
                          <div><dt>Referencia</dt><dd>{detail.monetary?.transaction_reference ?? '—'}</dd></div>
                          <div><dt>Institución emisora</dt><dd>{detail.monetary?.sender_institution ?? '—'}</dd></div>
                          <div><dt>Cuenta receptora</dt><dd>{detail.monetary?.receiver_account_label ?? '—'}</dd></div>
                        </dl>
                      </div>
                    ) : (
                      <div>
                        <strong>{detail.item_description}</strong>
                        <p>{formatNumber(detail.quantity)} {detail.unit?.abbreviation ?? detail.unit?.name_es ?? ''}</p>
                        <dl>
                          <div><dt>Categoría</dt><dd>{detail.category ?? '—'}</dd></div>
                          <div><dt>Código</dt><dd>{detail.item_code ?? '—'}</dd></div>
                          <div><dt>Vencimiento</dt><dd>{formatDate(detail.expiry_date)}</dd></div>
                          <div><dt>Valor referencial</dt><dd>{detail.reference_value ? `${formatNumber(detail.reference_value, 2)} ${detail.reference_currency ?? ''}` : '—'}</dd></div>
                        </dl>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {donation.shipment && (
              <section className="edifica-detail-section">
                <h3>Información del envío</h3>
                <div className="edifica-detail-grid">
                  <DetailField label="Origen">{[donation.shipment.origin_city, donation.shipment.origin_country].filter(Boolean).join(', ')}</DetailField>
                  <DetailField label="Destino">{[donation.shipment.destination_city, donation.shipment.destination_country].filter(Boolean).join(', ')}</DetailField>
                  <DetailField label="Transportista">{donation.shipment.carrier_name}</DetailField>
                  <DetailField label="Seguimiento">{donation.shipment.tracking_number ?? donation.shipment.container_number}</DetailField>
                  <DetailField label="Salida">{formatDate(donation.shipment.departure_date)}</DetailField>
                  <DetailField label="Llegada estimada">{formatDate(donation.shipment.estimated_arrival)}</DetailField>
                </div>
              </section>
            )}

            {donation.notes && (
              <section className="edifica-detail-section">
                <h3>Observaciones</h3>
                <p className="edifica-detail-notes">{donation.notes}</p>
              </section>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default function DashboardApp() {
  const access = useOperatorAccess()
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  useEffect(() => {
    if (access.status !== 'authorized' || !supabase || !access.userId) return

    let active = true
    const loadDonations = async () => {
      setLoading(true)
      const { data, error: queryError } = await supabase
        .from('donation')
        .select('id, donation_type, status, reference_code, received_at, created_at, donor:actor(name)')
        .eq('created_by', access.userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!active) return
      if (queryError) {
        setError(queryError.message)
        setDonations([])
      } else {
        setError('')
        setDonations(data ?? [])
      }
      setLoading(false)
    }

    loadDonations()
    return () => { active = false }
  }, [access.status, access.userId])

  useEffect(() => {
    if (!selectedId) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedId('')
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedId])

  const totals = useMemo(() => ({
    all: donations.length,
    monetary: donations.filter((item) => item.donation_type === 'monetary').length,
    inKind: donations.filter((item) => item.donation_type === 'in_kind').length,
  }), [donations])

  const openDonation = async (donationId) => {
    if (!supabase) return
    setSelectedId(donationId)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)

    try {
      const { data: donationData, error: donationError } = await supabase
        .from('donation')
        .select('id, donation_type, status, reference_code, recorded_at, received_at, notes, created_at, donor:actor(name, email, phone, country, is_organization)')
        .eq('id', donationId)
        .single()

      if (donationError) throw donationError

      const { data: detailData, error: detailsError } = await supabase
        .from('donation_detail')
        .select('id, type, amount, currency, item_description, quantity, item_code, category, expiry_date, reference_value, reference_currency, unit:unit_of_measure(name_es, abbreviation)')
        .eq('donation_id', donationId)
        .order('created_at', { ascending: true })

      if (detailsError) throw detailsError

      const monetaryIds = (detailData ?? [])
        .filter((item) => item.type === 'monetary')
        .map((item) => item.id)

      let monetaryData = []
      if (monetaryIds.length) {
        const { data, error: monetaryError } = await supabase
          .from('monetary_donation_detail')
          .select('donation_detail_id, payment_method, usd_base_amount, exchange_rate_to_usd, exchange_rate_source, exchange_rate_date, sender_institution, receiver_account_label, transaction_reference, reconciliation_status')
          .in('donation_detail_id', monetaryIds)

        if (monetaryError) throw monetaryError
        monetaryData = data ?? []
      }

      const monetaryByDetail = new Map(monetaryData.map((item) => [item.donation_detail_id, item]))
      const details = (detailData ?? []).map((item) => ({
        ...item,
        monetary: monetaryByDetail.get(item.id) ?? null,
      }))

      let shipment = null
      if (donationData.donation_type === 'in_kind' || donationData.donation_type === 'mixed') {
        const { data, error: shipmentError } = await supabase
          .from('shipment')
          .select('id, transport_mode, status, origin_country, origin_city, destination_country, destination_city, container_number, tracking_number, carrier_name, departure_date, estimated_arrival, actual_arrival, customs_reference, notes')
          .eq('donation_id', donationId)
          .maybeSingle()

        if (shipmentError) throw shipmentError
        shipment = data
      }

      setDetail({ ...donationData, details, shipment })
    } catch (requestError) {
      setDetailError(requestError?.message ?? 'No fue posible cargar el detalle de la donación.')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedId('')
    setDetail(null)
    setDetailError('')
  }

  if (access.status !== 'authorized') return <LoginCard access={access} />

  return (
    <div className="edifica-dashboard-shell">
      <aside className="edifica-sidebar">
        <a className="edifica-wordmark" href="/">edifica<span>digital</span></a>
        <nav className="edifica-primary-nav">
          <a className="active" href="/app">Resumen</a>
          <a href="/donations/monetary/new">Nueva donación monetaria</a>
          <a href="/donations/in-kind/new">Nueva donación en especies</a>
          <a href="#registros">Mis registros</a>
        </nav>

        <div className="edifica-sidebar-footer">
          {canAdmin && (
            <nav className="edifica-admin-nav" aria-label="Administración">
              <span className="edifica-nav-section">ADMINISTRACIÓN</span>
              <button type="button" disabled title="Módulo administrativo en preparación">Personas habilitadas</button>
              <button type="button" disabled title="Módulo administrativo en preparación">Organizaciones</button>
            </nav>
          )}
          <button className="edifica-signout" type="button" onClick={access.signOut}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="edifica-dashboard-main">
        <header className="edifica-dashboard-header">
          <div>
            <p className="edifica-kicker">PANEL OPERATIVO</p>
            <h1>Resumen de donaciones</h1>
          </div>
          <div className="edifica-user-chip">
            <strong>{access.displayName || access.email}</strong>
            <span>{roleLabels[access.role] ?? access.role}</span>
          </div>
        </header>

        <section className="edifica-metrics">
          <article><span>Total registrado</span><strong>{totals.all}</strong></article>
          <article><span>Donaciones monetarias</span><strong>{totals.monetary}</strong></article>
          <article><span>Donaciones en especies</span><strong>{totals.inKind}</strong></article>
        </section>

        <section className="edifica-actions">
          <a href="/donations/monetary/new"><strong>Registrar donación monetaria</strong><span>Transferencias, efectivo, pago móvil, billeteras y otros medios.</span></a>
          <a href="/donations/in-kind/new"><strong>Registrar donación en especies</strong><span>Productos, insumos, contenedores, envíos y evidencias.</span></a>
        </section>

        <section className="edifica-records" id="registros">
          <div className="edifica-section-heading">
            <div><p className="edifica-kicker">HISTORIAL</p><h2>Mis registros</h2></div>
            <span>{donations.length} registros</span>
          </div>

          {loading ? <p className="edifica-empty">Cargando registros…</p> : error ? (
            <p className="edifica-empty error">No se pudo cargar el listado: {error}</p>
          ) : donations.length === 0 ? (
            <p className="edifica-empty">Todavía no has registrado donaciones.</p>
          ) : (
            <div className="edifica-table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Referencia</th><th>Tipo</th><th>Donante</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {donations.map((donation) => (
                    <tr key={donation.id} onClick={() => openDonation(donation.id)}>
                      <td>{formatDate(donation.received_at ?? donation.created_at)}</td>
                      <td>{donation.reference_code ?? 'Sin referencia'}</td>
                      <td>{typeLabels[donation.donation_type] ?? donation.donation_type}</td>
                      <td>{donation.donor?.name ?? 'Donante registrado'}</td>
                      <td><span className={`edifica-status ${donation.status}`}>{statusLabels[donation.status] ?? donation.status}</span></td>
                      <td><button className="edifica-view-detail" type="button" onClick={(event) => {
                        event.stopPropagation()
                        openDonation(donation.id)
                      }}>Ver detalle</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {selectedId && (
        <DonationDetailModal
          donation={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}
