import { useEffect } from 'react'
import './guided-ux.css'

const isEnglish = () => {
  try {
    return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en'
  } catch {
    return document.documentElement.lang === 'en'
  }
}

const normalize = (value = '') => value.replace(/\s+/g, ' ').trim().toLowerCase()

const fieldRules = [
  // Gestión organizacional · estructura
  { paths: ['/app/management', '/app/church'], match: ['Código *', 'Code *'], label: ['Código corto *', 'Short code *'], help: ['Usa una abreviatura fácil de reconocer. Ej.: DIPROM, JÓVENES, FINANZAS.', 'Use a short, recognizable code. Example: DIPROM, YOUTH, FINANCE.'] },
  { paths: ['/app/management', '/app/church'], match: ['Tipo de unidad', 'Unit type'], label: ['¿Qué clase de área es?', 'What kind of area is this?'], help: ['Elige la opción que mejor describa esta parte de la organización: dirección, ministerio, departamento, comité, sede, etc.', 'Choose the option that best describes this part of the organization: directorate, ministry, department, committee, campus, etc.'] },
  { paths: ['/app/management', '/app/church'], match: ['Depende de', 'Reports to'], label: ['¿Dónde se ubica en el organigrama?', 'Where does it sit in the organization chart?'], help: ['Selecciona el área superior. Si depende directamente de la organización, deja “Nivel principal”.', 'Select the parent area. If it reports directly to the organization, leave “Top level”.'] },
  { paths: ['/app/management', '/app/church'], match: ['Responsable visible', 'Visible manager'], label: ['¿Quién lidera esta unidad?', 'Who leads this unit?'], help: ['Este nombre se mostrará en el organigrama y en los informes.', 'This name will appear in the organization chart and reports.'] },
  { paths: ['/app/management', '/app/church'], match: ['Usuario asociado', 'Linked user'], label: ['¿Quién podrá trabajar en esta unidad dentro de Edifica?', 'Who can work in this unit inside Edifica?'], help: ['Vincula una persona habilitada para que pueda cargar avances e informes según su rol.', 'Link an authorized user so they can enter progress and reports according to their role.'] },
  { paths: ['/app/management', '/app/church'], match: ['Rol en la unidad', 'Role in unit'], label: ['¿Qué función tendrá esta persona?', 'What role will this person have?'], help: ['Director y coordinador gestionan la unidad; operador carga información; revisor participa en la revisión.', 'Directors and managers lead the unit; operators enter information; reviewers participate in review.'] },
  { paths: ['/app/management', '/app/church'], match: ['Orden', 'Order'], label: ['Posición en el organigrama', 'Position in the organization chart'], help: ['Opcional. Usa números para ordenar visualmente las unidades: 1, 2, 3…', 'Optional. Use numbers to control the visual order: 1, 2, 3…'] },

  // Gestión organizacional · períodos y objetivos
  { paths: ['/app/management', '/app/church'], match: ['Fecha límite de informe', 'Report due date'], label: ['¿Hasta cuándo pueden entregar el informe final?', 'When is the final report due?'], help: ['Opcional. Sirve como referencia para el cierre institucional del período.', 'Optional. Used as the institutional reporting deadline for the period.'] },
  { paths: ['/app/management', '/app/church'], match: ['Nivel', 'Level'], label: ['¿Qué tipo de objetivo es?', 'What type of objective is this?'], help: ['General: propósito amplio. Específico: resultado concreto. Operativo: acción medible de un área.', 'General: broad purpose. Specific: concrete result. Operational: measurable action for one area.'], optionSet: 'objectiveLevel' },
  { paths: ['/app/management', '/app/church'], match: ['Título *', 'Title *'], label: ['¿Qué queremos lograr? *', 'What do we want to achieve? *'], help: ['Escríbelo como un resultado claro. Ej.: “Fortalecer la formación de líderes de las iglesias”.', 'Write it as a clear result. Example: “Strengthen leadership training across churches.”'] },
  { paths: ['/app/management', '/app/church'], match: ['Objetivo superior', 'Parent objective'], label: ['¿Este objetivo depende de otro?', 'Does this objective belong under another one?'], help: ['Úsalo para conectar un objetivo específico con uno general, o uno operativo con uno específico.', 'Use this to connect a specific objective to a general one, or an operational objective to a specific one.'] },
  { paths: ['/app/management', '/app/church'], match: ['Peso (%)', 'Weight (%)'], label: ['¿Qué importancia tendrá en el cumplimiento total?', 'How important is it to overall completion?'], help: ['Opcional. Si todavía no usarán ponderaciones, puedes dejarlo vacío.', 'Optional. Leave blank if your organization is not using weighted objectives yet.'] },
  { paths: ['/app/management', '/app/church'], match: ['Unidad responsable', 'Responsible unit'], label: ['¿Qué área lidera este objetivo?', 'Which area leads this objective?'], help: ['Selecciona la dirección, ministerio o departamento que debe responder principalmente por este objetivo.', 'Select the directorate, ministry, or department primarily accountable for this objective.'] },
  { paths: ['/app/management', '/app/church'], match: ['Descripción', 'Description'], context: 'objective', label: ['Explícalo en una frase clara', 'Explain it in one clear sentence'], help: ['Aclara qué significa el objetivo y qué cambio debería producir.', 'Clarify what the objective means and what change it should produce.'] },

  // Gestión organizacional · indicadores
  { paths: ['/app/management', '/app/church'], match: ['Nombre *', 'Name *'], context: 'indicator', label: ['¿Qué quieres medir? *', 'What do you want to measure? *'], help: ['Ej.: Personas capacitadas, iglesias participantes, presupuesto ejecutado o estados alcanzados.', 'Example: People trained, participating churches, budget executed, or states reached.'] },
  { paths: ['/app/management', '/app/church'], match: ['Tipo de métrica', 'Metric type'], label: ['¿Qué clase de resultado vas a registrar?', 'What kind of result will you record?'], help: ['Elige la forma más sencilla de expresar el resultado. Edifica conservará la lógica técnica por detrás.', 'Choose the simplest way to express the result. Edifica keeps the technical logic behind the scenes.'], optionSet: 'metricType' },
  { paths: ['/app/management', '/app/church'], match: ['Método de consolidación', 'Aggregation method'], label: ['Cuando registres varios avances, ¿cómo debe obtenerse el resultado final?', 'When several progress entries exist, how should the final result be obtained?'], help: ['Ej.: sumar asistentes de varios meses, usar el último dato disponible o calcular un promedio.', 'Example: add monthly attendance, use the latest available value, or calculate an average.'], optionSet: 'aggregation' },
  { paths: ['/app/management', '/app/church'], match: ['Unidad / etiqueta', 'Unit / label'], label: ['¿En qué unidad lo vas a contar?', 'What unit will you use?'], help: ['Ej.: personas, iglesias, kits, publicaciones, litros, consultas.', 'Example: people, churches, kits, posts, liters, consultations.'] },
  { paths: ['/app/management', '/app/church'], match: ['Meta', 'Target'], context: 'indicator', label: ['¿Qué quieres alcanzar?', 'What do you want to achieve?'], help: ['Escribe la meta del período. Ej.: 300 personas, 24 estados o 100 publicaciones.', 'Enter the target for the period. Example: 300 people, 24 states, or 100 publications.'] },
  { paths: ['/app/management', '/app/church'], match: ['Frecuencia', 'Frequency'], label: ['¿Cada cuánto actualizarás este indicador?', 'How often will you update this indicator?'], help: ['Elige una frecuencia realista. Puedes registrar avances durante el año y Edifica calculará el resultado final.', 'Choose a realistic frequency. You can enter progress during the year and Edifica will calculate the final result.'] },
  { paths: ['/app/management', '/app/church'], match: ['Objetivo relacionado', 'Related objective'], label: ['¿Qué objetivo ayuda a cumplir?', 'Which objective does this support?'], help: ['Opcional, aunque es recomendable para que el informe conecte resultados con la planificación.', 'Optional, but recommended so the report connects results with planning.'] },
  { paths: ['/app/management', '/app/church'], match: ['Proyecto relacionado', 'Related project'], label: ['¿Este indicador pertenece a algún proyecto?', 'Does this indicator belong to a project?'], help: ['Selecciona un proyecto cuando este resultado se produce dentro de una iniciativa concreta.', 'Select a project when this result belongs to a specific initiative.'] },
  { paths: ['/app/management', '/app/church'], match: ['Fuente / criterio', 'Source / criteria'], label: ['¿De dónde saldrá este dato?', 'Where will this data come from?'], help: ['Ej.: lista de asistencia, formulario, sistema financiero, acta, informe regional o conteo de redes.', 'Example: attendance list, form, finance system, meeting record, regional report, or social media count.'] },

  // Gestión organizacional · avances
  { paths: ['/app/management', '/app/church'], match: ['Desde', 'From'], context: 'progress', label: ['Inicio del período reportado', 'Start of the reported period'], help: ['Opcional. Úsalo cuando el dato corresponde a un mes, trimestre o intervalo específico.', 'Optional. Use when the result belongs to a specific month, quarter, or date range.'] },
  { paths: ['/app/management', '/app/church'], match: ['Hasta', 'Through'], context: 'progress', label: ['Cierre del período reportado', 'End of the reported period'], help: ['Indica hasta qué fecha llega este avance.', 'Enter the date through which this progress is being reported.'] },
  { paths: ['/app/management', '/app/church'], match: ['Numerador', 'Numerator'], label: ['¿Cuánto se logró?', 'How much was achieved?'], help: ['Escribe la cantidad que cumplió la condición. Ej.: 42 iglesias participaron.', 'Enter the amount that met the condition. Example: 42 churches participated.'], key: 'achieved' },
  { paths: ['/app/management', '/app/church'], match: ['Denominador', 'Denominator'], label: ['¿Cuál era el total previsto o posible?', 'What was the total expected or possible?'], help: ['Escribe el total usado para comparar. Ej.: 50 iglesias estaban convocadas.', 'Enter the total used for comparison. Example: 50 churches were invited.'], key: 'total' },
  { paths: ['/app/management', '/app/church'], match: ['Valor reportado', 'Reported value'], context: 'progress', label: ['¿Qué lograste en este período?', 'What did you achieve in this period?'], help: ['Registra únicamente el resultado correspondiente a este avance. Edifica hará la consolidación automáticamente.', 'Enter only the result for this progress entry. Edifica will consolidate it automatically.'] },
  { paths: ['/app/management', '/app/church'], match: ['Observaciones', 'Notes'], context: 'progress', label: ['¿Qué ocurrió durante este período?', 'What happened during this period?'], help: ['Añade una explicación breve si ayuda a entender el dato, una variación o un resultado importante.', 'Add a short explanation when it helps clarify the figure, a change, or an important result.'] },

  // Gestión organizacional · informes
  { paths: ['/app/management', '/app/church'], match: ['Resumen ejecutivo', 'Executive summary'], label: ['En pocas palabras, ¿qué hizo esta unidad?', 'In a few words, what did this unit do?'], help: ['Resume lo más importante del período. Los indicadores y proyectos aparecerán como sustento del informe.', 'Summarize the most important work from the period. Indicators and projects provide supporting evidence.'] },
  { paths: ['/app/management', '/app/church'], match: ['Principales logros', 'Main achievements'], label: ['¿Qué se logró y qué vale la pena destacar?', 'What was achieved and is worth highlighting?'], help: ['Incluye resultados verificables, hitos, avances y cambios relevantes.', 'Include verifiable results, milestones, progress, and meaningful changes.'] },
  { paths: ['/app/management', '/app/church'], match: ['Retos y dificultades', 'Challenges and difficulties'], label: ['¿Qué dificultó el trabajo?', 'What made the work difficult?'], help: ['Describe obstáculos reales que ayuden a interpretar los resultados y tomar decisiones.', 'Describe real obstacles that help explain results and support decisions.'] },
  { paths: ['/app/management', '/app/church'], match: ['Próximos pasos', 'Next steps'], label: ['¿Qué debe ocurrir después?', 'What should happen next?'], help: ['Indica las acciones prioritarias para el siguiente período.', 'List the priority actions for the next period.'] },
  { paths: ['/app/management', '/app/church'], match: ['Observaciones del revisor', 'Reviewer notes'], label: ['Observaciones para la unidad', 'Notes for the unit'], help: ['Este espacio sirve para dejar correcciones, solicitudes de aclaratoria o comentarios antes de aprobar.', 'Use this space for corrections, clarification requests, or comments before approval.'] },

  // Proyectos
  { paths: ['/app/donations/projects', '/app/projects', '/app/management/projects'], match: ['Tipo', 'Type'], context: 'project', label: ['¿Qué clase de iniciativa es?', 'What kind of initiative is this?'], help: ['Proyecto, programa, campaña o iniciativa. Elige la opción que mejor describa el trabajo real.', 'Project, program, campaign, or initiative. Choose the option that best describes the actual work.'], optionSet: 'projectType' },
  { paths: ['/app/donations/projects', '/app/projects', '/app/management/projects'], match: ['Fuente de financiamiento', 'Funding source'], label: ['¿Cómo se financia?', 'How is it funded?'], help: ['Externo: un aliado aporta recursos. Propio: la organización lo cubre. Mixto: combina ambos. Sin componente financiero: el proyecto se gestiona sin presupuesto.', 'External: a partner provides resources. Own: the organization covers it. Mixed: combines both. No financial component: managed without a budget.'], optionSet: 'fundingSource' },
  { paths: ['/app/donations/projects', '/app/projects', '/app/management/projects'], match: ['Dirección / unidad responsable', 'Responsible directorate / unit', 'Unidad responsable', 'Responsible unit'], context: 'project', label: ['¿Qué área lidera este proyecto?', 'Which area leads this project?'], help: ['Selecciona una sola unidad como responsable principal. Otras áreas pueden añadirse como participantes.', 'Select one unit as the primary owner. Other areas can be added as participants.'] },
  { paths: ['/app/donations/projects', '/app/projects', '/app/management/projects'], match: ['Presupuesto aprobado u otorgado', 'Approved or granted budget'], label: ['¿Qué monto fue aprobado para este proyecto?', 'What amount was approved for this project?'], help: ['Puede ser el monto otorgado por un aliado o el presupuesto interno autorizado.', 'This may be the amount granted by a partner or the internally approved budget.'] },
  { paths: ['/app/donations/projects', '/app/projects', '/app/management/projects'], match: ['Exigencias de reporte', 'Reporting requirements'], label: ['¿Qué exige el proyecto al momento de rendir cuentas?', 'What reporting does this project require?'], help: ['Ej.: informe trimestral, facturas, fotografías, lista de beneficiarios, indicadores específicos.', 'Example: quarterly report, invoices, photographs, beneficiary list, or specific indicators.'] },

  // Ejecución de proyectos
  { paths: ['/app/donations/execution', '/app/compliance'], match: ['Meta comprometida', 'Committed target'], label: ['¿Qué cantidad se prometió alcanzar?', 'What quantity was committed?'], help: ['Ej.: 1.000 kits, 500 consultas o 20 sistemas instalados.', 'Example: 1,000 kits, 500 consultations, or 20 systems installed.'] },
  { paths: ['/app/donations/execution', '/app/compliance'], match: ['Cantidad armada o producida', 'Quantity prepared or produced'], label: ['¿Cuánto se preparó o produjo?', 'How much was prepared or produced?'], help: ['Registra lo que ya está listo, aunque todavía falte entregarlo.', 'Enter what is already prepared, even if it has not yet been delivered.'] },
  { paths: ['/app/donations/execution', '/app/compliance'], match: ['Cantidad entregada', 'Quantity delivered'], label: ['¿Cuánto se entregó realmente?', 'How much was actually delivered?'], help: ['Este dato representa lo que efectivamente llegó a destino o a las personas beneficiarias.', 'This is what actually reached the destination or beneficiaries.'] },
  { paths: ['/app/donations/execution', '/app/compliance'], match: ['Observaciones y método de verificación', 'Notes and verification method'], label: ['¿Qué ocurrió y cómo se puede comprobar?', 'What happened and how can it be verified?'], help: ['Ej.: acta de entrega, lista, fotografías, centro atendido o documento firmado.', 'Example: delivery record, list, photographs, service location, or signed document.'] },
  { paths: ['/app/donations/execution', '/app/compliance'], match: ['Categoría', 'Category'], context: 'expense', label: ['¿En qué se gastó?', 'What was the expense for?'], help: ['Ej.: alimentos, transporte, salud, logística, materiales.', 'Example: food, transportation, health, logistics, materials.'] },
  { paths: ['/app/donations/execution', '/app/compliance'], match: ['Descripción', 'Description'], context: 'expense', label: ['¿Qué se pagó exactamente?', 'What exactly was paid for?'], help: ['Describe el bien o servicio de forma breve y verificable.', 'Briefly describe the good or service in a verifiable way.'] },

  // Donación monetaria
  { paths: ['/donations/monetary'], match: ['Tasa hacia USD *', 'Rate to USD *'], label: ['¿Cuánto vale 1 unidad de esta moneda en USD? *', 'How much is 1 unit of this currency worth in USD? *'], help: ['Ej.: si 1 EUR equivale a 1,10 USD, escribe 1,10.', 'Example: if 1 EUR equals 1.10 USD, enter 1.10.'] },
  { paths: ['/donations/monetary'], match: ['Base de reporte USD *', 'USD reporting base *'], label: ['Equivalente en USD *', 'USD equivalent *'], help: ['Edifica usa este valor para consolidar reportes entre monedas diferentes.', 'Edifica uses this value to consolidate reports across different currencies.'] },
  { paths: ['/donations/monetary'], match: ['Fuente de la tasa *', 'Rate source *'], label: ['¿De dónde tomaste la tasa? *', 'Where did you get the exchange rate? *'], help: ['Ej.: banco, plataforma financiera, tasa institucional o referencia acordada.', 'Example: bank, financial platform, institutional rate, or agreed reference.'] },
  { paths: ['/donations/monetary'], match: ['Institución emisora *', 'Sending institution *'], label: ['Banco o institución desde donde salió el dinero *', 'Bank or institution the money came from *'], help: ['Identifica el origen del pago para facilitar la conciliación.', 'Identify the payment origin to make reconciliation easier.'] },
  { paths: ['/donations/monetary'], match: ['Cuenta o institución receptora *', 'Receiving account or institution *'], label: ['Cuenta o institución que recibió el dinero *', 'Account or institution that received the money *'], help: ['Indica dónde ingresó efectivamente el aporte.', 'Enter where the contribution was actually received.'] },
  { paths: ['/donations/monetary'], match: ['Referencia de transacción *', 'Transaction reference *'], label: ['Número o referencia del pago *', 'Payment number or reference *'], help: ['Usa la referencia bancaria, número de recibo o identificador equivalente.', 'Use the bank reference, receipt number, or equivalent identifier.'] },

  // Donación en especies
  { paths: ['/donations/in-kind'], match: ['Alcance *', 'Scope *'], label: ['¿La donación viene del país o del exterior? *', 'Is the donation domestic or international? *'], help: ['Esto ayuda a definir el seguimiento logístico y documental.', 'This helps determine logistics and documentation requirements.'] },
  { paths: ['/donations/in-kind'], match: ['Transporte *', 'Transport *'], label: ['¿Cómo llegará la carga? *', 'How will the shipment arrive? *'], help: ['Selecciona la modalidad principal de transporte.', 'Select the primary transport method.'] },
  { paths: ['/donations/in-kind'], match: ['Categorías principales *', 'Main categories *'], label: ['¿Qué contiene principalmente la carga? *', 'What does the shipment mainly contain? *'], help: ['Marca las categorías generales. El detalle completo puede quedar en el manifiesto adjunto.', 'Select the general categories. Full detail can remain in the attached manifest.'] },
  { paths: ['/donations/in-kind'], match: ['Cantidad declarada *', 'Declared quantity *'], label: ['¿Cuántos bultos, cajas, paletas o unidades se reciben? *', 'How many packages, boxes, pallets, or units are being received? *'], help: ['Usa el campo “Unidad” para indicar cómo estás contando la carga.', 'Use the “Unit” field to indicate how the shipment is being counted.'] },
  { paths: ['/donations/in-kind'], match: ['Valor referencial', 'Reference value'], label: ['Valor estimado de la donación', 'Estimated donation value'], help: ['Opcional. Úsalo cuando exista una valoración razonable de los bienes recibidos.', 'Optional. Use when there is a reasonable valuation for the goods received.'] },

  // Beneficiarios
  { paths: ['/app/donations/execution', '/app/compliance'], match: ['Personas representadas', 'People represented'], label: ['¿A cuántas personas representa este registro?', 'How many people does this record represent?'], help: ['Ej.: si registras a una persona en nombre de su familia de 5 miembros, escribe 5. Si representa solo a esa persona, escribe 1.', 'Example: if one person represents a family of 5, enter 5. If the record represents only that person, enter 1.'] },

  // Aliados y donantes
  { paths: ['/app/donations/donors', '/app/donors'], match: ['Tipo', 'Type'], context: 'donor', label: ['¿Quién es este aliado o donante?', 'Who is this partner or donor?'], help: ['Puede ser una organización, una persona o un donante anónimo.', 'It can be an organization, a person, or an anonymous donor.'] },
  { paths: ['/app/donations/donors', '/app/donors'], match: ['Registro activo', 'Active record'], label: ['Disponible para usar en nuevos registros', 'Available for new records'], help: ['Desactívalo si ya no quieres que aparezca en los formularios, conservando su historial.', 'Turn this off if you no longer want it to appear in forms while keeping its history.'] },

  // Usuarios
  { paths: ['/app/admin/operators'], match: ['Rol', 'Role'], label: ['¿Qué puede hacer esta persona?', 'What can this person do?'], help: ['Operador carga información; administrador gestiona usuarios y configuración de su organización; superadministrador controla la plataforma.', 'Operators enter information; administrators manage users and their organization settings; super administrators control the platform.'] },
  { paths: ['/app/admin/operators'], match: ['Organización', 'Organization'], label: ['¿A qué organización pertenece?', 'Which organization does this person belong to?'], help: ['Los datos y permisos de esta persona quedarán limitados al tenant seleccionado.', 'This person’s data and permissions will be limited to the selected tenant.'] },
  { paths: ['/app/admin/operators'], match: ['Acceso activo', 'Active access'], label: ['Puede iniciar sesión', 'Can sign in'], help: ['Al desactivarlo, la persona conserva su historial pero pierde acceso al sistema.', 'When disabled, the person keeps their history but loses system access.'] },

  // Organizaciones y hosts
  { paths: ['/app/admin/organizations'], match: ['Código del tenant', 'Tenant code'], label: ['Código interno de la organización', 'Internal organization code'], help: ['Identificador corto y único usado por Edifica. Ej.: cnbv, iglesia-central, fundacion-vida.', 'Short unique identifier used by Edifica. Example: cnbv, central-church, vida-foundation.'] },
  { paths: ['/app/admin/organizations'], match: ['Hostname', 'Hostname'], label: ['Dominio de acceso', 'Access domain'], help: ['Escribe solo el dominio, sin https:// ni rutas. Ej.: app.organizacion.org.', 'Enter only the domain, without https:// or paths. Example: app.organization.org.'] },
  { paths: ['/app/admin/organizations'], match: ['Host principal', 'Primary host'], label: ['Usar como dominio principal', 'Use as primary domain'], help: ['Este será el dominio preferido para identificar y abrir el tenant.', 'This will be the preferred domain for identifying and opening the tenant.'] },

  // Planes y facturación
  { paths: ['/app/admin/billing'], match: ['Límite de usuarios', 'User limit'], label: ['¿Cuántas personas pueden tener acceso?', 'How many people can have access?'], help: ['Cada usuario activo ocupa un cupo del plan de esta organización.', 'Each active user occupies one seat in this organization’s plan.'] },
  { paths: ['/app/admin/billing'], match: ['Ciclo', 'Cycle'], label: ['¿Cada cuánto se cobra?', 'How often is it billed?'], help: ['Define si la suscripción se factura mensualmente o anualmente.', 'Choose whether the subscription is billed monthly or annually.'] },
  { paths: ['/app/admin/billing'], match: ['Importe acordado', 'Agreed amount'], label: ['Precio acordado', 'Agreed price'], help: ['Monto que esta organización paga por Edifica en cada ciclo de facturación.', 'Amount this organization pays for Edifica in each billing cycle.'] },
  { paths: ['/app/admin/billing'], match: ['Proveedor de pago', 'Payment provider'], label: ['Sistema utilizado para cobrar', 'Payment system used'], help: ['Ej.: cobro manual, Stripe u otro proveedor que se integre posteriormente.', 'Example: manual collection, Stripe, or another provider integrated later.'] },
]

