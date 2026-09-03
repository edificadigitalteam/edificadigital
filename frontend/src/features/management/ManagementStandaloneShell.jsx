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
    ['Objetivos', '/app/management/objectives', '/app/management/objectives'],
    ['Proyectos', '/app/management/projects', '/app/management/projects'],
  ] },
  { label: 'Recursos y operación', items: [
    ['Aportes y recursos', '/app/management/resources', '/app/management/resources'],
    ['Aliados y donantes', '/app/management/allies', '/app/management/allies'],
    ['Voluntariado', '/app/management/volunteers', '/app/management/volunteers'],
    ['Finanzas', '/app/management/finance', '/app/management/finance'],
  ] },
  { label: 'Control y rendición', items: [
    ['Seguimiento', '/app/management/tracking', '/app/management/tracking'],
    ['Informes', '/app/management/reports', '/app/management/reports'],
  ] },
]

function Brand() {
  return <a className="management-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a>
}

export default function ManagementStandaloneShell({ access, children }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/app/management'
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

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
