import { useEffect, useState } from 'react'
import './global-language.css'

const LANGUAGE_KEY = 'edifica-language'

const translations = new Map(Object.entries({
  'ACCESO AL SISTEMA': 'SYSTEM ACCESS',
  'Ingresa al panel de Edifica': 'Access the Edifica dashboard',
  'Usa el correo habilitado por el administrador. Recibirás un enlace seguro para iniciar sesión.': 'Use the email authorized by the administrator. You will receive a secure sign-in link.',
  'Revisa tu correo. El enlace de acceso fue enviado a': 'Check your email. The access link was sent to',
  'Este correo todavía requiere autorización administrativa.': 'This email still requires administrative authorization.',
  'Correo electrónico': 'Email address',
  'Enviar enlace de acceso': 'Send access link',
  'Enviando…': 'Sending…',
  'Cerrar sesión': 'Sign out',
  'PORTAL DE GESTIÓN': 'MANAGEMENT PORTAL',
  'ORGANIZACIÓN ACTIVA': 'ACTIVE ORGANIZATION',
  'Administración general': 'General administration',
  'OPERACIÓN': 'OPERATIONS',
  'Resumen': 'Overview',
  'Donación monetaria': 'Monetary donation',
  'Donación en especies': 'In-kind donation',
  'Voluntariado': 'Volunteering',
  'GESTIÓN Y CUMPLIMIENTO': 'MANAGEMENT AND COMPLIANCE',
  'Proyectos': 'Projects',
  'Resultados e informes': 'Execution and reports',
  'ADMINISTRACIÓN': 'ADMINISTRATION',
  'Personas habilitadas': 'Authorized users',
  'Organizaciones y hosts': 'Organizations and hosts',
  'PANEL OPERATIVO': 'OPERATIONS DASHBOARD',
  'Resumen de operaciones': 'Operations overview',
  'Total registrado': 'Total records',
  'Donaciones de la organización': 'Organization donations',
  'Fondos recibidos': 'Funds received',
  'Base consolidada en USD': 'Consolidated USD base',
  'Inversión ejecutada': 'Executed investment',
  'Gastos reportados o verificados': 'Reported or verified expenses',
  'Cumplimiento físico': 'Physical completion',
  'Promedio de metas entregadas': 'Average delivery against targets',
  'Personas beneficiadas': 'People reached',
  'Registros agregados o nominales': 'Aggregate or individual records',
  'Tipos de donación': 'Donation types',
  'Monetarias / en especies': 'Monetary / in-kind',
  'Registrar donación monetaria': 'Register monetary donation',
  'Divisas, transferencias, efectivo y comprobantes.': 'Currencies, transfers, cash, and payment evidence.',
  'Registrar donación en especies': 'Register in-kind donation',
  'Cargas consolidadas, manifiestos, contenedores y envíos.': 'Consolidated shipments, manifests, containers, and deliveries.',
  'Registrar voluntario': 'Register volunteer',
  'Voluntariado general, médico, cocina, logística y especialidades.': 'General, medical, kitchen, logistics, and specialized volunteering.',
  'Cargar proyecto financiado': 'Create funded project',
  'Consultar proyectos': 'View projects',
  'Objetivos, presupuesto, ejecución, facturas, evidencias e informes.': 'Objectives, budget, execution, invoices, evidence, and reports.',
  'ACTIVIDAD RECIENTE': 'RECENT ACTIVITY',
  'Registros de la organización': 'Organization records',
  'Cargando registros…': 'Loading records…',
  'Todavía no existen donaciones registradas.': 'There are no registered donations yet.',
  'Fecha': 'Date',
  'Referencia': 'Reference',
  'Tipo': 'Type',
  'Donante': 'Donor',
  'Donante o aliado': 'Donor or partner',
  'Estado': 'Status',
  'Acciones': 'Actions',
  'Ver': 'View',
  'Editar': 'Edit',
  'Monetaria': 'Monetary',
  'En especies': 'In kind',
  'Mixta': 'Mixed',
  'Borrador': 'Draft',
  'Anunciada': 'Announced',
  'Recibida': 'Received',
  'Verificada': 'Verified',
  'Cerrada': 'Closed',
  'Operador': 'Operator',
  'Administrador': 'Administrator',
  'Superadministrador': 'Super administrator',

  'CUMPLIMIENTO DEL PROYECTO': 'PROJECT COMPLIANCE',
  'Ejecución e informe final': 'Execution and final report',
  'Registra los avances, las entregas, las personas beneficiadas, la inversión y los soportes requeridos por el aliado o donante.': 'Record progress, deliveries, beneficiaries, investment, and the evidence required by the donor or partner.',
  'Imprimir informe': 'Print report',
  'Proyecto': 'Project',
  'Seleccionar proyecto': 'Select project',
  'Crea o selecciona un proyecto para registrar su ejecución.': 'Create or select a project to record its execution.',
  'Presupuesto aprobado': 'Approved budget',
  'Según avances reportados': 'Based on reported progress',
  'Según registro individual': 'Based on individual records',
  'Avances y entregas': 'Progress and deliveries',
  'Actividad o producto': 'Activity or deliverable',
  'Unidad de medida': 'Unit of measure',
  'Seleccionar unidad': 'Select unit',
  'Planificado': 'Planned',
  'En ejecución': 'In progress',
  'Completado': 'Completed',
  'Verificado': 'Verified',
  'Meta comprometida': 'Committed target',
  'Cantidad armada o producida': 'Quantity prepared or produced',
  'Cantidad entregada': 'Quantity delivered',
  'Observaciones y método de verificación': 'Notes and verification method',
  'Evidencias multimedia': 'Multimedia evidence',
  'Agrega fotografías, PDF o videos que sustenten esta ejecución.': 'Add photographs, PDF files, or videos supporting this execution.',
  'Agregar evidencias': 'Add evidence',
  'Imágenes y PDF: máximo 10 MB. Videos MP4 o MOV: máximo 50 MB.': 'Images and PDF: 10 MB maximum. MP4 or MOV videos: 50 MB maximum.',
  'Limpiar': 'Clear',
  'Guardar cambios': 'Save changes',
  'Registrar avance': 'Record progress',
  'Guardando…': 'Saving…',
  'Inversión ejecutada registrada.': 'Executed investment recorded.',
  'Avance registrado.': 'Progress record saved.',
  'Avance actualizado.': 'Progress record updated.',
  'Fecha de gasto': 'Expense date',
  'Proveedor': 'Supplier',
  'Categoría': 'Category',
  'Descripción': 'Description',
  'Número de factura': 'Invoice number',
  'Referencia de pago': 'Payment reference',
  'Registrar inversión': 'Record investment',
  'Reportado': 'Reported',
  'Rechazado': 'Rejected',
  'INFORME DE CUMPLIMIENTO': 'COMPLIANCE REPORT',
  'cumplimiento físico': 'physical completion',
  'Objetivo': 'Objective',
  'Resultados esperados': 'Expected results',
  'Exigencias de reporte': 'Reporting requirements',
  'Pendiente de definir': 'Pending definition',
  'Según convenio del proyecto': 'According to the project agreement',
  'EJECUCIÓN FÍSICA': 'PHYSICAL EXECUTION',
  'Metas y avances': 'Targets and progress',
  'Todavía faltan avances y entregas por registrar.': 'Progress and deliveries still need to be recorded.',
  'Actividad / producto': 'Activity / deliverable',
  'Meta': 'Target',
  'Armado': 'Prepared',
  'Entregado': 'Delivered',
  'Cumplimiento': 'Completion',
  'Beneficiarios': 'Beneficiaries',
  'Evidencias': 'Evidence',
  'Acción': 'Action',
  'Ver registro': 'View registry',
  'SOPORTES MULTIMEDIA': 'MULTIMEDIA EVIDENCE',
  'Evidencias de ejecución': 'Execution evidence',
  'EJECUCIÓN FINANCIERA': 'FINANCIAL EXECUTION',
  'Inversión y comprobantes': 'Investment and supporting documents',
  'Todavía faltan inversiones o gastos por registrar.': 'Investments or expenses still need to be recorded.',
  'Proveedor / concepto': 'Supplier / description',
  'Factura': 'Invoice',

  'REGISTRO NOMINAL OPCIONAL': 'OPTIONAL INDIVIDUAL REGISTRY',
  'Este proyecto exige detalle individual. Registra únicamente los datos solicitados por el convenio y conserva la aceptación del aviso de privacidad.': 'This project requires individual detail. Record only the data requested by the agreement and retain privacy notice acknowledgement.',
  'Nombre completo *': 'Full name *',
  'Documento o identificación': 'Document or identification',
  'País': 'Country',
  'Ciudad, comunidad o zona': 'City, community, or area',
  'Rango de edad': 'Age range',
  'Sexo': 'Sex',
  'Personas representadas': 'People represented',
  'Beneficio, servicio o entrega recibida': 'Benefit, service, or delivery received',
  'Registro activo': 'Active record',
  'Confirmo que la persona fue informada sobre el uso y resguardo de sus datos.': 'I confirm that the person was informed about the use and protection of their data.',
  'Registrar persona': 'Register person',
  'Persona beneficiaria registrada.': 'Beneficiary registered.',
  'Persona beneficiaria actualizada.': 'Beneficiary updated.',
  'Cargando personas beneficiadas…': 'Loading beneficiaries…',
  'Todavía no existen personas registradas para este proyecto.': 'There are no people registered for this project yet.',
  'Persona': 'Person',
  'Contacto': 'Contact',
  'Ubicación': 'Location',
  'Beneficio': 'Benefit',
  'Sin identificación': 'No identification',
  'Sin especificar': 'Unspecified',
  '0 a 5 años': '0 to 5 years',
  '6 a 12 años': '6 to 12 years',
  '13 a 17 años': '13 to 17 years',
  '18 a 59 años': '18 to 59 years',
  '60 años o más': '60 years or older',
  'Femenino': 'Female',
  'Masculino': 'Male',
  'Intersexual': 'Intersex',
  'Prefiere no indicar': 'Prefer not to say',

  'CUMPLIMIENTO Y TRAZABILIDAD': 'COMPLIANCE AND TRACEABILITY',
  'Proyectos financiados': 'Funded projects',
  'Administra la cartera de proyectos, sus aliados o donantes, presupuesto, objetivos y exigencias de cumplimiento desde una vista institucional.': 'Manage the project portfolio, donors or partners, budgets, objectives, and compliance requirements from an institutional view.',
  'Nuevo proyecto': 'New project',
  'proyectos activos': 'active projects',
  'Buscar por código, proyecto, organización o aliado/donante': 'Search by code, project, organization, or donor/partner',
  'Todos los estados': 'All statuses',
  'Todas las organizaciones': 'All organizations',
  'CARTERA DE PROYECTOS': 'PROJECT PORTFOLIO',
  'Proyectos registrados': 'Registered projects',
  'Organización / aliado o donante': 'Organization / donor or partner',
  'Vigencia': 'Term',
  'Presupuesto': 'Budget',
  'Registro nominal': 'Individual registry',
  'hasta': 'through',
  'Por definir': 'To be defined',
  'Crear': 'Create',
  'IDENTIFICACIÓN DEL PROYECTO': 'PROJECT IDENTIFICATION',
  'Identificación del proyecto': 'Project identification',
  'Datos de la organización responsable y del aliado o donante que financia.': 'Information about the responsible organization and the donor or partner providing funding.',
  'Organización usuaria': 'Client organization',
  'Código del proyecto': 'Project code',
  'Nombre del proyecto': 'Project name',
  'Aliado o donante financiador': 'Funding donor or partner',
  'Financiamiento y vigencia': 'Funding and term',
  'Presupuesto aprobado, moneda, fechas y situación operativa.': 'Approved budget, currency, dates, and operating status.',
  'Moneda': 'Currency',
  'Fecha de inicio': 'Start date',
  'Fecha de cierre': 'End date',
  'Compromisos de cumplimiento': 'Compliance commitments',
  'Base narrativa y nivel de detalle requerido para cotejar lo aprobado frente a la ejecución final.': 'Narrative basis and level of detail required to compare approval with final execution.',
  'Este proyecto requiere registrar individualmente a las personas beneficiadas.': 'This project requires individual beneficiary records.',
  'Activa esta opción únicamente cuando el aliado o donante solicite datos nominales. Los demás proyectos conservarán cifras agregadas.': 'Enable this option when the donor or partner requests individual data. Other projects will retain aggregate figures.',
  'Registrar proyecto': 'Register project',
  'Proyecto registrado correctamente.': 'Project registered successfully.',
  'Proyecto actualizado correctamente.': 'Project updated successfully.',
  'En planificación': 'Planning',
  'Presentado': 'Submitted',
  'Aprobado': 'Approved',
  'Pausado': 'Paused',
  'Cancelado': 'Cancelled',

  'ADMINISTRACIÓN MULTITENANT': 'MULTITENANT ADMINISTRATION',
  'organizaciones activas': 'active organizations',
  'EDITAR ORGANIZACIÓN': 'EDIT ORGANIZATION',
  'NUEVA ORGANIZACIÓN': 'NEW ORGANIZATION',
  'Actualizar tenant': 'Update tenant',
  'Crear tenant': 'Create tenant',
  'Nombre visible': 'Display name',
  'Código del tenant': 'Tenant code',
  'Razón social': 'Legal name',
  'RIF / identificación fiscal': 'Tax identification',
  'Correo de contacto': 'Contact email',
  'Teléfono': 'Phone',
  'Suscripción': 'Subscription',
  'Organización activa': 'Active organization',
  'Crear organización': 'Create organization',
  'HOST Y TENANT': 'HOST AND TENANT',
  'Dominio de acceso': 'Access domain',
  'Organización': 'Organization',
  'Seleccionar': 'Select',
  'Hostname': 'Hostname',
  'Host principal': 'Primary host',
  'Host activo': 'Active host',
  'Guardar host': 'Save host',
  'Asociar host': 'Link host',
  'CUENTAS': 'ACCOUNTS',
  'Organizaciones registradas': 'Registered organizations',
  'ENRUTAMIENTO': 'ROUTING',
  'Hosts registrados': 'Registered hosts',
  'Principal': 'Primary',
  'Alternativo': 'Alternative',
  'Activo': 'Active',
  'Inactivo': 'Inactive',
  'Activa': 'Active',
  'Inactiva': 'Inactive',
  'Prueba': 'Trial',
  'Pago pendiente': 'Past due',
  'Suspendida': 'Suspended',
  'Cancelada': 'Cancelled',

  'Agrega usuarios, asígnalos a una organización y administra su nivel de acceso dentro de Edifica.': 'Add users, assign them to an organization, and manage their access level in Edifica.',
  'accesos activos': 'active access records',
  'EDITAR ACCESO': 'EDIT ACCESS',
  'NUEVO ACCESO': 'NEW ACCESS',
  'Actualizar persona': 'Update user',
  'Habilitar una persona': 'Authorize a user',
  'Nombre': 'Name',
  'Nombre y apellido': 'First and last name',
  'Sin asignar': 'Unassigned',
  'Rol': 'Role',
  'Acceso activo': 'Active access',
  'Habilitar persona': 'Authorize user',
  'DIRECTORIO': 'DIRECTORY',
  'Usuarios del sistema': 'System users',
  'Actualizado': 'Updated',
  'Suspendido': 'Suspended',
  'Suspender': 'Suspend',
  'Reactivar': 'Reactivate',
  'Cargando personas habilitadas…': 'Loading authorized users…',
  'Todavía no existen personas habilitadas.': 'There are no authorized users yet.',

  'REGISTRO DE VOLUNTARIADO': 'VOLUNTEER REGISTRATION',
  'Voluntarios': 'Volunteers',
  'Voluntario general': 'General volunteer',
  'Voluntario especializado': 'Specialized volunteer',
  'Profesión u oficio': 'Profession or trade',
  'Matrícula o licencia profesional': 'Professional license',
  'Disponibilidad': 'Availability',
  'Contacto de emergencia': 'Emergency contact',
  'Especialidades': 'Specialties',
  'Cargando…': 'Loading…',
  'Cancelar': 'Cancel',
  'Eliminar': 'Remove',
  'Sin fecha': 'No date',
  'Sin referencia': 'No reference',
  'Donante registrado': 'Registered donor',
}))

