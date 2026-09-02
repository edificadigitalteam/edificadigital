import { useEffect } from 'react'
import './guided-ux.css'

const langNow = () => {
  try {
    return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
  } catch {
    return document.documentElement.lang === 'en' ? 'en' : 'es'
  }
}

const clean = (value = '') => value.replace(/\s+/g, ' ').trim().toLowerCase()
const currentPath = () => window.location.pathname.replace(/\/$/, '')
const pathIs = (...paths) => paths.some((path) => currentPath() === path || currentPath().startsWith(`${path}/`))

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
    es: { general: 'General — propósito amplio de la organización', specific: 'Específico — resultado concreto que apoya al general', operational: 'Operativo — acción medible de una unidad' },
    en: { general: 'General — broad organizational purpose', specific: 'Specific — concrete result supporting the general objective', operational: 'Operational — measurable action for one unit' },
  },
  projectType: {
    es: { funded_project: 'Proyecto financiado — recibe aportes externos', institutional_project: 'Proyecto institucional — iniciativa propia', program: 'Programa — trabajo continuo con varias acciones', campaign: 'Campaña — esfuerzo concentrado en un período', initiative: 'Iniciativa — acción puntual o emergente', other: 'Otro' },
    en: { funded_project: 'Funded project — receives external support', institutional_project: 'Institutional project — organization-led initiative', program: 'Program — ongoing work with several actions', campaign: 'Campaign — focused effort during a period', initiative: 'Initiative — specific or emerging action', other: 'Other' },
  },
  fundingSource: {
    es: { external: 'Externo — lo financia un aliado o donante', own: 'Propio — lo cubre la organización', mixed: 'Mixto — combina recursos propios y externos', none: 'Sin componente financiero' },
    en: { external: 'External — funded by a partner or donor', own: 'Own resources — covered by the organization', mixed: 'Mixed — combines own and external resources', none: 'No financial component' },
  },
}

