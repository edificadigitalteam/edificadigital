import './platform-home.css'

const churchFeatures = [
  ['Membresía', 'Registro, estado, grupos familiares y acompañamiento pastoral.'],
  ['Calendario y eventos', 'Actividades, inscripciones, responsables y asistencia.'],
  ['Discipulado', 'Rutas de formación, seguimiento y próximos pasos.'],
  ['Educación cristiana', 'Clases, grupos por edades, docentes y materiales.'],
  ['Ministerios', 'Equipos de servicio, planificación y cumplimiento de actividades.'],
  ['Aportes', 'Registro declarativo de diezmos, ofrendas y contribuciones.'],
]

const products = [
  ['CURSO', 'Administración financiera con integridad', 'Principios y controles para equipos administrativos y líderes.', 'Formación'],
  ['PLANTILLAS', 'Presupuesto y planificación ministerial', 'Archivos editables para metas, responsables y ejecución.', 'Herramientas'],
  ['TALLER', 'Comunicación digital para iglesias', 'Contenido, identidad y coordinación de equipos.', 'Comunicación'],
  ['BIBLIOTECA', 'Membresía y discipulado', 'Guías y formularios para acompañar a la iglesia local.', 'Gestión eclesial'],
]

function Topbar({ access, title }) {
  return (
    <header className="module-preview-topbar">
      <a href="/app">← Volver a módulos</a>
      <div><span>{title}</span><strong>{access.organizationName || 'Administración general'}</strong></div>
      <button type="button" onClick={access.signOut}>Cerrar sesión</button>
    </header>
  )
}

export function ChurchModulePreview({ access }) {
  return (
    <div className="module-preview-shell church-preview">
      <Topbar access={access} title="Módulo Iglesia" />
      <main>
        <section className="module-preview-hero">
          <div><p>GESTIÓN ECLESIAL</p><h1>La vida de la iglesia, organizada con propósito.</h1><span>Este módulo reunirá los procesos pastorales, educativos y administrativos de la iglesia local dentro del mismo ecosistema Edifica.</span></div>
          <article><span>ESTADO DEL MÓDULO</span><strong>Próxima fase</strong><small>Arquitectura funcional definida</small></article>
        </section>
        <section className="module-feature-grid">{churchFeatures.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p><b>Planificado</b></article>)}</section>
        <section className="module-preview-cta"><div><p>CONFIGURACIÓN POR IGLESIA</p><h2>Cada congregación podrá activar los procesos que realmente utiliza.</h2><span>La estructura será adaptable a iglesias bautistas, pentecostales, católicas y otras comunidades cristianas que trabajen dentro de sus principios doctrinales.</span></div><a href="/app/admin/billing">Consultar módulos del plan →</a></section>
      </main>
    </div>
  )
}

export function DigitalProductsPreview({ access }) {
  return (
    <div className="module-preview-shell academy-preview">
      <Topbar access={access} title="Productos digitales" />
      <main>
        <section className="module-preview-hero">
          <div><p>FORMACIÓN Y RECURSOS</p><h1>Herramientas para aplicar dentro y fuera del software.</h1><span>El catálogo complementará los módulos de Edifica con cursos, plantillas, ebooks, talleres y bibliotecas prácticas.</span></div>
          <article><span>MODELO DE ACCESO</span><strong>Plan o compra</strong><small>Productos incluidos y adicionales</small></article>
        </section>
        <section className="academy-catalog">{products.map(([type, title, text, category], index) => <article key={title}><div className={`academy-cover cover-${index + 1}`}><span>{type}</span><b>ED</b></div><div><small>{category}</small><h2>{title}</h2><p>{text}</p><button type="button" disabled>Próximamente</button></div></article>)}</section>
        <section className="module-preview-cta"><div><p>MONETIZACIÓN CON PROPÓSITO</p><h2>El software se convierte en una puerta de entrada a formación útil.</h2><span>Los productos podrán asociarse a un módulo, incluirse en determinados planes o adquirirse individualmente desde la cuenta de la organización.</span></div><a href="/app/admin/billing">Ver plan de la organización →</a></section>
      </main>
    </div>
  )
}