const patterns = [
  [/^(\d+) registros$/, '$1 records'],
  [/^(\d+) proyectos$/, '$1 projects'],
  [/^(\d+) proyectos activos$/, '$1 active projects'],
  [/^(\d+) personas$/, '$1 people'],
  [/^(\d+) activas$/, '$1 active'],
  [/^(\d+) hosts$/, '$1 hosts'],
  [/^(\d+) indicadores$/, '$1 indicators'],
  [/^(\d+) archivos$/, '$1 files'],
  [/^(\d+) evidencias$/, '$1 evidence files'],
  [/^(\d+)% del presupuesto$/, '$1% of budget'],
  [/^Monto \(([^)]+)\)$/, 'Amount ($1)'],
  [/^hasta (.+)$/, 'through $1'],
]

const textState = new WeakMap()
const attributeState = new WeakMap()
const translatedAttributes = ['placeholder', 'title', 'aria-label']

function translateValue(value) {
  const match = String(value ?? '').match(/^(\s*)([\s\S]*?)(\s*)$/)
  const prefix = match?.[1] ?? ''
  const text = match?.[2] ?? value
  const suffix = match?.[3] ?? ''
  if (!text) return value
  const exact = translations.get(text)
  if (exact) return `${prefix}${exact}${suffix}`
  for (const [pattern, replacement] of patterns) {
    pattern.lastIndex = 0
    if (pattern.test(text)) return `${prefix}${text.replace(pattern, replacement)}${suffix}`
  }
  return value
}

