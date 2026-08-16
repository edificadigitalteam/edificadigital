import { useEffect, useState } from 'react'
import BillingPanel from '../billing/BillingPanel.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import { DigitalProductsPreview } from '../platform/ModulePreview.jsx'
import PlatformHome from '../platform/PlatformHome.jsx'
import OperatorAdminPanel from './OperatorAdminPanel.jsx'
import OrganizationAdminPanel from './OrganizationAdminPanel.jsx'
import './dashboard.css'
import './dashboard-extensions.css'
import './module-panel.css'
import './portal-shell.css'

const roleLabels = { operator: 'Operador', admin: 'Administrador', super_admin: 'Superadministrador' }
const iconPaths = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
  management: 'M4 5h16v15H4zM8 5V3h8v2M8 10h8M8 14h5',
  users: 'M4 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 2 2 2 3-4',
  organization: 'M4 21V7l8-4 8 4v14M8 10h2m4 0h2m-8 4h2m4 0h2m-5 7v-4h2v4',
  billing: 'M4 5h16v14H4zM4 9h16M8 14h4M8 17h7',
}

function PortalIcon({ name }) { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[name]} /></svg> }
function NavLink({ active, href, icon, children }) { return <a className={active ? 'active' : ''} href={href}><span className="portal-nav-icon"><PortalIcon name={icon} /></span><span>{children}</span></a> }

function LoginCard({ access }) {
  const [email, setEmail] = useState(access.email ?? '')
  const busy = access.status === 'loading' || access.status === 'sending_link'
  const submit = async (event) => { event.preventDefault(); if (email.trim()) await access.requestMagicLink(email.trim().toLowerCase()) }
  return (
    <main className="edifica-login-shell"><section className="edifica-login-card"><a className="edifica-wordmark" href="/">edifica<span>digital</span></a><p className="edifica-kicker">ACCESO AL SISTEMA</p><h1>Ingresa a Edifica</h1><p>Usa el correo habilitado por el administrador. Recibirás un enlace seguro para iniciar sesión.</p>{access.status === 'link_sent' ? <div className="edifica-message success">Revisa tu correo. El enlace de acceso fue enviado a <strong>{access.email}</strong>.</div> : access.status === 'confirmation_sent' ? <div className="edifica-message success">Correo de activación enviado a <strong>{access.email}</strong>.</div> : access.status === 'restricted' ? <div className="edifica-message error">Este correo todavía requiere autorización administrativa.<button type="button" onClick={access.signOut}>Cerrar sesión</button></div> : <form onSubmit={submit}><label htmlFor="dashboard-email">Correo electrónico</label><input id="dashboard-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@organizacion.org" required />{access.message && <p className="edifica-form-error">{access.message}</p>}<button className="edifica-primary-button" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace de acceso'}</button></form>}</section></main>
  )
}

export default function DashboardApp() {
  const access = useOperatorAccess()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const isSuperAdmin = access.role === 'super_admin'
  const canAdmin = access.role === 'admin' || isSuperAdmin
  const platformHome = path === '/app' && !isSuperAdmin
  const academyPage = path.startsWith('/app/academy')
  const operatorsPage = path.startsWith('/app/admin/operators')
  const organizationsPage = path.startsWith('/app/admin/organizations')
  const billingPage = path.startsWith('/app/admin/billing')

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
  if (academyPage) return <DigitalProductsPreview access={access} />

  let page = isSuperAdmin ? <OrganizationAdminPanel access={access} /> : <PlatformHome access={access} />
  if (operatorsPage && canAdmin) page = <OperatorAdminPanel access={access} />
  if (organizationsPage && isSuperAdmin) page = <OrganizationAdminPanel access={access} />
  if (billingPage && canAdmin) page = <BillingPanel access={access} />

  return (
    <div className="edifica-dashboard-shell portal-dashboard-shell">
      <div className="portal-mobile-topbar"><button type="button" className="portal-menu-button" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setSidebarOpen((current) => !current)}><span /><span /></button><a className="edifica-wordmark" href="/app">edifica<span>digital</span></a></div>
      {sidebarOpen ? <button type="button" className="portal-sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} /> : null}
      <aside className={`edifica-sidebar portal-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="portal-brand-block"><a className="edifica-wordmark" href="/app">edifica<span>digital</span></a><small>{isSuperAdmin ? 'PLATAFORMA' : 'ADMINISTRACIÓN'}</small></div>
        <div className="portal-tenant-card"><span>ORGANIZACIÓN ACTIVA</span><strong>{access.organizationName || 'Administración general'}</strong><small>{roleLabels[access.role] ?? access.role}</small></div>
        <nav className="edifica-primary-nav portal-primary-nav">
          <span className="portal-nav-section">EDIFICA</span>
          <NavLink href="/app" icon="home">{isSuperAdmin ? 'Inicio' : 'Todos los espacios'}</NavLink>
          {isSuperAdmin ? <><span className="portal-nav-section portal-management-section">PLATAFORMA</span><NavLink active={organizationsPage || (!operatorsPage && !billingPage)} href="/app/admin/organizations" icon="organization">Organizaciones y hosts</NavLink><NavLink active={operatorsPage} href="/app/admin/operators" icon="users">Personas habilitadas</NavLink><NavLink active={billingPage} href="/app/admin/billing" icon="billing">Planes y facturación</NavLink></> : <><span className="portal-nav-section portal-management-section">OPERACIÓN</span><NavLink href="/app/management" icon="management">Gestión organizacional</NavLink><span className="portal-nav-section portal-management-section">MI ORGANIZACIÓN</span><NavLink active={operatorsPage} href="/app/admin/operators" icon="users">Usuarios y accesos</NavLink><NavLink active={billingPage} href="/app/admin/billing" icon="billing">Plan y facturación</NavLink></>}
        </nav>
        <div className="edifica-sidebar-footer portal-sidebar-footer"><div className="portal-user-footer"><div><strong>{access.displayName || access.email}</strong><span>{access.email}</span></div><button className="edifica-signout" type="button" onClick={access.signOut}>Cerrar sesión</button></div></div>
      </aside>
      <main className="edifica-dashboard-main">{page}</main>
    </div>
  )
}
