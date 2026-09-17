import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management.css'
import './management-annual-plan.css'

const MONTHS = {
  es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
}
const KIND_LABELS = {
  es: { result: 'Resultado', output: 'Producto / entregable', process: 'Proceso / gestión', impact: 'Impacto' },
  en: { result: 'Outcome', output: 'Output / deliverable', process: 'Process / management', impact: 'Impact' },
}
const METRIC_LABELS = {
  es: { count: 'Cantidad', currency: 'Dinero', percentage: 'Porcentaje', ratio: 'Relación / tasa', boolean: 'Sí / No', text: 'Texto' },
  en: { count: 'Quantity', currency: 'Money', percentage: 'Percentage', ratio: 'Ratio / rate', boolean: 'Yes / No', text: 'Text' },
}
const ACTIVITY_STATUS = {
  es: { planned: 'Planificada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' },
  en: { planned: 'Planned', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' },
}
const LEVEL_LABELS = {
  es: { general: 'General', specific: 'Específico', operational: 'Operativo' },
  en: { general: 'General', specific: 'Specific', operational: 'Operational' },
}
const copy = {
  es: {
    eyebrow: 'PLANIFICACIÓN ANUAL', title: 'Plan Anual de Trabajo', intro: 'Cada Dirección organiza su año de enero a diciembre. Los objetivos contienen sus indicadores y las actividades se calendarizan dentro del mismo plan.',
    organization: 'Organización', year: 'Año de trabajo', unit: 'Dirección / unidad', newYear: '＋ Nuevo año', objective: '＋ Objetivo', activity: '＋ Actividad',
    objectiveView: 'Objetivos e indicadores', calendarView: 'Calendario de actividades', objectives: 'Objetivos', indicators: 'Indicadores', activities: 'Actividades', completed: 'Completadas',
    noPlan: 'Todavía no existe un Plan Anual para esta Dirección.', noObjectives: 'Todavía no hay objetivos en este plan.', noActivities: 'Sin actividades este mes.',
    addIndicator: '＋ Indicador', edit: 'Editar', target: 'Meta', frequency: 'Frecuencia', indicatorType: 'Tipo de indicador', metricFormat: 'Formato del dato',
    newObjective: 'Nuevo objetivo', editObjective: 'Editar objetivo', whatGoal: '¿Qué quiere lograr esta Dirección?', description: 'Descripción', level: 'Nivel', weight: 'Peso (%)', saveObjective: 'Guardar objetivo',
    newActivity: 'Nueva actividad del calendario', editActivity: 'Editar actividad', activityName: 'Actividad', relatedObjective: 'Objetivo relacionado', relatedIndicator: 'Indicador relacionado (opcional)', start: 'Inicio', end: 'Fin', responsible: 'Responsable', status: 'Estado', saveActivity: 'Guardar actividad',
    cancel: 'Cancelar', close: 'Cerrar', loading: 'Cargando plan anual…', yearPrompt: 'Año', createYear: 'Crear ciclo anual', yearHelp: 'Esto crea el año institucional, los planes de cada Dirección y los cortes de marzo, julio, noviembre y anual.',
    indicatorHelp: 'Cada objetivo debe tener uno o más indicadores. El tipo explica qué mide; el formato define cómo se captura el dato.',
  },
  en: {
    eyebrow: 'ANNUAL PLANNING', title: 'Annual Work Plan', intro: 'Each unit organizes its January–December work. Objectives contain their indicators and activities are scheduled inside the same plan.',
    organization: 'Organization', year: 'Work year', unit: 'Unit', newYear: '＋ New year', objective: '＋ Objective', activity: '＋ Activity',
    objectiveView: 'Objectives & indicators', calendarView: 'Activity calendar', objectives: 'Objectives', indicators: 'Indicators', activities: 'Activities', completed: 'Completed',
    noPlan: 'There is no Annual Work Plan for this unit yet.', noObjectives: 'There are no objectives in this plan yet.', noActivities: 'No activities this month.',
    addIndicator: '＋ Indicator', edit: 'Edit', target: 'Target', frequency: 'Frequency', indicatorType: 'Indicator type', metricFormat: 'Data format',
    newObjective: 'New objective', editObjective: 'Edit objective', whatGoal: 'What does this unit want to achieve?', description: 'Description', level: 'Level', weight: 'Weight (%)', saveObjective: 'Save objective',
    newActivity: 'New calendar activity', editActivity: 'Edit activity', activityName: 'Activity', relatedObjective: 'Related objective', relatedIndicator: 'Related indicator (optional)', start: 'Start', end: 'End', responsible: 'Responsible', status: 'Status', saveActivity: 'Save activity',
    cancel: 'Cancel', close: 'Close', loading: 'Loading annual plan…', yearPrompt: 'Year', createYear: 'Create annual cycle', yearHelp: 'This creates the institutional year, each unit work plan and the March, July, November and annual reporting windows.',
    indicatorHelp: 'Each objective should have one or more indicators. The type explains what it measures; the format defines how data is captured.',
  },
}

function readLanguage() { try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' } catch { return 'es' } }
function unitCode(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,16) }
function metricValue(indicator, language) {
  if (indicator.target_value == null) return indicator.target_text || '—'
  const value = Number(indicator.target_value)
  if (indicator.metric_type === 'currency') return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE',{ style:'currency',currency:indicator.currency || 'USD',maximumFractionDigits:2 }).format(value)
  if (indicator.metric_type === 'percentage') return `${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE',{maximumFractionDigits:2}).format(value)}%`
  return `${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-VE',{maximumFractionDigits:2}).format(value)}${indicator.unit_label ? ` ${indicator.unit_label}` : ''}`
}
function dateLabel(value, language) { if (!value) return ''; return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE',{ day:'numeric',month:'short' }).format(new Date(`${value}T12:00:00`)) }

const emptyObjective = () => ({ id:'', title:'', description:'', objective_level:'specific', weight:'', status:'active' })
const emptyActivity = () => ({ id:'', objective_id:'', indicator_id:'', title:'', description:'', start_date:'', end_date:'', status:'planned', responsible_name:'' })

export default function ManagementAnnualPlanPage() {
  const access = useOperatorAccess()
  const params = new URLSearchParams(window.location.search)
  const [language,setLanguage] = useState(readLanguage)
  const t = copy[language]
  const [organizationId,setOrganizationId] = useState(access.organizationId || '')
  const [organizations,setOrganizations] = useState([])
  const [periods,setPeriods] = useState([])
  const [units,setUnits] = useState([])
  const [memberships,setMemberships] = useState([])
  const [workPlans,setWorkPlans] = useState([])
  const [objectives,setObjectives] = useState([])
  const [assignments,setAssignments] = useState([])
  const [indicators,setIndicators] = useState([])
  const [activities,setActivities] = useState([])
  const [activePeriodId,setActivePeriodId] = useState(params.get('period') || '')
  const [selectedUnitId,setSelectedUnitId] = useState(params.get('unit') || '')
  const [view,setView] = useState('objectives')
  const [objectiveForm,setObjectiveForm] = useState(emptyObjective)
  const [activityForm,setActivityForm] = useState(emptyActivity)
  const [objectiveOpen,setObjectiveOpen] = useState(false)
  const [activityOpen,setActivityOpen] = useState(false)
  const [yearOpen,setYearOpen] = useState(false)
  const [newYear,setNewYear] = useState(new Date().getFullYear()+1)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')

  const canAdmin = access.role === 'admin' || access.role === 'super_admin'
  const isSuperAdmin = access.role === 'super_admin'

  useEffect(() => { const observer = new MutationObserver(() => setLanguage(readLanguage())); observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']}); return () => observer.disconnect() },[])
  useEffect(() => { if (access.status === 'authorized' && !isSuperAdmin) setOrganizationId(access.organizationId || '') },[access.organizationId,access.status,isSuperAdmin])

  const loadOrganizations = useCallback(async () => {
    if (!supabase || access.status !== 'authorized') return
    if (!isSuperAdmin) { setOrganizations(access.organizationId ? [{id:access.organizationId,name:access.organizationName}] : []); return }
    const {data,error:requestError} = await supabase.rpc('admin_list_organizations')
    if (requestError) setError(requestError.message)
    else { const rows=data ?? []; setOrganizations(rows); setOrganizationId((current) => current || rows.find((item)=>item.code==='cnbv')?.id || rows[0]?.id || '') }
  },[access.organizationId,access.organizationName,access.status,isSuperAdmin])

  const reload = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const responses = await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id',organizationId).order('start_date',{ascending:false}),
      supabase.from('organization_unit').select('*').eq('organization_id',organizationId).eq('active',true).order('sort_order').order('name'),
      supabase.from('organization_unit_member').select('*').eq('organization_id',organizationId).eq('active',true),
      supabase.from('unit_work_plan').select('*').eq('organization_id',organizationId),
      supabase.from('institutional_objective').select('*').eq('organization_id',organizationId).order('code'),
      supabase.from('objective_unit_assignment').select('*').eq('organization_id',organizationId),
      supabase.from('management_indicator').select('*').eq('organization_id',organizationId).eq('active',true).order('created_at'),
      supabase.from('unit_work_activity').select('*').eq('organization_id',organizationId).order('start_date'),
    ])
    const firstError = responses.find((response)=>response.error)?.error
    if (firstError) setError(firstError.message)
    else {
      const periodRows=responses[0].data ?? []; const unitRows=responses[1].data ?? []
      setPeriods(periodRows); setUnits(unitRows); setMemberships(responses[2].data ?? []); setWorkPlans(responses[3].data ?? []); setObjectives(responses[4].data ?? []); setAssignments(responses[5].data ?? []); setIndicators(responses[6].data ?? []); setActivities(responses[7].data ?? [])
      setActivePeriodId((current)=>periodRows.some((item)=>item.id===current)?current:periodRows.find((item)=>item.status==='active')?.id || periodRows[0]?.id || '')
    }
    setLoading(false)
  },[access.status,organizationId])
  useEffect(()=>{ loadOrganizations() },[loadOrganizations])
  useEffect(()=>{ reload() },[reload])

  const manageableUnitIds = useMemo(() => canAdmin ? units.map((unit)=>unit.id) : memberships.filter((item)=>['director','manager','operator','reviewer'].includes(item.unit_role)).map((item)=>item.unit_id),[canAdmin,memberships,units])
  const visibleUnits = useMemo(() => canAdmin ? units : units.filter((unit)=>manageableUnitIds.includes(unit.id)),[canAdmin,manageableUnitIds,units])
  useEffect(()=>{ if (!visibleUnits.some((unit)=>unit.id===selectedUnitId)) setSelectedUnitId(visibleUnits[0]?.id || '') },[selectedUnitId,visibleUnits])
  const canManageSelected = canAdmin || manageableUnitIds.includes(selectedUnitId)
  const activePeriod = periods.find((item)=>item.id===activePeriodId)
  const selectedUnit = units.find((item)=>item.id===selectedUnitId)
  const selectedPlan = workPlans.find((item)=>item.management_period_id===activePeriodId && item.unit_id===selectedUnitId)
  const planObjectives = useMemo(() => objectives.filter((item)=>item.management_period_id===activePeriodId && (selectedPlan ? item.work_plan_id===selectedPlan.id : assignments.some((a)=>a.objective_id===item.id && a.assignment_type==='responsible' && a.unit_id===selectedUnitId))),[objectives,assignments,activePeriodId,selectedPlan,selectedUnitId])
  const objectiveIds = useMemo(()=>new Set(planObjectives.map((item)=>item.id)),[planObjectives])
  const planIndicators = useMemo(()=>indicators.filter((item)=>item.management_period_id===activePeriodId && item.unit_id===selectedUnitId && objectiveIds.has(item.objective_id)),[indicators,activePeriodId,selectedUnitId,objectiveIds])
  const planActivities = useMemo(()=>activities.filter((item)=>item.work_plan_id===selectedPlan?.id),[activities,selectedPlan])

  const ensurePlan = async () => {
    if (selectedPlan) return selectedPlan.id
    if (!selectedUnitId || !activePeriodId) return ''
    const year = activePeriod?.start_date ? new Date(`${activePeriod.start_date}T12:00:00`).getFullYear() : new Date().getFullYear()
    const {data,error:requestError}=await supabase.from('unit_work_plan').upsert({organization_id:organizationId,management_period_id:activePeriodId,unit_id:selectedUnitId,title:`Plan Anual de Trabajo ${year} · ${selectedUnit?.code || ''}`,status:'planning',updated_by:access.userId,created_by:access.userId},{onConflict:'management_period_id,unit_id'}).select('id').single()
    if (requestError) throw requestError
    await reload(); return data.id
  }

  const nextObjectiveCode = () => {
    const prefix=`${unitCode(selectedUnit?.code)}-OBJ-`
    const values=planObjectives.map((item)=>Number.parseInt(String(item.code || '').replace(prefix,''),10)).filter(Number.isFinite)
    return `${prefix}${String((values.length?Math.max(...values):0)+1).padStart(2,'0')}`
  }

  const openNewObjective = () => { setObjectiveForm(emptyObjective()); setObjectiveOpen(true); setActivityOpen(false); setError(''); setMessage(''); window.scrollTo({top:0,behavior:'smooth'}) }
  const openEditObjective = (objective) => { setObjectiveForm({...emptyObjective(),...objective,weight:objective.weight ?? ''}); setObjectiveOpen(true); setActivityOpen(false); setError(''); window.scrollTo({top:0,behavior:'smooth'}) }
  const saveObjective = async (event) => {
    event.preventDefault(); if (!canManageSelected || saving || !activePeriodId || !selectedUnitId) return
    setSaving(true); setError(''); setMessage('')
    try {
      const planId = selectedPlan?.id || await ensurePlan()
      const payload={organization_id:organizationId,management_period_id:activePeriodId,work_plan_id:planId,code:objectiveForm.id?objectiveForm.code:nextObjectiveCode(),title:objectiveForm.title.trim(),description:objectiveForm.description.trim()||null,objective_level:objectiveForm.objective_level,weight:objectiveForm.weight===''?null:Number(objectiveForm.weight),status:objectiveForm.status,updated_by:access.userId,...(objectiveForm.id?{}:{created_by:access.userId})}
      const request=objectiveForm.id?supabase.from('institutional_objective').update(payload).eq('id',objectiveForm.id).select('id').single():supabase.from('institutional_objective').insert(payload).select('id').single()
      const {data,error:requestError}=await request; if(requestError) throw requestError
      await supabase.from('objective_unit_assignment').delete().eq('objective_id',data.id)
      const {error:assignmentError}=await supabase.from('objective_unit_assignment').insert({organization_id:organizationId,objective_id:data.id,unit_id:selectedUnitId,assignment_type:'responsible'}); if(assignmentError) throw assignmentError
      setObjectiveOpen(false); setObjectiveForm(emptyObjective()); setMessage(language==='en'?'Objective saved.':'Objetivo guardado.'); await reload()
    } catch (err) { setError(err.message || String(err)) }
    setSaving(false)
  }

  const openNewActivity = (objectiveId='') => { setActivityForm({...emptyActivity(),objective_id:objectiveId,start_date:activePeriod?.start_date || ''}); setActivityOpen(true); setObjectiveOpen(false); setError(''); window.scrollTo({top:0,behavior:'smooth'}) }
  const openEditActivity = (activity) => { setActivityForm({...emptyActivity(),...activity,end_date:activity.end_date || '',indicator_id:activity.indicator_id || '',responsible_name:activity.responsible_name || '',description:activity.description || ''}); setActivityOpen(true); setObjectiveOpen(false); window.scrollTo({top:0,behavior:'smooth'}) }
  const saveActivity = async (event) => {
    event.preventDefault(); if(!canManageSelected || saving || !activityForm.objective_id || !activityForm.title.trim()) return
    setSaving(true); setError(''); setMessage('')
    try {
      const planId=selectedPlan?.id || await ensurePlan()
      const payload={organization_id:organizationId,work_plan_id:planId,objective_id:activityForm.objective_id,indicator_id:activityForm.indicator_id||null,title:activityForm.title.trim(),description:activityForm.description.trim()||null,start_date:activityForm.start_date,end_date:activityForm.end_date||null,status:activityForm.status,responsible_name:activityForm.responsible_name.trim()||null,updated_by:access.userId,...(activityForm.id?{}:{created_by:access.userId})}
      const request=activityForm.id?supabase.from('unit_work_activity').update(payload).eq('id',activityForm.id):supabase.from('unit_work_activity').insert(payload)
      const {error:requestError}=await request; if(requestError) throw requestError
      setActivityOpen(false); setActivityForm(emptyActivity()); setMessage(language==='en'?'Activity saved.':'Actividad guardada.'); await reload()
    } catch(err){ setError(err.message || String(err)) }
    setSaving(false)
  }

  const createYear = async (event) => {
    event.preventDefault(); if(!canAdmin || saving) return
    setSaving(true); setError(''); setMessage('')
    const {data,error:requestError}=await supabase.rpc('create_annual_management_cycle',{target_organization_id:organizationId,target_year:Number(newYear)})
    if(requestError) setError(requestError.message); else { setYearOpen(false); setMessage(language==='en'?'Annual cycle created.':'Año de trabajo creado.'); await reload(); if(data) setActivePeriodId(data) }
    setSaving(false)
  }

  if(access.status!=='authorized') return <OperatorAccessScreen access={access} copy={{languageLabel:language==='en'?'Language':'Idioma'}} language={language} onLanguageChange={()=>{}} />

  const selectedObjectiveIndicators = planIndicators.filter((item)=>item.objective_id===activityForm.objective_id)

  return <ManagementStandaloneShell access={access}><div className="management-panel annual-plan-page">
    <div className="management-panel-heading"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div><div className="management-heading-actions">{canAdmin&&<button className="secondary" onClick={()=>setYearOpen(true)}>{t.newYear}</button>}{canManageSelected&&<button onClick={openNewObjective} disabled={!activePeriodId||!selectedUnitId}>{t.objective}</button>}{canManageSelected&&<button className="accent" onClick={()=>openNewActivity()} disabled={!planObjectives.length}>{t.activity}</button>}</div></div>
    {isSuperAdmin&&<section className="management-filter-row"><label><span>{t.organization}</span><select value={organizationId} onChange={(e)=>{setOrganizationId(e.target.value);setActivePeriodId('');setSelectedUnitId('')}}>{organizations.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>}
    <section className="annual-plan-context"><label><span>{t.year}</span><select value={activePeriodId} onChange={(e)=>setActivePeriodId(e.target.value)}>{periods.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t.unit}</span><select value={selectedUnitId} onChange={(e)=>setSelectedUnitId(e.target.value)}>{visibleUnits.map((item)=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><div className="annual-plan-context-title"><small>{selectedPlan?.status?.toUpperCase() || 'PLAN'}</small><strong>{selectedPlan?.title || `${t.title} · ${selectedUnit?.code || ''}`}</strong></div></section>
    {error&&<p className="management-flash error">{error}</p>}{message&&<p className="management-flash success">{message}</p>}

    {yearOpen&&<form className="management-form-card annual-year-form" onSubmit={createYear}><div className="management-form-title"><div><small>{t.eyebrow}</small><h2>{t.newYear.replace('＋ ','')}</h2><p>{t.yearHelp}</p></div><button type="button" onClick={()=>setYearOpen(false)}>{t.close}</button></div><label><span>{t.yearPrompt}</span><input type="number" min="2000" max="2100" value={newYear} onChange={(e)=>setNewYear(e.target.value)} /></label><div className="management-form-actions"><button type="button" onClick={()=>setYearOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{t.createYear}</button></div></form>}

    {objectiveOpen&&<form className="management-form-card annual-objective-form" onSubmit={saveObjective}><div className="management-form-title"><div><small>{selectedUnit?.code} · {activePeriod?.name}</small><h2>{objectiveForm.id?t.editObjective:t.newObjective}</h2></div><button type="button" onClick={()=>setObjectiveOpen(false)}>{t.close}</button></div><div className="management-form-grid"><label className="wide"><span>{t.whatGoal} *</span><input value={objectiveForm.title} onChange={(e)=>setObjectiveForm((c)=>({...c,title:e.target.value}))} required /></label><label><span>{t.level}</span><select value={objectiveForm.objective_level} onChange={(e)=>setObjectiveForm((c)=>({...c,objective_level:e.target.value}))}>{Object.entries(LEVEL_LABELS[language]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>{t.weight}</span><input type="number" min="0" max="100" step="0.01" value={objectiveForm.weight} onChange={(e)=>setObjectiveForm((c)=>({...c,weight:e.target.value}))} /></label><label className="wide"><span>{t.description}</span><textarea value={objectiveForm.description} onChange={(e)=>setObjectiveForm((c)=>({...c,description:e.target.value}))} /></label></div><div className="management-form-actions"><button type="button" onClick={()=>setObjectiveOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{t.saveObjective}</button></div></form>}

    {activityOpen&&<form className="management-form-card annual-activity-form" onSubmit={saveActivity}><div className="management-form-title"><div><small>{selectedUnit?.code} · {activePeriod?.name}</small><h2>{activityForm.id?t.editActivity:t.newActivity}</h2></div><button type="button" onClick={()=>setActivityOpen(false)}>{t.close}</button></div><div className="management-form-grid"><label className="wide"><span>{t.activityName} *</span><input value={activityForm.title} onChange={(e)=>setActivityForm((c)=>({...c,title:e.target.value}))} required /></label><label><span>{t.relatedObjective} *</span><select value={activityForm.objective_id} onChange={(e)=>setActivityForm((c)=>({...c,objective_id:e.target.value,indicator_id:''}))} required><option value="">—</option>{planObjectives.map((item)=><option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label><label><span>{t.relatedIndicator}</span><select value={activityForm.indicator_id} onChange={(e)=>setActivityForm((c)=>({...c,indicator_id:e.target.value}))}><option value="">—</option>{selectedObjectiveIndicators.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t.start} *</span><input type="date" value={activityForm.start_date} min={activePeriod?.start_date} max={activePeriod?.end_date} onChange={(e)=>setActivityForm((c)=>({...c,start_date:e.target.value}))} required /></label><label><span>{t.end}</span><input type="date" value={activityForm.end_date} min={activityForm.start_date||activePeriod?.start_date} max={activePeriod?.end_date} onChange={(e)=>setActivityForm((c)=>({...c,end_date:e.target.value}))} /></label><label><span>{t.status}</span><select value={activityForm.status} onChange={(e)=>setActivityForm((c)=>({...c,status:e.target.value}))}>{Object.entries(ACTIVITY_STATUS[language]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>{t.responsible}</span><input value={activityForm.responsible_name} onChange={(e)=>setActivityForm((c)=>({...c,responsible_name:e.target.value}))} /></label><label className="wide"><span>{t.description}</span><textarea value={activityForm.description} onChange={(e)=>setActivityForm((c)=>({...c,description:e.target.value}))} /></label></div><div className="management-form-actions"><button type="button" onClick={()=>setActivityOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{t.saveActivity}</button></div></form>}

    {loading?<div className="management-loading"><span/><p>{t.loading}</p></div>:<>
      <section className="annual-plan-summary"><article><span>{t.objectives}</span><strong>{planObjectives.length}</strong></article><article><span>{t.indicators}</span><strong>{planIndicators.length}</strong></article><article><span>{t.activities}</span><strong>{planActivities.length}</strong></article><article><span>{t.completed}</span><strong>{planActivities.filter((item)=>item.status==='completed').length}</strong></article></section>
      <div className="annual-plan-tabs"><button className={view==='objectives'?'active':''} onClick={()=>setView('objectives')}>{t.objectiveView}</button><button className={view==='calendar'?'active':''} onClick={()=>setView('calendar')}>{t.calendarView}</button></div>

      {view==='objectives'&&<section className="annual-objectives-section"><div className="annual-section-heading"><div><small>{selectedUnit?.code} · {activePeriod?.name}</small><h2>{t.objectiveView}</h2><p>{t.indicatorHelp}</p></div>{canManageSelected&&<button onClick={openNewObjective}>{t.objective}</button>}</div>{!selectedPlan?<p className="management-empty">{t.noPlan}</p>:!planObjectives.length?<p className="management-empty">{t.noObjectives}</p>:<div className="annual-objective-list">{planObjectives.map((objective)=>{const objectiveIndicators=planIndicators.filter((item)=>item.objective_id===objective.id);const objectiveActivities=planActivities.filter((item)=>item.objective_id===objective.id);return <article className="annual-objective-card" key={objective.id}><header><div><small>{objective.code} · {LEVEL_LABELS[language][objective.objective_level] || objective.objective_level}</small><h3>{objective.title}</h3>{objective.description&&<p>{objective.description}</p>}<span>{objectiveIndicators.length} {t.indicators.toLowerCase()} · {objectiveActivities.length} {t.activities.toLowerCase()}</span></div>{canManageSelected&&<div className="annual-objective-actions"><button onClick={()=>openEditObjective(objective)}>{t.edit}</button><a href={`/app/management/tracking/new?period=${encodeURIComponent(activePeriodId)}&unit=${encodeURIComponent(selectedUnitId)}&objective=${encodeURIComponent(objective.id)}&workPlan=${encodeURIComponent(selectedPlan.id)}`}>{t.addIndicator}</a><button className="activity" onClick={()=>openNewActivity(objective.id)}>{t.activity}</button></div>}</header><div className="annual-indicator-list">{objectiveIndicators.length?objectiveIndicators.map((indicator)=><div className="annual-indicator-card" key={indicator.id}><div className="annual-indicator-badges"><b>{KIND_LABELS[language][indicator.indicator_kind || 'result']}</b><span>{METRIC_LABELS[language][indicator.metric_type] || indicator.metric_type}</span></div><strong>{indicator.name}</strong><div><span>{t.target}</span><b>{metricValue(indicator,language)}</b></div><footer><small>{t.frequency}: {indicator.frequency}</small><a href={`/app/management/tracking?period=${encodeURIComponent(activePeriodId)}&unit=${encodeURIComponent(selectedUnitId)}`}>{language==='en'?'Open tracking':'Abrir seguimiento'} →</a></footer></div>):<div className="annual-no-indicators"><p>{language==='en'?'This objective still has no indicator.':'Este objetivo todavía no tiene indicador.'}</p>{canManageSelected&&<a href={`/app/management/tracking/new?period=${encodeURIComponent(activePeriodId)}&unit=${encodeURIComponent(selectedUnitId)}&objective=${encodeURIComponent(objective.id)}&workPlan=${encodeURIComponent(selectedPlan.id)}`}>{t.addIndicator}</a>}</div>}</div></article>})}</div>}</section>}

      {view==='calendar'&&<section className="annual-calendar-section"><div className="annual-section-heading"><div><small>{selectedUnit?.code} · {activePeriod?.name}</small><h2>{t.calendarView}</h2><p>{language==='en'?'Activities stay linked to the objective and, when applicable, to the indicator they support.':'Cada actividad permanece vinculada al objetivo y, cuando aplica, al indicador que ayuda a cumplir.'}</p></div>{canManageSelected&&<button onClick={()=>openNewActivity()}>{t.activity}</button>}</div><div className="annual-calendar-grid">{MONTHS[language].map((month,index)=>{const monthRows=planActivities.filter((item)=>new Date(`${item.start_date}T12:00:00`).getMonth()===index);return <article key={month}><header><span>{String(index+1).padStart(2,'0')}</span><strong>{month}</strong><b>{monthRows.length}</b></header><div>{monthRows.length?monthRows.map((activity)=>{const objective=planObjectives.find((item)=>item.id===activity.objective_id);return <button className={`calendar-activity ${activity.status}`} onClick={()=>canManageSelected&&openEditActivity(activity)} key={activity.id}><small>{objective?.code || 'OBJ'} · {ACTIVITY_STATUS[language][activity.status]}</small><strong>{activity.title}</strong><span>{dateLabel(activity.start_date,language)}{activity.end_date&&activity.end_date!==activity.start_date?` — ${dateLabel(activity.end_date,language)}`:''}</span></button>}):<p>{t.noActivities}</p>}</div></article>})}</div></section>}
    </>}
  </div></ManagementStandaloneShell>
}
