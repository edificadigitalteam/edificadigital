import './management.css'
import './management-fixes.css'

const navigation = [
  ['Resumen', '/app/management', '/app/management'],
  ['Estructura', '/app/management/structure', '/app/management/structure'],
  ['Objetivos', '/app/management/objectives', '/app/management/objectives'],
  ['Proyectos', '/app/management/projects', '/app/management/projects'],
  ['Aportes y recursos', '/app/management/resources', '/app/management/resources'],
  ['Aliados y donantes', '/app/management/allies', '/app/management/allies'],
  ['Voluntariado', '/app/management/volunteers', '/app/management/volunteers'],
  ['Seguimiento', '/app/management/tracking', '/app/management/tracking'],
  ['Informes', '/app/management/reports', '/app/management/reports'],
]

function Brand() {
  return <a className="management-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a>
}

export default function ManagementStandaloneShell({ access, children }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/app/management'
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  return (
    <div className="management-shell management-unified-shell">
      <aside className="management-sidebar no-print">
        <div className="management-sidebar-top"><Brand /><small>GESTIÓN ORGANIZACIONAL</small></div>
        <a className="management-back" href="/app">← Todos los módulos</a>
        <nav>
          {navigation.map(([label, href, prefix], index) => {
            const active = href === '/app/management' ? path === href : path.startsWith(prefix)
            return <button className={active ? 'active' : ''} type="button" onClick={() => window.location.assign(href)} key={href}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>
          })}
        </nav>
        <div className="management-sidebar-footer">
          {canAdmin && <a className="management-users-link" href="/app/admin/operators">Usuarios y accesos</a>}
          <div><strong>{access.organizationName || 'Organización'}</strong><span>{access.displayName || access.email}</span></div>
          <button type="button" onClick={access.signOut}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="management-main">
        <div className="management-mobile-header no-print"><Brand /><div className="management-mobile-actions">{canAdmin && <a href="/app/admin/operators">Usuarios</a>}<button type="button" onClick={() => window.location.assign('/app')}>Módulos</button></div></div>
        {children}
      </main>
    </div>
  )
}
