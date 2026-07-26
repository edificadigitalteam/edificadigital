import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { buildPublicContactUrl } from '../../contact.js'
import './product-landing.css'

const copy = {
  es: {
    metaTitle: 'Edifica Digital | Software para iglesias',
    metaDescription: 'Edifica es un software modular para iglesias y organizaciones cristianas, con donaciones trazables, administración eclesial y productos digitales en una sola plataforma.',
    nav: {
      modules: 'Módulos', ecosystem: 'Ecosistema', resources: 'Recursos', plans: 'Planes', contact: 'Solicitar presentación', login: 'Iniciar sesión',
      skip: 'Saltar al contenido principal', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú', switchLanguage: 'Switch to English',
    },
    hero: {
      kicker: 'SOFTWARE MODULAR PARA ORGANIZACIONES CRISTIANAS',
      title: 'Administra, sirve y crece desde una sola plataforma.',
      lead: 'Edifica conecta la gestión diaria de tu organización con herramientas especializadas, equipos de trabajo y formación práctica para avanzar con orden, integridad y visión.',
      primary: 'Conocer Edifica',
      secondary: 'Explorar módulos',
      note: 'Una cuenta por organización, múltiples usuarios y módulos que se activan según el plan contratado.',
    },
    preview: {
      greeting: 'Bienvenido a Edifica',
      organization: 'Organización activa',
      modules: 'Módulos disponibles',
      users: 'Usuarios habilitados',
      plan: 'Plan Organización',
      donation: 'Donaciones',
      church: 'Iglesia',
      academy: 'Productos digitales',
      active: 'Activo',
      next: 'Próxima fase',
      included: 'Recursos disponibles',
    },
    trust: ['GESTIÓN MODULAR', 'DATOS POR ORGANIZACIÓN', 'ACCESOS POR EQUIPO', 'ESPAÑOL E INGLÉS'],
    modules: {
      kicker: 'TRES LÍNEAS CONECTADAS',
      title: 'Una plataforma que crece junto a tu organización.',
      intro: 'Cada módulo responde a una necesidad concreta y comparte la misma cuenta, la misma organización y una experiencia coherente.',
      items: [
        {
          number: '01', label: 'OPERACIÓN Y TRANSPARENCIA', title: 'Donaciones y proyectos',
          text: 'Registra fondos y bienes, administra aliados, proyectos, beneficiarios, evidencias, voluntariado e inversión ejecutada.',
          features: ['Donaciones monetarias y en especies', 'Proyectos financiados y ejecución', 'Directorio de aliados y donantes'],
          state: 'Disponible', tone: 'purple',
        },
        {
          number: '02', label: 'VIDA Y GESTIÓN ECLESIAL', title: 'Iglesia',
          text: 'Organiza miembros, calendario, eventos, discipulado, educación cristiana, ministerios y aportes dentro de una estructura pastoral clara.',
          features: ['Membresía y seguimiento', 'Calendario y eventos', 'Discipulado y educación cristiana'],
          state: 'En desarrollo', tone: 'orange',
        },
        {
          number: '03', label: 'FORMACIÓN Y CRECIMIENTO', title: 'Productos digitales',
          text: 'Integra cursos, plantillas, ebooks y recursos prácticos vinculados con los procesos que cada organización gestiona dentro de Edifica.',
          features: ['Cursos aplicados al trabajo ministerial', 'Plantillas y bibliotecas descargables', 'Acceso según plan o compra individual'],
          state: 'Catálogo inicial', tone: 'yellow',
        },
      ],
    },
    ecosystem: {
      kicker: 'UN SOLO ECOSISTEMA',
      title: 'Software, equipo y formación en una misma experiencia.',
      intro: 'Edifica funciona por organización. Cada cliente conserva sus datos, crea sus usuarios y accede únicamente a los módulos incluidos en su plan.',
      items: [
        ['Cuenta institucional', 'La organización es la propietaria del espacio, la suscripción y los datos.'],
        ['Equipos con permisos', 'Administradores y operadores trabajan con accesos individuales y responsabilidades definidas.'],
        ['Módulos activables', 'Cada plan establece usuarios, almacenamiento, módulos y productos incluidos.'],
        ['Crecimiento comercial', 'Los recursos digitales amplían el valor del software y crean nuevas oportunidades de formación.'],
      ],
    },
    resources: {
      kicker: 'RECURSOS QUE COMPLEMENTAN EL SOFTWARE',
      title: 'Aprender mientras la organización avanza.',
      intro: 'El catálogo conecta formación y herramientas con necesidades reales de gestión. Estos son ejemplos de líneas de producto, no un catálogo definitivo.',
      items: [
        ['CURSO', 'Administración financiera con integridad', 'Principios, controles y prácticas para equipos administrativos y líderes.'],
        ['PLANTILLAS', 'Presupuesto y planificación ministerial', 'Recursos editables para organizar metas, responsables y ejecución.'],
        ['TALLER', 'Comunicación digital para iglesias', 'Planificación de contenidos, identidad y coordinación de equipos.'],
        ['BIBLIOTECA', 'Membresía y discipulado', 'Guías, formularios y rutas de acompañamiento para la iglesia local.'],
      ],
    },
    plans: {
      kicker: 'MODELO DE SUSCRIPCIÓN',
      title: 'Planes adaptados al tamaño y la operación de cada organización.',
      intro: 'La cantidad de usuarios, módulos habilitados, almacenamiento y productos incluidos se configuran de acuerdo con el plan.',
      items: [
        ['Esencial', 'Para equipos pequeños que necesitan comenzar con un módulo y una estructura clara.', ['Usuarios limitados', 'Un módulo principal', 'Soporte de implementación']],
        ['Organización', 'Para iglesias y organizaciones con varios operadores y procesos activos.', ['Múltiples usuarios', 'Módulos combinables', 'Recursos digitales seleccionados']],
        ['Ecosistema', 'Para organizaciones que requieren una implementación amplia y acompañamiento.', ['Todos los módulos contratados', 'Mayor capacidad de usuarios', 'Formación y soporte prioritario']],
      ],
      cta: 'Solicitar propuesta',
    },
    closing: {
      kicker: 'EDIFICA',
      title: 'Una plataforma preparada para servir a quienes sirven.',
      text: 'Conoce la arquitectura modular, define los procesos prioritarios de tu organización y construye un plan de implementación.',
      cta: 'Solicitar presentación',
      whatsapp: 'Hola, quisiera conocer Edifica y sus módulos para mi organización.',
    },
    footer: 'Software modular para iglesias y organizaciones cristianas.',
  },
  en: {
    metaTitle: 'Edifica Digital | Software for churches',
    metaDescription: 'Edifica is modular software for churches and Christian organizations, with traceable donations, church administration, and digital products in one platform.',
    nav: {
      modules: 'Modules', ecosystem: 'Ecosystem', resources: 'Resources', plans: 'Plans', contact: 'Request a presentation', login: 'Sign in',
      skip: 'Skip to main content', openMenu: 'Open menu', closeMenu: 'Close menu', switchLanguage: 'Cambiar a español',
    },
    hero: {
      kicker: 'MODULAR SOFTWARE FOR CHRISTIAN ORGANIZATIONS',
      title: 'Manage, serve, and grow from one platform.',
      lead: 'Edifica connects your organization’s daily management with specialized tools, work teams, and practical training to advance with order, integrity, and vision.',
      primary: 'Discover Edifica',
      secondary: 'Explore modules',
      note: 'One account per organization, multiple users, and modules activated according to the selected plan.',
    },
    preview: {
      greeting: 'Welcome to Edifica', organization: 'Active organization', modules: 'Available modules', users: 'Authorized users', plan: 'Organization plan',
      donation: 'Donations', church: 'Church', academy: 'Digital products', active: 'Active', next: 'Next phase', included: 'Resources available',
    },
    trust: ['MODULAR MANAGEMENT', 'DATA BY ORGANIZATION', 'TEAM ACCESS', 'SPANISH AND ENGLISH'],
    modules: {
      kicker: 'THREE CONNECTED LINES', title: 'A platform that grows with your organization.',
      intro: 'Each module responds to a specific need and shares the same account, organization, and consistent experience.',
      items: [
        { number: '01', label: 'OPERATIONS AND TRANSPARENCY', title: 'Donations and projects', text: 'Record funds and goods, manage partners, projects, beneficiaries, evidence, volunteering, and executed investment.', features: ['Monetary and in-kind donations', 'Funded projects and execution', 'Partner and donor directory'], state: 'Available', tone: 'purple' },
        { number: '02', label: 'CHURCH LIFE AND MANAGEMENT', title: 'Church', text: 'Organize members, calendars, events, discipleship, Christian education, ministries, and contributions within a clear pastoral structure.', features: ['Membership and follow-up', 'Calendar and events', 'Discipleship and Christian education'], state: 'In development', tone: 'orange' },
        { number: '03', label: 'TRAINING AND GROWTH', title: 'Digital products', text: 'Integrate courses, templates, ebooks, and practical resources linked to the processes each organization manages in Edifica.', features: ['Courses applied to ministry work', 'Downloadable templates and libraries', 'Access by plan or individual purchase'], state: 'Initial catalog', tone: 'yellow' },
      ],
    },
    ecosystem: {
      kicker: 'ONE ECOSYSTEM', title: 'Software, teams, and training in one experience.',
      intro: 'Edifica works by organization. Each customer retains its data, creates users, and accesses only the modules included in its plan.',
      items: [
        ['Institutional account', 'The organization owns the workspace, subscription, and data.'],
        ['Teams with permissions', 'Administrators and operators work through individual accounts and defined responsibilities.'],
        ['Activatable modules', 'Each plan establishes users, storage, modules, and included products.'],
        ['Commercial growth', 'Digital resources expand the value of the software and create new training opportunities.'],
      ],
    },
    resources: {
      kicker: 'RESOURCES THAT COMPLEMENT THE SOFTWARE', title: 'Learn while the organization moves forward.',
      intro: 'The catalog connects training and tools with real management needs. These are examples of product lines, not a final catalog.',
      items: [
        ['COURSE', 'Financial administration with integrity', 'Principles, controls, and practices for administrative teams and leaders.'],
        ['TEMPLATES', 'Budget and ministry planning', 'Editable resources to organize goals, responsibilities, and execution.'],
        ['WORKSHOP', 'Digital communication for churches', 'Content planning, identity, and team coordination.'],
        ['LIBRARY', 'Membership and discipleship', 'Guides, forms, and follow-up paths for the local church.'],
      ],
    },
    plans: {
      kicker: 'SUBSCRIPTION MODEL', title: 'Plans adapted to each organization’s size and operation.',
      intro: 'The number of users, enabled modules, storage, and included products are configured according to the plan.',
      items: [
        ['Essential', 'For small teams starting with one module and a clear structure.', ['Limited users', 'One primary module', 'Implementation support']],
        ['Organization', 'For churches and organizations with several operators and active processes.', ['Multiple users', 'Combinable modules', 'Selected digital resources']],
        ['Ecosystem', 'For organizations requiring broad implementation and guidance.', ['All contracted modules', 'Greater user capacity', 'Training and priority support']],
      ],
      cta: 'Request proposal',
    },
    closing: {
      kicker: 'EDIFICA', title: 'A platform built to serve those who serve.',
      text: 'Explore the modular architecture, define your organization’s priority processes, and build an implementation plan.',
      cta: 'Request a presentation', whatsapp: 'Hello, I would like to learn about Edifica and its modules for my organization.',
    },
    footer: 'Modular software for churches and Christian organizations.',
  },
}

