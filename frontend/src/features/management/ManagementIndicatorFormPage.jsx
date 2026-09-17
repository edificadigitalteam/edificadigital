import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-indicator-form.css'

const indicatorKinds = {
  es: {
    result: { label: 'Resultado', help: 'Mide el cambio o logro alcanzado por el objetivo.' },
    output: { label: 'Producto / entregable', help: 'Mide lo que la Dirección produjo o entregó.' },
    process: { label: 'Proceso / gestión', help: 'Mide ejecución, cumplimiento o actividad realizada.' },
    impact: { label: 'Impacto', help: 'Mide un efecto de mayor alcance o transformación.' },
  },
  en: {
    result: { label: 'Outcome', help: 'Measures the change or achievement produced by the objective.' },
    output: { label: 'Output / deliverable', help: 'Measures what the unit produced or delivered.' },
    process: { label: 'Process / management', help: 'Measures execution, compliance or work performed.' },
    impact: { label: 'Impact', help: 'Measures a broader or longer-term effect.' },
  },
}
const metricTypes = {
  es: { count: 'Cantidad', currency: 'Dinero', percentage: 'Porcentaje', ratio: 'Relación / tasa', boolean: 'Sí / No', text: 'Texto o descripción' },
  en: { count: 'Quantity', currency: 'Money', percentage: 'Percentage', ratio: 'Ratio / rate', boolean: 'Yes / No', text: 'Text or description' },
}
const aggregationOptions = {
  es: { sum: 'Sumar todos los resultados cargados', average: 'Calcular un promedio', latest: 'Usar el último resultado cargado', max: 'Usar el valor más alto', unique_people: 'Contar personas diferentes', non_aggregable: 'Mostrar el último dato sin acumular' },
  en: { sum: 'Add all recorded results', average: 'Calculate an average', latest: 'Use the latest recorded result', max: 'Use the highest value', unique_people: 'Count unique people', non_aggregable: 'Show the latest value without accumulating' },
}
const frequencyOptions = {
  es: { monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', ad_hoc: 'Cuando aplique' },
  en: { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semiannual', annual: 'Annual', ad_hoc: 'When applicable' },
}
const emptyForm = { name: '', description: '', objective_id: '', project_id: '', indicator_kind: 'result', metric_type: 'count', unit_label: 'personas', aggregation_method: 'sum', target_value: '', target_text: '', currency: 'USD', frequency: 'annual', source_note: '' }

const copy = {
  es: {
    eyebrow: 'INDICADOR DEL OBJETIVO', title: 'Crear indicador', intro: 'El indicador pertenece a un objetivo del Plan Anual. Primero define qué clase de indicador es y luego cómo se medirá.',
    period: 'Año de trabajo *', unit: 'Dirección responsable *', objective: 'Objetivo *', noObjective: 'Selecciona un objetivo', project: 'Proyecto relacionado (opcional)', noProject: 'Sin proyecto relacionado',
    measure: 'Nombre del indicador *', kind: '¿Qué tipo de indicador es?', metric: '¿En qué formato se registrará el dato?', aggregation: '¿Cómo se consolidarán varios resultados?', unitLabel: 'Unidad de medida', target: 'Meta del indicador', targetText: 'Meta o criterio esperado', currency: 'Moneda', frequency: 'Frecuencia de actualización', description: '¿Qué significa este indicador?', source: 'Fuente del dato / evidencia',
    cancel: 'Cancelar', save: 'Crear indicador', saving: 'Guardando…', context: 'CONTEXTO DEL INDICADOR', help: 'El año, la Dirección y el objetivo determinan dónde vive este indicador. Después los resultados cargados aquí se arrastran automáticamente a los informes.', noAccess: 'No tienes una unidad habilitada para crear indicadores.', noObjectives: 'Esta Dirección todavía no tiene objetivos en el Plan Anual. Crea primero un objetivo.',
  },
  en: {
    eyebrow: 'OBJECTIVE INDICATOR', title: 'Create indicator', intro: 'The indicator belongs to an Annual Work Plan objective. First define what kind of indicator it is, then how it will be measured.',
    period: 'Work year *', unit: 'Responsible unit *', objective: 'Objective *', noObjective: 'Select an objective', project: 'Related project (optional)', noProject: 'No related project',
    measure: 'Indicator name *', kind: 'What type of indicator is it?', metric: 'How will the data be recorded?', aggregation: 'How should multiple results be consolidated?', unitLabel: 'Unit of measure', target: 'Indicator target', targetText: 'Expected target or criterion', currency: 'Currency', frequency: 'Update frequency', description: 'What does this indicator mean?', source: 'Data source / evidence',
    cancel: 'Cancel', save: 'Create indicator', saving: 'Saving…', context: 'INDICATOR CONTEXT', help: 'The work year, unit and objective determine where this indicator belongs. Results recorded here are later pulled automatically into reports.', noAccess: 'You do not have an enabled unit for creating indicators.', noObjectives: 'This unit has no objectives in its Annual Work Plan yet. Create an objective first.',
  },
}

function readLanguage() { try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function normalizedMethod(form) { return ['percentage','text','boolean'].includes(form.metric_type) ? 'latest' : (form.aggregation_method || 'sum') }

export default function ManagementIndicatorFormPage() {
  const access = useOperatorAccess()
  const params = new URLSearchParams(window.location.search)
  const [language, setLanguage] = useState(readLanguage)
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [organizations, setOrganizations] = useState([])
  const [periods, setPeriods] = useState([])
  const [units, setUnits] = useState([])
  const [memberships, setMemberships] = useState([])
  const [workPlans, setWorkPlans] = useState([])
  const [objectives, setObjectives] = useState([])
  const [projects, setProjects] = useState([])
  const [periodId, setPeriodId] = useState(params.get('period') || '')
  const [unitId, setUnitId] = useState(params.get('unit') || '')
  const [form, setForm] = useState({ ...emptyForm, objective_id: params.get('objective') || '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'
  const t = copy[language]

  useEffect(() => { const observer = new MutationObserver(() => setLanguage(readLanguage())); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); return () => observer.disconnect() }, [])
  useEffect(() => { if (access.status === 'authorized' && !isSuperAdmin) setOrganizationId(access.organizationId || '') }, [access.organizationId, access.status, isSuperAdmin])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) { setOrganizations(access.organizationId ? [{ id: access.organizationId, name: access.organizationName }] : []); return }
    const { data, error: requestError } = await supabase.rpc('admin_list_organizations')
    if (requestError) setError(requestError.message)
    else { const rows = data ?? []; setOrganizations(rows); setOrganizationId((current) => current || rows.find((item) => item.code === 'cnbv')?.id || rows[0]?.id || '') }
  }, [access.organizationId, access.organizationName, access.status, isSuperAdmin])

  const reload = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const [periodResponse, unitResponse, memberResponse, planResponse, objectiveResponse, projectResponse] = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('organization_unit').select('*').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id', organizationId).eq('active', true),
      supabase.from('unit_work_plan').select('*').eq('organization_id', organizationId),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('project').select('id,organization_id,code,name,status').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    ])
    const firstError = periodResponse.error || unitResponse.error || memberResponse.error || planResponse.error || objectiveResponse.error || projectResponse.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows = periodResponse.data ?? []; const unitRows = unitResponse.data ?? []
      setPeriods(periodRows); setUnits(unitRows); setMemberships(memberResponse.data ?? []); setWorkPlans(planResponse.data ?? []); setObjectives(objectiveResponse.data ?? []); setProjects(projectResponse.data ?? [])
      setPeriodId((current) => periodRows.some((item) => item.id === current) ? current : periodRows.find((item) => item.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const manageableUnitIds = useMemo(() => canAdmin ? units.map((unit) => unit.id) : memberships.filter((item) => ['director','manager','operator','reviewer'].includes(item.unit_role)).map((item) => item.unit_id), [canAdmin, memberships, units])
  const visibleUnits = useMemo(() => canAdmin ? units : units.filter((unit) => manageableUnitIds.includes(unit.id)), [canAdmin, manageableUnitIds, units])
  useEffect(() => { if (!visibleUnits.some((unit) => unit.id === unitId)) setUnitId(visibleUnits[0]?.id || '') }, [unitId, visibleUnits])

  const selectedPlan = workPlans.find((item) => item.management_period_id === periodId && item.unit_id === unitId)
  const eligibleObjectives = useMemo(() => objectives.filter((item) => item.management_period_id === periodId && (!selectedPlan || item.work_plan_id === selectedPlan.id)), [objectives, periodId, selectedPlan])
  useEffect(() => {
    const requested = params.get('objective') || ''
    if (requested && eligibleObjectives.some((item) => item.id === requested)) setForm((current) => ({ ...current, objective_id: requested }))
    else if (form.objective_id && !eligibleObjectives.some((item) => item.id === form.objective_id)) setForm((current) => ({ ...current, objective_id: '' }))
  }, [eligibleObjectives])

  const returnUrl = `/app/management/objectives?period=${encodeURIComponent(periodId)}&unit=${encodeURIComponent(unitId)}`

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !periodId || !unitId || !form.name.trim()) return
    if (!canAdmin && !manageableUnitIds.includes(unitId)) { setError(t.noAccess); return }
    if (!form.objective_id) { setError(t.noObjectives); return }
    setSaving(true); setError('')
    const metricType = form.metric_type
    const { error: requestError } = await supabase.from('management_indicator').insert({
      organization_id: organizationId,
      management_period_id: periodId,
      unit_id: unitId,
      objective_id: form.objective_id,
      project_id: form.project_id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      indicator_kind: form.indicator_kind,
      metric_type: metricType,
      unit_label: ['currency','percentage','boolean','text'].includes(metricType) ? null : (form.unit_label.trim() || null),
      aggregation_method: normalizedMethod(form),
      target_value: form.target_value === '' ? (metricType === 'boolean' ? 1 : null) : Number(form.target_value),
      target_text: metricType === 'text' ? (form.target_text.trim() || null) : null,
      currency: metricType === 'currency' ? form.currency : null,
      frequency: form.frequency,
      source_note: form.source_note.trim() || null,
      active: true,
      created_by: access.userId || null,
      updated_by: access.userId || null,
    })
    if (requestError) { setError(requestError.message); setSaving(false); return }
    window.location.assign(returnUrl)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel indicator-create-page">
      <div className="indicator-create-back"><a href={returnUrl}>← {language === 'en' ? 'Back to Annual Work Plan' : 'Volver al Plan Anual'}</a></div>
      <div className="management-panel-heading"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div></div>
      {error && <p className="management-flash error">{error}</p>}
      {loading ? <div className="management-loading"><span /><p>{language === 'en' ? 'Loading context…' : 'Cargando contexto…'}</p></div> : <form className="management-form-card indicator-create-form" onSubmit={save}>
        <div className="indicator-context-block"><small>{t.context}</small><p>{t.help}</p><div>
          {isSuperAdmin && <label><span>{language === 'en' ? 'Organization' : 'Organización'}</span><select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setPeriodId(''); setUnitId('') }}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label><span>{t.period}</span><select value={periodId} onChange={(event) => { setPeriodId(event.target.value); setForm((current) => ({ ...current, objective_id: '' })) }} required><option value="">—</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>{t.unit}</span><select value={unitId} onChange={(event) => { setUnitId(event.target.value); setForm((current) => ({ ...current, objective_id: '' })) }} required><option value="">—</option>{visibleUnits.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label><span>{t.objective}</span><select value={form.objective_id} onChange={(event) => setForm((current) => ({ ...current, objective_id: event.target.value }))} required><option value="">{t.noObjective}</option>{eligibleObjectives.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label>
        </div></div>

        {!eligibleObjectives.length && <div className="indicator-objective-required"><strong>{t.noObjectives}</strong><a href={returnUrl}>{language === 'en' ? 'Create objective' : 'Crear objetivo en el Plan Anual'}</a></div>}

        <section className="indicator-kind-section"><div><small>{language === 'en' ? 'INDICATOR TYPE' : 'TIPO DE INDICADOR'}</small><h2>{t.kind}</h2></div><div className="indicator-kind-grid">{Object.entries(indicatorKinds[language]).map(([value, info]) => <label className={form.indicator_kind === value ? 'active' : ''} key={value}><input type="radio" name="indicator-kind" value={value} checked={form.indicator_kind === value} onChange={() => setForm((current) => ({ ...current, indicator_kind: value }))} /><span><b>{info.label}</b><small>{info.help}</small></span></label>)}</div></section>

        <div className="management-form-grid indicator-details-grid">
          <label className="wide"><span>{t.measure}</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={language === 'en' ? 'Example: Churches participating in national prayer vigils' : 'Ej.: Iglesias participantes en las vigilias nacionales de oración'} required /></label>
          <label><span>{t.metric}</span><select value={form.metric_type} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, metric_type: value, aggregation_method: ['percentage','text','boolean'].includes(value) ? 'latest' : current.aggregation_method, target_value: value === 'boolean' ? '1' : current.target_value })) }}>{Object.entries(metricTypes[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{t.frequency}</span><select value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}>{Object.entries(frequencyOptions[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wide"><span>{t.aggregation}</span><select value={normalizedMethod(form)} onChange={(event) => setForm((current) => ({ ...current, aggregation_method: event.target.value }))} disabled={['percentage','text','boolean'].includes(form.metric_type)}>{Object.entries(aggregationOptions[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {!['currency','percentage','boolean','text'].includes(form.metric_type) && <label><span>{t.unitLabel}</span><input value={form.unit_label} onChange={(event) => setForm((current) => ({ ...current, unit_label: event.target.value }))} placeholder={language === 'en' ? 'people, kits, liters' : 'personas, kits, litros'} /></label>}
          {!['text','boolean'].includes(form.metric_type) && <label><span>{t.target}</span><input type="number" step="0.01" value={form.target_value} onChange={(event) => setForm((current) => ({ ...current, target_value: event.target.value }))} /></label>}
          {form.metric_type === 'text' && <label className="wide"><span>{t.targetText}</span><input value={form.target_text} onChange={(event) => setForm((current) => ({ ...current, target_text: event.target.value }))} /></label>}
          {form.metric_type === 'currency' && <label><span>{t.currency}</span><select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>}
          <label><span>{t.project}</span><select value={form.project_id} onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}><option value="">{t.noProject}</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label className="wide"><span>{t.description}</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <label className="wide"><span>{t.source}</span><textarea value={form.source_note} onChange={(event) => setForm((current) => ({ ...current, source_note: event.target.value }))} /></label>
        </div>
        <div className="management-form-actions indicator-create-actions"><a className="indicator-cancel-link" href={returnUrl}>{t.cancel}</a><button className="primary" disabled={saving || !form.objective_id || !eligibleObjectives.length}>{saving ? t.saving : t.save}</button></div>
      </form>}
    </div>
  </ManagementStandaloneShell>
}