const rules = [
  // Estructura
  { scope: () => pathIs('/app/management/structure'), match: ['Código *', 'Code *'], label: { es: 'Código corto *', en: 'Short code *' }, help: { es: 'Usa una abreviatura fácil de reconocer. Ej.: DIPROM, JÓVENES, FINANZAS.', en: 'Use a short recognizable code. Example: DIPROM, YOUTH, FINANCE.' } },
  { scope: () => pathIs('/app/management/structure'), match: ['Tipo de unidad', 'Unit type'], label: { es: '¿Qué clase de área es?', en: 'What kind of area is this?' }, help: { es: 'Elige lo que mejor describa esta parte de la organización: dirección, ministerio, departamento, comité, sede, etc.', en: 'Choose what best describes this part of the organization: directorate, ministry, department, committee, campus, etc.' } },
  { scope: () => pathIs('/app/management/structure'), match: ['Depende de', 'Reports to'], label: { es: '¿Dónde se ubica en el organigrama?', en: 'Where does it sit in the organization chart?' }, help: { es: 'Selecciona el área superior. Si depende directamente de la organización, deja “Nivel principal”.', en: 'Select the parent area. If it reports directly to the organization, leave “Top level”.' } },
  { scope: () => pathIs('/app/management/structure'), match: ['Responsable visible', 'Visible manager'], label: { es: '¿Quién lidera esta unidad?', en: 'Who leads this unit?' }, help: { es: 'Este nombre se mostrará en el organigrama y los informes.', en: 'This name will appear in the organization chart and reports.' } },
  { scope: () => pathIs('/app/management/structure'), match: ['Usuario asociado', 'Linked user'], label: { es: '¿Quién podrá trabajar aquí dentro de Edifica?', en: 'Who can work here inside Edifica?' }, help: { es: 'Vincula una persona habilitada para que pueda cargar avances e informes según su rol.', en: 'Link an authorized user so they can enter progress and reports according to their role.' } },
  { scope: () => pathIs('/app/management/structure'), match: ['Rol en la unidad', 'Role in unit'], label: { es: '¿Qué función tendrá esta persona?', en: 'What role will this person have?' }, help: { es: 'Director y coordinador gestionan; operador carga información; revisor participa en la revisión.', en: 'Directors and managers lead; operators enter data; reviewers participate in review.' } },
  { scope: () => pathIs('/app/management/structure'), match: ['Orden dentro de la unidad superior', 'Order within the parent unit'], label: { es: 'Orden dentro de la unidad superior', en: 'Order within the parent unit' }, help: { es: 'Usa 1, 2, 3… para ordenar esta unidad entre otras que dependan de la misma área.', en: 'Use 1, 2, 3… to order this unit among others that report to the same area.' } },

  // Objetivos
  { scope: () => pathIs('/app/management/objectives'), match: ['Fecha límite de informe', 'Report due date'], label: { es: '¿Hasta cuándo pueden entregar el informe final?', en: 'When is the final report due?' }, help: { es: 'Opcional. Sirve como referencia para el cierre institucional del período.', en: 'Optional. Used as the institutional reporting deadline.' } },
  { scope: () => pathIs('/app/management/objectives'), match: ['Nivel', 'Level'], label: { es: '¿Qué tipo de objetivo es?', en: 'What type of objective is this?' }, help: { es: 'General: propósito amplio. Específico: resultado concreto. Operativo: acción medible de un área.', en: 'General: broad purpose. Specific: concrete result. Operational: measurable action for one area.' }, options: 'objectiveLevel' },
  { scope: () => pathIs('/app/management/objectives'), match: ['Título *', 'Title *'], label: { es: '¿Qué queremos lograr? *', en: 'What do we want to achieve? *' }, help: { es: 'Escríbelo como un resultado claro. Ej.: “Fortalecer la formación de líderes”.', en: 'Write it as a clear result. Example: “Strengthen leadership training.”' } },
  { scope: () => pathIs('/app/management/objectives'), match: ['Objetivo superior', 'Parent objective'], label: { es: '¿Este objetivo depende de otro?', en: 'Does this objective belong under another one?' }, help: { es: 'Conecta un objetivo específico con uno general, o uno operativo con uno específico.', en: 'Connect a specific objective to a general one, or an operational objective to a specific one.' } },
  { scope: () => pathIs('/app/management/objectives'), match: ['Peso (%)', 'Weight (%)'], label: { es: '¿Qué importancia tendrá en el cumplimiento total?', en: 'How important is it to overall completion?' }, help: { es: 'Opcional. Déjalo vacío si todavía no usarán ponderaciones.', en: 'Optional. Leave blank if you are not using weighted objectives yet.' } },
  { scope: () => pathIs('/app/management/objectives'), match: ['Unidad responsable', 'Responsible unit'], label: { es: '¿Qué área lidera este objetivo?', en: 'Which area leads this objective?' }, help: { es: 'Selecciona la unidad que debe responder principalmente por el resultado.', en: 'Select the unit primarily accountable for the result.' } },

  // Indicadores
  { scope: () => pathIs('/app/management/tracking'), match: ['Nombre *', 'Name *'], context: 'indicator', label: { es: '¿Qué quieres medir? *', en: 'What do you want to measure? *' }, help: { es: 'Ej.: Personas capacitadas, iglesias participantes, presupuesto ejecutado o estados alcanzados.', en: 'Example: People trained, participating churches, budget executed, or states reached.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Tipo de métrica', 'Metric type'], label: { es: '¿Qué clase de resultado vas a registrar?', en: 'What kind of result will you record?' }, help: { es: 'Elige la forma más sencilla de expresar el resultado. La lógica técnica queda detrás.', en: 'Choose the simplest way to express the result. The technical logic stays behind the scenes.' }, options: 'metricType' },
  { scope: () => pathIs('/app/management/tracking'), match: ['Método de consolidación', 'Aggregation method'], label: { es: 'Cuando registres varios avances, ¿cómo debe obtenerse el resultado final?', en: 'When several progress entries exist, how should the final result be obtained?' }, help: { es: 'Ej.: sumar varios meses, usar el último dato o calcular un promedio.', en: 'Example: add several months, use the latest value, or calculate an average.' }, options: 'aggregation' },
  { scope: () => pathIs('/app/management/tracking'), match: ['Unidad / etiqueta', 'Unit / label'], label: { es: '¿En qué unidad lo vas a contar?', en: 'What unit will you use?' }, help: { es: 'Ej.: personas, iglesias, kits, publicaciones, litros, consultas.', en: 'Example: people, churches, kits, posts, liters, consultations.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Meta', 'Target'], context: 'indicator', label: { es: '¿Qué quieres alcanzar?', en: 'What do you want to achieve?' }, help: { es: 'Escribe la meta del período. Ej.: 300 personas, 24 estados o 100 publicaciones.', en: 'Enter the target for the period. Example: 300 people, 24 states, or 100 posts.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Frecuencia', 'Frequency'], label: { es: '¿Cada cuánto actualizarás este indicador?', en: 'How often will you update this indicator?' }, help: { es: 'Elige una frecuencia realista. Edifica consolidará los avances automáticamente.', en: 'Choose a realistic frequency. Edifica will consolidate progress automatically.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Objetivo relacionado', 'Related objective'], label: { es: '¿Qué objetivo ayuda a cumplir?', en: 'Which objective does this support?' }, help: { es: 'Recomendado para que el informe conecte resultados con la planificación.', en: 'Recommended so reports connect results with planning.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Proyecto relacionado', 'Related project'], label: { es: '¿Este indicador pertenece a algún proyecto?', en: 'Does this indicator belong to a project?' }, help: { es: 'Selecciona un proyecto cuando este resultado se produce dentro de una iniciativa concreta.', en: 'Select a project when this result belongs to a specific initiative.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Fuente / criterio', 'Source / criteria'], label: { es: '¿De dónde saldrá este dato?', en: 'Where will this data come from?' }, help: { es: 'Ej.: lista de asistencia, formulario, sistema financiero, acta o informe regional.', en: 'Example: attendance list, form, finance system, meeting record, or regional report.' } },

  // Avances
  { scope: () => pathIs('/app/management/tracking'), match: ['Desde', 'From'], context: 'progress', label: { es: 'Inicio del período reportado', en: 'Start of the reported period' }, help: { es: 'Opcional. Úsalo cuando el dato corresponde a un mes, trimestre o intervalo.', en: 'Optional. Use when the result belongs to a month, quarter, or date range.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Hasta', 'Through'], context: 'progress', label: { es: 'Cierre del período reportado', en: 'End of the reported period' }, help: { es: 'Indica hasta qué fecha llega este avance.', en: 'Enter the date through which this progress is being reported.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Numerador', 'Numerator'], label: { es: '¿Cuánto se logró?', en: 'How much was achieved?' }, help: { es: 'Escribe la cantidad que cumplió la condición. Ej.: 42 iglesias participaron.', en: 'Enter the amount that met the condition. Example: 42 churches participated.' }, key: 'achieved' },
  { scope: () => pathIs('/app/management/tracking'), match: ['Denominador', 'Denominator'], label: { es: '¿Cuál era el total previsto o posible?', en: 'What was the total expected or possible?' }, help: { es: 'Escribe el total usado para comparar. Ej.: 50 iglesias estaban convocadas.', en: 'Enter the total used for comparison. Example: 50 churches were invited.' }, key: 'total' },
  { scope: () => pathIs('/app/management/tracking'), match: ['Valor reportado', 'Reported value'], context: 'progress', label: { es: '¿Qué lograste en este período?', en: 'What did you achieve in this period?' }, help: { es: 'Registra solo este avance. Edifica hará la consolidación automáticamente.', en: 'Enter only this progress result. Edifica will consolidate it automatically.' } },
  { scope: () => pathIs('/app/management/tracking'), match: ['Observaciones', 'Notes'], context: 'progress', label: { es: '¿Qué ocurrió durante este período?', en: 'What happened during this period?' }, help: { es: 'Añade una explicación breve si ayuda a entender el dato o una variación importante.', en: 'Add a short explanation when it helps clarify the figure or an important variation.' } },

  // Informes
  { scope: () => pathIs('/app/management/reports'), match: ['Resumen ejecutivo', 'Executive summary'], label: { es: 'En pocas palabras, ¿qué hizo esta unidad?', en: 'In a few words, what did this unit do?' }, help: { es: 'Resume lo más importante. Los indicadores y proyectos sirven como sustento.', en: 'Summarize the most important work. Indicators and projects provide supporting evidence.' } },
  { scope: () => pathIs('/app/management/reports'), match: ['Principales logros', 'Main achievements'], label: { es: '¿Qué se logró y qué vale la pena destacar?', en: 'What was achieved and is worth highlighting?' }, help: { es: 'Incluye resultados verificables, hitos y cambios relevantes.', en: 'Include verifiable results, milestones, and meaningful changes.' } },
  { scope: () => pathIs('/app/management/reports'), match: ['Retos y dificultades', 'Challenges and difficulties'], label: { es: '¿Qué dificultó el trabajo?', en: 'What made the work difficult?' }, help: { es: 'Describe obstáculos reales que ayuden a interpretar los resultados.', en: 'Describe real obstacles that help explain the results.' } },
  { scope: () => pathIs('/app/management/reports'), match: ['Próximos pasos', 'Next steps'], label: { es: '¿Qué debe ocurrir después?', en: 'What should happen next?' }, help: { es: 'Indica las acciones prioritarias para el siguiente período.', en: 'List the priority actions for the next period.' } },
  { scope: () => pathIs('/app/management/reports'), match: ['Observaciones del revisor', 'Reviewer notes'], label: { es: 'Observaciones para la unidad', en: 'Notes for the unit' }, help: { es: 'Deja correcciones o solicitudes de aclaratoria antes de aprobar.', en: 'Leave corrections or clarification requests before approval.' } },

  // Proyectos
  { scope: () => pathIs('/app/donations/projects', '/app/projects', '/app/management/projects'), match: ['Tipo', 'Type'], context: 'project', label: { es: '¿Qué clase de iniciativa es?', en: 'What kind of initiative is this?' }, help: { es: 'Proyecto, programa, campaña o iniciativa. Elige lo que mejor describa el trabajo real.', en: 'Project, program, campaign, or initiative. Choose what best describes the actual work.' }, options: 'projectType' },
  { scope: () => pathIs('/app/donations/projects', '/app/projects', '/app/management/projects'), match: ['Fuente de financiamiento', 'Funding source'], label: { es: '¿Cómo se financia?', en: 'How is it funded?' }, help: { es: 'Externo: aporta un aliado. Propio: lo cubre la organización. Mixto: combina ambos. Sin componente financiero: no requiere presupuesto.', en: 'External: funded by a partner. Own: covered by the organization. Mixed: combines both. No financial component: no budget is required.' }, options: 'fundingSource' },
  { scope: () => pathIs('/app/donations/projects', '/app/projects', '/app/management/projects'), match: ['Dirección / unidad responsable', 'Responsible directorate / unit', 'Unidad responsable', 'Responsible unit'], context: 'project', label: { es: '¿Qué área lidera este proyecto?', en: 'Which area leads this project?' }, help: { es: 'Selecciona una sola unidad como responsable principal. Otras pueden participar.', en: 'Select one unit as the primary owner. Other units can participate.' } },
  { scope: () => pathIs('/app/donations/projects', '/app/projects', '/app/management/projects'), match: ['Presupuesto aprobado u otorgado', 'Approved or granted budget'], label: { es: '¿Qué monto fue aprobado para este proyecto?', en: 'What amount was approved for this project?' }, help: { es: 'Puede ser el monto de un aliado o el presupuesto interno autorizado.', en: 'This may be a partner grant or an internally approved budget.' } },
  { scope: () => pathIs('/app/donations/projects', '/app/projects', '/app/management/projects'), match: ['Exigencias de reporte', 'Reporting requirements'], label: { es: '¿Qué exige el proyecto al momento de rendir cuentas?', en: 'What reporting does this project require?' }, help: { es: 'Ej.: informe trimestral, facturas, fotografías, beneficiarios o indicadores específicos.', en: 'Example: quarterly report, invoices, photographs, beneficiaries, or specific indicators.' } },

  // Ejecución
  { scope: () => pathIs('/app/donations/execution', '/app/compliance'), match: ['Meta comprometida', 'Committed target'], label: { es: '¿Qué cantidad se prometió alcanzar?', en: 'What quantity was committed?' }, help: { es: 'Ej.: 1.000 kits, 500 consultas o 20 sistemas instalados.', en: 'Example: 1,000 kits, 500 consultations, or 20 systems installed.' } },
  { scope: () => pathIs('/app/donations/execution', '/app/compliance'), match: ['Cantidad armada o producida', 'Quantity prepared or produced'], label: { es: '¿Cuánto se preparó o produjo?', en: 'How much was prepared or produced?' }, help: { es: 'Registra lo que ya está listo, aunque todavía falte entregarlo.', en: 'Enter what is already prepared, even if it has not yet been delivered.' } },
  { scope: () => pathIs('/app/donations/execution', '/app/compliance'), match: ['Cantidad entregada', 'Quantity delivered'], label: { es: '¿Cuánto se entregó realmente?', en: 'How much was actually delivered?' }, help: { es: 'Representa lo que efectivamente llegó a destino o a las personas beneficiarias.', en: 'This is what actually reached the destination or beneficiaries.' } },
  { scope: () => pathIs('/app/donations/execution', '/app/compliance'), match: ['Observaciones y método de verificación', 'Notes and verification method'], label: { es: '¿Qué ocurrió y cómo se puede comprobar?', en: 'What happened and how can it be verified?' }, help: { es: 'Ej.: acta de entrega, lista, fotografías, centro atendido o documento firmado.', en: 'Example: delivery record, list, photographs, service location, or signed document.' } },
  { scope: () => pathIs('/app/donations/execution', '/app/compliance'), match: ['Personas representadas', 'People represented'], label: { es: '¿A cuántas personas representa este registro?', en: 'How many people does this record represent?' }, help: { es: 'Ej.: si una persona representa una familia de 5, escribe 5. Si se representa solo a sí misma, escribe 1.', en: 'Example: if one person represents a family of 5, enter 5. If they represent only themselves, enter 1.' } },

  // Donación monetaria
  { scope: () => pathIs('/donations/monetary'), match: ['Tasa hacia USD *', 'Rate to USD *'], label: { es: '¿Cuánto vale 1 unidad de esta moneda en USD? *', en: 'How much is 1 unit of this currency worth in USD? *' }, help: { es: 'Ej.: si 1 EUR equivale a 1,10 USD, escribe 1,10.', en: 'Example: if 1 EUR equals 1.10 USD, enter 1.10.' } },
  { scope: () => pathIs('/donations/monetary'), match: ['Base de reporte USD *', 'USD reporting base *'], label: { es: 'Equivalente en USD *', en: 'USD equivalent *' }, help: { es: 'Edifica usa este valor para consolidar reportes entre monedas diferentes.', en: 'Edifica uses this value to consolidate reports across currencies.' } },
  { scope: () => pathIs('/donations/monetary'), match: ['Fuente de la tasa *', 'Rate source *'], label: { es: '¿De dónde tomaste la tasa? *', en: 'Where did you get the exchange rate? *' }, help: { es: 'Ej.: banco, plataforma financiera, tasa institucional o referencia acordada.', en: 'Example: bank, financial platform, institutional rate, or agreed reference.' } },
  { scope: () => pathIs('/donations/monetary'), match: ['Institución emisora *', 'Sending institution *'], label: { es: 'Banco o institución desde donde salió el dinero *', en: 'Bank or institution the money came from *' }, help: { es: 'Identifica el origen del pago para facilitar la conciliación.', en: 'Identify the payment origin to make reconciliation easier.' } },
  { scope: () => pathIs('/donations/monetary'), match: ['Cuenta o institución receptora *', 'Receiving account or institution *'], label: { es: 'Cuenta o institución que recibió el dinero *', en: 'Account or institution that received the money *' }, help: { es: 'Indica dónde ingresó efectivamente el aporte.', en: 'Enter where the contribution was actually received.' } },

  // Donación en especies
  { scope: () => pathIs('/donations/in-kind'), match: ['Alcance *', 'Scope *'], label: { es: '¿La donación viene del país o del exterior? *', en: 'Is the donation domestic or international? *' }, help: { es: 'Esto ayuda a definir el seguimiento logístico y documental.', en: 'This helps determine logistics and documentation requirements.' } },
  { scope: () => pathIs('/donations/in-kind'), match: ['Transporte *', 'Transport *'], label: { es: '¿Cómo llegará la carga? *', en: 'How will the shipment arrive? *' }, help: { es: 'Selecciona la modalidad principal de transporte.', en: 'Select the primary transport method.' } },
  { scope: () => pathIs('/donations/in-kind'), match: ['Categorías principales *', 'Main categories *'], label: { es: '¿Qué contiene principalmente la carga? *', en: 'What does the shipment mainly contain? *' }, help: { es: 'Marca las categorías generales. El detalle completo puede quedar en el manifiesto.', en: 'Select the general categories. Full detail can remain in the manifest.' } },
  { scope: () => pathIs('/donations/in-kind'), match: ['Cantidad declarada *', 'Declared quantity *'], label: { es: '¿Cuántos bultos, cajas, paletas o unidades se reciben? *', en: 'How many packages, boxes, pallets, or units are being received? *' }, help: { es: 'Usa el campo “Unidad” para indicar cómo estás contando la carga.', en: 'Use the “Unit” field to indicate how the shipment is being counted.' } },
  { scope: () => pathIs('/donations/in-kind'), match: ['Valor referencial', 'Reference value'], label: { es: 'Valor estimado de la donación', en: 'Estimated donation value' }, help: { es: 'Opcional. Úsalo cuando exista una valoración razonable de los bienes.', en: 'Optional. Use when there is a reasonable valuation for the goods.' } },

  // Donantes
  { scope: () => pathIs('/app/donations/donors', '/app/donors'), match: ['Tipo', 'Type'], context: 'donor', label: { es: '¿Quién es este aliado o donante?', en: 'Who is this partner or donor?' }, help: { es: 'Puede ser una organización, una persona o un donante anónimo.', en: 'It can be an organization, a person, or an anonymous donor.' } },
  { scope: () => pathIs('/app/donations/donors', '/app/donors'), match: ['Registro activo', 'Active record'], label: { es: 'Disponible para usar en nuevos registros', en: 'Available for new records' }, help: { es: 'Desactívalo si ya no quieres que aparezca en formularios, conservando su historial.', en: 'Turn it off if you no longer want it in forms while keeping its history.' } },

  // Usuarios
  { scope: () => pathIs('/app/admin/operators'), match: ['Rol', 'Role'], label: { es: '¿Qué puede hacer esta persona?', en: 'What can this person do?' }, help: { es: 'Operador carga información; administrador gestiona su organización; superadministrador controla la plataforma.', en: 'Operators enter information; administrators manage their organization; super administrators control the platform.' } },
  { scope: () => pathIs('/app/admin/operators'), match: ['Organización', 'Organization'], label: { es: '¿A qué organización pertenece?', en: 'Which organization does this person belong to?' }, help: { es: 'Sus datos y permisos quedarán limitados al tenant seleccionado.', en: 'Their data and permissions will be limited to the selected tenant.' } },
  { scope: () => pathIs('/app/admin/operators'), match: ['Acceso activo', 'Active access'], label: { es: 'Puede iniciar sesión', en: 'Can sign in' }, help: { es: 'Al desactivarlo conserva su historial, pero pierde acceso al sistema.', en: 'When disabled, they keep their history but lose system access.' } },

  // Organizaciones
  { scope: () => pathIs('/app/admin/organizations'), match: ['Código del tenant', 'Tenant code'], label: { es: 'Código interno de la organización', en: 'Internal organization code' }, help: { es: 'Identificador corto y único. Ej.: cnbv, iglesia-central, fundacion-vida.', en: 'Short unique identifier. Example: cnbv, central-church, vida-foundation.' } },
  { scope: () => pathIs('/app/admin/organizations'), match: ['Hostname', 'Hostname'], label: { es: 'Dominio de acceso', en: 'Access domain' }, help: { es: 'Escribe solo el dominio, sin https:// ni rutas. Ej.: app.organizacion.org.', en: 'Enter only the domain, without https:// or paths. Example: app.organization.org.' } },
  { scope: () => pathIs('/app/admin/organizations'), match: ['Host principal', 'Primary host'], label: { es: 'Usar como dominio principal', en: 'Use as primary domain' }, help: { es: 'Será el dominio preferido para identificar y abrir este tenant.', en: 'This will be the preferred domain for identifying and opening this tenant.' } },

  // Facturación
  { scope: () => pathIs('/app/admin/billing'), match: ['Límite de usuarios', 'User limit'], label: { es: '¿Cuántas personas pueden tener acceso?', en: 'How many people can have access?' }, help: { es: 'Cada usuario activo ocupa un cupo del plan.', en: 'Each active user occupies one seat in the plan.' } },
  { scope: () => pathIs('/app/admin/billing'), match: ['Ciclo', 'Cycle'], label: { es: '¿Cada cuánto se cobra?', en: 'How often is it billed?' }, help: { es: 'Define si la suscripción se factura mensual o anualmente.', en: 'Choose whether the subscription is billed monthly or annually.' } },
  { scope: () => pathIs('/app/admin/billing'), match: ['Importe acordado', 'Agreed amount'], label: { es: 'Precio acordado', en: 'Agreed price' }, help: { es: 'Monto que la organización paga por Edifica en cada ciclo.', en: 'Amount the organization pays for Edifica in each billing cycle.' } },
  { scope: () => pathIs('/app/admin/billing'), match: ['Proveedor de pago', 'Payment provider'], label: { es: 'Sistema utilizado para cobrar', en: 'Payment system used' }, help: { es: 'Ej.: cobro manual, Stripe u otro proveedor futuro.', en: 'Example: manual collection, Stripe, or another future provider.' } },
]