const optionSets = {
  metricType: {
    es: { count: 'Una cantidad', currency: 'Dinero', percentage: 'Un porcentaje', ratio: 'Una relación entre dos cantidades', boolean: 'Cumplimiento simple (Sí / No)', text: 'Una respuesta o descripción' },
    en: { count: 'A quantity', currency: 'Money', percentage: 'A percentage', ratio: 'A relationship between two quantities', boolean: 'Simple completion (Yes / No)', text: 'A response or description' },
  },
  aggregation: {
    es: { sum: 'Sumar todos los avances', average: 'Calcular un promedio', latest: 'Usar el último dato registrado', max: 'Usar el valor más alto', unique_people: 'Contar personas diferentes', calculated: 'Calcular automáticamente un porcentaje', non_aggregable: 'Mostrar cada dato por separado' },
    en: { sum: 'Add all progress entries', average: 'Calculate an average', latest: 'Use the latest recorded value', max: 'Use the highest value', unique_people: 'Count unique people', calculated: 'Automatically calculate a percentage', non_aggregable: 'Show each value separately' },
  },
  objectiveLevel: {
    es: { general: 'General — propósito amplio de la organización', specific: 'Específico — resultado concreto que apoya al objetivo general', operational: 'Operativo — acción medible de una unidad' },
    en: { general: 'General — broad organizational purpose', specific: 'Specific — concrete result supporting a general objective', operational: 'Operational — measurable action for one unit' },
  },
  projectType: {
    es: { funded_project: 'Proyecto financiado — recibe fondos o aportes externos', institutional_project: 'Proyecto institucional — iniciativa propia de la organización', program: 'Programa — trabajo continuo con varias acciones', campaign: 'Campaña — esfuerzo concentrado en un período', initiative: 'Iniciativa — acción puntual o emergente', other: 'Otro' },
    en: { funded_project: 'Funded project — receives external funds or contributions', institutional_project: 'Institutional project — organization-led initiative', program: 'Program — ongoing work with multiple actions', campaign: 'Campaign — focused effort during a period', initiative: 'Initiative — specific or emerging action', other: 'Other' },
  },
  fundingSource: {
    es: { external: 'Externo — lo financia un aliado o donante', own: 'Propio — lo cubre la organización', mixed: 'Mixto — combina recursos propios y externos', none: 'Sin componente financiero' },
    en: { external: 'External — funded by a partner or donor', own: 'Own resources — covered by the organization', mixed: 'Mixed — combines own and external resources', none: 'No financial component' },
  },
}

