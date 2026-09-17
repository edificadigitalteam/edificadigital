import { useState } from 'react'
import ManagementRuntimeEnhancements from './ManagementRuntimeEnhancements.jsx'
import './management.css'
import './management-fixes.css'
import './management-visual-hotfix.css'
import './management-runtime-enhancements.css'
import './management-grouped-nav.css'
import './management-report-editor-modern.css'

const navigationGroups = [
  { label: 'Inicio', items: [['Resumen', '/app/management', '/app/management']] },
  { label: 'Planificación', items: [
    ['Estructura', '/app/management/structure', '/app/management/structure'],
    ['Plan anual', '/app/management/objectives', '/app/management/objectives'],
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
  ['Categorías de miembros', '/app/management/settings/member-categories'],
  ['Roles de relación', '/app/management/settings/relationship-roles'],
]

function Brand() {
  return <a className="management-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a>
}

export default function ManagementStandaloneShell({ access, children }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/app/management'
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const onMaintainerPage = path.startsWith('/app/management/settings')
  const [maintainersOpen, setMaintainersOpen] = useState(onMaintainerPage)

  return (
    <div className="management-shell management-unified-shell">
      <ManagementRuntimeEnhancements />
      <aside className="management-sidebar no-print">
        <div className="management-sidebar-top"><Brand /><small>GESTIÓN ORGANIZACIONAL</small></div>
        <a className="management-back" href="/app">← Todos los módulos</a>
        <nav className="management-canonical-nav management-grouped-nav">
          {navigationGroups.map((group) => <div className="management-nav-group" key={group.label}>
            <p className="management-nav-group-label">{group.label}</p>
            {group.items.map(([label, href, prefix]) => {
              const active = href === '/app/management' ? path === href : path.startsWith(prefix)
              return <button className={active ? 'active' : ''} type="button" onClick={() => window.location.assign(href)} key={href}>{label}</button>
            })}
          </div>)}
          {canAdmin && <div className="management-nav-group">
            <p className="management-nav-group-label">Administración</p>
            <a className="management-nav-action" href="/app/admin/operators">Usuarios y accesos</a>
            <button
              type="button"
              className={`management-nav-collapse${maintainersOpen ? ' open' : ''}`}
              aria-expanded={maintainersOpen}
              aria-controls="management-nav-maintainers"
              onClick={() => setMaintainersOpen((current) => !current)}
              title={maintainersOpen ? 'Ocultar los mantenedores' : 'Mostrar los mantenedores'}
            >
              <span>Mantenedores</span>
              <i aria-hidden="true" />
            </button>
            <div id="management-nav-maintainers" className="management-nav-collapse-panel" hidden={!maintainersOpen}>
              {maintainerItems.map(([label, href]) => (
                <button
                  className={path.startsWith(href) ? 'active' : ''}
                  type="button"
                  onClick={() => window.location.assign(href)}
                  key={href}
                  title={`Abrir el mantenedor ${label.toLowerCase()}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>}
        </nav>
        <div className="management-sidebar-footer">
          <div><strong>{access.organizationName || 'Organización'}</strong><span>{access.displayName || access.email}</span></div>
          <button type="button" onClick={access.signOut}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="management-main">
        <div className="management-mobile-header no-print"><Brand /><div className="management-mobile-actions">{canAdmin && <a className="management-users-mobile-link" href="/app/admin/operators">Usuarios</a>}<a className="management-resources-mobile-link" href="/app/management/resources">Aportes</a><a className="management-finance-mobile-link" href="/app/management/finance">Finanzas</a><button type="button" onClick={() => window.location.assign('/app')}>Módulos</button></div></div>
        {children}
      </main>
    </div>
  )
}
