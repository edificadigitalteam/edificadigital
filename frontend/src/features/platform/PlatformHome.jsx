import './platform-home.css'

const modules = [
  {
    key: 'donations',
    title: 'Donaciones y proyectos',
    label: 'OPERACIÓN Y TRANSPARENCIA',
    description: 'Gestiona donaciones, proyectos financiados, aliados, beneficiarios, voluntariado y ejecución.',
    href: '/app/donations',
    status: 'Disponible',
    tone: 'purple',
    features: ['Donaciones monetarias y en especies', 'Proyectos y ejecución', 'Aliados y beneficiarios'],
  },
  {
    key: 'management',
    title: 'Gestión organizacional',
    label: 'PLANIFICACIÓN Y CUMPLIMIENTO',
    description: 'Organiza estructura, objetivos, proyectos, indicadores y reportes dentro de una sola gestión institucional.',
    href: '/app/management',
    status: 'Disponible',
    tone: 'orange',
    features: ['Estructura y responsables', 'Objetivos e indicadores', 'Informes por unidad y consolidado'],
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
            <span>Selecciona el módulo con el que deseas trabajar. Cada área comparte la organización, los usuarios y el plan contratado.</span>
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
              <div>Entrar al módulo <span>→</span></div>
            </a>
          ))}
        </section>

        <section className="platform-account-summary">
          <div><p>CUENTA DE LA ORGANIZACIÓN</p><h2>Una sola suscripción, varios espacios de trabajo.</h2><span>Los módulos, el número de usuarios y los productos incluidos se administran desde el plan de la organización.</span></div>
          <div className="platform-account-stats"><article><span>Módulos</span><strong>3</strong></article><article><span>Cuenta</span><strong>Activa</strong></article><article><span>Idioma</span><strong>ES / EN</strong></article></div>
          {(access.role === 'admin' || access.role === 'super_admin') && <a href="/app/admin/billing">Administrar plan y usuarios →</a>}
        </section>
      </main>
    </div>
  )
}
