import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import BillingPanel from '../billing/BillingPanel.jsx'
import DonorDirectoryPanel from '../donors/DonorDirectoryPanel.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import { ChurchModulePreview, DigitalProductsPreview } from '../platform/ModulePreview.jsx'
import PlatformHome from '../platform/PlatformHome.jsx'
import DonationDetailModal from './DonationDetailModal.jsx'
import DonationEditModal from './DonationEditModal.jsx'
import OperatorAdminPanel from './OperatorAdminPanel.jsx'
import OrganizationAdminPanel from './OrganizationAdminPanel.jsx'
import ProjectCompliancePanel from './ProjectCompliancePanel.jsx'
import ProjectsPanel from './ProjectsPanel.jsx'
import VolunteerPanel from './VolunteerPanel.jsx'
import './dashboard.css'
import './dashboard-extensions.css'
import './dashboard-summary.css'
import './module-panel.css'
import './portal-shell.css'

const typeLabels = { monetary: 'Monetaria', in_kind: 'En especies', mixed: 'Mixta' }
const statusLabels = { draft: 'Borrador', announced: 'Anunciada', received: 'Recibida', verified: 'Verificada', closed: 'Cerrada' }
const roleLabels = { operator: 'Operador', admin: 'Administrador', super_admin: 'Superadministrador' }

const iconPaths = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
  money: 'M4 6h16v12H4zM8 10h.01M16 14h.01M12 9v6m2-4.5c-.5-.8-1.3-1.2-2.2-1.2-1.2 0-2 .6-2 1.5 0 2.2 4.2 1.1 4.2 3.3 0 .9-.8 1.6-2.1 1.6-.9 0-1.8-.4-2.4-1.2',
  package: 'm4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7m-8 4v10',
  people: 'M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20m7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6m5 16v-1.5a4 4 0 0 0-3-3.9',
  project: 'M4 5h16v15H4zM8 5V3h8v2M8 10h8M8 14h5',
  donor: 'M4 20v-2.2A4.8 4.8 0 0 1 8.8 13h2.4a4.8 4.8 0 0 1 4.8 4.8V20M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1v6m-3-3h6',
  users: 'M4 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 2 2 2 3-4',
  organization: 'M4 21V7l8-4 8 4v14M8 10h2m4 0h2m-8 4h2m4 0h2m-5 7v-4h2v4',
  billing: 'M4 5h16v14H4zM4 9h16M8 14h4M8 17h7',
}

function PortalIcon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[name]} /></svg>
}

function NavLink({ active, href, icon, children }) {
  return <a className={active ? 'active' : ''} href={href}><span className="portal-nav-icon"><PortalIcon name={icon} /></span><span>{children}</span></a>
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
        <h1>Ingresa a Edifica</h1>
        <p>Usa el correo habilitado por el administrador. Recibirás un enlace seguro para iniciar sesión.</p>
        {access.status === 'link_sent' ? <div className="edifica-message success">Revisa tu correo. El enlace de acceso fue enviado a <strong>{access.email}</strong>.</div> : access.status === 'confirmation_sent' ? <div className="edifica-message success">Correo de activación de cuenta enviado a <strong>{access.email}</strong>.</div> :access.status === 'restricted' ? <div className="edifica-message error">Este correo todavía requiere autorización administrativa.<button type="button" onClick={access.signOut} title="Cerrar la sesión actual">Cerrar sesión</button></div> : (
          <form onSubmit={submit}>
            <label htmlFor="dashboard-email">Correo electrónico</label>
            <input id="dashboard-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@organizacion.org" required />
            {access.message && <p className="edifica-form-error">{access.message}</p>}
            <button className="edifica-primary-button" type="submit" disabled={busy} title="Enviar un enlace de acceso al correo indicado">{busy ? 'Enviando…' : 'Enviar enlace de acceso'}</button>
          </form>
        )}
      </section>
    </main>
  )
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(value))
}

function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0))
}

function formatInvestments(investmentByCurrency) {
  const entries = Object.entries(investmentByCurrency ?? {})
  if (!entries.length) return formatMoney(0, 'USD')
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' · ')
}

