import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from '../management/ManagementStandaloneShell.jsx'
import { DEFAULT_CALENDAR_MODULE_LABEL, buildCalendarActivityPayloads, canOpenCalendarActivityEntry, resolveCalendarModuleLabel, reviewStatusLabel } from './calendar.js'
import { canReviewUnitActivity, defaultOwnUnitId } from '../management/unitScope.js'
import './management-calendar.css'

const MONTHS = {
  es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
}
const STATUS = {
  es: { planned:'Planificada', in_progress:'En curso', completed:'Completada', cancelled:'Cancelada' },
  en: { planned:'Planned', in_progress:'In progress', completed:'Completed', cancelled:'Cancelled' },
}
const MODALITY = {
  es: { in_person:'Presencial', virtual:'Virtual', hybrid:'Híbrida' },
  en: { in_person:'In person', virtual:'Virtual', hybrid:'Hybrid' },
}
const copy = {
  es: {
    eyebrow:'PLANIFICACIÓN INSTITUCIONAL', title:'Calendario anual', intro:'Cada Dirección o agencia administra sus actividades del año seleccionado.',
    preliminary:'PRELIMINAR', preliminaryText:'Calendario preliminar sujeto a validación institucional.', year:'Año', unit:'Dirección / agencia',
    myCalendar:'Mi calendario', consolidated:'Consolidado institucional', calendar:'Calendario anual', list:'Listado', newActivity:'＋ Cargar actividades',
    bulkTitle:'Cargar actividades', bulkIntro:'Completa una vez los datos compartidos y agrega todas las actividades que necesites.', noObjective:'Sin objetivo vinculado',
    sharedData:'DATOS COMPARTIDOS', activitiesToLoad:'ACTIVIDADES A CARGAR', addRow:'＋ Agregar otra actividad', removeRow:'Quitar',
    saveBatch:'Guardar actividades', incompleteRows:'Completa el nombre y la fecha de inicio de cada actividad agregada.',
    invalidDates:'Revisa las fechas: la fecha de cierre debe ser igual o posterior a la fecha de inicio.', activityName:'Nombre de la actividad', notes:'Notas',
    clear:'Vaciar calendario', clearConfirm:'¿Vaciar todas las actividades de esta unidad para el año seleccionado? Esta acción eliminará únicamente el calendario propio visible.',
    clearDone:'Calendario de la unidad vaciado.', jointOn:'Habilitar vista conjunta', jointOff:'Cerrar vista conjunta',
    jointEnabled:'Vista consolidada habilitada por la unidad general.', privateView:'Tu calendario es visible para tu unidad y para las unidades de las que depende.',
    digenView:'Ves el calendario de tu unidad y de las unidades que dependen de ella.', visibleActivities:'Actividades visibles', visibleUnits:'Unidades visibles',
    validated:'Validadas', observed:'Observadas', noActivities:'Sin actividades visibles.',
    noObjectives:'Esta unidad necesita al menos un objetivo en su Plan Anual antes de registrar actividades.', openPlan:'Abrir Plan Anual',
    activity:'Actividad', objective:'Objetivo del Plan Anual', indicator:'Indicador relacionado (opcional)', dateFrom:'Fecha de inicio', dateTo:'Fecha de cierre',
    responsible:'Responsable', modality:'Modalidad', status:'Estado', details:'Notas / detalles', save:'Guardar actividad', saving:'Guardando…',
    cancel:'Cancelar', edit:'Editar', validate:'Validar', observe:'Observar', reviewState:'Estado de revisión', date:'Fecha', direction:'Dirección',
    objectiveIndicator:'Objetivo / indicador', loading:'Cargando calendario…', saved:'Actividad guardada.', reviewed:'Revisión actualizada.',
    jointChanged:'Visibilidad conjunta actualizada.', noUnitAccess:'Tu usuario todavía no está asignado a una Dirección o agencia con acceso al calendario.',
  },
  en: {
    eyebrow:'INSTITUTIONAL PLANNING', title:'Annual calendar', intro:'Each unit or agency manages its activities for the selected year.',
    preliminary:'PRELIMINARY', preliminaryText:'Preliminary calendar subject to institutional validation.', year:'Year', unit:'Unit / agency',
    myCalendar:'My calendar', consolidated:'Institutional consolidated', calendar:'Annual calendar', list:'List', newActivity:'＋ Load activities',
    bulkTitle:'Load activities', bulkIntro:'Complete the shared details once and add every activity you need.', noObjective:'No linked objective',
    sharedData:'SHARED DETAILS', activitiesToLoad:'ACTIVITIES TO LOAD', addRow:'＋ Add another activity', removeRow:'Remove',
    saveBatch:'Save activities', incompleteRows:'Complete the name and start date for every activity you added.',
    invalidDates:'Check the dates: the end date must be the same as or later than the start date.', activityName:'Activity name', notes:'Notes',
    clear:'Clear calendar', clearConfirm:'Clear all activities for this unit and selected year? This only deletes the current unit calendar.',
    clearDone:'Unit calendar cleared.', jointOn:'Enable shared view', jointOff:'Close shared view', jointEnabled:'Consolidated view enabled by the top unit.',
    privateView:'Your calendar is visible to your unit and the units above it.', digenView:'You see the calendar of your unit and of the units below it.',
    visibleActivities:'Visible activities', visibleUnits:'Visible units', validated:'Validated', observed:'Observed', noActivities:'No visible activities.',
    noObjectives:'This unit needs at least one Annual Work Plan objective before activities can be created.', openPlan:'Open Annual Work Plan',
    activity:'Activity', objective:'Annual Work Plan objective', indicator:'Related indicator (optional)', dateFrom:'Start date', dateTo:'End date',
    responsible:'Responsible', modality:'Modality', status:'Status', details:'Notes / details', save:'Save activity', saving:'Saving…', cancel:'Cancel',
    edit:'Edit', validate:'Validate', observe:'Observe', reviewState:'Review status', date:'Date', direction:'Unit',
    objectiveIndicator:'Objective / indicator', loading:'Loading calendar…', saved:'Activity saved.', reviewed:'Review updated.',
    jointChanged:'Shared visibility updated.', noUnitAccess:'Your user is not yet assigned to a unit or agency with calendar access.',
  },
}

