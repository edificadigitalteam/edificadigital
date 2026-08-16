import { useEffect, useState } from 'react'
import { Analytics, track } from '@vercel/analytics/react'
import { buildPublicContactUrl } from '../../contact.js'
import './product-landing.css'

const copy = {
  es: {
    metaTitle: 'Edifica Digital | Software para organizaciones cristianas',
    metaDescription: 'Edifica es un software modular para iglesias y organizaciones cristianas con gestión organizacional, donaciones trazables, proyectos, equipos y productos digitales.',
    nav: { modules: 'Módulos', ecosystem: 'Ecosistema', resources: 'Recursos', plans: 'Planes', faq: 'FAQ', contact: 'Solicitar presentación', login: 'Iniciar sesión', skip: 'Saltar al contenido principal', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú', switchLanguage: 'Switch to English' },
    hero: {
      kicker: 'SOFTWARE MODULAR PARA IGLESIAS Y ORGANIZACIONES CRISTIANAS',
      title: 'Ordena la gestión. Demuestra el impacto. Haz crecer la organización.',
      lead: 'Edifica conecta estructura, objetivos, proyectos, donaciones, equipos e informes en un solo espacio de trabajo, con datos separados por organización y accesos según responsabilidad.',
      primary: 'Solicitar presentación', secondary: 'Explorar módulos',
      note: 'Una cuenta institucional, múltiples usuarios y módulos que se adaptan a convenciones, asociaciones, iglesias, ministerios y organizaciones de servicio.',
    },
    preview: { greeting: 'Bienvenido a Edifica', organization: 'Organización activa', modules: 'Módulos disponibles', users: 'Usuarios habilitados', plan: 'Plan Organización', donation: 'Donaciones', management: 'Gestión organizacional', academy: 'Productos digitales', active: 'Activo', structured: 'Estructura activa', included: 'Recursos disponibles' },
    trust: ['GESTIÓN MULTITENANT', 'OBJETIVOS Y SEGUIMIENTO', 'PROYECTOS TRAZABLES', 'ESPAÑOL E INGLÉS'],
    modules: {
      kicker: 'TRES LÍNEAS CONECTADAS', title: 'Una plataforma que entiende cómo trabaja una organización.',
      intro: 'Los módulos comparten la misma cuenta, los mismos usuarios y una arquitectura de datos común. Cada organización activa únicamente lo que necesita.',
      items: [
        { number: '01', label: 'OPERACIÓN Y TRANSPARENCIA', title: 'Donaciones y proyectos', text: 'Registra fondos y bienes, administra aliados, proyectos, beneficiarios, evidencias, voluntariado e inversión ejecutada.', features: ['Donaciones monetarias y en especies', 'Proyectos financiados y ejecución', 'Aliados, beneficiarios y evidencias'], state: 'Disponible', tone: 'purple' },
        { number: '02', label: 'PLANIFICACIÓN Y CUMPLIMIENTO', title: 'Gestión organizacional', text: 'Construye el organigrama, asigna responsables, define objetivos, vincula proyectos, mide indicadores y consolida informes por dirección, departamento o ministerio.', features: ['Organigrama y equipos', 'Objetivos, proyectos e indicadores', 'Informes por unidad y consolidado institucional'], state: 'Disponible', tone: 'orange' },
        { number: '03', label: 'FORMACIÓN Y CRECIMIENTO', title: 'Productos digitales', text: 'Integra cursos, plantillas, ebooks y recursos prácticos asociados con los procesos que la organización ya administra dentro de Edifica.', features: ['Cursos aplicados a la gestión', 'Plantillas y bibliotecas descargables', 'Acceso por plan o compra individual'], state: 'Catálogo inicial', tone: 'yellow' },
      ],
    },
    ecosystem: {
      kicker: 'UNA MISMA ARQUITECTURA', title: 'Funciona para una convención nacional y para una iglesia local.',
      intro: 'Cada cliente tiene su propio tenant. Dentro puede crear direcciones, departamentos, ministerios, comités, sedes o áreas y asignar usuarios a responsabilidades específicas.',
      items: [
        ['Cuenta institucional', 'La organización es propietaria del espacio, la suscripción y sus datos.'],
        ['Estructura adaptable', 'El organigrama se configura según la realidad de una convención, asociación, iglesia u organización.'],
        ['Usuarios con responsabilidad', 'Administradores, directores y operadores trabajan con accesos individuales y permisos definidos.'],
        ['Información reutilizable', 'Proyectos, objetivos, indicadores y evidencias se relacionan entre módulos para reducir duplicaciones.'],
      ],
    },
    resources: {
      kicker: 'RECURSOS QUE COMPLEMENTAN EL SOFTWARE', title: 'La plataforma también puede convertirse en un canal de formación.',
      intro: 'El catálogo puede ofrecer recursos relacionados con los procesos que cada organización gestiona. Los siguientes son ejemplos de líneas comerciales, no un catálogo definitivo.',
      items: [
        ['CURSO', 'Administración financiera con integridad', 'Principios, controles y prácticas para equipos administrativos y líderes.'],
        ['PLANTILLAS', 'Planificación y seguimiento institucional', 'Recursos editables para objetivos, responsables, indicadores y ejecución.'],
        ['TALLER', 'Comunicación digital para organizaciones cristianas', 'Contenido, identidad y coordinación práctica de equipos.'],
        ['BIBLIOTECA', 'Membresía, discipulado y vida ministerial', 'Guías y formularios aplicables en iglesias y ministerios.'],
      ],
    },
    plans: {
      kicker: 'MODELO DE SUSCRIPCIÓN', title: 'El plan crece con el tamaño y la complejidad de la organización.',
      intro: 'Usuarios, almacenamiento, módulos habilitados y productos incluidos pueden configurarse según la operación de cada cliente.',
      items: [
        ['Esencial', 'Para equipos pequeños que quieren comenzar con procesos centrales.', ['Usuarios limitados', 'Un módulo principal', 'Implementación inicial']],
        ['Organización', 'Para iglesias y organizaciones con varias áreas y operadores.', ['Múltiples usuarios', 'Módulos combinables', 'Gestión por áreas y responsables']],
        ['Ecosistema', 'Para estructuras amplias que requieren gestión institucional y acompañamiento.', ['Módulos contratados', 'Mayor capacidad de usuarios', 'Formación y soporte prioritario']],
      ], cta: 'Solicitar propuesta',
    },
    faq: {
      kicker: 'PREGUNTAS FRECUENTES', title: 'Lo esencial antes de implementar Edifica.',
      items: [
        ['¿Qué es Edifica Digital?', 'Edifica es un software modular para iglesias y organizaciones cristianas que conecta gestión organizacional, donaciones, proyectos, equipos e información de cumplimiento en una sola plataforma.'],
        ['¿Qué significa Gestión Organizacional?', 'Es el módulo donde cada organización construye su estructura, define períodos y objetivos, asigna responsables, vincula proyectos, registra indicadores y produce informes por unidad y un consolidado institucional.'],
        ['¿También sirve para una iglesia local?', 'Sí. Una iglesia puede configurar ministerios, departamentos, comités, áreas o sedes dentro del mismo modelo de Gestión Organizacional. La estructura se adapta a la organización y no depende de un organigrama único.'],
        ['¿Qué hace el módulo de Donaciones y proyectos?', 'Registra donaciones monetarias y en especies, administra aliados, beneficiarios, evidencias y ejecución, y permite vincular los proyectos con las áreas y objetivos de Gestión Organizacional.'],
        ['¿Los datos de una organización se mezclan con los de otra?', 'Cada organización trabaja dentro de su propio tenant y sus usuarios acceden únicamente a la información autorizada.'],
        ['¿Puedo limitar la cantidad de usuarios?', 'Sí. Los planes contemplan cupos de usuarios y Edifica controla los accesos activos por organización.'],
        ['¿Edifica está disponible en español e inglés?', 'Sí. La interfaz incluye español e inglés con preferencia persistente.'],
        ['¿Cómo solicito una presentación?', 'Desde esta página puedes abrir el canal de contacto del equipo de Edifica y solicitar una presentación orientada a tu organización.'],
      ],
    },
    closing: { kicker: 'EDIFICA', title: 'Convierte información dispersa en gestión que se puede presentar, verificar y mejorar.', text: 'Conoce la plataforma, define la estructura de tu organización y construye un plan de implementación por módulos.', cta: 'Solicitar presentación', whatsapp: 'Hola, quisiera conocer Edifica y sus módulos para mi organización.' },
    footer: 'Software modular para iglesias y organizaciones cristianas.',
  },
  en: {
    metaTitle: 'Edifica Digital | Software for Christian organizations',
    metaDescription: 'Edifica is modular software for churches and Christian organizations with organizational management, traceable donations, projects, teams, and digital products.',
    nav: { modules: 'Modules', ecosystem: 'Ecosystem', resources: 'Resources', plans: 'Plans', faq: 'FAQ', contact: 'Request a presentation', login: 'Sign in', skip: 'Skip to main content', openMenu: 'Open menu', closeMenu: 'Close menu', switchLanguage: 'Cambiar a español' },
    hero: { kicker: 'MODULAR SOFTWARE FOR CHURCHES AND CHRISTIAN ORGANIZATIONS', title: 'Organize management. Prove impact. Grow the organization.', lead: 'Edifica connects structure, objectives, projects, donations, teams, and reports in one workspace, with data separated by organization and access based on responsibility.', primary: 'Request a presentation', secondary: 'Explore modules', note: 'One institutional account, multiple users, and modules that adapt to conventions, associations, churches, ministries, and service organizations.' },
    preview: { greeting: 'Welcome to Edifica', organization: 'Active organization', modules: 'Available modules', users: 'Authorized users', plan: 'Organization plan', donation: 'Donations', management: 'Organizational management', academy: 'Digital products', active: 'Active', structured: 'Structure active', included: 'Resources available' },
    trust: ['MULTITENANT MANAGEMENT', 'OBJECTIVES AND TRACKING', 'TRACEABLE PROJECTS', 'SPANISH AND ENGLISH'],
    modules: { kicker: 'THREE CONNECTED LINES', title: 'A platform that understands how organizations work.', intro: 'Modules share the same account, users, and common data architecture. Each organization activates only what it needs.', items: [
      { number: '01', label: 'OPERATIONS AND TRANSPARENCY', title: 'Donations and projects', text: 'Record funds and goods, manage partners, projects, beneficiaries, evidence, volunteering, and executed investment.', features: ['Monetary and in-kind donations', 'Funded projects and execution', 'Partners, beneficiaries, and evidence'], state: 'Available', tone: 'purple' },
      { number: '02', label: 'PLANNING AND COMPLIANCE', title: 'Organizational management', text: 'Build the organization chart, assign leaders, define objectives, link projects, measure indicators, and consolidate reports by directorate, department, or ministry.', features: ['Organization chart and teams', 'Objectives, projects, and indicators', 'Unit reports and institutional consolidation'], state: 'Available', tone: 'orange' },
      { number: '03', label: 'TRAINING AND GROWTH', title: 'Digital products', text: 'Integrate courses, templates, ebooks, and practical resources linked to the processes managed in Edifica.', features: ['Courses applied to management', 'Downloadable templates and libraries', 'Access by plan or individual purchase'], state: 'Initial catalog', tone: 'yellow' },
    ] },
    ecosystem: { kicker: 'ONE ARCHITECTURE', title: 'It works for a national convention and for a local church.', intro: 'Each customer has its own tenant. Inside it can create directorates, departments, ministries, committees, campuses, or areas and assign users to specific responsibilities.', items: [
      ['Institutional account', 'The organization owns its workspace, subscription, and data.'], ['Adaptable structure', 'The organization chart is configured according to a convention, association, church, or organization.'], ['Users with responsibility', 'Administrators, directors, and operators work with individual accounts and defined permissions.'], ['Reusable information', 'Projects, objectives, indicators, and evidence are linked across modules to reduce duplication.'],
    ] },
    resources: { kicker: 'RESOURCES THAT COMPLEMENT THE SOFTWARE', title: 'The platform can also become a training channel.', intro: 'The catalog can offer resources related to the processes each organization manages. These are examples of commercial product lines, not a final catalog.', items: [
      ['COURSE', 'Financial administration with integrity', 'Principles, controls, and practices for administrative teams and leaders.'], ['TEMPLATES', 'Institutional planning and tracking', 'Editable resources for objectives, responsibilities, indicators, and execution.'], ['WORKSHOP', 'Digital communication for Christian organizations', 'Content, identity, and practical team coordination.'], ['LIBRARY', 'Membership, discipleship, and ministry life', 'Guides and forms for churches and ministries.'],
    ] },
    plans: { kicker: 'SUBSCRIPTION MODEL', title: 'The plan grows with the size and complexity of the organization.', intro: 'Users, storage, enabled modules, and included products can be configured according to each customer’s operation.', items: [
      ['Essential', 'For small teams starting with core processes.', ['Limited users', 'One primary module', 'Initial implementation']], ['Organization', 'For churches and organizations with several areas and operators.', ['Multiple users', 'Combinable modules', 'Management by areas and leaders']], ['Ecosystem', 'For broad structures requiring institutional management and guidance.', ['Contracted modules', 'Greater user capacity', 'Training and priority support']],
    ], cta: 'Request proposal' },
    faq: { kicker: 'FREQUENTLY ASKED QUESTIONS', title: 'What matters before implementing Edifica.', items: [
      ['What is Edifica Digital?', 'Edifica is modular software for churches and Christian organizations that connects organizational management, donations, projects, teams, and compliance information in one platform.'], ['What does Organizational Management mean?', 'It is the module where each organization builds its structure, defines periods and objectives, assigns responsibilities, links projects, records indicators, and produces unit reports and an institutional consolidation.'], ['Does it also work for a local church?', 'Yes. A church can configure ministries, departments, committees, areas, or campuses within the same Organizational Management model.'], ['What does Donations and projects do?', 'It records monetary and in-kind donations, manages partners, beneficiaries, evidence, and execution, and links projects to organizational units and objectives.'], ['Is data from different organizations mixed?', 'Each organization works within its own tenant and users only access authorized information.'], ['Can I limit the number of users?', 'Yes. Plans include user seat limits and Edifica controls active access by organization.'], ['Is Edifica available in Spanish and English?', 'Yes. The interface includes Spanish and English with a persistent preference.'], ['How do I request a presentation?', 'Use the contact channel on this page to request a presentation tailored to your organization.'],
    ] },
    closing: { kicker: 'EDIFICA', title: 'Turn scattered information into management that can be presented, verified, and improved.', text: 'Explore the platform, define your organization’s structure, and build a modular implementation plan.', cta: 'Request a presentation', whatsapp: 'Hello, I would like to learn about Edifica and its modules for my organization.' }, footer: 'Modular software for churches and Christian organizations.',
  },
}

function Brand({ footer = false }) { return <a className={`product-brand${footer ? ' footer' : ''}`} href="#inicio"><span className="product-brand-mark"><i /><i /><i /></span><span>edifica<span>digital</span></span></a> }
function Arrow() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg> }
function Check() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.2 3.2 7.8-8" /></svg> }