const introCards = [
  { scope: () => pathIs('/app/management/structure'), title: { es: 'Empieza por reflejar cómo funciona realmente tu organización', en: 'Start by reflecting how your organization actually works' }, body: { es: 'Crea las áreas principales, indica de quién dependen y asigna responsables. Este organigrama alimentará proyectos, objetivos, permisos e informes.', en: 'Create the main areas, show who they report to, and assign leaders. This structure feeds projects, objectives, permissions, and reports.' }, steps: { es: ['1. Crea las unidades', '2. Ordénalas', '3. Asigna responsables'], en: ['1. Create units', '2. Arrange them', '3. Assign leaders'] } },
  { scope: () => pathIs('/app/management/objectives'), title: { es: 'Convierte la planificación en una ruta fácil de seguir', en: 'Turn planning into an easy-to-follow roadmap' }, body: { es: 'Define el período, crea los objetivos generales y agrega debajo los específicos u operativos. Después asigna qué área responde por cada uno.', en: 'Define the period, create general objectives, add specific or operational objectives underneath, then assign the accountable area.' }, steps: { es: ['1. Período', '2. Objetivos', '3. Responsables'], en: ['1. Period', '2. Objectives', '3. Owners'] } },
  { scope: () => pathIs('/app/management/tracking'), title: { es: 'Medir debe ser sencillo', en: 'Measurement should be simple' }, body: { es: 'Define qué quieres medir, fija una meta y registra avances. Edifica hará las sumas, promedios o porcentajes según la regla que elijas.', en: 'Define what you want to measure, set a target, and record progress. Edifica handles sums, averages, or percentages according to your choice.' }, steps: { es: ['1. Qué medir', '2. Meta', '3. Avances'], en: ['1. What to measure', '2. Target', '3. Progress'] } },
  { scope: () => pathIs('/app/management/reports'), title: { es: 'El informe se construye con lo que ya registraste', en: 'The report is built from what you already recorded' }, body: { es: 'Los indicadores, proyectos y objetivos sirven como evidencia. Aquí cada unidad agrega contexto, logros, dificultades y próximos pasos antes de enviar.', en: 'Indicators, projects, and objectives provide evidence. Each unit adds context, achievements, challenges, and next steps before submitting.' }, steps: { es: ['1. Completa', '2. Guarda borrador', '3. Envía'], en: ['1. Complete', '2. Save draft', '3. Submit'] } },
  { scope: () => pathIs('/app/donations/projects', '/app/projects', '/app/management/projects'), title: { es: 'Un proyecto puede conectar toda la gestión', en: 'A project can connect the entire operation' }, body: { es: 'Define quién lo lidera, cómo se financia, qué objetivos apoya y qué otras áreas participan. Donaciones, ejecución, beneficiarios y evidencias permanecen en el mismo expediente.', en: 'Define who leads it, how it is funded, which objectives it supports, and which other areas participate. Donations, execution, beneficiaries, and evidence stay in the same record.' }, steps: { es: ['1. Identifica', '2. Vincula', '3. Ejecuta'], en: ['1. Identify', '2. Link', '3. Execute'] } },
  { scope: () => pathIs('/app/donations/donors', '/app/donors'), title: { es: 'Registra al aliado una sola vez', en: 'Register each partner only once' }, body: { es: 'Después podrás seleccionarlo en proyectos y donaciones sin volver a escribir sus datos de contacto.', en: 'You can then select it in projects and donations without entering contact details again.' }, steps: { es: ['Crear', 'Reutilizar', 'Mantener historial'], en: ['Create', 'Reuse', 'Keep history'] } },
  { scope: () => pathIs('/app/admin/operators'), title: { es: 'Cada persona debe tener su propio acceso', en: 'Each person should have their own access' }, body: { es: 'Asigna la organización y el nivel de permiso correcto. Los usuarios activos consumen cupos del plan.', en: 'Assign the correct organization and permission level. Active users consume plan seats.' }, steps: { es: ['Correo individual', 'Rol correcto', 'Acceso'], en: ['Individual email', 'Correct role', 'Access'] } },
  { scope: () => pathIs('/app/admin/organizations'), title: { es: 'Una organización es una cuenta cliente independiente', en: 'Each organization is an independent customer account' }, body: { es: 'Sus usuarios, proyectos, donantes y datos quedan aislados por tenant. Los dominios permiten identificar desde qué host se abre cada organización.', en: 'Its users, projects, donors, and data are isolated by tenant. Domains identify which organization is opened from each host.' }, steps: { es: ['Organización', 'Dominio', 'Usuarios'], en: ['Organization', 'Domain', 'Users'] } },
  { scope: () => pathIs('/app/admin/billing'), title: { es: 'Plan, cupos y pagos en un mismo lugar', en: 'Plan, seats, and payments in one place' }, body: { es: 'Define cuánto paga la organización, cada cuánto se factura y cuántas personas pueden tener acceso. Luego registra los pagos recibidos.', en: 'Define how much the organization pays, how often it is billed, and how many people can have access. Then record received payments.' }, steps: { es: ['Plan', 'Cupos', 'Pagos'], en: ['Plan', 'Seats', 'Payments'] } },
]

