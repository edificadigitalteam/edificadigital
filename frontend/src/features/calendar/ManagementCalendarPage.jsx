import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from '../management/ManagementStandaloneShell.jsx'
import { DEFAULT_CALENDAR_MODULE_LABEL, resolveCalendarModuleLabel, reviewStatusLabel } from './calendar.js'
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
    myCalendar:'Mi calendario', consolidated:'Consolidado institucional', calendar:'Calendario anual', list:'Listado', newActivity:'＋ Nueva actividad',
    clear:'Vaciar calendario', clearConfirm:'¿Vaciar todas las actividades de esta unidad para el año seleccionado? Esta acción eliminará únicamente el calendario propio visible.',
    clearDone:'Calendario de la unidad vaciado.', jointOn:'Habilitar vista conjunta', jointOff:'Cerrar vista conjunta',
    jointEnabled:'Vista consolidada habilitada por DIGEN.', privateView:'Tu calendario está visible para tu unidad y para DIGEN.',
    digenView:'DIGEN tiene acceso al consolidado institucional.', visibleActivities:'Actividades visibles', visibleUnits:'Unidades visibles',
    validated:'Validadas', observed:'Observadas', noActivities:'Sin actividades visibles.',
    noObjectives:'Esta unidad necesita al menos un objetivo en su Plan Anual antes de registrar actividades.', openPlan:'Abrir Plan Anual',
    activity:'Actividad', objective:'Objetivo del Plan Anual', indicator:'Indicador relacionado (opcional)', dateFrom:'Fecha de inicio', dateTo:'Fecha de cierre',
    responsible:'Responsable', modality:'Modalidad', status:'Estado', details:'Notas / detalles', save:'Guardar actividad', saving:'Guardando…',
    cancel:'Cancelar', edit:'Editar', validate:'Validar', observe:'Observar', reviewState:'Estado DIGEN', date:'Fecha', direction:'Dirección',
    objectiveIndicator:'Objetivo / indicador', loading:'Cargando calendario…', saved:'Actividad guardada.', reviewed:'Revisión actualizada.',
    jointChanged:'Visibilidad conjunta actualizada.', noUnitAccess:'Tu usuario todavía no está asignado a una Dirección o agencia con acceso al calendario.',
  },
  en: {
    eyebrow:'INSTITUTIONAL PLANNING', title:'Annual calendar', intro:'Each unit or agency manages its activities for the selected year.',
    preliminary:'PRELIMINARY', preliminaryText:'Preliminary calendar subject to institutional validation.', year:'Year', unit:'Unit / agency',
    myCalendar:'My calendar', consolidated:'Institutional consolidated', calendar:'Annual calendar', list:'List', newActivity:'＋ New activity',
    clear:'Clear calendar', clearConfirm:'Clear all activities for this unit and selected year? This only deletes the current unit calendar.',
    clearDone:'Unit calendar cleared.', jointOn:'Enable shared view', jointOff:'Close shared view', jointEnabled:'Consolidated view enabled by DIGEN.',
    privateView:'Your calendar is visible to your unit and DIGEN.', digenView:'DIGEN can access the institutional consolidated calendar.',
    visibleActivities:'Visible activities', visibleUnits:'Visible units', validated:'Validated', observed:'Observed', noActivities:'No visible activities.',
    noObjectives:'This unit needs at least one Annual Work Plan objective before activities can be created.', openPlan:'Open Annual Work Plan',
    activity:'Activity', objective:'Annual Work Plan objective', indicator:'Related indicator (optional)', dateFrom:'Start date', dateTo:'End date',
    responsible:'Responsible', modality:'Modality', status:'Status', details:'Notes / details', save:'Save activity', saving:'Saving…', cancel:'Cancel',
    edit:'Edit', validate:'Validate', observe:'Observe', reviewState:'DIGEN status', date:'Date', direction:'Unit',
    objectiveIndicator:'Objective / indicator', loading:'Loading calendar…', saved:'Activity saved.', reviewed:'Review updated.',
    jointChanged:'Shared visibility updated.', noUnitAccess:'Your user is not yet assigned to a unit or agency with calendar access.',
  },
}