const introCards = [
  { paths: ['/app/management/structure'], title: ['Empieza por reflejar cómo funciona realmente tu organización', 'Start by reflecting how your organization actually works'], body: ['Crea las áreas principales, indica de quién dependen y asigna responsables. Este organigrama alimentará proyectos, objetivos, permisos e informes.', 'Create the main areas, show who they report to, and assign leaders. This structure will feed projects, objectives, permissions, and reports.'], steps: [['1. Crea las unidades', '2. Ordénalas jerárquicamente', '3. Asigna responsables'], ['1. Create units', '2. Arrange the hierarchy', '3. Assign leaders']] },
  { paths: ['/app/management/objectives'], title: ['Convierte la planificación en una ruta fácil de seguir', 'Turn planning into an easy-to-follow roadmap'], body: ['Primero define el período. Después crea los objetivos generales y, debajo de ellos, los específicos u operativos. Finalmente asigna qué área responde por cada objetivo.', 'First define the period. Then create general objectives and place specific or operational objectives underneath. Finally assign the area accountable for each objective.'], steps: [['1. Período', '2. Objetivos', '3. Responsables'], ['1. Period', '2. Objectives', '3. Owners']] },
  { paths: ['/app/management/tracking'], title: ['Medir debe ser sencillo', 'Measurement should be simple'], body: ['Define qué quieres medir, fija una meta y registra avances. Edifica hará las sumas, promedios o porcentajes según la regla que elijas.', 'Define what you want to measure, set a target, and record progress. Edifica will handle sums, averages, or percentages according to the rule you choose.'], steps: [['1. Qué medir', '2. Meta', '3. Avances'], ['1. What to measure', '2. Target', '3. Progress']] },
  { paths: ['/app/management/reports'], title: ['El informe se construye con lo que ya registraste', 'The report is built from what you already recorded'], body: ['Los indicadores, proyectos y objetivos sirven como evidencia. Aquí cada unidad agrega contexto, logros, dificultades y próximos pasos antes de enviar su informe.', 'Indicators, projects, and objectives provide evidence. Here each unit adds context, achievements, challenges, and next steps before submitting its report.'], steps: [['1. Completa la gestión', '2. Guarda borrador', '3. Envía para revisión'], ['1. Complete the narrative', '2. Save draft', '3. Submit for review']] },
  { paths: ['/app/donations/projects', '/app/projects', '/app/management/projects'], title: ['Un proyecto puede conectar toda la gestión', 'A project can connect the entire operation'], body: ['Define quién lo lidera, cómo se financia, qué objetivos apoya y qué otras áreas participan. El mismo proyecto conserva donaciones, ejecución, beneficiarios y evidencias.', 'Define who leads it, how it is funded, which objectives it supports, and which other areas participate. The same project keeps donations, execution, beneficiaries, and evidence together.'], steps: [['1. Identifica', '2. Vincula áreas y objetivos', '3. Registra ejecución'], ['1. Identify', '2. Link areas and objectives', '3. Record execution']] },
  { paths: ['/app/donations/donors', '/app/donors'], title: ['Registra al aliado una sola vez', 'Register each partner only once'], body: ['Después podrás seleccionarlo en proyectos y donaciones sin volver a escribir sus datos de contacto.', 'You can then select the same record in projects and donations without entering contact details again.'], steps: [['Crear', 'Reutilizar', 'Mantener historial'], ['Create', 'Reuse', 'Keep history']] },
  { paths: ['/app/admin/operators'], title: ['Cada persona debe tener su propio acceso', 'Each person should have their own access'], body: ['Asigna la organización y el nivel de permiso correcto. Los cupos activos dependen del plan contratado.', 'Assign the correct organization and permission level. Active seats depend on the organization’s plan.'], steps: [['Correo individual', 'Rol correcto', 'Acceso activo'], ['Individual email', 'Correct role', 'Active access']] },
  { paths: ['/app/admin/organizations'], title: ['Una organización es una cuenta cliente independiente', 'Each organization is an independent customer account'], body: ['Sus usuarios, proyectos, donantes y datos quedan aislados por tenant. Los dominios permiten identificar desde qué host se abre cada organización.', 'Its users, projects, donors, and data are isolated by tenant. Domains identify which organization is opened from each host.'], steps: [['Organización', 'Dominio', 'Usuarios'], ['Organization', 'Domain', 'Users']] },
  { paths: ['/app/admin/billing'], title: ['Plan, cupos y pagos en un mismo lugar', 'Plan, seats, and payments in one place'], body: ['Define cuánto paga la organización, cada cuánto se factura y cuántas personas pueden tener acceso. Luego registra los pagos recibidos.', 'Define how much the organization pays, how often it is billed, and how many people can have access. Then record received payments.'], steps: [['Plan', 'Cupos', 'Pagos'], ['Plan', 'Seats', 'Payments']] },
]

