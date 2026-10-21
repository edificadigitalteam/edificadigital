import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import ManagementStandaloneShell from '../management/ManagementStandaloneShell.jsx'
import './executive-evaluation.css'

const COMPETENCIES = [
  'Capacidad de relación, gestión y negociación',
  'Habilidad para trabajar en equipo',
  'Coordinación, organización y supervisión de personal',
  'Manejo de conflictos',
  'Liderazgo',
  'Habilidad para la toma de decisiones',
  'Buena redacción y fluidez verbal',
  'Destreza en el manejo de nuevas tecnologías',
  'Conocimientos en el área administrativa',
  'Conocimientos en planificación estratégica',
  'Conocimientos en técnicas de relaciones públicas',
  'Conocimientos en técnicas de redacción de informes',
  'Capacidad analítica y de interpretación',
  'Creatividad, proactividad e investigación',
  'Ética y desarrollo personal',
  'Capacidad para motivar',
  'Capacidad de organizar eventos',
  'Capacidad de resiliencia',
]
const EN_COMPETENCIES = [
  'Relationship building, management and negotiation',
  'Teamwork','Personnel coordination, organization and supervision',
  'Conflict management','Leadership','Decision-making skills',
  'Writing and verbal fluency','Technology proficiency',
  'Administrative knowledge','Strategic planning',
  'Public relations skills','Report writing techniques',
  'Analytical and interpretation skills',
  'Creativity, proactivity and research',
  'Ethics and personal development','Ability to motivate others',
  'Event organization','Resilience',
]
const SWOT = {
  es: [['strengths','Fortalezas'],['opportunities','Oportunidades'],['weaknesses','Debilidades'],['threats','Amenazas']],
  en: [['strengths','Strengths'],['opportunities','Opportunities'],['weaknesses','Weaknesses'],['threats','Threats']],
}
const RATINGS = ['strength_high','strength_medium','strength_low','weakness_high','weakness_medium','weakness_low']
const ratingLabels = { es:['Fortaleza alta','Fortaleza media','Fortaleza baja','Debilidad alta','Debilidad media','Debilidad baja'], en:['High strength','Medium strength','Low strength','High weakness','Medium weakness','Low weakness'] }
const txt = {
  es: { eyebrow:'GESTIÓN ORGANIZACIONAL',title:'Evaluación',intro:'Autoevaluación de titulares de posiciones ejecutivas. Completa el formulario en línea y envíalo a DIGEN.', period:'Gestión',unit:'Dirección / organización',new:'Nueva autoevaluación',save:'Guardar borrador',submit:'Enviar a DIGEN',sent:'Enviada a DIGEN',draft:'Borrador',pending:'Pendiente',my:'Mi autoevaluación',all:'Evaluaciones recibidas',subject:'Director(a) / presidente',date:'Fecha',place:'Lugar',entry:'Año de ingreso',number:'N.º período',swot:'Matriz DOFA',profile:'Perfil ocupacional',profileTip:'Marca un nivel por competencia, según corresponda a fortaleza o debilidad.',achievement:'Logros alcanzados en el período según los objetivos de la Dirección',strength:'Fortaleza',weakness:'Debilidad',high:'Alto',medium:'Medio',low:'Bajo',subtotal:'Subtotal',total:'Total valorado',none:'Sin valoración',view:'Ver evaluación',back:'Volver a mi evaluación',readonly:'Evaluación enviada. Se conserva como registro de rendición.',empty:'Todavía no hay autoevaluaciones enviadas.',confirm:'¿Enviar esta autoevaluación a DIGEN? Después del envío quedará en solo lectura.',saved:'Borrador guardado.',sentOk:'Autoevaluación enviada a DIGEN.',required:'Completa tu nombre antes de guardar.',access:'Tu usuario debe estar vinculado como director o responsable de una unidad para completar la autoevaluación.',loading:'Cargando evaluación…',digen:'Vista institucional de DIGEN',visibility:'Solo tú ves el borrador. DIGEN recibe la autoevaluación cuando la envías.',name:'Nombre completo',unitSummary:'Unidad evaluada',download:'Imprimir',fill:'Completar autoevaluación' },
  en: { eyebrow:'ORGANIZATIONAL MANAGEMENT',title:'Evaluation',intro:'Online self-assessment for executive office holders. Complete and submit to the General Director.', period:'Management year',unit:'Unit / organization',new:'New self-assessment',save:'Save draft',submit:'Send to General Director',sent:'Submitted',draft:'Draft',pending:'Pending',my:'My self-assessment',all:'Received evaluations',subject:'Director / president',date:'Date',place:'Location',entry:'Year joined',number:'Term number',swot:'SWOT matrix',profile:'Occupational profile',profileTip:'Choose one rating per competency, as a strength or weakness.',achievement:'Achievements during the term, aligned with unit objectives',strength:'Strength',weakness:'Weakness',high:'High',medium:'Medium',low:'Low',subtotal:'Subtotal',total:'Total rated',none:'Not rated',view:'View evaluation',back:'Back to my evaluation',readonly:'This submitted evaluation is kept as an accountability record.',empty:'No evaluations have been submitted yet.',confirm:'Submit this evaluation to the General Director? It becomes read-only.',saved:'Draft saved.',sentOk:'Evaluation submitted.',required:'Enter your name to save.',access:'Your account must be assigned as a director or unit manager to complete this assessment.',loading:'Loading evaluation…',digen:'General Director overview',visibility:'Only you can see the draft. The General Director receives it upon submission.',name:'Full name',unitSummary:'Evaluated unit',download:'Print',fill:'Complete self-assessment' },
}
const empty = () => ({
  id:'',director_name:'',evaluation_date:new Date().toISOString().slice(0,10),place:'',
  entry_year:'',period_number:'',swot:{strengths:['','',''],opportunities:['','',''],weaknesses:['','',''],threats:['','','']},
  skill_ratings:{},achievements:Array(7).fill(''),status:'draft'
})
function normalize(row){
  const basis=empty()
  if(!row)return basis
  return {...basis,...row,entry_year:row.entry_year??'',period_number:row.period_number??'',
    swot:Object.fromEntries(Object.keys(basis.swot).map(k=>[k,Array.from({length:3},(_,i)=>String(row.swot?.[k]?.[i]||''))])),
    skill_ratings:row.skill_ratings||{},
    achievements:Array.from({length:7},(_,i)=>String(row.achievements?.[i]||''))}
}
function languageNow(){ try{return document.documentElement.lang==='en'||localStorage.getItem('edifica-language')==='en'?'en':'es'}catch{return'es'} }

