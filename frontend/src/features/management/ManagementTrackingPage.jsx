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
    sum: 'Sumar todos los resultados cargados',
    average: 'Calcular un promedio',
    latest: 'Usar el último resultado cargado',
    max: 'Usar el valor más alto',
    unique_people: 'Contar personas diferentes',
    calculated: 'Usar el porcentaje reportado',
    non_aggregable: 'Mostrar cada resultado por separado',
  },
  en: {
    sum: 'Add all recorded results',
    average: 'Calculate an average',
    latest: 'Use the latest recorded result',
    max: 'Use the highest value',
    unique_people: 'Count unique people',
    calculated: 'Use the reported percentage',
    non_aggregable: 'Keep each result separate',
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
    title: 'Indicadores y resultados',
    intro: 'Define una vez la meta de cada indicador. Después registra únicamente lo que realmente se logró en cada período; Edifica compara y consolida los resultados.',
    newIndicator: '＋ Crear indicador',
    editIndicator: 'Editar indicador',
    progress: 'Registrar resultado',
    periodFilter: 'Período',
    unitFilter: 'Área responsable',
    noPeriod: 'Sin período disponible',
    noUnit: 'Sin áreas disponibles',
    missingPeriod: 'Falta crear un período de gestión antes de registrar indicadores.',
    missingUnit: 'Falta crear al menos un área o unidad organizativa antes de registrar indicadores.',
    configurePeriod: 'Configurar período',
    configureUnit: 'Configurar estructura',
    indicator: 'INDICADOR',
    createIndicatorTitle: 'Crear indicador',
    editIndicatorTitle: 'Editar indicador',
    indicatorContext: 'El período y el área responsable ya están seleccionados. Objetivo institucional y proyecto son relaciones opcionales que puedes agregar ahora o después.',
    editIndicatorIntro: 'Aquí puedes cambiar el nombre, la meta y la forma de consolidar el indicador. Los resultados ya registrados se conservan.',
    measure: '¿Qué quieres medir? *',
    measureExample: 'Ej.: Personas capacitadas, iglesias participantes, ingresos anuales, presupuesto ejecutado.',
    metricType: '¿Qué clase de resultado vas a registrar?',
    aggregation: 'Cuando cargues varios resultados, ¿cómo debe quedar el total?',
    aggregationHelp: 'Ej.: 40 personas en enero + 60 en febrero = 100 si eliges sumar. Para porcentajes normalmente conviene usar el último resultado.',
    unitLabel: '¿En qué unidad lo vas a contar?',
    unitExample: 'Ej.: personas, iglesias, kits, publicaciones, litros.',
    target: 'Meta del indicador',
    targetExample: 'Se registra una sola vez. Ej.: 300 personas, 85 %, 50.000 USD.',
    currency: 'Moneda',
    frequency: '¿Cada cuánto esperas actualizar este indicador?',
    objective: 'Objetivo institucional relacionado (opcional)',
    noObjective: 'Sin objetivo relacionado',
    objectiveHelp: 'El indicador puede existir aunque todavía no hayas creado objetivos.',
    project: 'Proyecto relacionado (opcional)',
    noProject: 'Sin proyecto relacionado',
    projectHelp: 'Puedes vincular un proyecto después sin perder el historial del indicador.',
    description: '¿Qué significa este indicador?',
    descriptionExample: 'Aclara qué se cuenta para evitar interpretaciones distintas entre quienes cargan información.',
    source: '¿De dónde saldrá este dato?',
    sourceExample: 'Ej.: reporte financiero, lista de asistencia, formulario, acta o base de datos.',
    cancel: 'Cancelar',
    saveIndicator: 'Guardar indicador',
    saveChanges: 'Guardar cambios',
    saving: 'Guardando…',
    resultEyebrow: 'RESULTADO DEL PERÍODO',
    resultIntro: 'La meta ya está guardada en el indicador. Aquí solo cargas el resultado real alcanzado durante este período.',
    targetReference: 'META REGISTRADA',
    startDate: 'Inicio del período reportado (opcional)',
    startDateHelp: 'Úsalo únicamente cuando el resultado corresponda a un intervalo.',
    endDate: 'Fecha o cierre del resultado',
    endDateHelp: 'Fecha hasta la cual estás reportando este resultado.',
    resultValue: 'Resultado logrado',
    amountValue: 'Monto logrado',
    percentageValue: 'Porcentaje logrado (%)',
    ratioValue: 'Valor logrado',
    textValue: '¿Qué resultado o información deseas reportar?',
    resultHelp: 'Escribe únicamente el dato real. Edifica lo comparará con la meta que ya está registrada.',
    yesNoValue: '¿Se cumplió?',
    saveAsDraft: 'Guardar como borrador',
    draftHelp: 'Actívalo solo si este resultado todavía no debe entrar en los cálculos del indicador.',
    notes: '¿Qué ocurrió durante este período?',
    notesExample: 'Agrega contexto, incidencias, aclaraciones o información que pueda ser útil al generar el informe.',
    saveResult: 'Guardar resultado',
    board: 'TABLERO DE SEGUIMIENTO',
    indicators: 'indicadores',
    noIndicators: 'Todavía no hay indicadores para esta área y período. Crea el primero definiendo qué quieres medir y cuál es su meta.',
    targetLabel: 'Meta',
    executed: 'Resultado actual',
    results: 'resultados cargados',
    indicatorSaved: 'Indicador guardado.',
    indicatorUpdated: 'Indicador actualizado.',
    resultSaved: 'Resultado registrado.',
    requiredResult: 'Debes registrar el resultado alcanzado antes de guardar.',
    loading: 'Cargando indicadores…',
  },
  en: {
    module: 'ORGANIZATIONAL MANAGEMENT',
    back: '← All modules',
    nav: ['Overview', 'Structure', 'Objectives', 'Projects', 'Tracking', 'Reports'],
    users: 'Users and access',
    signOut: 'Sign out',
    eyebrow: 'TRACKING',
    title: 'Indicators and results',
    intro: 'Define each indicator target once. Then record only what was actually achieved in each period; Edifica compares and consolidates the results.',
    newIndicator: '＋ Create indicator',
    editIndicator: 'Edit indicator',
    progress: 'Record result',
    periodFilter: 'Period',
    unitFilter: 'Responsible area',
    noPeriod: 'No period available',
    noUnit: 'No areas available',
    missingPeriod: 'Create a management period before registering indicators.',
    missingUnit: 'Create at least one organizational area or unit before registering indicators.',
    configurePeriod: 'Configure period',
    configureUnit: 'Configure structure',
    indicator: 'INDICATOR',
    createIndicatorTitle: 'Create indicator',
    editIndicatorTitle: 'Edit indicator',
    indicatorContext: 'The management period and responsible area are already selected. Institutional objective and project are optional relationships that can be added now or later.',
    editIndicatorIntro: 'Change the name, target, and consolidation rule here. Previously recorded results are preserved.',
    measure: 'What do you want to measure? *',
    measureExample: 'Example: People trained, participating churches, annual income, budget executed.',
    metricType: 'What kind of result will you record?',
    aggregation: 'When several results are entered, how should the final total be obtained?',
    aggregationHelp: 'Example: 40 people in January + 60 in February = 100 when using sum. For percentages, the latest result is usually appropriate.',
    unitLabel: 'What unit will you use?',
    unitExample: 'Example: people, churches, kits, posts, liters.',
    target: 'Indicator target',
    targetExample: 'Set it once. Example: 300 people, 85%, USD 50,000.',
    currency: 'Currency',
    frequency: 'How often do you expect to update this indicator?',
    objective: 'Related institutional objective (optional)',
    noObjective: 'No related objective',
    objectiveHelp: 'The indicator can exist even if objectives have not been created yet.',
    project: 'Related project (optional)',
    noProject: 'No related project',
    projectHelp: 'A project can be linked later without losing indicator history.',
    description: 'What does this indicator mean?',
    descriptionExample: 'Clarify what is counted so everyone reports it consistently.',
    source: 'Where will this data come from?',
    sourceExample: 'Example: financial report, attendance list, form, minutes, or database.',
    cancel: 'Cancel',
    saveIndicator: 'Save indicator',
    saveChanges: 'Save changes',
    saving: 'Saving…',
    resultEyebrow: 'PERIOD RESULT',
    resultIntro: 'The target is already stored in the indicator. Here you only enter the actual result achieved during this period.',
    targetReference: 'SAVED TARGET',
    startDate: 'Start of reported period (optional)',
    startDateHelp: 'Use this only when the result covers an interval.',
    endDate: 'Result date or period end',
    endDateHelp: 'Date through which this result is being reported.',
    resultValue: 'Result achieved',
    amountValue: 'Amount achieved',
    percentageValue: 'Percentage achieved (%)',
    ratioValue: 'Value achieved',
    textValue: 'What result or information do you want to report?',
    resultHelp: 'Enter only the actual result. Edifica will compare it with the target already stored in the indicator.',
    yesNoValue: 'Was it achieved?',
    saveAsDraft: 'Save as draft',
    draftHelp: 'Use this only if the result should not be included in indicator calculations yet.',
    notes: 'What happened during this period?',
    notesExample: 'Add context, incidents, clarifications, or information that may be useful in the final report.',
    saveResult: 'Save result',
    board: 'TRACKING BOARD',
    indicators: 'indicators',
    noIndicators: 'There are no indicators for this area and period yet. Create the first one by defining what you want to measure and its target.',
    targetLabel: 'Target',
    executed: 'Current result',
    results: 'results recorded',
    indicatorSaved: 'Indicator saved.',
    indicatorUpdated: 'Indicator updated.',
    resultSaved: 'Result recorded.',
    requiredResult: 'Enter the achieved result before saving.',
    loading: 'Loading indicators…',
  },
}

