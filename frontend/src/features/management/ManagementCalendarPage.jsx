import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-calendar.css'

const MONTHS = {
  es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
}
const MONTH_THEMES = {
  es: ['Unión Femenil Misionera','Juventud y Esfuerzo Cooperativo','Seminario y Núcleos','Servicio Social','Hogar Cristiano','Oración','Compañerismo','Evangelización','Biblia y CNBV','Familia Pastoral','Mayordomía','Misiones Nacionales'],
  en: ['Women’s Missionary Union','Youth and Cooperative Program','Seminary and Centers','Social Service','Christian Home','Prayer','Fellowship','Evangelism','Bible and CNBV','Pastoral Family','Stewardship','National Missions'],
}
const STATUS = {
  es: { planned:'Planificada', in_progress:'En curso', completed:'Completada', cancelled:'Cancelada' },
  en: { planned:'Planned', in_progress:'In progress', completed:'Completed', cancelled:'Cancelled' },
}
const copy = {
  es: {
    eyebrow:'PLANIFICACIÓN INSTITUCIONAL', title:'Calendario anual', intro:'Registra las actividades de tu Dirección o agencia dentro del Plan Anual de Trabajo.',
    preliminary:'PRELIMINAR', validation:'Sujeto a validación institucional', year:'Año de trabajo', unit:'Dirección / agencia', allUnits:'Todas las unidades',
    newActivity:'＋ Nueva actividad', emptyCalendar:'Vaciar calendario', calendar:'Calendario anual', list:'Listado', visible:'Actividades visibles', thisMonth:'Este mes', units:'Unidades visibles', completed:'Completadas',
    ownPrivacy:'Este calendario muestra únicamente las actividades de tu unidad.', digenPrivacy:'Vista institucional consolidada disponible para DIGEN.',
    noActivities:'Sin actividades visibles.', date:'Fecha', activity:'Actividad', objective:'Objetivo', indicator:'Indicador relacionado', responsible:'Responsable', status:'Estado',
    newTitle:'Registrar actividad', editTitle:'Editar actividad', description:'Notas / detalles', start:'Inicio', end:'Fin', save:'Guardar actividad', cancel:'Cancelar', close:'Cerrar',
    selectObjective:'Selecciona un objetivo', optionalIndicator:'Sin indicador específico', loading:'Cargando calendario…', saved:'Actividad guardada.', deleted:'Calendario de la unidad vaciado.',
    confirmClear:'Se eliminarán todas las actividades del año seleccionado para esta unidad. Esta acción no afecta a otras Direcciones. ¿Deseas continuar?',
    onlyOwn:'Solo puedes modificar actividades de las unidades a las que perteneces.', noPlan:'Esta unidad todavía no tiene un Plan Anual para el año seleccionado.',
    noObjectives:'Crea primero un objetivo en el Plan Anual para registrar actividades.', openPlan:'Abrir Plan Anual', edit:'Editar',
  },
  en: {
    eyebrow:'INSTITUTIONAL PLANNING', title:'Annual calendar', intro:'Record your unit activities inside the Annual Work Plan.',
    preliminary:'PRELIMINARY', validation:'Subject to institutional validation', year:'Work year', unit:'Unit / agency', allUnits:'All units',
    newActivity:'＋ New activity', emptyCalendar:'Clear calendar', calendar:'Annual calendar', list:'List', visible:'Visible activities', thisMonth:'This month', units:'Visible units', completed:'Completed',
    ownPrivacy:'This calendar shows only your unit activities.', digenPrivacy:'Institutional consolidated view available to DIGEN.',
    noActivities:'No visible activities.', date:'Date', activity:'Activity', objective:'Objective', indicator:'Related indicator', responsible:'Responsible', status:'Status',
    newTitle:'Add activity', editTitle:'Edit activity', description:'Notes / details', start:'Start', end:'End', save:'Save activity', cancel:'Cancel', close:'Close',
    selectObjective:'Select an objective', optionalIndicator:'No specific indicator', loading:'Loading calendar…', saved:'Activity saved.', deleted:'Unit calendar cleared.',
    confirmClear:'All activities for the selected year and unit will be deleted. Other units are unaffected. Continue?',
    onlyOwn:'You can only modify activities for units you belong to.', noPlan:'This unit does not have an Annual Work Plan for the selected year yet.',
    noObjectives:'Create an objective in the Annual Work Plan before adding activities.', openPlan:'Open Annual Work Plan', edit:'Edit',
  },
}