function pathMatches(paths) {
  const current = window.location.pathname.replace(/\/$/, '')
  return paths.some((path) => current === path || current.startsWith(`${path}/`) || (path.endsWith('/management') && current.startsWith(path)))
}

function closestContext(label, context) {
  if (!context) return true
  if (context === 'indicator') return Boolean(label.closest('.management-form-card')?.querySelector('.management-form-title small')?.textContent.match(/INDICADOR|INDICATOR/i))
  if (context === 'progress') return Boolean(label.closest('.management-form-card')?.querySelector('.management-form-title small')?.textContent.match(/AVANCE|PROGRESS/i))
  if (context === 'objective') return Boolean(label.closest('.management-form-card')?.querySelector('.management-form-title small')?.textContent.match(/OBJETIVO|OBJECTIVE/i))
  if (context === 'project') return Boolean(label.closest('.project-form-portal, .project-form-section'))
  if (context === 'expense') return Boolean(label.closest('form')?.textContent.match(/Inversión ejecutada|Executed investment/i))
  if (context === 'donor') return Boolean(label.closest('.donor-directory-form, .donor-quick-form'))
  return true
}

function directLabelSpan(label) {
  return Array.from(label.children).find((child) => child.tagName === 'SPAN' && !child.classList.contains('guided-field-help')) || null
}