const emptyActivity = () => ({ id:'', title:'', description:'', objective_id:'', indicator_id:'', start_date:'', end_date:'', status:'planned', responsible_name:'', modality:'in_person' })
const emptyBulkDefaults = () => ({ objective_id:'', indicator_id:'', responsible_name:'', modality:'in_person', status:'planned' })
const emptyBulkRow = () => ({ title:'', start_date:'', end_date:'', description:'' })

function readLanguage(){
  try { return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es' }
  catch { return 'es' }
}
function dateLabel(value, language){
  if (!value) return ''
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', { day:'numeric', month:'short' }).format(new Date(value + 'T12:00:00'))
}
function sameYear(date, period){ return Boolean(date && period && date >= period.start_date && date <= period.end_date) }

export default function ManagementCalendarPage(){
  const access = useOperatorAccess()
  const [language,setLanguage] = useState(readLanguage)
  const t = copy[language]
  const [organization,setOrganization] = useState(null)
  const [periods,setPeriods] = useState([])
  const [units,setUnits] = useState([])
  const [workPlans,setWorkPlans] = useState([])
  const [objectives,setObjectives] = useState([])
  const [indicators,setIndicators] = useState([])
  const [activities,setActivities] = useState([])
  const [calendarAccess,setCalendarAccess] = useState({ is_digen:false, unit_ids:[], joint_review_enabled:false, can_view_consolidated:false, digen_unit_id:null })
  const [periodId,setPeriodId] = useState('')
  const [selectedUnitId,setSelectedUnitId] = useState('')
  const [scope,setScope] = useState('mine')
  const [presentation,setPresentation] = useState('calendar')
  const [form,setForm] = useState(emptyActivity)
  const [formOpen,setFormOpen] = useState(false)
  const [bulkOpen,setBulkOpen] = useState(false)
  const [bulkDefaults,setBulkDefaults] = useState(emptyBulkDefaults)
  const [bulkRows,setBulkRows] = useState(()=>[emptyBulkRow()])
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const organizationId = access.organizationId || ''

  useEffect(() => {
    const observer = new MutationObserver(() => setLanguage(readLanguage()))
    observer.observe(document.documentElement,{ attributes:true, attributeFilter:['lang'] })
    return () => observer.disconnect()
  },[])

  const loadBase = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) { setLoading(false); return }
    setLoading(true); setError('')
    const responses = await Promise.all([
      supabase.from('organization').select('id,name,calendar_module_label').eq('id',organizationId).single(),
      supabase.from('management_period').select('*').eq('organization_id',organizationId).order('start_date',{ascending:false}),
      supabase.from('organization_unit').select('*').eq('organization_id',organizationId).eq('active',true).order('sort_order').order('name'),
      supabase.from('unit_work_plan').select('*').eq('organization_id',organizationId),
      supabase.from('institutional_objective').select('*').eq('organization_id',organizationId).order('code'),
      supabase.from('management_indicator').select('*').eq('organization_id',organizationId).eq('active',true).order('created_at'),
      supabase.from('unit_work_activity').select('*').eq('organization_id',organizationId).order('start_date'),
    ])
    const firstError = responses.find((response)=>response.error)?.error
    if (firstError) { setError(firstError.message); setLoading(false); return }
    const periodRows = responses[1].data ?? []
    setOrganization(responses[0].data ?? null)
    setPeriods(periodRows); setUnits(responses[2].data ?? []); setWorkPlans(responses[3].data ?? [])
    setObjectives(responses[4].data ?? []); setIndicators(responses[5].data ?? []); setActivities(responses[6].data ?? [])
    setPeriodId((current)=>periodRows.some((period)=>period.id===current) ? current : periodRows.find((period)=>period.status==='active')?.id || periodRows[0]?.id || '')
    setLoading(false)
  },[access.status,organizationId])

  useEffect(()=>{ loadBase() },[loadBase])

  const loadAccess = useCallback(async () => {
    if (!supabase || !organizationId || !periodId) return
    const { data,error:requestError } = await supabase.rpc('calendar_access_overview',{ target_organization_id:organizationId, target_period_id:periodId })
    if (requestError) { setError(requestError.message); return }
    const next = data ?? {}
    setCalendarAccess(next)
    setScope((current)=>current==='consolidated' && !next.can_view_consolidated ? 'mine' : current)
  },[organizationId,periodId])

  useEffect(()=>{ loadAccess() },[loadAccess])

  const ownUnitIds = useMemo(()=>new Set(calendarAccess.unit_ids ?? []),[calendarAccess.unit_ids])
  const ownUnits = useMemo(()=>units.filter((unit)=>ownUnitIds.has(unit.id)),[units,ownUnitIds])
  const defaultUnitId = defaultOwnUnitId(units, calendarAccess)

  useEffect(()=>{
    setSelectedUnitId((current)=>ownUnitIds.has(current) ? current : defaultUnitId)
  },[defaultUnitId,ownUnitIds])

  const activePeriod = periods.find((period)=>period.id===periodId)
  const workPlanById = useMemo(()=>new Map(workPlans.map((plan)=>[plan.id,plan])),[workPlans])
  const periodPlans = useMemo(()=>workPlans.filter((plan)=>plan.management_period_id===periodId),[workPlans,periodId])
  const ownSelectedPlan = periodPlans.find((plan)=>plan.unit_id===selectedUnitId)
  const allPeriodPlanIds = useMemo(()=>new Set(periodPlans.map((plan)=>plan.id)),[periodPlans])
  const enrichedActivities = useMemo(()=>activities.filter((activity)=>allPeriodPlanIds.has(activity.work_plan_id) && sameYear(activity.start_date,activePeriod)).map((activity)=>({ ...activity, unit_id:workPlanById.get(activity.work_plan_id)?.unit_id || '' })),[activities,allPeriodPlanIds,workPlanById,activePeriod])
  const visibleActivities = useMemo(()=>scope==='consolidated' && calendarAccess.can_view_consolidated ? enrichedActivities : enrichedActivities.filter((activity)=>activity.unit_id===selectedUnitId),[enrichedActivities,scope,calendarAccess.can_view_consolidated,selectedUnitId])
  const planObjectives = useMemo(()=>objectives.filter((objective)=>objective.management_period_id===periodId && objective.work_plan_id===ownSelectedPlan?.id),[objectives,periodId,ownSelectedPlan?.id])
  const planObjectiveIds = useMemo(()=>new Set(planObjectives.map((objective)=>objective.id)),[planObjectives])
  const planIndicators = useMemo(()=>indicators.filter((indicator)=>indicator.management_period_id===periodId && indicator.unit_id===selectedUnitId && planObjectiveIds.has(indicator.objective_id)),[indicators,periodId,selectedUnitId,planObjectiveIds])
  const currentUnit = units.find((unit)=>unit.id===selectedUnitId)
  const moduleLabel = resolveCalendarModuleLabel(organization)
  const canCreate = Boolean(selectedUnitId && ownUnitIds.has(selectedUnitId))
  const canViewConsolidated = Boolean(calendarAccess.can_view_consolidated)
  const visibleUnitCount = new Set(visibleActivities.map((activity)=>activity.unit_id).filter(Boolean)).size

  const reloadActivities = async () => {
    const { data,error:requestError } = await supabase.from('unit_work_activity').select('*').eq('organization_id',organizationId).order('start_date')
    if (requestError) setError(requestError.message)
    else setActivities(data ?? [])
  }

  const openNew = () => {
    if (!canOpenCalendarActivityEntry({ canCreate, saving })) return
    setBulkDefaults(emptyBulkDefaults())
    setBulkRows([emptyBulkRow()])
    setBulkOpen(true); setFormOpen(false); setError(''); setMessage(''); window.scrollTo({top:0,behavior:'smooth'})
  }
  const openEdit = (activity) => {
    if (!ownUnitIds.has(activity.unit_id)) return
    setSelectedUnitId(activity.unit_id)
    setForm({ ...emptyActivity(), ...activity, objective_id:activity.objective_id || '', end_date:activity.end_date || '', indicator_id:activity.indicator_id || '', description:activity.description || '', responsible_name:activity.responsible_name || '' })
    setFormOpen(true); setBulkOpen(false); setError(''); setMessage(''); window.scrollTo({top:0,behavior:'smooth'})
  }
  const updateBulkRow = (index, field, value) => {
    setBulkRows((rows)=>rows.map((row,rowIndex)=>rowIndex===index ? { ...row, [field]:value } : row))
  }
  const addBulkRow = () => setBulkRows((rows)=>[...rows,emptyBulkRow()])
  const removeBulkRow = (index) => setBulkRows((rows)=>rows.length===1 ? rows : rows.filter((_,rowIndex)=>rowIndex!==index))

  const saveBulkActivities = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canCreate || !ownSelectedPlan) return
    const filledRows = bulkRows.filter((row)=>row.title.trim() || row.start_date || row.end_date || row.description.trim())
    if (!filledRows.length || filledRows.some((row)=>!row.title.trim() || !row.start_date)) {
      setError(t.incompleteRows)
      return
    }
    if (filledRows.some((row)=>row.end_date && row.end_date < row.start_date)) {
      setError(t.invalidDates)
      return
    }
    const payloads = buildCalendarActivityPayloads({
      organizationId,
      workPlanId:ownSelectedPlan.id,
      userId:access.userId,
      defaults:bulkDefaults,
      rows:filledRows,
    })
    setSaving(true); setError(''); setMessage('')
    const { error:requestError } = await supabase.from('unit_work_activity').insert(payloads)
    if (requestError) setError(requestError.message)
    else {
      setBulkOpen(false); setBulkDefaults(emptyBulkDefaults()); setBulkRows([emptyBulkRow()])
      setMessage(language==='en' ? `${payloads.length} activities saved.` : `${payloads.length} actividades guardadas.`)
      await reloadActivities()
    }
    setSaving(false)
  }

  const saveActivity = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canCreate || !ownSelectedPlan || !form.title.trim() || !form.start_date) return
    setSaving(true); setError(''); setMessage('')
    const objectiveId = form.objective_id || null
    const payload = {
      organization_id:organizationId, work_plan_id:ownSelectedPlan.id, objective_id:objectiveId, indicator_id:objectiveId ? (form.indicator_id || null) : null,
      title:form.title.trim(), description:form.description.trim() || null, start_date:form.start_date, end_date:form.end_date || null,
      status:form.status, responsible_name:form.responsible_name.trim() || null, modality:form.modality, updated_by:access.userId || null,
    }
    const { error:requestError } = await supabase.from('unit_work_activity').update(payload).eq('id',form.id).eq('work_plan_id',ownSelectedPlan.id)
    if (requestError) setError(requestError.message)
    else { setFormOpen(false); setForm(emptyActivity()); setMessage(t.saved); await reloadActivities() }
    setSaving(false)
  }

  const reviewActivity = async (activity,status) => {
    if (!canReviewUnitActivity(activity, calendarAccess) || saving) return
    setSaving(true); setError('')
    const { error:requestError } = await supabase.rpc('review_calendar_activity',{ target_activity_id:activity.id, target_status:status, target_note:null })
    if (requestError) setError(requestError.message)
    else { setMessage(t.reviewed); await reloadActivities() }
    setSaving(false)
  }

  const toggleJointReview = async () => {
    if (!calendarAccess.can_manage_joint_review || !periodId || saving) return
    setSaving(true); setError('')
    const { error:requestError } = await supabase.rpc('set_calendar_joint_review',{ target_period_id:periodId, enabled:!calendarAccess.joint_review_enabled })
    if (requestError) setError(requestError.message)
    else { setMessage(t.jointChanged); await loadAccess(); await reloadActivities() }
    setSaving(false)
  }

  const clearCalendar = async () => {
    if (!ownSelectedPlan || !canCreate || saving) return
    if (!window.confirm(t.clearConfirm)) return
    setSaving(true); setError('')
    const { error:requestError } = await supabase.from('unit_work_activity').delete().eq('work_plan_id',ownSelectedPlan.id)
    if (requestError) setError(requestError.message)
    else { setMessage(t.clearDone); await reloadActivities() }
    setSaving(false)
  }

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} copy={{languageLabel:language==='en'?'Language':'Idioma'}} language={language} onLanguageChange={()=>{}} />

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel management-calendar-page">
      <div className="management-panel-heading calendar-page-heading">
        <div><p>{t.eyebrow}</p><h1 data-no-translate>{moduleLabel || DEFAULT_CALENDAR_MODULE_LABEL}</h1><span>{t.intro}</span></div>
        <div className="management-heading-actions calendar-heading-actions">
          {canCreate && <button className="secondary calendar-clear-button" type="button" onClick={clearCalendar} disabled={saving || !enrichedActivities.some((activity)=>activity.unit_id===selectedUnitId)}>{t.clear}</button>}
          {calendarAccess.can_manage_joint_review && <button className="secondary" type="button" onClick={toggleJointReview} disabled={saving}>{calendarAccess.joint_review_enabled?t.jointOff:t.jointOn}</button>}
          {canCreate && <button type="button" onClick={openNew} disabled={!canOpenCalendarActivityEntry({ canCreate, saving })}>{t.newActivity}</button>}
        </div>
      </div>

      <section className="calendar-preliminary-banner"><strong>{t.preliminaryText}</strong><span>{t.preliminary}</span></section>
      {error && <p className="management-flash error">{error}</p>}
      {message && <p className="management-flash success">{message}</p>}

      <section className="calendar-context-row">
        <label><span>{t.year}</span><select value={periodId} onChange={(event)=>{setPeriodId(event.target.value);setScope('mine');setFormOpen(false);setBulkOpen(false)}}>{periods.map((period)=><option key={period.id} value={period.id}>{period.name}</option>)}</select></label>
        <label><span>{t.unit}</span><select value={selectedUnitId} onChange={(event)=>{setSelectedUnitId(event.target.value);setScope('mine');setFormOpen(false);setBulkOpen(false)}} disabled={ownUnits.length<=1}>{ownUnits.map((unit)=><option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
        <div className="calendar-access-summary"><strong>{calendarAccess.is_digen?t.digenView:calendarAccess.joint_review_enabled?t.jointEnabled:t.privateView}</strong><small>{currentUnit ? currentUnit.code + ' · ' + currentUnit.name : ''}</small></div>
      </section>

      {!ownUnits.length && <p className="management-flash error">{t.noUnitAccess}</p>}

      {bulkOpen && <form className="management-form-card calendar-bulk-form" onSubmit={saveBulkActivities}>
        <div className="management-form-title calendar-bulk-title"><div><small>{currentUnit?.code || t.preliminary} · {activePeriod?.name || ''}</small><h2>{t.bulkTitle}</h2><p>{t.bulkIntro}</p></div><button type="button" onClick={()=>setBulkOpen(false)}>{t.cancel}</button></div>
        <div className="calendar-bulk-shared">
          <p>{t.sharedData}</p>
          <div className="management-form-grid">
            <label><span>{t.objective}</span><select value={bulkDefaults.objective_id} onChange={(event)=>setBulkDefaults((current)=>({...current,objective_id:event.target.value,indicator_id:''}))}><option value="">{t.noObjective}</option>{planObjectives.map((objective)=><option key={objective.id} value={objective.id}>{objective.code} · {objective.title}</option>)}</select></label>
            <label><span>{t.indicator}</span><select value={bulkDefaults.indicator_id} disabled={!bulkDefaults.objective_id} onChange={(event)=>setBulkDefaults((current)=>({...current,indicator_id:event.target.value}))}><option value="">—</option>{planIndicators.filter((indicator)=>indicator.objective_id===bulkDefaults.objective_id).map((indicator)=><option key={indicator.id} value={indicator.id}>{indicator.name}</option>)}</select></label>
            <label><span>{t.responsible}</span><input value={bulkDefaults.responsible_name} onChange={(event)=>setBulkDefaults((current)=>({...current,responsible_name:event.target.value}))} /></label>
            <label><span>{t.modality}</span><select value={bulkDefaults.modality} onChange={(event)=>setBulkDefaults((current)=>({...current,modality:event.target.value}))}>{Object.entries(MODALITY[language]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>{t.status}</span><select value={bulkDefaults.status} onChange={(event)=>setBulkDefaults((current)=>({...current,status:event.target.value}))}>{Object.entries(STATUS[language]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          </div>
        </div>
        <div className="calendar-bulk-rows">
          <div className="calendar-bulk-rows-heading"><p>{t.activitiesToLoad}</p><strong>{bulkRows.length}</strong></div>
          {bulkRows.map((row,index)=><article className="calendar-bulk-row" key={index}>
            <div className="calendar-bulk-row-number"><span>{index+1}</span>{bulkRows.length>1&&<button type="button" onClick={()=>removeBulkRow(index)}>{t.removeRow}</button>}</div>
            <label className="calendar-bulk-name"><span>{t.activityName} *</span><input value={row.title} onChange={(event)=>updateBulkRow(index,'title',event.target.value)} placeholder={language==='en'?'Example: Regional meeting':'Ej.: Reunión regional'} /></label>
            <label><span>{t.dateFrom} *</span><input type="date" value={row.start_date} min={activePeriod?.start_date} max={activePeriod?.end_date} onChange={(event)=>updateBulkRow(index,'start_date',event.target.value)} /></label>
            <label><span>{t.dateTo}</span><input type="date" value={row.end_date} min={row.start_date||activePeriod?.start_date} max={activePeriod?.end_date} onChange={(event)=>updateBulkRow(index,'end_date',event.target.value)} /></label>
            <label className="calendar-bulk-notes"><span>{t.notes}</span><input value={row.description} onChange={(event)=>updateBulkRow(index,'description',event.target.value)} /></label>
          </article>)}
          <button className="calendar-add-row" type="button" onClick={addBulkRow}>{t.addRow}</button>
        </div>
        <div className="management-form-actions"><button type="button" onClick={()=>setBulkOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{saving?t.saving:`${t.saveBatch} (${bulkRows.filter((row)=>row.title.trim()).length || 1})`}</button></div>
      </form>}

      {formOpen && <form className="management-form-card calendar-activity-form" onSubmit={saveActivity}>
        <div className="management-form-title"><div><small>{t.preliminary}</small><h2>{form.id?t.edit:t.newActivity.replace('＋ ','')}</h2></div><button type="button" onClick={()=>setFormOpen(false)}>{t.cancel}</button></div>
        <div className="management-form-grid">
          <label className="wide"><span>{t.activity} *</span><input value={form.title} onChange={(event)=>setForm((current)=>({...current,title:event.target.value}))} required /></label>
          <label><span>{t.objective}</span><select value={form.objective_id} onChange={(event)=>setForm((current)=>({...current,objective_id:event.target.value,indicator_id:''}))}><option value="">{t.noObjective}</option>{planObjectives.map((objective)=><option key={objective.id} value={objective.id}>{objective.code} · {objective.title}</option>)}</select></label>
          <label><span>{t.indicator}</span><select value={form.indicator_id} disabled={!form.objective_id} onChange={(event)=>setForm((current)=>({...current,indicator_id:event.target.value}))}><option value="">—</option>{planIndicators.filter((indicator)=>indicator.objective_id===form.objective_id).map((indicator)=><option key={indicator.id} value={indicator.id}>{indicator.name}</option>)}</select></label>
          <label><span>{t.dateFrom} *</span><input type="date" value={form.start_date} min={activePeriod?.start_date} max={activePeriod?.end_date} onChange={(event)=>setForm((current)=>({...current,start_date:event.target.value}))} required /></label>
          <label><span>{t.dateTo}</span><input type="date" value={form.end_date} min={form.start_date||activePeriod?.start_date} max={activePeriod?.end_date} onChange={(event)=>setForm((current)=>({...current,end_date:event.target.value}))} /></label>
          <label><span>{t.responsible}</span><input value={form.responsible_name} onChange={(event)=>setForm((current)=>({...current,responsible_name:event.target.value}))} /></label>
          <label><span>{t.modality}</span><select value={form.modality} onChange={(event)=>setForm((current)=>({...current,modality:event.target.value}))}>{Object.entries(MODALITY[language]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>{t.status}</span><select value={form.status} onChange={(event)=>setForm((current)=>({...current,status:event.target.value}))}>{Object.entries(STATUS[language]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <label className="wide"><span>{t.details}</span><textarea value={form.description} onChange={(event)=>setForm((current)=>({...current,description:event.target.value}))} /></label>
        </div>
        <div className="management-form-actions"><button type="button" onClick={()=>setFormOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{saving?t.saving:t.save}</button></div>
      </form>}

      {loading ? <div className="management-loading"><span/><p>{t.loading}</p></div> : <>
        <section className="calendar-metrics">
          <article><span>{t.visibleActivities}</span><strong>{visibleActivities.length}</strong></article>
          <article><span>{t.visibleUnits}</span><strong>{visibleUnitCount || (selectedUnitId?1:0)}</strong></article>
          <article><span>{t.validated}</span><strong>{visibleActivities.filter((activity)=>activity.review_status==='validated').length}</strong></article>
          <article><span>{t.observed}</span><strong>{visibleActivities.filter((activity)=>activity.review_status==='observed').length}</strong></article>
        </section>

        <div className="calendar-view-controls">
          <div className="calendar-scope-tabs"><button className={scope==='mine'?'active':''} type="button" onClick={()=>setScope('mine')}>{t.myCalendar}</button>{canViewConsolidated && <button className={scope==='consolidated'?'active':''} type="button" onClick={()=>setScope('consolidated')}>{t.consolidated}</button>}</div>
          <div className="calendar-presentation-tabs"><button className={presentation==='calendar'?'active':''} type="button" onClick={()=>setPresentation('calendar')}>{t.calendar}</button><button className={presentation==='list'?'active':''} type="button" onClick={()=>setPresentation('list')}>{t.list}</button></div>
        </div>

        {presentation==='calendar' ? <section className="calendar-year-grid">{MONTHS[language].map((month,index)=>{
          const monthRows=visibleActivities.filter((activity)=>new Date(activity.start_date + 'T12:00:00').getMonth()===index)
          return <article className="calendar-month-card" key={month}><header><span>{String(index+1).padStart(2,'0')}</span><strong>{month}</strong><b>{monthRows.length}</b></header><div>{monthRows.length ? monthRows.map((activity)=>{
            const unit=units.find((row)=>row.id===activity.unit_id); const objective=objectives.find((row)=>row.id===activity.objective_id); const indicator=indicators.find((row)=>row.id===activity.indicator_id); const editable=ownUnitIds.has(activity.unit_id)
            return <div className={'calendar-event review-' + (activity.review_status||'pending')} key={activity.id}>
              <div className="calendar-event-top"><span>{dateLabel(activity.start_date,language)}</span><b>{unit?.code||'—'}</b></div>
              <strong>{activity.title}</strong><small>{objective?.code||''}{indicator ? ' · ' + indicator.name : ''}</small>
              <div className="calendar-event-meta"><span>{MODALITY[language][activity.modality]||activity.modality}</span><span>{STATUS[language][activity.status]||activity.status}</span></div>
              <div className="calendar-event-footer"><span className={'calendar-review-badge ' + (activity.review_status||'pending')}>{reviewStatusLabel(activity.review_status,language)}</span><div>{editable && <button type="button" onClick={()=>openEdit(activity)}>{t.edit}</button>}{canReviewUnitActivity(activity, calendarAccess) && <><button className="validate" type="button" onClick={()=>reviewActivity(activity,'validated')}>{t.validate}</button><button className="observe" type="button" onClick={()=>reviewActivity(activity,'observed')}>{t.observe}</button></>}</div></div>
            </div>
          }) : <p>{t.noActivities}</p>}</div></article>
        })}</section> : <section className="calendar-list-card">
          <div className="calendar-list-head"><span>{t.date}</span><span>{t.activity}</span><span>{t.direction}</span><span>{t.objectiveIndicator}</span><span>{t.reviewState}</span></div>
          {visibleActivities.length ? visibleActivities.map((activity)=>{
            const unit=units.find((row)=>row.id===activity.unit_id); const objective=objectives.find((row)=>row.id===activity.objective_id); const indicator=indicators.find((row)=>row.id===activity.indicator_id)
            return <div className="calendar-list-row" key={activity.id}><div className="calendar-list-cell" data-label={t.date}><span>{dateLabel(activity.start_date,language)}</span></div><div className="calendar-list-cell calendar-list-activity" data-label={t.activity}><strong>{activity.title}</strong></div><div className="calendar-list-cell" data-label={t.direction}><span>{unit?.code||'—'}</span></div><div className="calendar-list-cell calendar-list-objective" data-label={t.objectiveIndicator}><span>{objective?.code||'—'}</span>{indicator?<small>{indicator.name}</small>:null}</div><div className="calendar-list-cell" data-label={t.reviewState}><span className={'calendar-review-badge ' + (activity.review_status||'pending')}>{reviewStatusLabel(activity.review_status,language)}</span></div></div>
          }) : <p className="management-empty">{t.noActivities}</p>}
        </section>}
      </>}
    </div>
  </ManagementStandaloneShell>
}
