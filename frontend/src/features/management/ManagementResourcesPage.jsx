import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import DonationDetailModal from '../dashboard/DonationDetailModal.jsx'
import DonationEditModal from '../dashboard/DonationEditModal.jsx'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import '../dashboard/dashboard.css'
import '../dashboard/dashboard-summary.css'
import '../dashboard/module-panel.css'
import './management-resources.css'

const typeLabels = { monetary: 'Monetario', in_kind: 'En especies', mixed: 'Mixto' }
const statusLabels = { draft: 'Borrador', announced: 'Anunciado', received: 'Recibido', verified: 'Verificado', closed: 'Cerrado' }

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(value))
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
}

export default function ManagementResourcesPage() {
  const access = useOperatorAccess()
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedMode, setSelectedMode] = useState('detail')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const load = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    setLoading(true)
    setError('')
    let request = supabase.from('donation').select('id, donation_type, status, reference_code, received_at, created_at, project_id, donor:actor(name), project:project(code, name)').order('created_at', { ascending: false }).limit(100)
    if (access.role !== 'super_admin' && access.organizationId) request = request.eq('organization_id', access.organizationId)
    const [recordsResponse, summaryResponse] = await Promise.all([
      request,
      supabase.rpc('current_operations_summary', { target_organization_id: access.organizationId || null }),
    ])
    if (recordsResponse.error) setError(recordsResponse.error.message)
    else setRecords(recordsResponse.data ?? [])
    if (!summaryResponse.error) setSummary(summaryResponse.data ?? null)
    setLoading(false)
  }, [access.organizationId, access.role, access.status])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => ({
    all: Number(summary?.donation_count ?? records.length),
    monetary: Number(summary?.monetary_count ?? records.filter((item) => item.donation_type === 'monetary').length),
    inKind: Number(summary?.in_kind_count ?? records.filter((item) => item.donation_type === 'in_kind').length),
    usd: Number(summary?.monetary_received_usd ?? 0),
  }), [records, summary])

  const openRecord = useCallback(async (id, mode = 'detail') => {
    if (!supabase) return
    setSelectedId(id)
    setSelectedMode(mode)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const { data: donationData, error: donationError } = await supabase.from('donation').select('id, donation_type, status, reference_code, organization_id, project_id, recorded_at, received_at, notes, created_at, donor:actor(name, email, phone, country, is_organization, is_anonymous), project:project(name, code)').eq('id', id).single()
      if (donationError) throw donationError
      const { data: detailData, error: detailsError } = await supabase.from('donation_detail').select('id, type, amount, currency, item_description, quantity, item_code, category, expiry_date, reference_value, reference_currency, unit:unit_of_measure(name_es, abbreviation)').eq('donation_id', id).order('created_at', { ascending: true })
      if (detailsError) throw detailsError
      const monetaryIds = (detailData ?? []).filter((item) => item.type === 'monetary').map((item) => item.id)
      let monetaryData = []
      if (monetaryIds.length) {
        const { data, error: monetaryError } = await supabase.from('monetary_donation_detail').select('donation_detail_id, payment_method, usd_base_amount, exchange_rate_to_usd, exchange_rate_source, exchange_rate_date, sender_institution, receiver_account_label, transaction_reference, reconciliation_status').in('donation_detail_id', monetaryIds)
        if (monetaryError) throw monetaryError
        monetaryData = data ?? []
      }
      const monetaryByDetail = new Map(monetaryData.map((item) => [item.donation_detail_id, item]))
      const details = (detailData ?? []).map((item) => ({ ...item, monetary: monetaryByDetail.get(item.id) ?? null }))
      let shipment = null
      if (['in_kind', 'mixed'].includes(donationData.donation_type)) {
        const { data, error: shipmentError } = await supabase.from('shipment').select('id, transport_mode, status, shipment_scope, category_codes, contents_summary, declared_package_count, package_unit_code, origin_country, origin_city, destination_country, destination_city, container_number, tracking_number, carrier_name, departure_date, estimated_arrival, actual_arrival, customs_reference, notes').eq('donation_id', id).maybeSingle()
        if (shipmentError) throw shipmentError
        shipment = data
      }
      setDetail({ ...donationData, details, shipment })
    } catch (requestError) {
      setDetailError(requestError?.message ?? 'No fue posible cargar el registro.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: 'Idioma' }} language="es" onLanguageChange={() => {}} />

  return (
    <ManagementStandaloneShell access={access}>
      <div className="management-panel management-resources-page">
        <div className="management-panel-heading">
          <div><p>APORTES Y RECURSOS</p><h1>Fondos y bienes recibidos</h1><span>Registra aportes monetarios y en especies de aliados o donantes. Cuando correspondan a un proyecto, Edifica los incorpora automáticamente en su cotejo financiero y rendición.</span></div>
        </div>

        <section className="management-resource-actions no-print">
          <a className="primary" href="/app/management/resources/monetary/new"><strong>＋ Aporte monetario</strong><span>Transferencias, efectivo, divisas y comprobantes.</span></a>
          <a href="/app/management/resources/in-kind/new"><strong>＋ Aporte en especies</strong><span>Bienes, cargas, contenedores, inventario y manifiestos.</span></a>
          <a href="/app/management/allies"><strong>Aliados y donantes</strong><span>Directorio reutilizable para proyectos y aportes.</span></a>
        </section>

        <section className="management-resource-summary">
          <article><span>Registros</span><strong>{totals.all}</strong><small>Aportes recibidos</small></article>
          <article><span>Fondos recibidos</span><strong>{formatMoney(totals.usd)}</strong><small>Base consolidada en USD</small></article>
          <article><span>Monetarios</span><strong>{totals.monetary}</strong><small>Registros</small></article>
          <article><span>En especies</span><strong>{totals.inKind}</strong><small>Registros</small></article>
        </section>

        <section className="management-resource-records">
          <div className="management-card-heading"><div><small>HISTORIAL OPERATIVO</small><h2>Aportes registrados</h2></div></div>
          {loading ? <p className="management-empty">Cargando registros…</p> : error ? <p className="management-empty">{error}</p> : !records.length ? <p className="management-empty">Todavía no hay aportes registrados.</p> : (
            <div className="management-resource-table-wrap"><table><thead><tr><th>Fecha</th><th>Referencia</th><th>Tipo</th><th>Aliado o donante</th><th>Proyecto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDate(record.received_at ?? record.created_at)}</td><td>{record.reference_code || '—'}</td><td>{typeLabels[record.donation_type] || record.donation_type}</td><td>{record.donor?.name || '—'}</td><td>{record.project ? `${record.project.code} · ${record.project.name}` : 'Sin proyecto vinculado'}</td><td><span className={`management-resource-status ${record.status}`}>{statusLabels[record.status] || record.status}</span></td><td><div><button type="button" onClick={() => openRecord(record.id, 'detail')}>Ver</button><button type="button" onClick={() => openRecord(record.id, 'edit')}>Editar</button></div></td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
      {selectedId && (detailLoading || selectedMode === 'detail' || !detail
        ? <DonationDetailModal donation={detail} loading={detailLoading} error={detailError} onClose={() => setSelectedId('')} />
        : <DonationEditModal donation={detail} onClose={() => setSelectedId('')} onSaved={async () => { await load(); await openRecord(selectedId, 'detail') }} />)}
    </ManagementStandaloneShell>
  )
}