const emptyActivity = () => ({ id:'', title:'', description:'', objective_id:'', indicator_id:'', start_date:'', end_date:'', status:'planned', responsible_name:'', modality:'in_person' })

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
  const digenUnit = units.find((unit)=>unit.id===calendarAccess.digen_unit_id || String(unit.code||'').toUpperCase()==='DIGEN')

  useEffect(()=>{
    if (calendarAccess.is_digen && digenUnit) {
      setSelectedUnitId((current)=>ownUnitIds.has(current) ? current : digenUnit.id)
      return
    }
    setSelectedUnitId((current)=>ownUnitIds.has(current) ? current : ownUnits[0]?.id || '')
  },[calendarAccess.is_digen,digenUnit?.id,ownUnits,ownUnitIds])

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
    if (!canCreate) return
    setForm({ ...emptyActivity(), start_date:activePeriod?.start_date || '' })
    setFormOpen(true); setError(''); setMessage(''); window.scrollTo({top:0,behavior:'smooth'})
  }
  const openEdit = (activity) => {
    if (!ownUnitIds.has(activity.unit_id)) return
    setSelectedUnitId(activity.unit_id)
    setForm({ ...emptyActivity(), ...activity, end_date:activity.end_date || '', indicator_id:activity.indicator_id || '', description:activity.description || '', responsible_name:activity.responsible_name || '' })
    setFormOpen(true); setError(''); setMessage(''); window.scrollTo({top:0,behavior:'smooth'})
  }

  const saveActivity = async (event) => {
    event.preventDefault()
    if (!supabase || saving || !canCreate || !ownSelectedPlan || !form.objective_id || !form.title.trim() || !form.start_date) return
    setSaving(true); setError(''); setMessage('')
    const payload = {
      organization_id:organizationId, work_plan_id:ownSelectedPlan.id, objective_id:form.objective_id, indicator_id:form.indicator_id || null,
      title:form.title.trim(), description:form.description.trim() || null, start_date:form.start_date, end_date:form.end_date || null,
      status:form.status, responsible_name:form.responsible_name.trim() || null, modality:form.modality, updated_by:access.userId || null,
      ...(form.id ? {} : { created_by:access.userId || null }),
    }
    const request = form.id
      ? supabase.from('unit_work_activity').update(payload).eq('id',form.id).eq('work_plan_id',ownSelectedPlan.id)
      : supabase.from('unit_work_activity').insert(payload)
    const { error:requestError } = await request
    if (requestError) setError(requestError.message)
    else { setFormOpen(false); setForm(emptyActivity()); setMessage(t.saved); await reloadActivities() }
    setSaving(false)
  }

  const reviewActivity = async (activity,status) => {
    if (!calendarAccess.is_digen || saving) return
    setSaving(true); setError('')
    const { error:requestError } = await supabase.rpc('review_calendar_activity',{ target_activity_id:activity.id, target_status:status, target_note:null })
    if (requestError) setError(requestError.message)
    else { setMessage(t.reviewed); await reloadActivities() }
    setSaving(false)
  }

  const toggleJointReview = async () => {
    if (!calendarAccess.is_digen || !periodId || saving) return
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
          {calendarAccess.is_digen && <button className="secondary" type="button" onClick={toggleJointReview} disabled={saving}>{calendarAccess.joint_review_enabled?t.jointOff:t.jointOn}</button>}
          {canCreate && <button type="button" onClick={openNew} disabled={saving || !planObjectives.length}>{t.newActivity}</button>}
        </div>
      </div>

      <section className="calendar-preliminary-banner"><strong>{t.preliminaryText}</strong><span>{t.preliminary}</span></section>
      {error && <p className="management-flash error">{error}</p>}
      {message && <p className="management-flash success">{message}</p>}

      <section className="calendar-context-row">
        <label><span>{t.year}</span><select value={periodId} onChange={(event)=>{setPeriodId(event.target.value);setScope('mine');setFormOpen(false)}}>{periods.map((period)=><option key={period.id} value={period.id}>{period.name}</option>)}</select></label>
        <label><span>{t.unit}</span><select value={selectedUnitId} onChange={(event)=>{setSelectedUnitId(event.target.value);setScope('mine');setFormOpen(false)}} disabled={ownUnits.length<=1}>{ownUnits.map((unit)=><option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
        <div className="calendar-access-summary"><strong>{calendarAccess.is_digen?t.digenView:calendarAccess.joint_review_enabled?t.jointEnabled:t.privateView}</strong><small>{currentUnit ? currentUnit.code + ' · ' + currentUnit.name : ''}</small></div>
      </section>

      {!ownUnits.length && <p className="management-flash error">{t.noUnitAccess}</p>}

      {formOpen && <form className="management-form-card calendar-activity-form" onSubmit={saveActivity}>
        <div className="management-form-title"><div><small>{t.preliminary}</small><h2>{form.id?t.edit:t.newActivity.replace('＋ ','')}</h2></div><button type="button" onClick={()=>setFormOpen(false)}>{t.cancel}</button></div>
        {!planObjectives.length ? <div className="calendar-objective-required"><p>{t.noObjectives}</p><a href={'/app/management/objectives?period=' + encodeURIComponent(periodId) + '&unit=' + encodeURIComponent(selectedUnitId)}>{t.openPlan}</a></div> : <div className="management-form-grid">
          <label className="wide"><span>{t.activity} *</span><input value={form.title} onChange={(event)=>setForm((current)=>({...current,title:event.target.value}))} required /></label>
          <label><span>{t.objective} *</span><select value={form.objective_id} onChange={(event)=>setForm((current)=>({...current,objective_id:event.target.value,indicator_id:''}))} required><option value="">—</option>{planObjectives.map((objective)=><option key={objective.id} value={objective.id}>{objective.code} · {objective.title}</option>)}</select></label>
          <label><span>{t.indicator}</span><select value={form.indicator_id} onChange={(event)=>setForm((current)=>({...current,indicator_id:event.target.value}))}><option value="">—</option>{planIndicators.filter((indicator)=>!form.objective_id||indicator.objective_id===form.objective_id).map((indicator)=><option key={indicator.id} value={indicator.id}>{indicator.name}</option>)}</select></label>
          <label><span>{t.dateFrom} *</span><input type="date" value={form.start_date} min={activePeriod?.start_date} max={activePeriod?.end_date} onChange={(event)=>setForm((current)=>({...current,start_date:event.target.value}))} required /></label>
          <label><span>{t.dateTo}</span><input type="date" value={form.end_date} min={form.start_date||activePeriod?.start_date} max={activePeriod?.end_date} onChange={(event)=>setForm((current)=>({...current,end_date:event.target.value}))} /></label>
          <label><span>{t.responsible}</span><input value={form.responsible_name} onChange={(event)=>setForm((current)=>({...current,responsible_name:event.target.value}))} /></label>
          <label><span>{t.modality}</span><select value={form.modality} onChange={(event)=>setForm((current)=>({...current,modality:event.target.value}))}>{Object.entries(MODALITY[language]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>{t.status}</span><select value={form.status} onChange={(event)=>setForm((current)=>({...current,status:event.target.value}))}>{Object.entries(STATUS[language]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <label className="wide"><span>{t.details}</span><textarea value={form.description} onChange={(event)=>setForm((current)=>({...current,description:event.target.value}))} /></label>
        </div>}
        {planObjectives.length>0 && <div className="management-form-actions"><button type="button" onClick={()=>setFormOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving}>{saving?t.saving:t.save}</button></div>}
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
              <div className="calendar-event-footer"><span className={'calendar-review-badge ' + (activity.review_status||'pending')}>{reviewStatusLabel(activity.review_status,language)}</span><div>{editable && <button type="button" onClick={()=>openEdit(activity)}>{t.edit}</button>}{calendarAccess.is_digen && <><button className="validate" type="button" onClick={()=>reviewActivity(activity,'validated')}>{t.validate}</button><button className="observe" type="button" onClick={()=>reviewActivity(activity,'observed')}>{t.observe}</button></>}</div></div>
            </div>
          }) : <p>{t.noActivities}</p>}</div></article>
        })}</section> : <section className="calendar-list-card">
          <div className="calendar-list-head"><span>{t.date}</span><span>{t.activity}</span><span>{t.direction}</span><span>{t.objectiveIndicator}</span><span>{t.reviewState}</span></div>
          {visibleActivities.length ? visibleActivities.map((activity)=>{
            const unit=units.find((row)=>row.id===activity.unit_id); const objective=objectives.find((row)=>row.id===activity.objective_id); const indicator=indicators.find((row)=>row.id===activity.indicator_id)
            return <div className="calendar-list-row" key={activity.id}><span>{dateLabel(activity.start_date,language)}</span><strong>{activity.title}</strong><span>{unit?.code||'—'}</span><span>{objective?.code||'—'}{indicator?<small>{indicator.name}</small>:null}</span><span className={'calendar-review-badge ' + (activity.review_status||'pending')}>{reviewStatusLabel(activity.review_status,language)}</span></div>
          }) : <p className="management-empty">{t.noActivities}</p>}
        </section>}
      </>}
    </div>
  </ManagementStandaloneShell>
}