function hasContext(label, context) {
  if (!context) return true
  if (context === 'indicator') return /INDICADOR|INDICATOR/i.test(label.closest('.management-form-card')?.querySelector('.management-form-title small')?.textContent || '')
  if (context === 'progress') return /AVANCE|PROGRESS/i.test(label.closest('.management-form-card')?.querySelector('.management-form-title small')?.textContent || '')
  if (context === 'project') return Boolean(label.closest('.project-form-portal, .project-form-section'))
  if (context === 'donor') return Boolean(label.closest('.donor-directory-form, .donor-quick-form'))
  return true
}

function labelSpan(label) {
  return Array.from(label.children).find((child) => child.tagName === 'SPAN' && !child.classList.contains('guided-field-help')) || null
}

function updateOptions(label, setName, lang) {
  const select = label.querySelector('select')
  const values = optionSets[setName]?.[lang]
  if (!select || !values) return
  Array.from(select.options).forEach((option) => {
    if (!Object.prototype.hasOwnProperty.call(values, option.value)) return
    if (option.textContent !== values[option.value]) option.textContent = values[option.value]
    option.dataset.noTranslate = 'true'
  })
}

function applyFields(root, lang) {
  root.querySelectorAll('label').forEach((label) => {
    const span = labelSpan(label)
    if (!span) return
    let rule = span.dataset.guidedRule ? rules[Number(span.dataset.guidedRule)] : null
    if (!rule) {
      const text = clean(span.textContent)
      const index = rules.findIndex((candidate) => candidate.scope() && hasContext(label, candidate.context) && candidate.match.some((item) => clean(item) === text))
      if (index < 0) return
      rule = rules[index]
      span.dataset.guidedRule = String(index)
    }
    if (!rule.scope()) return
    span.dataset.noTranslate = 'true'
    if (span.textContent !== rule.label[lang]) span.textContent = rule.label[lang]
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
    if (help.textContent !== rule.help[lang]) help.textContent = rule.help[lang]
    if (rule.options) updateOptions(label, rule.options, lang)
  })
}

