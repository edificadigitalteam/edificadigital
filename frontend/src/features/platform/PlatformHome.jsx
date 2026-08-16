import './platform-home.css'

const modules = [
  {
    key: 'management',
    title: 'Gestión organizacional',
    label: 'OPERACIÓN, PLANIFICACIÓN Y TRANSPARENCIA',
    description: 'Gestiona estructura, objetivos, proyectos, aportes y recursos, aliados, beneficiarios, voluntariado, indicadores y rendición institucional desde un solo lugar.',
    href: '/app/management',
    status: 'Disponible',
    tone: 'purple',
    features: ['Proyectos y ejecución completa', 'Aportes, aliados y beneficiarios', 'Indicadores e informes por unidad'],
  },
  {
    key: 'academy',
    title: 'Productos digitales',
    label: 'FORMACIÓN Y RECURSOS',
    description: 'Accede a cursos, plantillas, ebooks y recursos vinculados con la operación de tu organización.',
    href: '/app/academy',
    status: 'Catálogo inicial',
    tone: 'yellow',
    features: ['Cursos', 'Plantillas', 'Biblioteca'],
  },
]

function Brand() {
  return <a className="platform-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a>
}

export default function PlatformHome({ access }) {
  return (
    <div className="platform-home-shell">
      <header className="platform-home-header">
        <Brand />
        <div className="platform-home-user">
          <div><strong>{access.displayName || access.email}</strong><span>{access.organizationName || 'Administración general'}</span></div>
          <a href="/">Sitio público</a>
          <button type="button" onClick={access.signOut}>Cerrar sesión</button>
        </div>
      </header>

      <main className="platform-home-main">
        <section className="platform-welcome">
          <div>
            <p>ESPACIO DE TRABAJO</p>
            <h1>Bienvenido a Edifica</h1>
            <span>La gestión operativa de la organización vive en un solo núcleo. Los proyectos conectan objetivos, recursos, ejecución, evidencias, beneficiarios e informes sin duplicar información.</span>
          </div>
          <article>
            <span>ORGANIZACIÓN ACTIVA</span>
            <strong>{access.organizationName || 'Administración general'}</strong>
            <small>{access.role === 'super_admin' ? 'Superadministrador' : access.role === 'admin' ? 'Administrador' : 'Operador'}</small>
          </article>
        </section>

        <section className="platform-module-grid">
          {modules.map((module, index) => (
            <a className={`platform-module-card ${module.tone}`} href={module.href} key={module.key}>
              <header><span>0{index + 1}</span><b>{module.status}</b></header>
              <small>{module.label}</small>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
              <ul>{module.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <div>Entrar <span>→</span></div>
            </a>
          ))}
        </section>

        <section className="platform-account-summary">
          <div><p>CUENTA DE LA ORGANIZACIÓN</p><h2>Una sola suscripción, un núcleo operativo.</h2><span>Gestión Organizacional concentra el trabajo institucional; Productos Digitales amplía la formación y los recursos disponibles.</span></div>
          <div className="platform-account-stats"><article><span>Espacios</span><strong>2</strong></article><article><span>Cuenta</span><strong>Activa</strong></article><article><span>Idioma</span><strong>ES / EN</strong></article></div>
          {(access.role === 'admin' || access.role === 'super_admin') && <a href="/app/admin/billing">Administrar plan y usuarios →</a>}
        </section>
      </main>
    </div>
  )
}