export default function ProductLandingPage() {
  const [language, setLanguage] = useState(() => window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es')
  const [menuOpen, setMenuOpen] = useState(false)
  const text = copy[language]
  const contactUrl = buildPublicContactUrl(text.closing.whatsapp, import.meta.env.VITE_PUBLIC_CONTACT_URL)

  useEffect(() => { document.documentElement.lang = language; document.title = text.metaTitle; document.querySelector('meta[name="description"]')?.setAttribute('content', text.metaDescription); window.localStorage.setItem('edifica-language', language) }, [language, text])
  useEffect(() => {
    if (!menuOpen) return undefined
    const body = document.body.style.overflow; const html = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'
    const onKeyDown = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = body; document.documentElement.style.overflow = html; document.removeEventListener('keydown', onKeyDown) }
  }, [menuOpen])
  const close = () => setMenuOpen(false)
  const trackCta = (name, props) => track(name, { language, ...props })

  return <div className="product-site">
    <a href="#main-content" className="skip-link">{text.nav.skip}</a>
    <header className="product-header"><Brand /><button className="product-menu-button" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? text.nav.closeMenu : text.nav.openMenu} onClick={() => setMenuOpen((current) => !current)}><span /><span /></button><nav className={menuOpen ? 'open' : ''}><a href="#modulos" onClick={close}>{text.nav.modules}</a><a href="#ecosistema" onClick={close}>{text.nav.ecosystem}</a><a href="#recursos" onClick={close}>{text.nav.resources}</a><a href="#planes" onClick={close}>{text.nav.plans}</a><a href="#faq" onClick={close}>{text.nav.faq}</a><button type="button" aria-label={text.nav.switchLanguage} onClick={() => { setLanguage((current) => current === 'es' ? 'en' : 'es'); close() }}><b>{language.toUpperCase()}</b><span>/</span>{language === 'es' ? 'EN' : 'ES'}</button><a className="product-contact-link" href="#contacto" onClick={close}>{text.nav.contact}</a><a className="product-login" href="/app">{text.nav.login} <Arrow /></a></nav></header>
    {menuOpen ? <button type="button" className="product-menu-backdrop" aria-label={text.nav.closeMenu} onClick={close} /> : null}
    <main id="main-content" tabIndex={-1}>
      <section className="product-hero" id="inicio"><div className="product-hero-copy"><p className="product-kicker"><span />{text.hero.kicker}</p><h1>{text.hero.title}</h1><p className="product-hero-lead">{text.hero.lead}</p><div className="product-hero-actions"><a href="#contacto" className="product-button primary" onClick={() => trackCta('hero_primary_click')}>{text.hero.primary} <Arrow /></a><a href="#modulos" className="product-text-link" onClick={() => trackCta('hero_secondary_click')}>{text.hero.secondary} ↓</a></div><div className="product-hero-note"><strong>ED</strong><p>{text.hero.note}</p></div></div>
        <div className="product-workspace-preview" aria-label="Edifica workspace preview"><div className="workspace-preview-top"><Brand /><span>ID</span></div><div className="workspace-preview-body"><aside><i className="active" /><i /><i /><i /></aside><div className="workspace-preview-content"><small>{text.preview.organization}</small><h2>{text.preview.greeting}</h2><div className="preview-summary"><div><span>{text.preview.modules}</span><strong>3</strong></div><div><span>{text.preview.users}</span><strong>8</strong></div><div><span>{text.preview.plan}</span><strong>✓</strong></div></div><div className="preview-modules"><article><span className="preview-icon purple">D</span><div><strong>{text.preview.donation}</strong><small>{text.preview.active}</small></div><b>→</b></article><article><span className="preview-icon orange">G</span><div><strong>{text.preview.management}</strong><small>{text.preview.structured}</small></div><b>→</b></article><article><span className="preview-icon yellow">P</span><div><strong>{text.preview.academy}</strong><small>{text.preview.included}</small></div><b>→</b></article></div></div></div></div>
      </section>
      <section className="product-trust-strip">{text.trust.map((item) => <span key={item}>{item}</span>)}</section>
      <section className="product-section product-modules" id="modulos"><div className="product-section-heading"><p className="product-kicker"><span />{text.modules.kicker}</p><h2>{text.modules.title}</h2><p>{text.modules.intro}</p></div><div className="product-module-grid">{text.modules.items.map((module) => <article className={module.tone} key={module.title}><header><span>{module.number}</span><small>{module.label}</small><b>{module.state}</b></header><h3>{module.title}</h3><p>{module.text}</p><ul>{module.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul></article>)}</div></section>
      <section className="product-ecosystem" id="ecosistema"><div><p className="product-kicker light"><span />{text.ecosystem.kicker}</p><h2>{text.ecosystem.title}</h2><p>{text.ecosystem.intro}</p></div><div className="ecosystem-list">{text.ecosystem.items.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
      <section className="product-section product-resources" id="recursos"><div className="product-section-heading compact"><p className="product-kicker"><span />{text.resources.kicker}</p><h2>{text.resources.title}</h2><p>{text.resources.intro}</p></div><div className="resource-grid">{text.resources.items.map(([type,title,description], index) => <article key={title}><div className={`resource-cover cover-${index + 1}`}><span>{type}</span><b>ED</b></div><div><small>{type}</small><h3>{title}</h3><p>{description}</p><span className="resource-link">Edifica Digital ↗</span></div></article>)}</div></section>
      <section className="product-section product-plans" id="planes"><div className="product-section-heading compact"><p className="product-kicker"><span />{text.plans.kicker}</p><h2>{text.plans.title}</h2><p>{text.plans.intro}</p></div><div className="plan-grid">{text.plans.items.map(([name,description,features], index) => <article className={index === 1 ? 'featured' : ''} key={name}><span>0{index + 1}</span><h3>{name}</h3><p>{description}</p><ul>{features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul><a href="#contacto" onClick={() => trackCta('plan_cta_click', { plan: name })}>{text.plans.cta} <Arrow /></a></article>)}</div></section>
      <section className="product-section product-faq" id="faq"><div className="product-section-heading compact"><p className="product-kicker"><span />{text.faq.kicker}</p><h2>{text.faq.title}</h2></div><div className="faq-list">{text.faq.items.map(([question,answer]) => <details key={question}><summary>{question}<Arrow /></summary><p>{answer}</p></details>)}</div></section>
      <section className="product-closing" id="contacto"><div><p>{text.closing.kicker}</p><h2>{text.closing.title}</h2><span>{text.closing.text}</span></div><a href={contactUrl} target="_blank" rel="noreferrer" onClick={() => trackCta('contact_whatsapp_click')}>{text.closing.cta} <Arrow /></a></section>
    </main>
    <footer className="product-footer"><Brand footer /><p>{text.footer}</p><span>© 2026 Edifica Digital</span></footer><Analytics />
  </div>
}