function findRule(label) {
  const span = directLabelSpan(label)
  if (!span) return null
  if (span.dataset.guidedRule) return fieldRules.find((rule) => rule.id === span.dataset.guidedRule) || null
  const text = normalize(span.textContent)
  return fieldRules.find((rule, index) => {
    rule.id ||= `field-${index}`
    return pathMatches(rule.paths) && closestContext(label, rule.context) && rule.match.some((candidate) => normalize(candidate) === text)
  }) || null
}

function updateOptions(label, optionSet, lang) {
  const select = label.querySelector('select')
  const set = optionSets[optionSet]?.[lang]
  if (!select || !set) return
  Array.from(select.options).forEach((option) => {
    if (Object.prototype.hasOwnProperty.call(set, option.value)) {
      option.textContent = set[option.value]
      option.dataset.noTranslate = 'true'
    }
  })
}

function applyFieldGuidance(root, lang) {
  root.querySelectorAll('label').forEach((label) => {
    const span = directLabelSpan(label)
    if (!span) return
    let rule = null
    if (span.dataset.guidedRule) rule = fieldRules.find((item) => item.id === span.dataset.guidedRule)
    if (!rule) rule = findRule(label)
    if (!rule) return
    span.dataset.guidedRule = rule.id
    span.dataset.noTranslate = 'true'
    span.textContent = rule.label[lang === 'en' ? 1 : 0]
    if (rule.key) label.dataset.guidedKey = rule.key
    let help = label.querySelector(':scope > .guided-field-help')
    if (!help) {
      help = document.createElement('small')
      help.className = 'guided-field-help'
      help.dataset.noTranslate = 'true'
      const input = label.querySelector('input, select, textarea')
      if (input) label.insertBefore(help, input)
      else label.appendChild(help)
    }
    help.textContent = rule.help[lang === 'en' ? 1 : 0]
    if (rule.optionSet) updateOptions(label, rule.optionSet, lang)
  })
}

