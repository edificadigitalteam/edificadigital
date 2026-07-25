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

const paymentMethodLabels = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia bancaria',
  mobile_payment: 'Pago móvil',
  digital_wallet: 'Billetera digital',
  crypto: 'Criptoactivo',
  other: 'Otro',
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

export default function DonationDetailModal({ donation, loading, error, onClose }) {
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
