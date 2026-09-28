import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import ManagementRuntimeEnhancements from './ManagementRuntimeEnhancements.jsx'
import './management.css'
import './management-fixes.css'
import './management-visual-hotfix.css'
import './management-runtime-enhancements.css'
import './management-grouped-nav.css'
import './management-report-editor-modern.css'

const navigationGroups = (calendarLabel = 'Calendario') => [
  { label: 'Inicio', items: [['Resumen', '/app/management', '/app/management']] },
  { label: 'Planificación', items: [
    ['Estructura', '/app/management/structure', '/app/management/structure'],
    ['Plan anual', '/app/management/objectives', '/app/management/objectives'],
    [calendarLabel, '/app/management/calendar', '/app/management/calendar'],
    ['Proyectos', '/app/management/projects', '/app/management/projects'],
  ] },
  { label: 'Recursos y operación', items: [
    ['Aportes y recursos', '/app/management/resources', '/app/management/resources'],
    ['Aliados y donantes', '/app/management/allies', '/app/management/allies'],
    ['Miembros', '/app/management/members', '/app/management/members'],
    ['Voluntariado', '/app/management/volunteers', '/app/management/volunteers'],
    ['Finanzas', '/app/management/finance', '/app/management/finance'],
  ] },
  { label: 'Control y rendición', items: [
    ['Seguimiento', '/app/management/tracking', '/app/management/tracking'],
    ['Informes', '/app/management/reports', '/app/management/reports'],
  ] },
]

// Tenant-configurable catalogs. They are collapsed by default so the everyday
// operational entries above them stay the first thing in view.
const maintainerItems = [
  ['Categorías de miembros', '/app/management/settings/member-categories', 'Abrir el mantenedor de categorías de miembros'],
  ['Roles de relación', '/app/management/settings/relationship-roles', 'Abrir el mantenedor de roles de relación'],
  ['Nombres de los módulos', '/app/management/settings/module-labels', 'Abrir el mantenedor de nombres de los módulos'],
]

function Brand() {
  return <a className="management-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a>
}

function ManagementNavigation({ path, calendarLabel, canAdmin, maintainersOpen, onToggleMaintainers, navigate, onNavigate = () => {}, idPrefix }) {
  return <nav className="management-canonical-nav management-grouped-nav" aria-label="Navegación de Gestión Organizacional">
    {navigationGroups(calendarLabel).map((group) => <div className="management-nav-group" key={group.label}>
      <p className="management-nav-group-label">{group.label}</p>
      {group.items.map(([label, href, prefix]) => {
        const active = href === '/app/management' ? path === href : path.startsWith(prefix)
        return <button className={active ? 'active' : ''} type="button" onClick={() => navigate(href)} key={href} title={`Abrir ${label}`}>{label}</button>
      })}
    </div>)}
    {canAdmin && <div className="management-nav-group">
      <p className="management-nav-group-label">Administración</p>
      <a className="management-nav-action" href="/app/admin/operators" onClick={onNavigate} title="Abrir usuarios y accesos">Usuarios y accesos</a>
      <button
        type="button"
        className={`management-nav-collapse${maintainersOpen ? ' open' : ''}`}
        aria-expanded={maintainersOpen}
        aria-controls={`${idPrefix}-maintainers`}
        onClick={onToggleMaintainers}
        title={maintainersOpen ? 'Ocultar los mantenedores' : 'Mostrar los mantenedores'}
      >
        <span>Mantenedores</span>
        <i aria-hidden="true" />
      </button>
      <div id={`${idPrefix}-maintainers`} className="management-nav-collapse-panel" hidden={!maintainersOpen}>
        {maintainerItems.map(([label, href, itemTitle]) => (
          <button
            className={path.startsWith(href) ? 'active' : ''}
            type="button"
            onClick={() => navigate(href)}
            key={href}
            title={itemTitle}
          >
            {label}
          </button>
        ))}
      </div>
    </div>}
  </nav>
}

export default function ManagementStandaloneShell({ access, children }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/app/management'
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const onMaintainerPage = path.startsWith('/app/management/settings')
  const [maintainersOpen, setMaintainersOpen] = useState(onMaintainerPage)
  const [calendarLabel, setCalendarLabel] = useState('Calendario')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!supabase || access.status !== 'authorized' || !access.organizationId) return undefined
    let cancelled = false
    supabase.from('organization').select('calendar_module_label').eq('id', access.organizationId).single()
      .then(({ data }) => { if (!cancelled) setCalendarLabel(String(data?.calendar_module_label || '').trim() || 'Calendario') })
    return () => { cancelled = true }
  }, [access.organizationId, access.status])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const onKeyDown = (event) => { if (event.key === 'Escape') setMobileMenuOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileMenuOpen])

  const navigate = (href) => window.location.assign(href)
  const navigateMobile = (href) => {
    setMobileMenuOpen(false)
    window.location.assign(href)
  }

  return (
    <div className="management-shell management-unified-shell">
      <ManagementRuntimeEnhancements />
      <aside className="management-sidebar no-print">
        <div className="management-sidebar-top"><Brand /><small>GESTIÓN ORGANIZACIONAL</small></div>
        <a className="management-back" href="/app">← Todos los módulos</a>
        <ManagementNavigation
          path={path}
          calendarLabel={calendarLabel}
          canAdmin={canAdmin}
          maintainersOpen={maintainersOpen}
          onToggleMaintainers={() => setMaintainersOpen((current) => !current)}
          navigate={navigate}
          idPrefix="desktop-management-nav"
        />
        <div className="management-sidebar-footer">
          <div><strong>{access.organizationName || 'Organización'}</strong><span>{access.displayName || access.email}</span></div>
          <button type="button" onClick={access.signOut}>Cerrar sesión</button>
        </div>
      </aside>
      {mobileMenuOpen && <button type="button" className="management-mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />}
      {mobileMenuOpen && <aside id="management-mobile-drawer" className="management-mobile-drawer" aria-label="Menú de Gestión Organizacional">
        <div className="management-mobile-drawer-header">
          <Brand />
          <button type="button" className="management-mobile-close-button" aria-label="Cerrar menú" title="Cerrar menú" onClick={() => setMobileMenuOpen(false)}>×</button>
        </div>
        <div className="management-mobile-context">
          <span>ORGANIZACIÓN ACTIVA</span>
          <strong>{access.organizationName || 'Organización'}</strong>
          <small>{access.displayName || access.email}</small>
        </div>
        <a className="management-mobile-modules-link" href="/app" onClick={() => setMobileMenuOpen(false)}>← Todos los módulos</a>
        <ManagementNavigation
          path={path}
          calendarLabel={calendarLabel}
          canAdmin={canAdmin}
          maintainersOpen={maintainersOpen}
          onToggleMaintainers={() => setMaintainersOpen((current) => !current)}
          navigate={navigateMobile}
          onNavigate={() => setMobileMenuOpen(false)}
          idPrefix="mobile-management-nav"
        />
        <div className="management-mobile-drawer-footer">
          <button type="button" onClick={access.signOut} title="Cerrar sesión">Cerrar sesión</button>
        </div>
      </aside>}
      <main className="management-main">
        <div className="management-mobile-header no-print">
          <button
            type="button"
            className="management-mobile-menu-button"
            aria-expanded={mobileMenuOpen}
            aria-controls="management-mobile-drawer"
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            title={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            <span /><span /><span />
          </button>
          <Brand />
          <span className="management-mobile-header-label">Gestión</span>
        </div>
        {children}
      </main>
    </div>
  )
}