function DashboardHome({ access }) {
  const [donations, setDonations] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedMode, setSelectedMode] = useState('detail')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  const loadDonations = useCallback(async () => {
    if (!supabase || !access.userId) return
    setLoading(true)
    setError('')
    let request = supabase.from('donation').select('id, donation_type, status, reference_code, received_at, created_at, donor:actor(name)').order('created_at', { ascending: false }).limit(50)
    if (access.role !== 'super_admin' && access.organizationId) request = request.eq('organization_id', access.organizationId)
    const [donationResponse, summaryResponse] = await Promise.all([
      request,
      supabase.rpc('current_operations_summary', { target_organization_id: access.organizationId || null }),
    ])
    if (donationResponse.error) {
      setDonations([])
      setError(donationResponse.error.message)
    } else setDonations(donationResponse.data ?? [])
    if (summaryResponse.error) {
      setSummary(null)
      setError((current) => current || summaryResponse.error.message)
    } else setSummary(summaryResponse.data ?? null)
    setLoading(false)
  }, [access.organizationId, access.role, access.userId])

  useEffect(() => { loadDonations() }, [loadDonations])
  useEffect(() => {
    if (!selectedId) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedId('') }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedId])

  const fallbackTotals = useMemo(() => ({
    all: donations.length,
    monetary: donations.filter((item) => item.donation_type === 'monetary').length,
    inKind: donations.filter((item) => item.donation_type === 'in_kind').length,
  }), [donations])

  const totals = {
    all: Number(summary?.donation_count ?? fallbackTotals.all),
    monetary: Number(summary?.monetary_count ?? fallbackTotals.monetary),
    inKind: Number(summary?.in_kind_count ?? fallbackTotals.inKind),
    monetaryReceivedUsd: Number(summary?.monetary_received_usd ?? 0),
    beneficiaries: Number(summary?.beneficiary_count ?? 0),
    compliance: Number(summary?.compliance_percent ?? 0),
  }

  const openDonation = useCallback(async (donationId, mode = 'detail') => {
    if (!supabase) return
    setSelectedId(donationId)
    setSelectedMode(mode)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const { data: donationData, error: donationError } = await supabase.from('donation').select('id, donation_type, status, reference_code, organization_id, project_id, recorded_at, received_at, notes, created_at, donor:actor(name, email, phone, country, is_organization, is_anonymous), project:project(name, code)').eq('id', donationId).single()
      if (donationError) throw donationError
      const { data: detailData, error: detailsError } = await supabase.from('donation_detail').select('id, type, amount, currency, item_description, quantity, item_code, category, expiry_date, reference_value, reference_currency, unit:unit_of_measure(name_es, abbreviation)').eq('donation_id', donationId).order('created_at', { ascending: true })
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
      if (donationData.donation_type === 'in_kind' || donationData.donation_type === 'mixed') {
        const { data, error: shipmentError } = await supabase.from('shipment').select('id, transport_mode, status, shipment_scope, category_codes, contents_summary, declared_package_count, package_unit_code, origin_country, origin_city, destination_country, destination_city, container_number, tracking_number, carrier_name, departure_date, estimated_arrival, actual_arrival, customs_reference, notes').eq('donation_id', donationId).maybeSingle()
        if (shipmentError) throw shipmentError
        shipment = data
      }
      setDetail({ ...donationData, details, shipment })
    } catch (requestError) {
      setDetailError(requestError?.message ?? 'No fue posible cargar el registro.')
    } finally { setDetailLoading(false) }
  }, [])

  const closeDetail = () => { setSelectedId(''); setDetail(null); setDetailError('') }
  const afterEdit = async () => { const currentId = selectedId; await loadDonations(); await openDonation(currentId, 'detail') }

  return (
    <>
      <header className="edifica-dashboard-header"><div><p className="edifica-kicker">MÓDULO DONACIONES</p><h1>Resumen de operaciones</h1>{access.organizationName && <p className="edifica-dashboard-organization">{access.organizationName}</p>}</div><div className="edifica-user-chip"><strong>{access.displayName || access.email}</strong><span>{roleLabels[access.role] ?? access.role}</span></div></header>
      <section className="edifica-metrics operations-summary-metrics">
        <article><span>Total registrado</span><strong>{totals.all}</strong><small>Donaciones de la organización</small></article>
        <article><span>Fondos recibidos</span><strong>{formatMoney(totals.monetaryReceivedUsd, 'USD')}</strong><small>Base consolidada en USD</small></article>
        <article><span>Inversión ejecutada</span><strong>{formatInvestments(summary?.investment_by_currency)}</strong><small>Gastos reportados o verificados</small></article>
        <article><span>Cumplimiento físico</span><strong>{totals.compliance}%</strong><small>Promedio de metas entregadas</small></article>
        <article><span>Personas beneficiadas</span><strong>{totals.beneficiaries}</strong><small>Registros agregados o nominales</small></article>
        <article><span>Tipos de donación</span><strong>{totals.monetary} / {totals.inKind}</strong><small>Monetarias / en especies</small></article>
      </section>
      <section className="edifica-actions edifica-actions-expanded">
        <a href="/donations/monetary/new"><strong>Registrar donación monetaria</strong><span>Divisas, transferencias, efectivo y comprobantes.</span></a>
        <a href="/donations/in-kind/new"><strong>Registrar donación en especies</strong><span>Cargas consolidadas, manifiestos, contenedores y envíos.</span></a>
        <a href="/app/donations/donors"><strong>Crear aliado o donante</strong><span>Directorio reutilizable para proyectos y donaciones.</span></a>
        <a href="/app/donations/projects"><strong>{canAdmin ? 'Cargar proyecto financiado' : 'Consultar proyectos'}</strong><span>Objetivos, presupuesto, ejecución, facturas y evidencias.</span></a>
      </section>
      <section className="edifica-records" id="registros">
        <div className="edifica-section-heading"><div><p className="edifica-kicker">ACTIVIDAD RECIENTE</p><h2>Registros de la organización</h2></div><span>{donations.length} registros</span></div>
        {loading ? <p className="edifica-empty">Cargando registros…</p> : error ? <p className="edifica-empty error">No se pudo cargar el listado: {error}</p> : donations.length === 0 ? <p className="edifica-empty">Todavía no existen donaciones registradas.</p> : <div className="edifica-table-wrap"><table><thead><tr><th>Fecha</th><th>Referencia</th><th>Tipo</th><th>Donante o aliado</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{donations.map((donation) => <tr key={donation.id} onClick={() => openDonation(donation.id, 'detail')}><td>{formatDate(donation.received_at ?? donation.created_at)}</td><td>{donation.reference_code ?? 'Sin referencia'}</td><td>{typeLabels[donation.donation_type] ?? donation.donation_type}</td><td>{donation.donor?.name ?? 'Donante registrado'}</td><td><span className={`edifica-status ${donation.status}`}>{statusLabels[donation.status] ?? donation.status}</span></td><td><div className="edifica-record-actions"><button className="edifica-view-detail" type="button" onClick={(event) => { event.stopPropagation(); openDonation(donation.id, 'detail') }} title="Ver el detalle de esta donación">Ver</button><button className="edifica-edit-record" type="button" onClick={(event) => { event.stopPropagation(); openDonation(donation.id, 'edit') }} title="Editar esta donación">Editar</button></div></td></tr>)}</tbody></table></div>}
      </section>
      {selectedId && (detailLoading || selectedMode === 'detail' || !detail ? <DonationDetailModal donation={detail} loading={detailLoading} error={detailError} onClose={closeDetail} /> : <DonationEditModal donation={detail} onClose={closeDetail} onSaved={afterEdit} />)}
    </>
  )
}