function applyMultiselectGuidance(root, lang) {
  root.querySelectorAll('.management-multiselect').forEach((block) => {
    const span = block.querySelector(':scope > span')
    if (!span) return
    const text = normalize(span.textContent)
    if (!span.dataset.guidedKey && !['unidades de apoyo', 'supporting units'].includes(text)) return
    span.dataset.guidedKey = 'supportingUnits'
    span.dataset.noTranslate = 'true'
    span.textContent = lang === 'en' ? 'Which other areas will support this objective?' : '¿Qué otras áreas apoyarán este objetivo?'
    let help = block.querySelector(':scope > .guided-field-help')
    if (!help) {
      help = document.createElement('small')
      help.className = 'guided-field-help'
      help.dataset.noTranslate = 'true'
      block.insertBefore(help, block.children[1] || null)
    }
    help.textContent = lang === 'en' ? 'Select every unit that participates without being the primary owner.' : 'Marca las unidades que participan, aunque no sean las responsables principales.'
  })
}

function applyIntroCards(root, lang) {
  introCards.forEach((card, index) => {
    if (!pathMatches(card.paths)) return
    const panel = root.querySelector('.management-panel, .project-portal-page, .donor-directory-page, .edifica-admin-page, .billing-page')
    if (!panel) return
    const key = `intro-${index}`
    let existing = panel.querySelector(`.guided-intro-card[data-guided-intro="${key}"]`)
    if (!existing) {
      existing = document.createElement('section')
      existing.className = 'guided-intro-card no-print'
      existing.dataset.guidedIntro = key
      existing.dataset.noTranslate = 'true'
      const heading = panel.querySelector('.management-panel-heading, .edifica-dashboard-header')
      if (heading?.nextSibling) panel.insertBefore(existing, heading.nextSibling)
      else panel.prepend(existing)
    }
    const i = lang === 'en' ? 1 : 0
    existing.innerHTML = `<div><span>${lang === 'en' ? 'HOW TO USE THIS SCREEN' : 'CÓMO USAR ESTA PANTALLA'}</span><strong>${card.title[i]}</strong><p>${card.body[i]}</p></div><div class="guided-steps">${card.steps[i].map((step) => `<b>${step}</b>`).join('')}</div>`
  })
}