function shouldSkip(node) {
  const parent = node.parentElement
  return !parent || parent.closest('[data-no-translate], script, style, textarea, [contenteditable="true"]')
}

function applyLanguage(root, language) {
  if (!root) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (!shouldSkip(node)) {
      const current = node.nodeValue
      let state = textState.get(node)
      if (!state || current !== state.applied) state = { source: current, applied: current }
      const next = language === 'en' ? translateValue(state.source) : state.source
      state.applied = next
      textState.set(node, state)
      if (current !== next) node.nodeValue = next
    }
    node = walker.nextNode()
  }

  root.querySelectorAll?.('*').forEach((element) => {
    if (element.closest('[data-no-translate]')) return
    const states = attributeState.get(element) ?? {}
    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return
      const current = element.getAttribute(attribute)
      let state = states[attribute]
      if (!state || current !== state.applied) state = { source: current, applied: current }
      const next = language === 'en' ? translateValue(state.source) : state.source
      state.applied = next
      states[attribute] = state
      if (current !== next) element.setAttribute(attribute, next)
    })
    attributeState.set(element, states)
  })
}

function readLanguage() {
  try { return window.localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'es' } catch { return 'es' }
}

export default function GlobalLanguageController() {
  const isPortal = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
  const [language, setLanguage] = useState(readLanguage)

  useEffect(() => {
    if (!isPortal) return undefined
    document.documentElement.lang = language
    window.localStorage.setItem(LANGUAGE_KEY, language)
    const root = document.getElementById('root')
    applyLanguage(root, language)

    let frame = 0
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => applyLanguage(root, language))
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatedAttributes })
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [isPortal, language])

  if (!isPortal) return null

  return (
    <button className="global-language-control" type="button" onClick={() => setLanguage((current) => current === 'es' ? 'en' : 'es')} aria-label={language === 'es' ? 'Change language to English' : 'Cambiar idioma a español'} data-no-translate>
      <span className={language === 'es' ? 'active' : ''}>ES</span><i>/</i><span className={language === 'en' ? 'active' : ''}>EN</span>
    </button>
  )
}