export default function ExecutiveEvaluationPage(){
  const access=useOperatorAccess()
  const [language,setLanguage]=useState(languageNow)
  const t=txt[language]
  const [periods,setPeriods]=useState([])
  const [units,setUnits]=useState([])
  const [periodId,setPeriodId]=useState('')
  const [unitId,setUnitId]=useState('')
  const [permission,setPermission]=useState({eligible_unit_ids:[],can_view_submitted:false})
  const [evaluations,setEvaluations]=useState([])
  const [selectedId,setSelectedId]=useState('')
  const [form,setForm]=useState(empty)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const org=access.organizationId||''
  useEffect(()=>{const obs=new MutationObserver(()=>setLanguage(languageNow()));obs.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});return()=>obs.disconnect()},[])
  const reload=useCallback(async()=>{
    if(access.status!=='authorized'||!org||!supabase)return
    setLoading(true);setError('')
    const responses=await Promise.all([
      supabase.rpc('executive_evaluation_access_overview',{target_organization_id:org}),
      supabase.from('management_period').select('id,name,start_date,end_date').eq('organization_id',org).order('start_date',{ascending:false}),
      supabase.from('organization_unit').select('id,code,name').eq('organization_id',org).eq('active',true).order('sort_order'),
      supabase.from('executive_self_evaluation').select('*').eq('organization_id',org).order('updated_at',{ascending:false})
    ])
    const issue=responses.find(r=>r.error)?.error
    if(issue){setError(issue.message);setLoading(false);return}
    setPermission(responses[0].data||{eligible_unit_ids:[],can_view_submitted:false})
    const ps=responses[1].data||[]
    setPeriods(ps);setUnits(responses[2].data||[]);setEvaluations(responses[3].data||[])
    setPeriodId(current=>ps.some(p=>p.id===current)?current:ps[0]?.id||'')
    setLoading(false)
  },[access.status,org])
  useEffect(()=>{reload()},[reload])
  const allowed=useMemo(()=>new Set(permission.eligible_unit_ids||[]),[permission.eligible_unit_ids])
  const ownUnits=units.filter(u=>allowed.has(u.id))
  useEffect(()=>{setUnitId(v=>ownUnits.some(u=>u.id===v)?v:ownUnits[0]?.id||'')},[permission.eligible_unit_ids,units])
  const ownEval=evaluations.find(e=>e.unit_id===unitId&&e.management_period_id===periodId&&e.created_by===access.userId)
  const selected=evaluations.find(e=>e.id===selectedId)
  const readOnly=Boolean(selectedId)||ownEval?.status==='submitted'
  const current=selected||ownEval
  useEffect(()=>{setForm(normalize(current))},[current?.id,current?.updated_at,unitId,periodId,selectedId])
  const visibleSubmitted=evaluations.filter(e=>e.status==='submitted'&&e.management_period_id===periodId)
  const unitName=(id)=>{const u=units.find(x=>x.id===id);return u?u.code+' · '+u.name:'—'}
  const setField=(name,value)=>setForm(prev=>({...prev,[name]:value}))
  const setSwot=(category,index,value)=>setForm(prev=>({...prev,swot:{...prev.swot,[category]:prev.swot[category].map((v,i)=>i===index?value:v)}}))
  const setRating=(index,value)=>setForm(prev=>({...prev,skill_ratings:{...prev.skill_ratings,[String(index+1)]:value}}))
  const setAchievement=(index,value)=>setForm(prev=>({...prev,achievements:prev.achievements.map((v,i)=>i===index?value:v)}))
  const counts=RATINGS.map(v=>Object.values(form.skill_ratings).filter(r=>r===v).length)
  const save=async(nextStatus)=>{
    if(!unitId||!periodId||saving||readOnly)return
    if(!form.director_name.trim()){setError(t.required);return}
    if(nextStatus==='submitted'&&!window.confirm(t.confirm))return
    setSaving(true);setError('');setNotice('')
    const payload={
      organization_id:org,management_period_id:periodId,unit_id:unitId,created_by:access.userId,
      director_name:form.director_name.trim(),evaluation_date:form.evaluation_date||null,place:form.place.trim()||null,
      entry_year:form.entry_year===''?null:Number(form.entry_year),period_number:form.period_number===''?null:Number(form.period_number),
      swot:Object.fromEntries(Object.keys(form.swot).map(k=>[k,form.swot[k].map(s=>s.trim())])),
      skill_ratings:form.skill_ratings,achievements:form.achievements.map(v=>v.trim()),status:nextStatus
    }
    const request=ownEval?.id?
      supabase.from('executive_self_evaluation').update(payload).eq('id',ownEval.id).select('id').single():
      supabase.from('executive_self_evaluation').insert(payload).select('id').single()
    const result=await request
    if(result.error)setError(result.error.message)
    else{setNotice(nextStatus==='submitted'?t.sentOk:t.saved);await reload()}
    setSaving(false)
  }
  if(access.status!=='authorized')return <OperatorAccessScreen access={access} language={language} onLanguageChange={()=>{}} copy={{languageLabel:language==='es'?'Idioma':'Language'}}/>
  const competencies=language==='es'?COMPETENCIES:EN_COMPETENCIES
  return <ManagementStandaloneShell access={access}><div className="management-panel executive-evaluation-page">
    <div className="management-panel-heading"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div></div>
    {error&&<p className="management-flash error" role="alert">{error}</p>}
    {notice&&<p className="management-flash success" role="status">{notice}</p>}
    {loading?<p>{t.loading}</p>:<>
      <section className="executive-evaluation-context">
        <label><span>{t.period}</span><select value={periodId} onChange={e=>{setPeriodId(e.target.value);setSelectedId('')}}>{periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label><span>{t.unit}</span><select value={unitId} disabled={Boolean(selectedId)||ownUnits.length<2} onChange={e=>{setUnitId(e.target.value);setSelectedId('')}}>{ownUnits.map(u=><option value={u.id} key={u.id}>{u.code} · {u.name}</option>)}</select></label>
        <div><strong>{readOnly?t.sent:t.draft}</strong><small>{t.visibility}</small></div>
      </section>
      {permission.can_view_submitted&&<section className="executive-evaluation-inbox">
        <div className="executive-evaluation-section-head"><div><small>{t.digen}</small><h2>{t.all}</h2></div><strong>{visibleSubmitted.length}</strong></div>
        <div className="executive-evaluation-records">{visibleSubmitted.length?visibleSubmitted.map(row=><button type="button" className={selectedId===row.id?'active':''} key={row.id} onClick={()=>setSelectedId(row.id)}>
          <span><b>{row.director_name}</b><small>{unitName(row.unit_id)} · {row.evaluation_date||'—'}</small></span><strong>{t.view} →</strong>
        </button>):<p>{t.empty}</p>}</div>
        {selectedId&&<button className="executive-evaluation-return" onClick={()=>setSelectedId('')}>{t.back}</button>}
      </section>}
      {selectedId||ownUnits.length>0?<section className="executive-evaluation-form">
        <div className="executive-evaluation-form-head"><div><small>{t.my}</small><h2>{selectedId?unitName(selected?.unit_id):unitName(unitId)}</h2><p>{readOnly?t.readonly:t.visibility}</p></div><span>{readOnly?t.sent:t.draft}</span></div>
        <div className="executive-evaluation-fields">
          <label className="wide"><span>{t.subject} *</span><input value={form.director_name} disabled={readOnly} onChange={e=>setField('director_name',e.target.value)} placeholder={t.name}/></label>
          <label><span>{t.date}</span><input type="date" value={form.evaluation_date||''} disabled={readOnly} onChange={e=>setField('evaluation_date',e.target.value)}/></label>
          <label><span>{t.place}</span><input value={form.place||''} disabled={readOnly} onChange={e=>setField('place',e.target.value)}/></label>
          <label><span>{t.entry}</span><input type="number" min="1900" max="2100" value={form.entry_year} disabled={readOnly} onChange={e=>setField('entry_year',e.target.value)}/></label>
          <label><span>{t.number}</span><input type="number" min="1" value={form.period_number} disabled={readOnly} onChange={e=>setField('period_number',e.target.value)}/></label>
        </div>
        <section className="executive-evaluation-card"><header><small>01</small><h3>{t.swot}</h3></header><div className="executive-evaluation-swot">{SWOT[language].map(([key,label])=><div key={key}><h4>{label}</h4>{form.swot[key].map((v,i)=><label key={i}><span>{i+1}.</span><input aria-label={label+' '+(i+1)} value={v} disabled={readOnly} onChange={e=>setSwot(key,i,e.target.value)}/></label>)}</div>)}</div></section>
        <section className="executive-evaluation-card"><header><small>02</small><h3>{t.profile}</h3><p>{t.profileTip}</p></header>
          <div className="executive-evaluation-table-scroll"><table className="executive-evaluation-skill-table"><thead><tr><th rowSpan="2">N.º</th><th rowSpan="2">{language==='es'?'Talento humano':'Competency'}</th><th colSpan="3">{t.strength}</th><th colSpan="3">{t.weakness}</th></tr><tr>{[t.high,t.medium,t.low,t.high,t.medium,t.low].map((v,i)=><th key={i}>{v}</th>)}</tr></thead><tbody>
            {competencies.map((competency,i)=><tr key={competency}><td>{i+1}</td><td>{competency}</td>{RATINGS.map((rating,j)=><td key={rating}><input type="radio" aria-label={competency+': '+ratingLabels[language][j]} name={'skill-'+i} checked={form.skill_ratings[String(i+1)]===rating} disabled={readOnly} onChange={()=>setRating(i,rating)}/></td>)}</tr>)}
          </tbody><tfoot><tr><td colSpan="2">{t.subtotal}</td>{counts.map((n,i)=><td key={i}>{n}</td>)}</tr><tr><td colSpan="2">{t.total}</td><td colSpan="6">{counts.reduce((a,b)=>a+b,0)} / 18</td></tr></tfoot></table></div>
        </section>
        <section className="executive-evaluation-card"><header><small>03</small><h3>{t.achievement}</h3></header><div className="executive-evaluation-achievements">{form.achievements.map((v,i)=><label key={i}><span>{i+1}</span><textarea rows="2" aria-label={t.achievement+' '+(i+1)} value={v} disabled={readOnly} onChange={e=>setAchievement(i,e.target.value)}/></label>)}</div></section>
        <div className="executive-evaluation-actions"><button type="button" className="secondary" onClick={()=>window.print()}>{t.download}</button>{!readOnly&&<><button type="button" className="secondary" disabled={saving} onClick={()=>save('draft')}>{t.save}</button><button type="button" className="primary" disabled={saving} onClick={()=>save('submitted')}>{saving?'…':t.submit}</button></>}</div>
      </section>:<p className="management-flash error">{t.access}</p>}
    </>}
  </div></ManagementStandaloneShell>
}
