import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-indicator-form.css'

const metricTypes = {
  es: { count: 'Una cantidad', currency: 'Dinero', percentage: 'Un porcentaje', ratio: 'Una relación / tasa', boolean: 'Cumplimiento simple (Sí / No)', text: 'Una respuesta o descripción' },
  en: { count: 'A quantity', currency: 'Money', percentage: 'A percentage', ratio: 'A ratio / rate', boolean: 'Simple completion (Yes / No)', text: 'An answer or description' },
}
const aggregationOptions = {
  es: { sum: 'Sumar todos los resultados cargados', average: 'Calcular un promedio', latest: 'Usar el último resultado cargado', max: 'Usar el valor más alto', unique_people: 'Contar personas diferentes', non_aggregable: 'Mostrar el último dato sin acumular' },
  en: { sum: 'Add all recorded results', average: 'Calculate an average', latest: 'Use the latest recorded result', max: 'Use the highest value', unique_people: 'Count unique people', non_aggregable: 'Show the latest value without accumulating' },
}
const frequencyOptions = {
  es: { monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', ad_hoc: 'Cuando aplique' },
  en: { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semiannual', annual: 'Annual', ad_hoc: 'When applicable' },
}
const emptyForm = { name: '', description: '', objective_id: '', project_id: '', metric_type: 'count', unit_label: 'personas', aggregation_method: 'sum', target_value: '', target_text: '', currency: 'USD', frequency: 'annual', source_note: '' }

const copy = {
  es: {
    eyebrow: 'NUEVO INDICADOR', title: 'Crear indicador', intro: 'Configura qué quieres medir y cuál es la meta. Después volverás al tablero para registrar los resultados reales.',
    period: 'Período de gestión *', unit: 'Área responsable *', measure: '¿Qué quieres medir? *', metric: '¿Qué clase de resultado vas a registrar?', aggregation: '¿Cómo se consolidarán varios resultados?', unitLabel: 'Unidad de medida', target: 'Meta del indicador', currency: 'Moneda', frequency: 'Frecuencia de actualización', objective: 'Objetivo institucional relacionado (opcional)', project: 'Proyecto relacionado (opcional)', description: '¿Qué significa este indicador?', source: '¿De dónde saldrá este dato?', noObjective: 'Sin objetivo relacionado', noProject: 'Sin proyecto relacionado', cancel: 'Cancelar y volver', save: 'Crear indicador', saving: 'Guardando…', context: 'CONTEXTO DEL INDICADOR', help: 'El período y el área determinan dónde aparecerá el indicador. Objetivo y proyecto pueden relacionarse ahora o después.', noAccess: 'No tienes una unidad habilitada para crear indicadores.', saved: 'Indicador creado.',
  },
  en: {
    eyebrow: 'NEW INDICATOR', title: 'Create indicator', intro: 'Configure what you want to measure and its target. Then return to the dashboard to record actual results.',
    period: 'Management period *', unit: 'Responsible area *', measure: 'What do you want to measure? *', metric: 'What kind of result will you record?', aggregation: 'How should multiple results be consolidated?', unitLabel: 'Unit of measure', target: 'Indicator target', currency: 'Currency', frequency: 'Update frequency', objective: 'Related institutional objective (optional)', project: 'Related project (optional)', description: 'What does this indicator mean?', source: 'Where will this data come from?', noObjective: 'No related objective', noProject: 'No related project', cancel: 'Cancel and return', save: 'Create indicator', saving: 'Saving…', context: 'INDICATOR CONTEXT', help: 'Period and area determine where the indicator appears. Objective and project can be linked now or later.', noAccess: 'You do not have an enabled unit for creating indicators.', saved: 'Indicator created.',
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
  const [objectives, setObjectives] = useState([])
  const [projects, setProjects] = useState([])
  const [periodId, setPeriodId] = useState(params.get('period') || '')
  const [unitId, setUnitId] = useState(params.get('unit') || '')
  const [form, setForm] = useState(emptyForm)
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
    const [periodResponse, unitResponse, memberResponse, objectiveResponse, projectResponse] = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id', organizationId).order('start_date', { ascending: false }),
      supabase.from('organization_unit').select('*').eq('organization_id', organizationId).eq('active', true).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id', organizationId).eq('active', true),
      supabase.from('institutional_objective').select('*').eq('organization_id', organizationId).order('code'),
      supabase.from('project').select('id,organization_id,code,name,status').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    ])
    const firstError = periodResponse.error || unitResponse.error || memberResponse.error || objectiveResponse.error || projectResponse.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows = periodResponse.data ?? []; const unitRows = unitResponse.data ?? []
      setPeriods(periodRows); setUnits(unitRows); setMemberships(memberResponse.data ?? []); setObjectives(objectiveResponse.data ?? []); setProjects(projectResponse.data ?? [])
      setPeriodId((current) => periodRows.some((item) => item.id === current) ? current : periodRows.find((item) => item.status === 'active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  useEffect(() => { reload() }, [reload])

  const manageableUnitIds = useMemo(() => canAdmin ? units.map((unit) => unit.id) : memberships.filter((item) => ['director','manager','operator'].includes(item.unit_role)).map((item) => item.unit_id), [canAdmin, memberships, units])
  const visibleUnits = useMemo(() => canAdmin ? units : units.filter((unit) => manageableUnitIds.includes(unit.id)), [canAdmin, manageableUnitIds, units])
  useEffect(() => { if (!visibleUnits.some((unit) => unit.id === unitId)) setUnitId(visibleUnits[0]?.id || '') }, [unitId, visibleUnits])

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !periodId || !unitId || !form.name.trim()) return
    if (!canAdmin && !manageableUnitIds.includes(unitId)) { setError(t.noAccess); return }
    setSaving(true); setError('')
    const metricType = form.metric_type
    const { error: requestError } = await supabase.from('management_indicator').insert({
      organization_id: organizationId,
      management_period_id: periodId,
      unit_id: unitId,
      objective_id: form.objective_id || null,
      project_id: form.project_id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      metric_type: metricType,
      unit_label: ['currency','percentage','boolean','text'].includes(metricType) ? null : (form.unit_label.trim() || null),
      aggregation_method: normalizedMethod(form),
      target_value: form.target_value === '' ? (metricType === 'boolean' ? 1 : null) : Number(form.target_value),
      target_text: form.target_text.trim() || null,
      currency: metricType === 'currency' ? form.currency : null,
      frequency: form.frequency,
      source_note: form.source_note.trim() || null,
      active: true,
      created_by: access.userId || null,
      updated_by: access.userId || null,
    })
    if (requestError) { setError(requestError.message); setSaving(false); return }
    const returnParams = new URLSearchParams({ period: periodId, unit: unitId })
    window.location.assign(`/app/management/tracking?${returnParams.toString()}`)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} language={language} onLanguageChange={() => {}} />

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel indicator-create-page">
      <div className="indicator-create-back"><a href="/app/management/tracking">← {language === 'en' ? 'Back to tracking' : 'Volver a seguimiento'}</a></div>
      <div className="management-panel-heading"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div></div>
      {error && <p className="management-flash error">{error}</p>}
      {loading ? <div className="management-loading"><span /><p>{language === 'en' ? 'Loading context…' : 'Cargando contexto…'}</p></div> : <form className="management-form-card indicator-create-form" onSubmit={save}>
        <div className="indicator-context-block"><small>{t.context}</small><p>{t.help}</p><div>
          {isSuperAdmin && <label><span>{language === 'en' ? 'Organization' : 'Organización'}</span><select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setPeriodId(''); setUnitId('') }}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label><span>{t.period}</span><select value={periodId} onChange={(event) => setPeriodId(event.target.value)} required><option value="">—</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>{t.unit}</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} required><option value="">—</option>{visibleUnits.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        </div></div>
        <div className="management-form-grid">
          <label className="wide"><span>{t.measure}</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={language === 'en' ? 'Example: People trained' : 'Ej.: Personas capacitadas'} required /></label>
          <label><span>{t.metric}</span><select value={form.metric_type} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, metric_type: value, aggregation_method: ['percentage','text','boolean'].includes(value) ? 'latest' : current.aggregation_method, target_value: value === 'boolean' ? '1' : current.target_value })) }}>{Object.entries(metricTypes[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>{t.frequency}</span><select value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}>{Object.entries(frequencyOptions[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wide"><span>{t.aggregation}</span><select value={normalizedMethod(form)} onChange={(event) => setForm((current) => ({ ...current, aggregation_method: event.target.value }))}>{Object.entries(aggregationOptions[language]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {!['currency','percentage','boolean','text'].includes(form.metric_type) && <label><span>{t.unitLabel}</span><input value={form.unit_label} onChange={(event) => setForm((current) => ({ ...current, unit_label: event.target.value }))} placeholder={language === 'en' ? 'people, kits, liters' : 'personas, kits, litros'} /></label>}
          {!['text','boolean'].includes(form.metric_type) && <label><span>{t.target}</span><input type="number" step="0.01" value={form.target_value} onChange={(event) => setForm((current) => ({ ...current, target_value: event.target.value }))} /></label>}
          {form.metric_type === 'currency' && <label><span>{t.currency}</span><select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}><option>USD</option><option>EUR</option><option>VES</option></select></label>}
          <label><span>{t.objective}</span><select value={form.objective_id} onChange={(event) => setForm((current) => ({ ...current, objective_id: event.target.value }))}><option value="">{t.noObjective}</option>{objectives.filter((item) => item.management_period_id === periodId).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label>
          <label><span>{t.project}</span><select value={form.project_id} onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}><option value="">{t.noProject}</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label className="wide"><span>{t.description}</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <label className="wide"><span>{t.source}</span><textarea value={form.source_note} onChange={(event) => setForm((current) => ({ ...current, source_note: event.target.value }))} /></label>
        </div>
        <div className="management-form-actions"><a className="indicator-cancel-link" href="/app/management/tracking">{t.cancel}</a><button className="primary" disabled={saving || !periodId || !unitId}>{saving ? t.saving : t.save}</button></div>
      </form>}
    </div>
  </ManagementStandaloneShell>
}