function applyCalculatedPreview(root, lang) {
  const form = Array.from(root.querySelectorAll('.management-form-card')).find((item) => item.querySelector('[data-guided-key="achieved"]') && item.querySelector('[data-guided-key="total"]'))
  if (!form) return
  const achieved = form.querySelector('[data-guided-key="achieved"] input')
  const total = form.querySelector('[data-guided-key="total"] input')
  if (!achieved || !total) return
  let preview = form.querySelector('.guided-calculation-preview')
  if (!preview) {
    preview = document.createElement('div')
    preview.className = 'guided-calculation-preview'
    preview.dataset.noTranslate = 'true'
    const grid = form.querySelector('.management-form-grid')
    grid?.appendChild(preview)
  }
  const update = () => {
    const a = Number(achieved.value || 0)
    const t = Number(total.value || 0)
    const valid = t > 0
    const result = valid ? Math.round((a / t) * 1000) / 10 : null
    preview.innerHTML = lang === 'en'
      ? `<span>CALCULATED RESULT</span><strong>${valid ? `${result}%` : '—'}</strong><p>${valid ? `${a} of ${t} = ${result}%` : 'Enter both amounts and Edifica will calculate the percentage automatically.'}</p>`
      : `<span>RESULTADO CALCULADO</span><strong>${valid ? `${result}%` : '—'}</strong><p>${valid ? `${a} de ${t} = ${result}%` : 'Completa ambas cantidades y Edifica calculará el porcentaje automáticamente.'}</p>`
  }
  if (!achieved.dataset.guidedCalcBound) {
    achieved.addEventListener('input', update)
    total.addEventListener('input', update)
    achieved.dataset.guidedCalcBound = 'true'
    total.dataset.guidedCalcBound = 'true'
  }
  update()
}