const emptyIndicator = {
  id: '', name: '', description: '', objective_id: '', project_id: '', metric_type: 'count', unit_label: 'personas',
  aggregation_method: 'sum', target_value: '', target_text: '', currency: 'USD', frequency: 'annual', source_note: '',
}

const emptyProgress = {
  indicator_id: '', unit_id: '', reporting_period_start: '', reporting_period_end: '', numeric_value: '', text_value: '', notes: '', status: 'submitted',
}

function readLanguage() {
  try {
    return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
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
    value = Number(row?.denominator || 0) > 0
      ? (Number(row?.numerator || 0) / Number(row.denominator)) * 100
      : Number(row?.numeric_value || 0)
  } else value = rows.reduce((sum, row) => sum + Number(row.numeric_value || 0), 0)

  const target = Number(indicator.target_value || 0)
  return { value, text: '', completion: target > 0 ? Math.round((value / target) * 1000) / 10 : 0 }
}

function metricDisplay(value, indicator, language) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  if (indicator.metric_type === 'currency') {
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE', {
      style: 'currency', currency: indicator.currency || 'USD', maximumFractionDigits: 2,
    }).format(Number(value))
  }
  if (indicator.metric_type === 'percentage' || indicator.aggregation_method === 'calculated') return `${formatNumber(value, language)}%`
  if (indicator.metric_type === 'boolean') return Number(value) ? (language === 'en' ? 'Yes' : 'Sí') : 'No'
  return `${formatNumber(value, language)}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}

function resultFieldLabel(indicator, t) {
  if (!indicator) return t.resultValue
  if (indicator.metric_type === 'currency') return t.amountValue
  if (indicator.metric_type === 'percentage' || indicator.aggregation_method === 'calculated') return t.percentageValue
  if (indicator.metric_type === 'ratio') return t.ratioValue
  return t.resultValue
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
      setActivePeriodId((current) => current && periodRows.some((item) => item.id === current)
        ? current
        : periodRows.find((item) => item.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const manageableUnitIds = useMemo(() => {
    if (canAdmin) return units.map((unit) => unit.id)
    return memberships
      .filter((item) => item.active && ['director', 'manager', 'operator', 'reviewer'].includes(item.unit_role))
      .map((item) => item.unit_id)
  }, [canAdmin, memberships, units])

  const visibleUnits = useMemo(
    () => canAdmin ? units : units.filter((unit) => manageableUnitIds.includes(unit.id)),
    [canAdmin, manageableUnitIds, units],
  )

  useEffect(() => {
    if (!visibleUnits.some((unit) => unit.id === unitId)) setUnitId(visibleUnits[0]?.id || '')
  }, [unitId, visibleUnits])

  const currentIndicators = indicators.filter((indicator) => indicator.management_period_id === activePeriodId && indicator.unit_id === unitId)
  const canManageSelected = canAdmin || manageableUnitIds.includes(unitId)
  const hasPeriod = Boolean(activePeriodId)
  const hasUnit = Boolean(unitId)
  const readyToCreate = hasPeriod && hasUnit && canManageSelected
  const selectedPeriod = periods.find((period) => period.id === activePeriodId)
  const selectedUnit = units.find((unit) => unit.id === unitId)

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
    setProgressForm({
      ...emptyProgress,
      indicator_id: indicator.id,
      unit_id: indicator.unit_id,
      reporting_period_end: new Date().toISOString().slice(0, 10),
      status: 'submitted',
    })
    setProgressOpen(true)
    setIndicatorOpen(false)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveProgress = async (event) => {
    event.preventDefault()
    if (saving || !progressForm.indicator_id) return
    const indicator = indicators.find((item) => item.id === progressForm.indicator_id)
    const needsText = indicator?.metric_type === 'text'
    const missingValue = needsText ? !progressForm.text_value.trim() : progressForm.numeric_value === ''
    if (missingValue) {
      setError(t.requiredResult)
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      organization_id: organizationId,
      indicator_id: progressForm.indicator_id,
      unit_id: progressForm.unit_id,
      reporting_period_start: progressForm.reporting_period_start || null,
      reporting_period_end: progressForm.reporting_period_end || null,
      numeric_value: progressForm.numeric_value === '' ? null : Number(progressForm.numeric_value),
      text_value: progressForm.text_value.trim() || null,
      numerator: null,
      denominator: null,
      notes: progressForm.notes.trim() || null,
      status: progressForm.status,
    }

    const { error: requestError } = await supabase.from('indicator_progress').insert(payload)
    if (requestError) setError(requestError.message)
    else {
      setMessage(t.resultSaved)
      setProgressForm(emptyProgress)
      setProgressOpen(false)
      await reload()
    }
    setSaving(false)
  }

  if (access.status !== 'authorized') {
    return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />
  }

  if (loading) {
    return <div className="management-shell"><aside className="management-sidebar no-print"><div className="management-sidebar-top"><Brand /><small>{t.module}</small></div></aside><main className="management-main"><div className="management-loading"><span /><p>{t.loading}</p></div></main></div>
  }

  const progressIndicator = indicators.find((item) => item.id === progressForm.indicator_id)
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
            {canManageSelected && <button type="button" onClick={startNewIndicator} disabled={!readyToCreate}>{t.newIndicator}</button>}
          </div>

          <Flash error={error} message={message} />

          {!readyToCreate && (
            <div className="management-prerequisite-alert">
              {!hasPeriod && <span>{t.missingPeriod} {canAdmin && <a href="/app/management/objectives">{t.configurePeriod}</a>}</span>}
              {!hasUnit && <span>{t.missingUnit} {canAdmin && <a href="/app/management/structure">{t.configureUnit}</a>}</span>}
            </div>
          )}

          <section className="management-filter-row">
            <label><span>{t.periodFilter}</span><select value={activePeriodId} onChange={(event) => setActivePeriodId(event.target.value)} disabled={!periods.length}><option value="">{t.noPeriod}</option>{periods.map((period) => <option value={period.id} key={period.id}>{period.name}</option>)}</select></label>
            <label><span>{t.unitFilter}</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} disabled={!visibleUnits.length}><option value="">{t.noUnit}</option>{visibleUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
          </section>

          {indicatorOpen && (
            <form className="management-form-card management-indicator-editor" onSubmit={saveIndicator}>
              <div className="management-form-title"><div><small>{t.indicator}</small><h2>{indicatorForm.id ? t.editIndicatorTitle : t.createIndicatorTitle}</h2><p>{indicatorForm.id ? t.editIndicatorIntro : t.indicatorContext}</p></div><button type="button" onClick={() => setIndicatorOpen(false)}>{language === 'en' ? 'Close' : 'Cerrar'}</button></div>
              <div className="management-context-note"><strong>{selectedPeriod?.name || t.periodFilter}</strong><span>·</span><strong>{selectedUnit ? `${selectedUnit.code} · ${selectedUnit.name}` : t.unitFilter}</strong></div>
              <div className="management-form-grid">
                <label className="wide"><span>{t.measure}</span><input value={indicatorForm.name} onChange={(event) => setIndicatorForm((current) => ({ ...current, name: event.target.value }))} required /><small className="management-field-help">{t.measureExample}</small></label>
                <label><span>{t.metricType}</span><select value={indicatorForm.metric_type} onChange={(event) => { const value = event.target.value; setIndicatorForm((current) => ({ ...current, metric_type: value, aggregation_method: value === 'percentage' ? 'latest' : ['text', 'boolean'].includes(value) ? 'latest' : current.aggregation_method, target_value: value === 'boolean' ? '1' : current.target_value })) }}>{Object.entries(metricTypes[language]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label><span>{t.frequency}</span><select value={indicatorForm.frequency} onChange={(event) => setIndicatorForm((current) => ({ ...current, frequency: event.target.value }))}>{Object.entries(frequencyOptions[language]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className="wide"><span>{t.aggregation}</span><select value={indicatorForm.aggregation_method} onChange={(event) => setIndicatorForm((current) => ({ ...current, aggregation_method: event.target.value }))}>{Object.entries(aggregationOptions[language]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small className="management-field-help">{t.aggregationHelp}</small></label>
                {!['currency', 'percentage', 'boolean', 'text'].includes(indicatorForm.metric_type) && <label><span>{t.unitLabel}</span><input value={indicatorForm.unit_label} onChange={(event) => setIndicatorForm((current) => ({ ...current, unit_label: event.target.value }))} /><small className="management-field-help">{t.unitExample}</small></label>}
                {indicatorForm.metric_type !== 'text' && indicatorForm.metric_type !== 'boolean' && <label><span>{t.target}</span><input type="number" step="0.01" value={indicatorForm.target_value} onChange={(event) => setIndicatorForm((current) => ({ ...current, target_value: event.target.value }))} /><small className="management-field-help">{t.targetExample}</small></label>}
                {indicatorForm.metric_type === 'currency' && <label><span>{t.currency}</span><select value={indicatorForm.currency} onChange={(event) => setIndicatorForm((current) => ({ ...current, currency: event.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>}
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
              <div className="management-form-title"><div><small>{t.resultEyebrow}</small><h2>{progressIndicator?.name}</h2><p>{t.resultIntro}</p></div><button type="button" onClick={() => setProgressOpen(false)}>{language === 'en' ? 'Close' : 'Cerrar'}</button></div>
              <div className="management-target-reference"><span>{t.targetReference}</span><strong>{progressIndicator?.target_value === null || progressIndicator?.target_value === undefined ? (progressIndicator?.target_text || '—') : metricDisplay(progressIndicator.target_value, progressIndicator, language)}</strong><small>{selectedPeriod?.name} · {selectedUnit ? `${selectedUnit.code} · ${selectedUnit.name}` : ''}</small></div>
              <div className="management-form-grid">
                <label><span>{t.startDate}</span><input type="date" value={progressForm.reporting_period_start} onChange={(event) => setProgressForm((current) => ({ ...current, reporting_period_start: event.target.value }))} /><small className="management-field-help">{t.startDateHelp}</small></label>
                <label><span>{t.endDate}</span><input type="date" value={progressForm.reporting_period_end} onChange={(event) => setProgressForm((current) => ({ ...current, reporting_period_end: event.target.value }))} /><small className="management-field-help">{t.endDateHelp}</small></label>
                {progressIndicator?.metric_type === 'text'
                  ? <label className="wide"><span>{t.textValue}</span><textarea value={progressForm.text_value} onChange={(event) => setProgressForm((current) => ({ ...current, text_value: event.target.value }))} required /></label>
                  : progressIndicator?.metric_type === 'boolean'
                    ? <label><span>{t.yesNoValue}</span><select value={progressForm.numeric_value} onChange={(event) => setProgressForm((current) => ({ ...current, numeric_value: event.target.value }))} required><option value="">—</option><option value="1">{language === 'en' ? 'Yes' : 'Sí'}</option><option value="0">No</option></select></label>
                    : <label className="wide"><span>{resultFieldLabel(progressIndicator, t)}</span><input type="number" step="0.01" value={progressForm.numeric_value} onChange={(event) => setProgressForm((current) => ({ ...current, numeric_value: event.target.value }))} required /><small className="management-field-help">{t.resultHelp}</small></label>}
                <label className="wide management-draft-check"><div><input type="checkbox" checked={progressForm.status === 'draft'} onChange={(event) => setProgressForm((current) => ({ ...current, status: event.target.checked ? 'draft' : 'submitted' }))} /><span>{t.saveAsDraft}</span></div><small className="management-field-help">{t.draftHelp}</small></label>
                <label className="wide"><span>{t.notes}</span><textarea value={progressForm.notes} onChange={(event) => setProgressForm((current) => ({ ...current, notes: event.target.value }))} /><small className="management-field-help">{t.notesExample}</small></label>
              </div>
              <div className="management-form-actions"><button type="button" onClick={() => setProgressOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{saving ? t.saving : t.saveResult}</button></div>
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
                <footer className="indicator-card-footer"><small>{frequencyOptions[language][indicator.frequency]} · {indicatorProgress.length} {t.results}</small>{canManageSelected && <div className="indicator-card-actions"><button className="edit" type="button" onClick={() => editIndicator(indicator)}>{t.editIndicator}</button><button type="button" onClick={() => startProgress(indicator)}>{t.progress}</button></div>}</footer>
              </article>
            })}</div>}
          </section>
        </div>
      </main>
    </div>
  )
}