function Brand({ footer = false }) {
  return <a className={`product-brand${footer ? ' footer' : ''}`} href="#inicio"><span className="product-brand-mark"><i /><i /><i /></span><span>edifica<span>digital</span></span></a>
}

function Arrow() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
}

function Check() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.2 3.2 7.8-8" /></svg>
}

export default function ProductLandingPage() {
  const [language, setLanguage] = useState(() => window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es')
  const [menuOpen, setMenuOpen] = useState(false)
  const text = copy[language]
  const contactUrl = buildPublicContactUrl(text.closing.whatsapp, import.meta.env.VITE_PUBLIC_CONTACT_URL)

  useEffect(() => {
    document.documentElement.lang = language
    document.title = text.metaTitle
    document.querySelector('meta[name="description"]')?.setAttribute('content', text.metaDescription)
    window.localStorage.setItem('edifica-language', language)
  }, [language, text])

  const close = () => setMenuOpen(false)

  return (
    <div className="product-site">
      <a href="#main-content" className="skip-link">{text.nav.skip}</a>
      <header className="product-header">
        <Brand />
        <button className="product-menu-button" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? text.nav.closeMenu : text.nav.openMenu} onClick={() => setMenuOpen((current) => !current)}><span /><span /></button>
        <nav className={menuOpen ? 'open' : ''}>
          <a href="#modulos" onClick={close}>{text.nav.modules}</a>
          <a href="#ecosistema" onClick={close}>{text.nav.ecosystem}</a>
          <a href="#recursos" onClick={close}>{text.nav.resources}</a>
          <a href="#planes" onClick={close}>{text.nav.plans}</a>
          <button type="button" aria-label={text.nav.switchLanguage} onClick={() => { setLanguage((current) => current === 'es' ? 'en' : 'es'); close() }}><b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}</button>
          <a className="product-contact-link" href="#contacto" onClick={close}>{text.nav.contact}</a>
          <a className="product-login" href="/app">{text.nav.login} <Arrow /></a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="product-hero" id="inicio">
          <div className="product-hero-copy">
            <p className="product-kicker"><span />{text.hero.kicker}</p>
            <h1>{text.hero.title}</h1>
            <p className="product-hero-lead">{text.hero.lead}</p>
            <div className="product-hero-actions">
              <a href="#contacto" className="product-button primary">{text.hero.primary} <Arrow /></a>
              <a href="#modulos" className="product-text-link">{text.hero.secondary} ↓</a>
            </div>
            <div className="product-hero-note"><strong>ED</strong><p>{text.hero.note}</p></div>
          </div>

          <div className="product-workspace-preview" aria-label="Edifica workspace preview">
            <div className="workspace-preview-top"><Brand /><span>ID</span></div>
            <div className="workspace-preview-body">
              <aside><i className="active" /><i /><i /><i /></aside>
              <div className="workspace-preview-content">
                <small>{text.preview.organization}</small>
                <h2>{text.preview.greeting}</h2>
                <div className="preview-summary"><div><span>{text.preview.modules}</span><strong>3</strong></div><div><span>{text.preview.users}</span><strong>8</strong></div><div><span>{text.preview.plan}</span><strong>✓</strong></div></div>
                <div className="preview-modules">
                  <article><span className="preview-icon purple">D</span><div><strong>{text.preview.donation}</strong><small>{text.preview.active}</small></div><b>→</b></article>
                  <article><span className="preview-icon orange">I</span><div><strong>{text.preview.church}</strong><small>{text.preview.next}</small></div><b>→</b></article>
                  <article><span className="preview-icon yellow">P</span><div><strong>{text.preview.academy}</strong><small>{text.preview.included}</small></div><b>→</b></article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="product-trust-strip">{text.trust.map((item) => <span key={item}>{item}</span>)}</section>

        <section className="product-section product-modules" id="modulos">
          <div className="product-section-heading"><p className="product-kicker"><span />{text.modules.kicker}</p><h2>{text.modules.title}</h2><p>{text.modules.intro}</p></div>
          <div className="product-module-grid">{text.modules.items.map((module) => <article className={module.tone} key={module.title}><header><span>{module.number}</span><small>{module.label}</small><b>{module.state}</b></header><h3>{module.title}</h3><p>{module.text}</p><ul>{module.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul></article>)}</div>
        </section>

        <section className="product-ecosystem" id="ecosistema">
          <div><p className="product-kicker light"><span />{text.ecosystem.kicker}</p><h2>{text.ecosystem.title}</h2><p>{text.ecosystem.intro}</p></div>
          <div className="ecosystem-list">{text.ecosystem.items.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
        </section>

        <section className="product-section product-resources" id="recursos">
          <div className="product-section-heading compact"><p className="product-kicker"><span />{text.resources.kicker}</p><h2>{text.resources.title}</h2><p>{text.resources.intro}</p></div>
          <div className="resource-grid">{text.resources.items.map(([type, title, description], index) => <article key={title}><div className={`resource-cover cover-${index + 1}`}><span>{type}</span><b>ED</b></div><div><small>{type}</small><h3>{title}</h3><p>{description}</p><span className="resource-link">Edifica Digital ↗</span></div></article>)}</div>
        </section>

        <section className="product-section product-plans" id="planes">
          <div className="product-section-heading compact"><p className="product-kicker"><span />{text.plans.kicker}</p><h2>{text.plans.title}</h2><p>{text.plans.intro}</p></div>
          <div className="plan-grid">{text.plans.items.map(([name, description, features], index) => <article className={index === 1 ? 'featured' : ''} key={name}><span>0{index + 1}</span><h3>{name}</h3><p>{description}</p><ul>{features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul><a href="#contacto">{text.plans.cta} <Arrow /></a></article>)}</div>
        </section>

        <section className="product-closing" id="contacto"><div><p>{text.closing.kicker}</p><h2>{text.closing.title}</h2><span>{text.closing.text}</span></div><a href={contactUrl} target="_blank" rel="noreferrer">{text.closing.cta} <Arrow /></a></section>
      </main>

      <footer className="product-footer"><Brand footer /><p>{text.footer}</p><span>© 2026 Edifica Digital</span></footer>
      <Analytics />
    </div>
  )
}
