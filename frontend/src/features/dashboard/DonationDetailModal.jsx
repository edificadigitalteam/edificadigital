import Modal from './Modal.jsx'

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

const categoryLabels = {
  food: 'Alimentos',
  clothing: 'Ropa',
  hygiene: 'Higiene',
  medical: 'Medicinas e insumos médicos',
  household: 'Hogar',
  other: 'Otros',
}

const transportLabels = {
  sea: 'Marítimo',
  air: 'Aéreo',
}

const scopeLabels = {
  national: 'Nacional',
  international: 'Internacional',
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
  return <div className="edifica-detail-field"><span>{label}</span><strong>{children || '—'}</strong></div>
}

export default function DonationDetailModal({ donation, loading, error, onClose }) {
  return (
    <Modal titleId="donation-detail-title" kicker="DETALLE DE LA DONACIÓN" title={donation?.reference_code ?? 'Registro de Edifica'} onClose={onClose} closeLabel="Cerrar detalle">
        {loading ? <p className="edifica-modal-state">Cargando información…</p> : error ? <p className="edifica-modal-state error">{error}</p> : donation ? (
          <div className="edifica-modal-content">
            <section className="edifica-detail-section">
              <h3>Información general</h3>
              <div className="edifica-detail-grid">
                <DetailField label="Tipo">{typeLabels[donation.donation_type] ?? donation.donation_type}</DetailField>
                <DetailField label="Estado">{statusLabels[donation.status] ?? donation.status}</DetailField>
                <DetailField label="Fecha de registro">{formatDate(donation.created_at, true)}</DetailField>
                <DetailField label="Fecha de recepción">{formatDate(donation.received_at, true)}</DetailField>
                <DetailField label="Proyecto relacionado">{donation.project ? `${donation.project.code} · ${donation.project.name}` : 'Sin proyecto específico'}</DetailField>
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
              <h3>{donation.donation_type === 'monetary' ? 'Información monetaria' : 'Carga registrada'}</h3>
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
                          <div><dt>Categoría</dt><dd>{categoryLabels[detail.category] ?? detail.category ?? 'Carga consolidada'}</dd></div>
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
                  <DetailField label="Alcance">{scopeLabels[donation.shipment.shipment_scope] ?? donation.shipment.shipment_scope}</DetailField>
                  <DetailField label="Transporte">{transportLabels[donation.shipment.transport_mode] ?? donation.shipment.transport_mode}</DetailField>
                  <DetailField label="Origen">{[donation.shipment.origin_city, donation.shipment.origin_country].filter(Boolean).join(', ')}</DetailField>
                  <DetailField label="Destino">{[donation.shipment.destination_city, donation.shipment.destination_country].filter(Boolean).join(', ')}</DetailField>
                  <DetailField label="Seguimiento">{donation.shipment.tracking_number ?? donation.shipment.container_number}</DetailField>
                  <DetailField label="Salida">{formatDate(donation.shipment.departure_date)}</DetailField>
                  <DetailField label="Llegada estimada">{formatDate(donation.shipment.estimated_arrival)}</DetailField>
                  <DetailField label="Cantidad declarada">{donation.shipment.declared_package_count ? `${formatNumber(donation.shipment.declared_package_count)} ${donation.shipment.package_unit_code ?? ''}` : '—'}</DetailField>
                  <DetailField label="Categorías">{(donation.shipment.category_codes ?? []).map((code) => categoryLabels[code] ?? code).join(', ')}</DetailField>
                </div>
                {donation.shipment.contents_summary && <p className="edifica-detail-notes edifica-shipment-summary"><strong>Resumen del contenido:</strong> {donation.shipment.contents_summary}</p>}
              </section>
            )}

            {donation.notes && <section className="edifica-detail-section"><h3>Observaciones</h3><p className="edifica-detail-notes">{donation.notes}</p></section>}
          </div>
        ) : null}
    </Modal>
  )
}