function applySupportingUnits(root, lang) {
  if (!pathIs('/app/management/objectives')) return
  root.querySelectorAll('.management-multiselect').forEach((block) => {
    const span = block.querySelector(':scope > span')
    if (!span) return
    const source = clean(span.dataset.guidedOriginal || span.textContent)
    if (!span.dataset.guidedOriginal && !['unidades de apoyo', 'supporting units'].includes(source)) return
    span.dataset.guidedOriginal ||= span.textContent
    span.dataset.noTranslate = 'true'
    const title = lang === 'en' ? 'Which other areas will support this objective?' : '¿Qué otras áreas apoyarán este objetivo?'
    if (span.textContent !== title) span.textContent = title
    let help = block.querySelector(':scope > .guided-field-help')
    if (!help) {
      help = document.createElement('small')
      help.className = 'guided-field-help'
      help.dataset.noTranslate = 'true'
      block.insertBefore(help, block.children[1] || null)
    }
    const text = lang === 'en' ? 'Select every unit that participates without being the primary owner.' : 'Marca las unidades que participan, aunque no sean las responsables principales.'
    if (help.textContent !== text) help.textContent = text
  })
}

function applyIntro(root, lang) {
  introCards.forEach((card, index) => {
    if (!card.scope()) return
    const panel = root.querySelector('.management-panel, .project-portal-page, .donor-directory-page, .edifica-admin-page, .billing-page')
    if (!panel) return
    const key = `intro-${index}`
    let box = panel.querySelector(`.guided-intro-card[data-guided-intro="${key}"]`)
    if (!box) {
      box = document.createElement('section')
      box.className = 'guided-intro-card no-print'
      box.dataset.guidedIntro = key
      box.dataset.noTranslate = 'true'
      const heading = panel.querySelector('.management-panel-heading, .edifica-dashboard-header')
      heading?.after(box)
    }
    if (box.dataset.guidedLang === lang) return
    box.dataset.guidedLang = lang
    box.innerHTML = `<div><span>${lang === 'en' ? 'HOW TO USE THIS SCREEN' : 'CÓMO USAR ESTA PANTALLA'}</span><strong>${card.title[lang]}</strong><p>${card.body[lang]}</p></div><div class="guided-steps">${card.steps[lang].map((step) => `<b>${step}</b>`).join('')}</div>`
  })
}

