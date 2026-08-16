import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './management.css'
import './management-fixes.css'

const metricTypes = {
  es: {
    count: 'Una cantidad',
    currency: 'Dinero',
    percentage: 'Un porcentaje',
    ratio: 'Una relación entre dos cantidades',
    boolean: 'Cumplimiento simple (Sí / No)',
    text: 'Una respuesta o descripción',
  },
  en: {
    count: 'A quantity',
    currency: 'Money',
    percentage: 'A percentage',
    ratio: 'A relationship between two quantities',
    boolean: 'Simple completion (Yes / No)',
    text: 'An answer or description',
  },
}

const aggregationOptions = {
  es: {
    sum: 'Sumar todos los avances',
    average: 'Calcular un promedio',
    latest: 'Usar el último dato registrado',
    max: 'Usar el valor más alto',
    unique_people: 'Contar personas diferentes',
    calculated: 'Calcular automáticamente un porcentaje',
    non_aggregable: 'Mostrar cada dato por separado',
  },
  en: {
    sum: 'Add all progress entries',
    average: 'Calculate an average',
    latest: 'Use the latest recorded value',
    max: 'Use the highest value',
    unique_people: 'Count unique people',
    calculated: 'Automatically calculate a percentage',
    non_aggregable: 'Keep each value separate',
  },
}