export default function DashboardApp() {
  const access = useOperatorAccess()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const platformHome = path === '/app'
  const churchPage = path.startsWith('/app/church')
  const academyPage = path.startsWith('/app/academy')
  const operatorsPage = path.startsWith('/app/admin/operators')
  const organizationsPage = path.startsWith('/app/admin/organizations')
  const billingPage = path.startsWith('/app/admin/billing')
  const compliancePage = path.startsWith('/app/donations/execution') || path.startsWith('/app/compliance')
  const projectsPage = path.startsWith('/app/donations/projects') || path.startsWith('/app/projects')
  const volunteersPage = path.startsWith('/app/donations/volunteers') || path.startsWith('/app/volunteers')
  const donorsPage = path.startsWith('/app/donations/donors') || path.startsWith('/app/donors')
  const donationsHome = path === '/app/donations'
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  useEffect(() => {
    if (!sidebarOpen) return undefined
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const onKeyDown = (event) => { if (event.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [sidebarOpen])

  if (access.status !== 'authorized') return <LoginCard access={access} />
  if (platformHome) return <PlatformHome access={access} />
  if (churchPage) return <ChurchModulePreview access={access} />
  if (academyPage) return <DigitalProductsPreview access={access} />

  let page = <DashboardHome access={access} />
  if (projectsPage) page = <ProjectsPanel access={access} />
  if (compliancePage) page = <ProjectCompliancePanel access={access} />
  if (volunteersPage) page = <VolunteerPanel access={access} />
  if (donorsPage) page = <DonorDirectoryPanel access={access} />
  if (operatorsPage && canAdmin) page = <OperatorAdminPanel access={access} />
  if (organizationsPage && canAdmin) page = <OrganizationAdminPanel access={access} />
  if (billingPage && canAdmin) page = <BillingPanel access={access} />

  return (
    <div className="edifica-dashboard-shell portal-dashboard-shell">
      <div className="portal-mobile-topbar">
        <a className="edifica-wordmark" href="/app">edifica<span>digital</span></a>
        <button type="button" className="portal-menu-button" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'} title={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setSidebarOpen((current) => !current)}><span /><span /></button>
      </div>
      {sidebarOpen ? <button type="button" className="portal-sidebar-backdrop" aria-label="Cerrar menú" title="Cerrar menú" onClick={() => setSidebarOpen(false)} /> : null}
      <aside className={`edifica-sidebar portal-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="portal-brand-block"><a className="edifica-wordmark" href="/app">edifica<span>digital</span></a><small>MÓDULO DONACIONES</small></div>
        <div className="portal-tenant-card"><span>ORGANIZACIÓN ACTIVA</span><strong>{access.organizationName || 'Administración general'}</strong><small>{roleLabels[access.role] ?? access.role}</small></div>
        <nav className="edifica-primary-nav portal-primary-nav">
          <span className="portal-nav-section">EDIFICA</span>
          <NavLink href="/app" icon="home">Todos los módulos</NavLink>
          <span className="portal-nav-section portal-management-section">DONACIONES</span>
          <NavLink active={donationsHome} href="/app/donations" icon="home">Resumen</NavLink>
          <NavLink href="/donations/monetary/new" icon="money">Donación monetaria</NavLink>
          <NavLink href="/donations/in-kind/new" icon="package">Donación en especies</NavLink>
          <NavLink active={volunteersPage} href="/app/donations/volunteers" icon="people">Voluntariado</NavLink>
          <span className="portal-nav-section portal-management-section">GESTIÓN</span>
          <NavLink active={projectsPage || compliancePage} href="/app/donations/projects" icon="project">Proyectos</NavLink>
          <NavLink active={donorsPage} href="/app/donations/donors" icon="donor">Aliados y donantes</NavLink>
        </nav>
        <div className="edifica-sidebar-footer portal-sidebar-footer">
          {canAdmin && <nav className="edifica-admin-nav portal-admin-nav" aria-label="Administración"><span className="portal-nav-section">ADMINISTRACIÓN</span><NavLink active={operatorsPage} href="/app/admin/operators" icon="users">Personas habilitadas</NavLink><NavLink active={organizationsPage} href="/app/admin/organizations" icon="organization">Organizaciones y hosts</NavLink><NavLink active={billingPage} href="/app/admin/billing" icon="billing">Planes y facturación</NavLink></nav>}
          <div className="portal-user-footer"><div><strong>{access.displayName || access.email}</strong><span>{access.email}</span></div><button className="edifica-signout" type="button" onClick={access.signOut} title="Cerrar la sesión actual">Cerrar sesión</button></div>
        </div>
      </aside>
      <main className="edifica-dashboard-main">{page}</main>
    </div>
  )
}
