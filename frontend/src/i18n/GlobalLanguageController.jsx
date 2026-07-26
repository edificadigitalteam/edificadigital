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
  'Donaciones monetarias': 'Monetary donations',
  'Donaciones en especies': 'In-kind donations',
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
  'Registra los avances del proyecto, las entregas, las personas beneficiadas, la inversión y los soportes requeridos por el aliado financiador.': 'Record project progress, deliveries, beneficiaries, investment, and the evidence required by the funding partner.',
  'Imprimir informe': 'Print report',
  'Proyecto': 'Project',
  'Seleccionar proyecto': 'Select project',
  'Crea o selecciona un proyecto para registrar su ejecución.': 'Create or select a project to record its execution.',
  'Presupuesto aprobado': 'Approved budget',
  'Inversión ejecutada': 'Executed investment',
  'Cumplimiento físico': 'Delivery completion',
  'Personas beneficiadas': 'People reached',
  'Promedio de metas entregadas': 'Average delivery against targets',
  'Según avances reportados': 'Based on reported progress',
  'Avances y entregas': 'Progress and deliveries',
  'Resultado o producto': 'Activity or deliverable',
  'Unidad de medida': 'Unit of measure',
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
  'cumplimiento físico': 'delivery completion',
  'Objetivo': 'Objective',
  'Resultados esperados': 'Expected results',
  'Exigencias de reporte': 'Reporting requirements',
  'Pendiente de definir': 'Pending definition',
  'Según convenio del proyecto': 'According to the project agreement',
  'EJECUCIÓN FÍSICA': 'DELIVERY EXECUTION',
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
  'EJECUCIÓN FINANCIERA': 'FINANCIAL EXECUTION',
  'Inversión y comprobantes': 'Investment and supporting documents',
  'Todavía faltan inversiones o gastos por registrar.': 'Investments or expenses still need to be recorded.',
  'Proveedor / concepto': 'Supplier / description',
  'Factura': 'Invoice',
  'CUMPLIMIENTO Y TRAZABILIDAD': 'COMPLIANCE AND TRACEABILITY',
  'Proyectos financiados': 'Funded projects',
  'Nuevo proyecto': 'New project',
  'Buscar por código, proyecto o aliado financiador': 'Search by code, project, or funding partner',
  'Todos los estados': 'All statuses',
  'Todas las organizaciones': 'All organizations',
  'Buscar': 'Search',
  'CARTERA DE PROYECTOS': 'PROJECT PORTFOLIO',
  'Proyecto / código': 'Project / code',
  'Organización / financiador': 'Organization / funding partner',
  'Vigencia': 'Term',
  'Presupuesto': 'Budget',
  'Cumplimiento': 'Compliance',
  'Cancelar edición': 'Cancel editing',
  'IDENTIFICACIÓN DEL PROYECTO': 'PROJECT IDENTIFICATION',
  'Organización usuaria': 'Client organization',
  'Código del proyecto': 'Project code',
  'Nombre del proyecto': 'Project name',
  'Aliado u organización financiadora': 'Funding partner or organization',
  'FINANCIAMIENTO Y VIGENCIA': 'FUNDING AND TERM',
  'Moneda del presupuesto': 'Budget currency',
  'Fecha de inicio': 'Start date',
  'Fecha de cierre': 'End date',
  'COMPROMISOS DE CUMPLIMIENTO': 'COMPLIANCE COMMITMENTS',
  'Exigencias de reporte y cumplimiento': 'Reporting and compliance requirements',
  'Observaciones': 'Notes',
  'Registrar proyecto': 'Register project',
  'Proyecto registrado.': 'Project registered.',
  'Proyecto actualizado.': 'Project updated.',
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
  'País': 'Country',
  'Ciudad': 'City',
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
  'Ubicación': 'Location',
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
  'Persona': 'User',
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
  'Registrar voluntario': 'Register volunteer',
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
  [/^(\d+) personas$/, '$1 users'],
  [/^(\d+) hosts$/, '$1 hosts'],
  [/^(\d+) indicadores$/, '$1 indicators'],
  [/^(\d+)% del presupuesto$/, '$1% of budget'],
  [/^Monto \(([^)]+)\)$/, 'Amount ($1)'],
]

const originalTexts = new WeakMap()
const originalAttributes = new WeakMap()
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
      if (!originalTexts.has(node)) originalTexts.set(node, node.nodeValue)
      const original = originalTexts.get(node)
      const next = language === 'en' ? translateValue(original) : original
      if (node.nodeValue !== next) node.nodeValue = next
    }
    node = walker.nextNode()
  }

  root.querySelectorAll?.('*').forEach((element) => {
    if (element.closest('[data-no-translate]')) return
    if (!originalAttributes.has(element)) originalAttributes.set(element, {})
    const originals = originalAttributes.get(element)
    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return
      if (!(attribute in originals)) originals[attribute] = element.getAttribute(attribute)
      const original = originals[attribute]
      element.setAttribute(attribute, language === 'en' ? translateValue(original) : original)
    })
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
    applyLanguage(document.getElementById('root'), language)

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => applyLanguage(document.getElementById('root'), language))
    })
    observer.observe(document.getElementById('root'), { childList: true, subtree: true, characterData: true, attributes: true })
    return () => observer.disconnect()
  }, [isPortal, language])

  if (!isPortal) return null

  return (
    <button
      className="global-language-control"
      type="button"
      onClick={() => setLanguage((current) => current === 'es' ? 'en' : 'es')}
      aria-label={language === 'es' ? 'Change language to English' : 'Cambiar idioma a español'}
      data-no-translate
    >
      <span className={language === 'es' ? 'active' : ''}>ES</span>
      <i>/</i>
      <span className={language === 'en' ? 'active' : ''}>EN</span>
    </button>
  )
}