const frequencyOptions = {
  es: { monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', ad_hoc: 'Cuando aplique' },
  en: { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semiannual', annual: 'Annual', ad_hoc: 'When applicable' },
}

const copy = {
  es: {
    module: 'GESTIÓN ORGANIZACIONAL',
    back: '← Todos los módulos',
    nav: ['Resumen', 'Estructura', 'Objetivos', 'Proyectos', 'Seguimiento', 'Informes'],
    users: 'Usuarios y accesos',
    signOut: 'Cerrar sesión',
    eyebrow: 'SEGUIMIENTO',
    title: 'Indicadores y avances',
    intro: 'Define qué quieres medir, fija una meta y registra lo logrado. Edifica realiza los cálculos y consolida los avances.',
    newIndicator: '＋ Crear indicador',
    editIndicator: 'Editar indicador',
    progress: 'Registrar avance',
    prerequisites: 'ANTES DE CREAR UN INDICADOR',
    prerequisiteTitle: 'Solo necesitas dos cosas previamente',
    prerequisiteIntro: 'Un objetivo institucional y un proyecto pueden relacionarse después. Ninguno de los dos es obligatorio para crear un indicador.',
    period: 'Período de gestión',
    periodReady: 'Hay un período seleccionado para saber a qué ciclo pertenece el indicador.',
    periodMissing: 'Primero crea un período de gestión para ubicar el indicador en el tiempo.',
    unit: 'Área o unidad organizativa',
    unitReady: 'Hay un área seleccionada como responsable del indicador.',
    unitMissing: 'Primero crea al menos una dirección, ministerio, departamento o área.',
    optional: 'Objetivo y proyecto',
    optionalHelp: 'Opcionales. Úsalos cuando quieras relacionar el indicador con un objetivo o proyecto específico.',
    ready: 'Listo',
    required: 'Requerido',
    optionalLabel: 'Opcional',
    configure: 'Configurar',
    periodFilter: 'Período',
    unitFilter: 'Área responsable',
    noPeriod: 'Sin período disponible',
    noUnit: 'Sin áreas disponibles',
    indicator: 'INDICADOR',
    createIndicatorTitle: 'Crear indicador',
    editIndicatorTitle: 'Editar indicador',
    editIndicatorIntro: 'Aquí cambias el nombre, la meta y la forma de calcular el indicador. Los avances ya registrados se conservan.',
    measure: '¿Qué quieres medir? *',
    measureExample: 'Ej.: Personas capacitadas, iglesias participantes, presupuesto ejecutado.',
    metricType: '¿Qué clase de resultado vas a registrar?',
    aggregation: 'Cuando registres varios avances, ¿cómo debe obtenerse el resultado final?',
    aggregationHelp: 'Ejemplo: si reportas 40 personas en enero y 60 en febrero, “sumar” mostrará 100; “promedio” mostrará 50.',
    unitLabel: '¿En qué unidad lo vas a contar?',
    unitExample: 'Ej.: personas, iglesias, kits, publicaciones, litros.',
    target: '¿Qué quieres alcanzar?',
    targetExample: 'Escribe la meta del período. Ej.: 300 personas.',
    currency: 'Moneda',
    frequency: '¿Cada cuánto actualizarás este indicador?',
    objective: '¿Qué objetivo ayuda a cumplir? (opcional)',
    noObjective: 'Sin objetivo relacionado',
    objectiveHelp: 'Puedes crear el indicador aunque todavía no existan objetivos.',
    project: '¿Pertenece a algún proyecto? (opcional)',
    noProject: 'Sin proyecto relacionado',
    projectHelp: 'Puedes vincularlo después. Un indicador también puede pertenecer únicamente a un área.',
    description: '¿Qué significa este indicador?',
    descriptionExample: 'Explica brevemente qué cuenta y qué queda fuera del cálculo.',
    source: '¿De dónde saldrá este dato?',
    sourceExample: 'Ej.: lista de asistencia, formulario de registro, reporte financiero, acta o base de datos.',
    cancel: 'Cancelar',
    saveIndicator: 'Guardar indicador',
    saveChanges: 'Guardar cambios',
    saving: 'Guardando…',
    progressEyebrow: 'NUEVO AVANCE',
    progressIntro: 'Estás agregando un resultado al indicador. Para cambiar su nombre, meta o configuración utiliza “Editar indicador”.',
    from: 'Desde',
    to: 'Hasta',
    achieved: '¿Cuánto se logró?',
    achievedExample: 'Ej.: 42 iglesias participaron.',
    total: '¿Cuál era el total previsto o posible?',
    totalExample: 'Ej.: 50 iglesias estaban convocadas.',
    calculatedResult: 'RESULTADO CALCULADO',
    reportedValue: '¿Qué resultado alcanzaste?',
    reportedText: '¿Qué resultado o información deseas reportar?',
    status: 'Estado del avance',
    draft: 'Borrador — todavía no cuenta en el resultado',
    submitted: 'Enviado — ya cuenta en el resultado',
    verified: 'Verificado — revisado y confirmado',
    statusHelp: 'Los borradores se guardan pero no modifican el resultado del indicador. “Enviado” y “Verificado” sí se incluyen.',
    notes: '¿Qué ocurrió durante este período?',
    notesExample: 'Agrega contexto, incidencias, aclaraciones o información útil para el informe.',
    saveProgress: 'Guardar avance',
    board: 'TABLERO DE SEGUIMIENTO',
    indicators: 'indicadores',
    noIndicators: 'Todavía no hay indicadores para esta área y período. Crea el primero definiendo qué quieres medir y qué meta quieres alcanzar.',
    targetLabel: 'Meta',
    executed: 'Ejecutado',
    advances: 'avances registrados',
    indicatorSaved: 'Indicador guardado.',
    indicatorUpdated: 'Indicador actualizado.',
    progressSaved: 'Avance registrado.',
    loading: 'Cargando indicadores…',
    loadError: 'No fue posible cargar el seguimiento',
    retry: 'Intentar nuevamente',
  },
  en: {
    module: 'ORGANIZATIONAL MANAGEMENT',
    back: '← All modules',
    nav: ['Overview', 'Structure', 'Objectives', 'Projects', 'Tracking', 'Reports'],
    users: 'Users and access',
    signOut: 'Sign out',
    eyebrow: 'TRACKING',
    title: 'Indicators and progress',
    intro: 'Define what you want to measure, set a target, and record what was achieved. Edifica performs the calculations and consolidates progress.',
    newIndicator: '＋ Create indicator',
    editIndicator: 'Edit indicator',
    progress: 'Record progress',
    prerequisites: 'BEFORE CREATING AN INDICATOR',
    prerequisiteTitle: 'Only two things are required beforehand',
    prerequisiteIntro: 'An institutional objective and a project can be linked later. Neither is required to create an indicator.',
    period: 'Management period',
    periodReady: 'A period is selected so Edifica knows which management cycle the indicator belongs to.',
    periodMissing: 'Create a management period first so the indicator has a time frame.',
    unit: 'Area or organizational unit',
    unitReady: 'An area is selected as the indicator owner.',
    unitMissing: 'Create at least one directorate, ministry, department, or area first.',
    optional: 'Objective and project',
    optionalHelp: 'Optional. Use them when the indicator needs to be linked to a specific objective or project.',
    ready: 'Ready',
    required: 'Required',
    optionalLabel: 'Optional',
    configure: 'Configure',
    periodFilter: 'Period',
    unitFilter: 'Responsible area',
    noPeriod: 'No period available',
    noUnit: 'No areas available',
    indicator: 'INDICATOR',
    createIndicatorTitle: 'Create indicator',
    editIndicatorTitle: 'Edit indicator',
    editIndicatorIntro: 'Change the name, target, and calculation method here. Previously recorded progress is preserved.',
    measure: 'What do you want to measure? *',
    measureExample: 'Example: People trained, participating churches, budget executed.',
    metricType: 'What kind of result will you record?',
    aggregation: 'When several progress entries exist, how should the final result be obtained?',
    aggregationHelp: 'Example: if you report 40 people in January and 60 in February, “add” shows 100 while “average” shows 50.',
    unitLabel: 'What unit will you use?',
    unitExample: 'Example: people, churches, kits, posts, liters.',
    target: 'What do you want to achieve?',
    targetExample: 'Enter the target for the period. Example: 300 people.',
    currency: 'Currency',
    frequency: 'How often will this indicator be updated?',
    objective: 'Which objective does it support? (optional)',
    noObjective: 'No related objective',
    objectiveHelp: 'You can create the indicator even if objectives have not been created yet.',
    project: 'Does it belong to a project? (optional)',
    noProject: 'No related project',
    projectHelp: 'You can link it later. An indicator can also belong only to an organizational area.',
    description: 'What does this indicator mean?',
    descriptionExample: 'Briefly explain what is included and excluded from the measurement.',
    source: 'Where will this data come from?',
    sourceExample: 'Example: attendance list, registration form, financial report, minutes, or database.',
    cancel: 'Cancel',
    saveIndicator: 'Save indicator',
    saveChanges: 'Save changes',
    saving: 'Saving…',
    progressEyebrow: 'NEW PROGRESS',
    progressIntro: 'You are adding a result to the indicator. To change its name, target, or configuration, use “Edit indicator”.',
    from: 'From',
    to: 'Through',
    achieved: 'How much was achieved?',
    achievedExample: 'Example: 42 churches participated.',
    total: 'What was the planned or possible total?',
    totalExample: 'Example: 50 churches were invited.',
    calculatedResult: 'CALCULATED RESULT',
    reportedValue: 'What result did you achieve?',
    reportedText: 'What result or information do you want to report?',
    status: 'Progress status',
    draft: 'Draft — does not count toward the result yet',
    submitted: 'Submitted — counts toward the result',
    verified: 'Verified — reviewed and confirmed',
    statusHelp: 'Drafts are saved but do not change the indicator result. Submitted and Verified entries are included.',
    notes: 'What happened during this period?',
    notesExample: 'Add context, incidents, clarifications, or useful information for the report.',
    saveProgress: 'Save progress',
    board: 'TRACKING BOARD',
    indicators: 'indicators',
    noIndicators: 'There are no indicators for this area and period yet. Create the first one by defining what you want to measure and the target you want to achieve.',
    targetLabel: 'Target',
    executed: 'Executed',
    advances: 'progress entries',
    indicatorSaved: 'Indicator saved.',
    indicatorUpdated: 'Indicator updated.',
    progressSaved: 'Progress recorded.',
    loading: 'Loading indicators…',
    loadError: 'Tracking could not be loaded',
    retry: 'Try again',
  },
}

const emptyIndicator = {
  id: '', name: '', description: '', objective_id: '', project_id: '', metric_type: 'count', unit_label: 'personas',
  aggregation_method: 'sum', target_value: '', target_text: '', currency: 'USD', frequency: 'annual', source_note: '',
}

const emptyProgress = {
  indicator_id: '', unit_id: '', reporting_period_start: '', reporting_period_end: '', numeric_value: '', text_value: '',
  numerator: '', denominator: '', notes: '', status: 'submitted',
}

function readLanguage() {
  return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
}

function formatNumber(value, language) {
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { maximumFractionDigits: 2 }).format(Number(value || 0))
}

function latestProgress(rows) {
  return [...rows].sort((a, b) => new Date(b.reporting_period_end || b.created_at) - new Date(a.reporting_period_end || a.created_at))[0]
}

function aggregateIndicator(indicator, progressRows) {
  const rows = progressRows.filter((row) => row.indicator_id === indicator.id && row.status !== 'draft')
  if (!rows.length) return { value: null, text: '', completion: 0 }
  if (indicator.metric_type === 'text') return { value: null, text: latestProgress(rows)?.text_value || '', completion: 0 }
  if (indicator.metric_type === 'boolean') {
    const value = Number(Boolean(Number(latestProgress(rows)?.numeric_value || 0)))
    return { value, text: '', completion: value * 100 }
  }
  let value = 0
  if (indicator.aggregation_method === 'average') value = rows.reduce((sum, row) => sum + Number(row.numeric_value || 0), 0) / rows.length
  else if (['latest', 'unique_people', 'non_aggregable'].includes(indicator.aggregation_method)) value = Number(latestProgress(rows)?.numeric_value || 0)
  else if (indicator.aggregation_method === 'max') value = Math.max(...rows.map((row) => Number(row.numeric_value || 0)))
  else if (indicator.aggregation_method === 'calculated') {
    const row = latestProgress(rows)
    value = Number(row?.denominator || 0) > 0 ? (Number(row?.numerator || 0) / Number(row.denominator)) * 100 : Number(row?.numeric_value || 0)
  } else value = rows.reduce((sum, row) => sum + Number(row.numeric_value || 0), 0)
  const target = Number(indicator.target_value || 0)
  return { value, text: '', completion: target > 0 ? Math.round((value / target) * 1000) / 10 : 0 }
}

function metricDisplay(value, indicator, language) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  if (indicator.metric_type === 'currency') return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', { style: 'currency', currency: indicator.currency || 'USD', maximumFractionDigits: 2 }).format(Number(value))
  if (indicator.metric_type === 'percentage' || indicator.aggregation_method === 'calculated') return `${formatNumber(value, language)}%`
  if (indicator.metric_type === 'boolean') return Number(value) ? (language === 'en' ? 'Yes' : 'Sí') : 'No'
  return `${formatNumber(value, language)}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}

function Brand() {
  return <a className="management-brand" href="/app"><span><i /><i /><i /></span><b>edifica<span>digital</span></b></a>
}

function Flash({ error, message }) {
  return <>{error && <p className="management-flash error">{error}</p>}{message && <p className="management-flash success">{message}</p>}</>
}

export default function ManagementTrackingPage() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(readLanguage)
  const t = copy[language]
  const [organizations, setOrganizations] = useState([])
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [periods, setPeriods] = useState([])
  const [activePeriodId, setActivePeriodId] = useState('')
  const [units, setUnits] = useState([])
  const [unitId, setUnitId] = useState('')
  const [memberships, setMemberships] = useState([])
  const [objectives, setObjectives] = useState([])
  const [projects, setProjects] = useState([])
  const [indicators, setIndicators] = useState([])
  const [progress, setProgress] = useState([])
  const [indicatorForm, setIndicatorForm] = useState(emptyIndicator)
  const [progressForm, setProgressForm] = useState(emptyProgress)
  const [indicatorOpen, setIndicatorOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'

  useEffect(() => {
    const observer = new MutationObserver(() => setLanguage(readLanguage()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (access.status === 'authorized') setOrganizationId((current) => current || access.organizationId || '')
  }, [access.organizationId, access.status])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) {
      setOrganizations(access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : [])
      return
    }
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) setError(requestError.message)
    else {
      setOrganizations(data ?? [])
      setOrganizationId((current) => current || data?.find((item) => item.code === 'cnbv')?.id || data?.[0]?.id || '')
    }
  }, [access.organizationId, access.organizationName, access.status, isSuperAdmin])

  const reload = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const responses = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('organization_unit').select('*').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id', organizationId),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('project').select('id, organization_id, code, name, status').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('management_indicator').select('*').eq('organization_id', organizationId).order('created_at'),
      supabase.from('indicator_progress').select('*').eq('organization_id', organizationId).order('created_at'),
    ])
    const firstError = responses.find((response) => response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows = responses[0].data ?? []
      setPeriods(periodRows)
      setUnits(responses[1].data ?? [])
      setMemberships(responses[2].data ?? [])
      setObjectives(responses[3].data ?? [])
      setProjects(responses[4].data ?? [])
      setIndicators(responses[5].data ?? [])
      setProgress(responses[6].data ?? [])
      setActivePeriodId((current) => current && periodRows.some((item) => item.id === current) ? current : periodRows.find((item) => item.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const manageableUnitIds = useMemo(() => {
    if (canAdmin) return units.map((unit) => unit.id)
    return memberships.filter((item) => item.active && ['director', 'manager', 'operator', 'reviewer'].includes(item.unit_role)).map((item) => item.unit_id)
  }, [canAdmin, memberships, units])

  const visibleUnits = useMemo(() => canAdmin ? units : units.filter((unit) => manageableUnitIds.includes(unit.id)), [canAdmin, manageableUnitIds, units])

  useEffect(() => {
    if (!visibleUnits.some((unit) => unit.id === unitId)) setUnitId(visibleUnits[0]?.id || '')
  }, [unitId, visibleUnits])

  const currentIndicators = indicators.filter((indicator) => indicator.management_period_id === activePeriodId && indicator.unit_id === unitId)
  const canManageSelected = canAdmin || manageableUnitIds.includes(unitId)
  const hasPeriod = Boolean(activePeriodId)
  const hasUnit = Boolean(unitId)
  const readyToCreate = hasPeriod && hasUnit && canManageSelected

  const startNewIndicator = () => {
    setIndicatorForm({ ...emptyIndicator })
    setIndicatorOpen(true)
    setProgressOpen(false)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const editIndicator = (indicator) => {
    setIndicatorForm({
      ...emptyIndicator,
      ...indicator,
      description: indicator.description ?? '',
      objective_id: indicator.objective_id ?? '',
      project_id: indicator.project_id ?? '',
      unit_label: indicator.unit_label ?? '',
      target_value: indicator.target_value ?? '',
      target_text: indicator.target_text ?? '',
      currency: indicator.currency ?? 'USD',
      source_note: indicator.source_note ?? '',
    })
    setIndicatorOpen(true)
    setProgressOpen(false)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveIndicator = async (event) => {
    event.preventDefault()
    if (!readyToCreate || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    const payload = {
      organization_id: organizationId,
      management_period_id: activePeriodId,
      unit_id: unitId,
      objective_id: indicatorForm.objective_id || null,
      project_id: indicatorForm.project_id || null,
      name: indicatorForm.name.trim(),
      description: indicatorForm.description.trim() || null,
      metric_type: indicatorForm.metric_type,
      unit_label: indicatorForm.unit_label.trim() || null,
      aggregation_method: indicatorForm.aggregation_method,
      target_value: indicatorForm.target_value === '' ? (indicatorForm.metric_type === 'boolean' ? 1 : null) : Number(indicatorForm.target_value),
      target_text: indicatorForm.target_text.trim() || null,
      currency: indicatorForm.metric_type === 'currency' ? indicatorForm.currency : null,
      frequency: indicatorForm.frequency,
      source_note: indicatorForm.source_note.trim() || null,
      active: true,
    }
    const wasEditing = Boolean(indicatorForm.id)
    const request = wasEditing
      ? supabase.from('management_indicator').update(payload).eq('id', indicatorForm.id)
      : supabase.from('management_indicator').insert(payload)
    const { error: requestError } = await request
    if (requestError) setError(requestError.message)
    else {
      setMessage(wasEditing ? t.indicatorUpdated : t.indicatorSaved)
      setIndicatorForm(emptyIndicator)
      setIndicatorOpen(false)
      await reload()
    }
    setSaving(false)
  }

  const startProgress = (indicator) => {
    setProgressForm({ ...emptyProgress, indicator_id: indicator.id, unit_id: indicator.unit_id, reporting_period_end: new Date().toISOString().slice(0, 10) })
    setProgressOpen(true)
    setIndicatorOpen(false)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveProgress = async (event) => {
    event.preventDefault()
    if (saving || !progressForm.indicator_id) return
    setSaving(true)
    setError('')
    setMessage('')
    const indicator = indicators.find((item) => item.id === progressForm.indicator_id)
    const payload = {
      organization_id: organizationId,
      indicator_id: progressForm.indicator_id,
      unit_id: progressForm.unit_id,
      reporting_period_start: progressForm.reporting_period_start || null,
      reporting_period_end: progressForm.reporting_period_end || null,
      numeric_value: progressForm.numeric_value === '' ? null : Number(progressForm.numeric_value),
      text_value: progressForm.text_value.trim() || null,
      numerator: progressForm.numerator === '' ? null : Number(progressForm.numerator),
      denominator: progressForm.denominator === '' ? null : Number(progressForm.denominator),
      notes: progressForm.notes.trim() || null,
      status: progressForm.status,
    }
    if (indicator?.aggregation_method === 'calculated' && Number(payload.denominator || 0) > 0) payload.numeric_value = (Number(payload.numerator || 0) / Number(payload.denominator)) * 100
    const { error: requestError } = await supabase.from('indicator_progress').insert(payload)
    if (requestError) setError(requestError.message)
    else {
      setMessage(t.progressSaved)
      setProgressForm(emptyProgress)
      setProgressOpen(false)
      await reload()
    }
    setSaving(false)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />

  if (loading) return <div className="management-shell"><aside className="management-sidebar no-print"><div className="management-sidebar-top"><Brand /><small>{t.module}</small></div></aside><main className="management-main"><div className="management-loading"><span /><p>{t.loading}</p></div></main></div>

  const progressIndicator = indicators.find((item) => item.id === progressForm.indicator_id)
  const preview = Number(progressForm.denominator || 0) > 0 ? (Number(progressForm.numerator || 0) / Number(progressForm.denominator)) * 100 : null
  const navRoutes = ['', 'structure', 'objectives', 'projects', 'tracking', 'reports']

  return (
    <div className="management-shell">
      <aside className="management-sidebar no-print">
        <div className="management-sidebar-top"><Brand /><small>{t.module}</small></div>
        <a className="management-back" href="/app">{t.back}</a>
        {isSuperAdmin && <label className="management-org-selector"><span>{language === 'en' ? 'Organization' : 'Organización'}</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></label>}
        <nav>{t.nav.map((label, index) => <button className={index === 4 ? 'active' : ''} type="button" onClick={() => window.location.assign(navRoutes[index] ? `/app/management/${navRoutes[index]}` : '/app/management')} key={label}><span>0{index + 1}</span>{label}</button>)}</nav>
        <div className="management-sidebar-footer">
          {canAdmin && <a className="management-users-link" href="/app/admin/operators">{t.users}</a>}
          <div><strong>{access.organizationName || organizations.find((item) => item.id === organizationId)?.name || (language === 'en' ? 'Organization' : 'Organización')}</strong><span>{access.displayName || access.email}</span></div>
          <button onClick={access.signOut}>{t.signOut}</button>
        </div>
      </aside>

      <main className="management-main">
        <div className="management-mobile-header no-print"><Brand /><div className="management-mobile-actions">{canAdmin && <a href="/app/admin/operators">{language === 'en' ? 'Users' : 'Usuarios'}</a>}<button onClick={() => window.location.assign('/app')}>{language === 'en' ? 'Modules' : 'Módulos'}</button></div></div>
        <div className="management-panel">
          <div className="management-panel-heading">
            <div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div>
            {canManageSelected && <button type="button" onClick={startNewIndicator} disabled={!readyToCreate} title={!hasPeriod ? t.periodMissing : !hasUnit ? t.unitMissing : ''}>{t.newIndicator}</button>}
          </div>

          <Flash error={error} message={message} />

          <section className={`management-readiness-card ${readyToCreate ? 'ready' : ''}`}>
            <header><small>{t.prerequisites}</small><h2>{t.prerequisiteTitle}</h2><p>{t.prerequisiteIntro}</p></header>
            <div className="management-readiness-grid">
              <article className={hasPeriod ? 'complete' : 'missing'}><span>1</span><div><strong>{t.period}</strong><p>{hasPeriod ? t.periodReady : t.periodMissing}</p></div><b>{hasPeriod ? t.ready : t.required}</b>{!hasPeriod && canAdmin && <a href="/app/management/objectives">{t.configure}</a>}</article>
              <article className={hasUnit ? 'complete' : 'missing'}><span>2</span><div><strong>{t.unit}</strong><p>{hasUnit ? t.unitReady : t.unitMissing}</p></div><b>{hasUnit ? t.ready : t.required}</b>{!hasUnit && canAdmin && <a href="/app/management/structure">{t.configure}</a>}</article>
              <article className="optional"><span>3</span><div><strong>{t.optional}</strong><p>{t.optionalHelp}</p></div><b>{t.optionalLabel}</b></article>
            </div>
          </section>

          <section className="management-filter-row">
            <label><span>{t.periodFilter}</span><select value={activePeriodId} onChange={(event) => setActivePeriodId(event.target.value)} disabled={!periods.length}><option value="">{t.noPeriod}</option>{periods.map((period) => <option value={period.id} key={period.id}>{period.name}</option>)}</select></label>
            <label><span>{t.unitFilter}</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} disabled={!visibleUnits.length}><option value="">{t.noUnit}</option>{visibleUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
          </section>

          {indicatorOpen && (
            <form className="management-form-card management-indicator-editor" onSubmit={saveIndicator}>
              <div className="management-form-title"><div><small>{t.indicator}</small><h2>{indicatorForm.id ? t.editIndicatorTitle : t.createIndicatorTitle}</h2>{indicatorForm.id && <p>{t.editIndicatorIntro}</p>}</div><button type="button" onClick={() => setIndicatorOpen(false)}>{language === 'en' ? 'Close' : 'Cerrar'}</button></div>
              <div className="management-form-grid">
                <label className="wide"><span>{t.measure}</span><input value={indicatorForm.name} onChange={(event) => setIndicatorForm((current) => ({ ...current, name: event.target.value }))} required /><small className="management-field-help">{t.measureExample}</small></label>
                <label><span>{t.metricType}</span><select value={indicatorForm.metric_type} onChange={(event) => { const value = event.target.value; setIndicatorForm((current) => ({ ...current, metric_type: value, aggregation_method: value === 'percentage' ? 'calculated' : ['text', 'boolean'].includes(value) ? 'latest' : current.aggregation_method, target_value: value === 'boolean' ? '1' : current.target_value })) }}>{Object.entries(metricTypes[language]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className="wide"><span>{t.aggregation}</span><select value={indicatorForm.aggregation_method} onChange={(event) => setIndicatorForm((current) => ({ ...current, aggregation_method: event.target.value }))}>{Object.entries(aggregationOptions[language]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small className="management-field-help">{t.aggregationHelp}</small></label>
                {!['currency', 'percentage', 'boolean', 'text'].includes(indicatorForm.metric_type) && <label><span>{t.unitLabel}</span><input value={indicatorForm.unit_label} onChange={(event) => setIndicatorForm((current) => ({ ...current, unit_label: event.target.value }))} /><small className="management-field-help">{t.unitExample}</small></label>}
                {indicatorForm.metric_type !== 'text' && indicatorForm.metric_type !== 'boolean' && <label><span>{t.target}</span><input type="number" step="0.01" value={indicatorForm.target_value} onChange={(event) => setIndicatorForm((current) => ({ ...current, target_value: event.target.value }))} /><small className="management-field-help">{t.targetExample}</small></label>}
                {indicatorForm.metric_type === 'currency' && <label><span>{t.currency}</span><select value={indicatorForm.currency} onChange={(event) => setIndicatorForm((current) => ({ ...current, currency: event.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>}
                <label><span>{t.frequency}</span><select value={indicatorForm.frequency} onChange={(event) => setIndicatorForm((current) => ({ ...current, frequency: event.target.value }))}>{Object.entries(frequencyOptions[language]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label><span>{t.objective}</span><select value={indicatorForm.objective_id} onChange={(event) => setIndicatorForm((current) => ({ ...current, objective_id: event.target.value }))}><option value="">{t.noObjective}</option>{objectives.filter((item) => item.management_period_id === activePeriodId).map((objective) => <option key={objective.id} value={objective.id}>{objective.code} · {objective.title}</option>)}</select><small className="management-field-help">{t.objectiveHelp}</small></label>
                <label><span>{t.project}</span><select value={indicatorForm.project_id} onChange={(event) => setIndicatorForm((current) => ({ ...current, project_id: event.target.value }))}><option value="">{t.noProject}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select><small className="management-field-help">{t.projectHelp}</small></label>
                <label className="wide"><span>{t.description}</span><textarea value={indicatorForm.description} onChange={(event) => setIndicatorForm((current) => ({ ...current, description: event.target.value }))} /><small className="management-field-help">{t.descriptionExample}</small></label>
                <label className="wide"><span>{t.source}</span><textarea value={indicatorForm.source_note} onChange={(event) => setIndicatorForm((current) => ({ ...current, source_note: event.target.value }))} /><small className="management-field-help">{t.sourceExample}</small></label>
              </div>
              <div className="management-form-actions"><button type="button" onClick={() => setIndicatorOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{saving ? t.saving : indicatorForm.id ? t.saveChanges : t.saveIndicator}</button></div>
            </form>
          )}

          {progressOpen && (
            <form className="management-form-card compact management-progress-editor" onSubmit={saveProgress}>
              <div className="management-form-title"><div><small>{t.progressEyebrow}</small><h2>{progressIndicator?.name}</h2><p>{t.progressIntro}</p></div><button type="button" onClick={() => setProgressOpen(false)}>{language === 'en' ? 'Close' : 'Cerrar'}</button></div>
              <div className="management-form-grid">
                <label><span>{t.from}</span><input type="date" value={progressForm.reporting_period_start} onChange={(event) => setProgressForm((current) => ({ ...current, reporting_period_start: event.target.value }))} /></label>
                <label><span>{t.to}</span><input type="date" value={progressForm.reporting_period_end} onChange={(event) => setProgressForm((current) => ({ ...current, reporting_period_end: event.target.value }))} /></label>
                {progressIndicator?.aggregation_method === 'calculated' ? <>
                  <label><span>{t.achieved}</span><input type="number" step="0.01" value={progressForm.numerator} onChange={(event) => setProgressForm((current) => ({ ...current, numerator: event.target.value }))} /><small className="management-field-help">{t.achievedExample}</small></label>
                  <label><span>{t.total}</span><input type="number" step="0.01" value={progressForm.denominator} onChange={(event) => setProgressForm((current) => ({ ...current, denominator: event.target.value }))} /><small className="management-field-help">{t.totalExample}</small></label>
                  <div className="management-calculated-preview wide"><span>{t.calculatedResult}</span><strong>{preview === null ? '—' : `${formatNumber(preview, language)} %`}</strong>{preview !== null && <small>{formatNumber(progressForm.numerator, language)} / {formatNumber(progressForm.denominator, language)} = {formatNumber(preview, language)}%</small>}</div>
                </> : progressIndicator?.metric_type === 'text' ? <label className="wide"><span>{t.reportedText}</span><textarea value={progressForm.text_value} onChange={(event) => setProgressForm((current) => ({ ...current, text_value: event.target.value }))} /></label> : progressIndicator?.metric_type === 'boolean' ? <label><span>{t.reportedValue}</span><select value={progressForm.numeric_value} onChange={(event) => setProgressForm((current) => ({ ...current, numeric_value: event.target.value }))}><option value="">—</option><option value="1">{language === 'en' ? 'Yes' : 'Sí'}</option><option value="0">No</option></select></label> : <label><span>{t.reportedValue}</span><input type="number" step="0.01" value={progressForm.numeric_value} onChange={(event) => setProgressForm((current) => ({ ...current, numeric_value: event.target.value }))} /></label>}
                <label><span>{t.status}</span><select value={progressForm.status} onChange={(event) => setProgressForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">{t.draft}</option><option value="submitted">{t.submitted}</option><option value="verified">{t.verified}</option></select><small className="management-field-help">{t.statusHelp}</small></label>
                <label className="wide"><span>{t.notes}</span><textarea value={progressForm.notes} onChange={(event) => setProgressForm((current) => ({ ...current, notes: event.target.value }))} /><small className="management-field-help">{t.notesExample}</small></label>
              </div>
              <div className="management-form-actions"><button type="button" onClick={() => setProgressOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.saveProgress}</button></div>
            </form>
          )}

          <section className="management-indicators-card">
            <div className="management-card-heading"><div><small>{t.board}</small><h2>{currentIndicators.length} {t.indicators}</h2></div></div>
            {!currentIndicators.length ? <p className="management-empty">{t.noIndicators}</p> : <div className="indicator-grid">{currentIndicators.map((indicator) => {
              const result = aggregateIndicator(indicator, progress)
              const indicatorProgress = progress.filter((row) => row.indicator_id === indicator.id)
              return <article key={indicator.id}>
                <header><span>{metricTypes[language][indicator.metric_type] || indicator.metric_type}</span><b>{aggregationOptions[language][indicator.aggregation_method] || indicator.aggregation_method}</b></header>
                <h3>{indicator.name}</h3>
                <div className="indicator-values"><div><span>{t.targetLabel}</span><strong>{indicator.target_value === null ? (indicator.target_text || '—') : metricDisplay(indicator.target_value, indicator, language)}</strong></div><div><span>{t.executed}</span><strong>{result.text || metricDisplay(result.value, indicator, language)}</strong></div></div>
                {Number(indicator.target_value || 0) > 0 && <div className="indicator-progress"><span style={{ width: `${Math.min(result.completion, 100)}%` }} /><b>{result.completion}%</b></div>}
                <footer className="indicator-card-footer"><small>{frequencyOptions[language][indicator.frequency]} · {indicatorProgress.length} {t.advances}</small>{canManageSelected && <div className="indicator-card-actions"><button className="edit" type="button" onClick={() => editIndicator(indicator)}>{t.editIndicator}</button><button type="button" onClick={() => startProgress(indicator)}>{t.progress}</button></div>}</footer>
              </article>
            })}</div>}
          </section>
        </div>
      </main>
    </div>
  )
}