function applyIndicatorCards(root, lang) {
  const friendly = optionSets.aggregation[lang]
  root.querySelectorAll('.indicator-grid article').forEach((card) => {
    const technical = card.querySelector('header b')
    if (!technical) return
    const current = normalize(technical.textContent)
    const key = technical.dataset.guidedAggregation || Object.entries({ sum: ['suma', 'sum'], average: ['promedio', 'average'], latest: ['último valor', 'latest value'], max: ['valor máximo', 'maximum value'], unique_people: ['personas únicas', 'unique people'], calculated: ['calculado', 'calculated'], non_aggregable: ['no consolidable', 'non-aggregable'] }).find(([, names]) => names.includes(current))?.[0]
    if (!key) return
    technical.dataset.guidedAggregation = key
    technical.dataset.noTranslate = 'true'
    technical.textContent = friendly[key]
  })
}

function applyGeneralEmptyStateHelp(root, lang) {
  root.querySelectorAll('.management-empty, .edifica-empty, .operations-empty-note').forEach((element) => {
    const text = normalize(element.textContent)
    if (element.dataset.guidedEmpty) return
    if (text.includes('todavía no existen indicadores') || text.includes('there are no indicators')) {
      element.dataset.guidedEmpty = 'true'
      element.textContent = lang === 'en' ? 'There are no indicators here yet. Create the first one by choosing what you want to measure and the target you want to reach.' : 'Todavía no hay indicadores aquí. Crea el primero eligiendo qué quieres medir y qué meta quieres alcanzar.'
    }
    if (text.includes('todavía no existen objetivos') || text.includes('there are no objectives')) {
      element.dataset.guidedEmpty = 'true'
      element.textContent = lang === 'en' ? 'There are no objectives for this period yet. Start with one general objective and add specific objectives underneath it.' : 'Todavía no hay objetivos para este período. Comienza con un objetivo general y agrega debajo los objetivos específicos.'
    }
  })
}

function applyGuidance(root) {
  if (!root) return
  const lang = isEnglish() ? 'en' : 'es'
  applyFieldGuidance(root, lang)
  applyMultiselectGuidance(root, lang)
  applyIntroCards(root, lang)
  applyCalculatedPreview(root, lang)
  applyIndicatorCards(root, lang)
  applyGeneralEmptyStateHelp(root, lang)
}

export default function GuidedUXController() {
  useEffect(() => {
    const pathname = window.location.pathname
    if (!pathname.startsWith('/app') && !pathname.startsWith('/donations')) return undefined
    const root = document.getElementById('root')
    if (!root) return undefined

    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => applyGuidance(root))
    }

    schedule()
    const rootObserver = new MutationObserver(schedule)
    rootObserver.observe(root, { childList: true, subtree: true, characterData: true })
    const languageObserver = new MutationObserver(schedule)
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

    return () => {
      window.cancelAnimationFrame(frame)
      rootObserver.disconnect()
      languageObserver.disconnect()
    }
  }, [])

  return null
}