function applyCalculatedPreview(root, lang) {
  if (!pathIs('/app/management/tracking')) return
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
    form.querySelector('.management-form-grid')?.appendChild(preview)
  }
  const update = () => {
    const a = Number(achieved.value || 0)
    const t = Number(total.value || 0)
    const result = t > 0 ? Math.round((a / t) * 1000) / 10 : null
    const html = lang === 'en'
      ? `<span>CALCULATED RESULT</span><strong>${result === null ? '—' : `${result}%`}</strong><p>${result === null ? 'Enter both amounts and Edifica will calculate the percentage automatically.' : `${a} of ${t} = ${result}%`}</p>`
      : `<span>RESULTADO CALCULADO</span><strong>${result === null ? '—' : `${result}%`}</strong><p>${result === null ? 'Completa ambas cantidades y Edifica calculará el porcentaje automáticamente.' : `${a} de ${t} = ${result}%`}</p>`
    if (preview.innerHTML !== html) preview.innerHTML = html
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
  if (!pathIs('/app/management/tracking')) return
  const aliases = {
    sum: ['suma', 'sum'], average: ['promedio', 'average'], latest: ['último valor', 'latest value'], max: ['valor máximo', 'maximum value'],
    unique_people: ['personas únicas', 'unique people'], calculated: ['calculado', 'calculated'], non_aggregable: ['no consolidable', 'non-aggregable'],
  }
  root.querySelectorAll('.indicator-grid article header b').forEach((element) => {
    const key = element.dataset.guidedAggregation || Object.entries(aliases).find(([, names]) => names.includes(clean(element.textContent)))?.[0]
    if (!key) return
    element.dataset.guidedAggregation = key
    element.dataset.noTranslate = 'true'
    const value = optionSets.aggregation[lang][key]
    if (element.textContent !== value) element.textContent = value
  })
}