function readLanguage(){try{return document.documentElement.lang==='en'||window.localStorage.getItem('edifica-language')==='en'?'en':'es'}catch{return'es'}}
function formatDate(value,language){if(!value)return'';return new Intl.DateTimeFormat(language==='en'?'en-US':'es-VE',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`))}
function emptyActivity(){return{id:'',unit_id:'',objective_id:'',indicator_id:'',title:'',description:'',start_date:'',end_date:'',status:'planned',responsible_name:''}}

export default function ManagementCalendarPage(){
  const access=useOperatorAccess()
  const [language,setLanguage]=useState(readLanguage)
  const t=copy[language]
  const [organizationId,setOrganizationId]=useState(access.organizationId||'')
  const [periods,setPeriods]=useState([])
  const [units,setUnits]=useState([])
  const [plans,setPlans]=useState([])
  const [objectives,setObjectives]=useState([])
  const [indicators,setIndicators]=useState([])
  const [activities,setActivities]=useState([])
  const [overview,setOverview]=useState(null)
  const [moduleLabel,setModuleLabel]=useState('')
  const [periodId,setPeriodId]=useState('')
  const [unitFilter,setUnitFilter]=useState('')
  const [view,setView]=useState('calendar')
  const [form,setForm]=useState(emptyActivity)
  const [formOpen,setFormOpen]=useState(false)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')

  const isSuperAdmin=access.role==='super_admin'
  const canViewAll=Boolean(overview?.is_digen)||isSuperAdmin
  const ownUnitIds=useMemo(()=>new Set(overview?.unit_ids||[]),[overview?.unit_ids])
  const digenUnitId=overview?.digen_unit_id||''

  useEffect(()=>{const observer=new MutationObserver(()=>setLanguage(readLanguage()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});return()=>observer.disconnect()},[])
  useEffect(()=>{if(access.status==='authorized'&&!isSuperAdmin)setOrganizationId(access.organizationId||'')},[access.organizationId,access.status,isSuperAdmin])

  const reload=useCallback(async()=>{
    if(!supabase||access.status!=='authorized'||!organizationId){setLoading(false);return}
    setLoading(true);setError('')
    const responses=await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id',organizationId).order('start_date',{ascending:false}),
      supabase.from('organization_unit').select('id,code,name,unit_type,sort_order,active').eq('organization_id',organizationId).eq('active',true).order('sort_order').order('name'),
      supabase.from('unit_work_plan').select('*').eq('organization_id',organizationId),
      supabase.from('institutional_objective').select('id,management_period_id,work_plan_id,code,title,status').eq('organization_id',organizationId).order('code'),
      supabase.from('management_indicator').select('id,management_period_id,unit_id,objective_id,name,active').eq('organization_id',organizationId).eq('active',true).order('created_at'),
      supabase.from('unit_work_activity').select('*').eq('organization_id',organizationId).order('start_date'),
      supabase.rpc('management_report_access_overview',{target_organization_id:organizationId}),
      supabase.from('organization').select('id,calendar_module_label').eq('id',organizationId).maybeSingle(),
    ])
    const firstError=responses.find((r)=>r.error)?.error
    if(firstError)setError(firstError.message)
    else{
      const periodRows=responses[0].data||[]
      setPeriods(periodRows);setUnits(responses[1].data||[]);setPlans(responses[2].data||[]);setObjectives(responses[3].data||[]);setIndicators(responses[4].data||[]);setActivities(responses[5].data||[]);setOverview(responses[6].data||null);setModuleLabel(responses[7].data?.calendar_module_label||'')
      setPeriodId((current)=>periodRows.some((p)=>p.id===current)?current:periodRows.find((p)=>p.status==='active')?.id||periodRows[0]?.id||'')
    }
    setLoading(false)
  },[access.status,organizationId])

  useEffect(()=>{reload()},[reload])

  const visibleUnitOptions=useMemo(()=>{
    if(canViewAll)return units
    return units.filter((unit)=>ownUnitIds.has(unit.id))
  },[canViewAll,units,ownUnitIds])

  useEffect(()=>{
    if(canViewAll){if(unitFilter&&unitFilter!=='all'&&!units.some((u)=>u.id===unitFilter))setUnitFilter('all');if(!unitFilter)setUnitFilter('all');return}
    if(!visibleUnitOptions.some((u)=>u.id===unitFilter))setUnitFilter(visibleUnitOptions[0]?.id||'')
  },[canViewAll,unitFilter,units,visibleUnitOptions])

  const currentPeriod=periods.find((p)=>p.id===periodId)
  const periodPlans=plans.filter((p)=>p.management_period_id===periodId)
  const visiblePlanIds=useMemo(()=>{
    if(unitFilter==='all')return new Set(periodPlans.map((p)=>p.id))
    return new Set(periodPlans.filter((p)=>p.unit_id===unitFilter).map((p)=>p.id))
  },[periodPlans,unitFilter])
  const visibleActivities=useMemo(()=>activities.filter((a)=>visiblePlanIds.has(a.work_plan_id)),[activities,visiblePlanIds])
  const visibleActivityUnits=new Set(visibleActivities.map((a)=>plans.find((p)=>p.id===a.work_plan_id)?.unit_id).filter(Boolean))
  const selectedOwnUnitId=unitFilter!=='all'&&ownUnitIds.has(unitFilter)?unitFilter:(digenUnitId&&ownUnitIds.has(digenUnitId)?digenUnitId:[...ownUnitIds][0]||'')
  const selectedPlan=periodPlans.find((p)=>p.unit_id===selectedOwnUnitId)
  const selectedObjectives=objectives.filter((o)=>o.management_period_id===periodId&&o.work_plan_id===selectedPlan?.id&&o.status!=='archived')
  const formIndicators=indicators.filter((i)=>i.management_period_id===periodId&&i.unit_id===form.unit_id&&i.objective_id===form.objective_id)
  const canClear=Boolean(unitFilter&&unitFilter!=='all'&&ownUnitIds.has(unitFilter))
  const now=new Date()
  const sameYear=currentPeriod?.start_date?now.getFullYear()===Number(currentPeriod.start_date.slice(0,4)):false
  const thisMonthCount=visibleActivities.filter((a)=>sameYear&&Number(a.start_date?.slice(5,7))===now.getMonth()+1).length

  const openNew=()=>{
    const unitId=selectedOwnUnitId
    const plan=periodPlans.find((p)=>p.unit_id===unitId)
    const unitObjectives=objectives.filter((o)=>o.management_period_id===periodId&&o.work_plan_id===plan?.id&&o.status!=='archived')
    setForm({...emptyActivity(),unit_id:unitId,objective_id:unitObjectives[0]?.id||'',start_date:currentPeriod?.start_date||''})
    setFormOpen(true);setError('');setMessage('');window.scrollTo({top:0,behavior:'smooth'})
  }
  const openEdit=(activity)=>{
    const plan=plans.find((p)=>p.id===activity.work_plan_id)
    if(!plan||!ownUnitIds.has(plan.unit_id))return
    setForm({...emptyActivity(),...activity,unit_id:plan.unit_id,indicator_id:activity.indicator_id||'',end_date:activity.end_date||'',description:activity.description||'',responsible_name:activity.responsible_name||''})
    setFormOpen(true);setError('');setMessage('');window.scrollTo({top:0,behavior:'smooth'})
  }

  const save=async(event)=>{
    event.preventDefault()
    if(saving||!form.unit_id||!ownUnitIds.has(form.unit_id)){setError(t.onlyOwn);return}
    const plan=periodPlans.find((p)=>p.unit_id===form.unit_id)
    if(!plan){setError(t.noPlan);return}
    if(!form.objective_id){setError(t.noObjectives);return}
    setSaving(true);setError('');setMessage('')
    const payload={organization_id:organizationId,work_plan_id:plan.id,objective_id:form.objective_id,indicator_id:form.indicator_id||null,title:form.title.trim(),description:form.description.trim()||null,start_date:form.start_date,end_date:form.end_date||null,status:form.status,responsible_name:form.responsible_name.trim()||null,updated_by:access.userId,...(form.id?{}:{created_by:access.userId})}
    const request=form.id?supabase.from('unit_work_activity').update(payload).eq('id',form.id):supabase.from('unit_work_activity').insert(payload)
    const {error:requestError}=await request
    if(requestError)setError(requestError.message)
    else{setFormOpen(false);setForm(emptyActivity());setMessage(t.saved);await reload()}
    setSaving(false)
  }

  const clearCalendar=async()=>{
    if(!canClear||saving)return
    if(!window.confirm(t.confirmClear))return
    const plan=periodPlans.find((p)=>p.unit_id===unitFilter)
    if(!plan)return
    setSaving(true);setError('');setMessage('')
    const {error:requestError}=await supabase.from('unit_work_activity').delete().eq('work_plan_id',plan.id)
    if(requestError)setError(requestError.message)
    else{setMessage(t.deleted);await reload()}
    setSaving(false)
  }

  if(access.status!=='authorized')return <OperatorAccessScreen access={access} copy={{languageLabel:language==='en'?'Language':'Idioma'}} language={language} onLanguageChange={()=>{}} />

  const displayTitle=moduleLabel||t.title

  return <ManagementStandaloneShell access={access}>
    <div className="management-panel management-calendar-page">
      <div className="management-panel-heading calendar-page-heading">
        <div><p>{t.eyebrow}</p><div className="calendar-heading-line"><h1>{displayTitle}</h1><span>{t.preliminary}</span></div><strong>{t.validation}</strong><small>{t.intro}</small></div>
        <div className="calendar-heading-actions"><button className="calendar-clear-button" disabled={!canClear||saving} onClick={clearCalendar}>{t.emptyCalendar}</button><button className="calendar-primary" disabled={!selectedOwnUnitId} onClick={openNew}>{t.newActivity}</button></div>
      </div>

      {error&&<p className="management-flash error">{error}</p>}
      {message&&<p className="management-flash success">{message}</p>}

      <section className="calendar-context">
        <label><span>{t.year}</span><select value={periodId} onChange={(e)=>{setPeriodId(e.target.value);setFormOpen(false)}}>{periods.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label><span>{t.unit}</span><select value={unitFilter} onChange={(e)=>{setUnitFilter(e.target.value);setFormOpen(false)}}>{canViewAll&&<option value="all">{t.allUnits}</option>}{visibleUnitOptions.map((u)=><option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select></label>
        <div className="calendar-privacy"><b>{canViewAll&&unitFilter==='all'?t.digenPrivacy:t.ownPrivacy}</b><span>{canViewAll&&unitFilter==='all'?'DIGEN':units.find((u)=>u.id===unitFilter)?.code||''}</span></div>
      </section>

      <section className="calendar-stats">
        <article><span>{t.visible}</span><strong>{visibleActivities.length}</strong></article>
        <article><span>{t.thisMonth}</span><strong>{thisMonthCount}</strong></article>
        <article><span>{t.units}</span><strong>{visibleActivityUnits.size||0}</strong></article>
        <article><span>{t.completed}</span><strong>{visibleActivities.filter((a)=>a.status==='completed').length}</strong></article>
      </section>

      <div className="calendar-tabs"><button className={view==='calendar'?'active':''} onClick={()=>setView('calendar')}>{t.calendar}</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}>{t.list}</button></div>

      {formOpen&&<form className="management-form-card calendar-form" onSubmit={save}>
        <div className="management-form-title"><div><small>{t.preliminary}</small><h2>{form.id?t.editTitle:t.newTitle}</h2></div><button type="button" onClick={()=>setFormOpen(false)}>{t.close}</button></div>
        <div className="management-form-grid">
          <label><span>{t.unit} *</span><select value={form.unit_id} disabled={Boolean(form.id)} onChange={(e)=>{const unitId=e.target.value;const plan=periodPlans.find((p)=>p.unit_id===unitId);const first=objectives.find((o)=>o.work_plan_id===plan?.id&&o.status!=='archived');setForm((c)=>({...c,unit_id:unitId,objective_id:first?.id||'',indicator_id:''}))}}>{units.filter((u)=>ownUnitIds.has(u.id)).map((u)=><option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select></label>
          <label><span>{t.status}</span><select value={form.status} onChange={(e)=>setForm((c)=>({...c,status:e.target.value}))}>{Object.entries(STATUS[language]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wide"><span>{t.activity} *</span><input value={form.title} onChange={(e)=>setForm((c)=>({...c,title:e.target.value}))} required /></label>
          <label><span>{t.objective} *</span><select value={form.objective_id} onChange={(e)=>setForm((c)=>({...c,objective_id:e.target.value,indicator_id:''}))} required><option value="">{t.selectObjective}</option>{objectives.filter((o)=>{const p=periodPlans.find((plan)=>plan.unit_id===form.unit_id);return o.work_plan_id===p?.id&&o.status!=='archived'}).map((o)=><option key={o.id} value={o.id}>{o.code} · {o.title}</option>)}</select></label>
          <label><span>{t.indicator}</span><select value={form.indicator_id} onChange={(e)=>setForm((c)=>({...c,indicator_id:e.target.value}))}><option value="">{t.optionalIndicator}</option>{formIndicators.map((i)=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
          <label><span>{t.start} *</span><input type="date" min={currentPeriod?.start_date} max={currentPeriod?.end_date} value={form.start_date} onChange={(e)=>setForm((c)=>({...c,start_date:e.target.value}))} required /></label>
          <label><span>{t.end}</span><input type="date" min={form.start_date||currentPeriod?.start_date} max={currentPeriod?.end_date} value={form.end_date} onChange={(e)=>setForm((c)=>({...c,end_date:e.target.value}))} /></label>
          <label><span>{t.responsible}</span><input value={form.responsible_name} onChange={(e)=>setForm((c)=>({...c,responsible_name:e.target.value}))} /></label>
          <label className="wide"><span>{t.description}</span><textarea value={form.description} onChange={(e)=>setForm((c)=>({...c,description:e.target.value}))} /></label>
        </div>
        {!selectedObjectives.length&&form.unit_id===selectedOwnUnitId&&<div className="calendar-plan-warning"><span>{t.noObjectives}</span><a href={`/app/management/objectives?period=${encodeURIComponent(periodId)}&unit=${encodeURIComponent(form.unit_id)}`}>{t.openPlan}</a></div>}
        <div className="management-form-actions"><button type="button" onClick={()=>setFormOpen(false)}>{t.cancel}</button><button className="primary" disabled={saving||!form.title.trim()||!form.objective_id}>{t.save}</button></div>
      </form>}

      {loading?<div className="management-loading"><span/><p>{t.loading}</p></div>:view==='calendar'?<section className="calendar-month-grid">
        {MONTHS[language].map((month,index)=>{
          const rows=visibleActivities.filter((a)=>Number(a.start_date?.slice(5,7))===index+1)
          return <article className="calendar-month-card" key={month}>
            <header><span>{String(index+1).padStart(2,'0')}</span><div><strong>{month}</strong><small>{MONTH_THEMES[language][index]}</small></div><b>{rows.length}</b></header>
            <div>{rows.length?rows.map((a)=>{const plan=plans.find((p)=>p.id===a.work_plan_id);const unit=units.find((u)=>u.id===plan?.unit_id);const objective=objectives.find((o)=>o.id===a.objective_id);const editable=Boolean(plan&&ownUnitIds.has(plan.unit_id));return <button type="button" className={`calendar-event ${a.status} ${editable?'editable':''}`} onClick={()=>editable&&openEdit(a)} key={a.id}><div><span>{formatDate(a.start_date,language)}</span><b>{unit?.code||''}</b></div><strong>{a.title}</strong><small>{objective?.code||''}{a.responsible_name?` · ${a.responsible_name}`:''}</small>{editable&&<em>{t.edit}</em>}</button>}):<p>{t.noActivities}</p>}</div>
          </article>
        })}
      </section>:<section className="calendar-list-card"><div className="calendar-list-head"><span>{t.date}</span><span>{t.activity}</span><span>{t.unit}</span><span>{t.objective}</span><span>{t.status}</span></div>{visibleActivities.length?visibleActivities.map((a)=>{const plan=plans.find((p)=>p.id===a.work_plan_id);const unit=units.find((u)=>u.id===plan?.unit_id);const objective=objectives.find((o)=>o.id===a.objective_id);return <div className="calendar-list-row" key={a.id}><span>{a.start_date}</span><strong>{a.title}</strong><span>{unit?.code||''}</span><span>{objective?.code||'—'}</span><b>{STATUS[language][a.status]||a.status}</b></div>}):<p className="calendar-empty-list">{t.noActivities}</p>}</section>}
    </div>
  </ManagementStandaloneShell>
}