function applyEmptyStates(root, lang) {
  root.querySelectorAll('.management-empty, .edifica-empty').forEach((element) => {
    const original = element.dataset.guidedEmptyOriginal || element.textContent
    const text = clean(original)
    let value = null
    if (text.includes('todavía no existen indicadores') || text.includes('there are no indicators')) value = lang === 'en' ? 'There are no indicators here yet. Create the first one by choosing what you want to measure and the target you want to reach.' : 'Todavía no hay indicadores aquí. Crea el primero eligiendo qué quieres medir y qué meta quieres alcanzar.'
    if (text.includes('todavía no existen objetivos') || text.includes('there are no objectives')) value = lang === 'en' ? 'There are no objectives for this period yet. Start with one general objective and add specific objectives underneath it.' : 'Todavía no hay objetivos para este período. Comienza con un objetivo general y agrega debajo los objetivos específicos.'
    if (!value) return
    element.dataset.guidedEmptyOriginal ||= original
    element.dataset.noTranslate = 'true'
    if (element.textContent !== value) element.textContent = value
  })
}

function applyGuidance(root) {
  const lang = langNow()
  applyFields(root, lang)
  applySupportingUnits(root, lang)
  applyIntro(root, lang)
  applyCalculatedPreview(root, lang)
  applyIndicatorCards(root, lang)
  applyEmptyStates(root, lang)
}

export default function GuidedUXControllerV2() {
  useEffect(() => {
    if (!currentPath().startsWith('/app') && !currentPath().startsWith('/donations')) return undefined
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
