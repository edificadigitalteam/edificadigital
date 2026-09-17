import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from './ManagementStandaloneShell.jsx'
import './management-reports-executive.css'

const copy = {
  es: {
    eyebrow: 'DIRECCIÓN GENERAL', title: 'Consolidado de informes', intro: 'DIGEN tiene visión institucional de todas las Direcciones. Consulta cada informe y el consolidado del corte seleccionado.',
    year: 'Año de trabajo', window: 'Informe / corte', directions: 'Direcciones', submitted: 'Enviados', approved: 'Aprobados', pending: 'Pendientes', own: 'Mi informe DIGEN', print: 'Imprimir / PDF',
    consolidated: 'CONSOLIDADO INSTITUCIONAL', consolidatedTitle: 'Rendición de todas las Direcciones', noReport: 'Informe pendiente', summary: 'Resumen ejecutivo', statements: 'Resultados y declaraciones', challenges: 'Retos', next: 'Próximos pasos', noItems: 'Sin información registrada.',
    updated: 'Actualizado', loading: 'Cargando consolidado institucional…', route: 'Supervisión institucional', routeHelp: 'DIGEN visualiza la rendición de todas las Direcciones. La revisión y aprobación financiera continúa en DIAF.',
  },
  en: {
    eyebrow: 'GENERAL DIRECTORATE', title: 'Report consolidation', intro: 'DIGEN has institutional visibility across all directorates. Review each report and the consolidated reporting window.',
    year: 'Work year', window: 'Report / window', directions: 'Directorates', submitted: 'Submitted', approved: 'Approved', pending: 'Pending', own: 'My DIGEN report', print: 'Print / PDF',
    consolidated: 'INSTITUTIONAL CONSOLIDATED', consolidatedTitle: 'Accountability from all directorates', noReport: 'Report pending', summary: 'Executive summary', statements: 'Results and statements', challenges: 'Challenges', next: 'Next steps', noItems: 'No information recorded.',
    updated: 'Updated', loading: 'Loading institutional consolidated report…', route: 'Institutional oversight', routeHelp: 'DIGEN can view every directorate report. Financial review and approval remains with DIAF.',
  },
}
const statuses = {
  es: { draft: 'Borrador', submitted: 'Enviado a DIAF', reviewed: 'Revisado por DIAF', approved: 'Aprobado por DIAF', closed: 'Cerrado', none: 'Pendiente' },
  en: { draft: 'Draft', submitted: 'Sent to Finance', reviewed: 'Reviewed by Finance', approved: 'Approved by Finance', closed: 'Closed', none: 'Pending' },
}
function readLanguage(){try{return document.documentElement.lang==='en'||window.localStorage.getItem('edifica-language')==='en'?'en':'es'}catch{return'es'}}
function formatDate(value,language){if(!value)return'—';return new Intl.DateTimeFormat(language==='en'?'en-US':'es-VE',{dateStyle:'medium'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`))}

export default function ManagementReportsExecutivePage(){
  const access=useOperatorAccess()
  const [language,setLanguage]=useState(readLanguage)
  const t=copy[language]
  const [periods,setPeriods]=useState([])
  const [windows,setWindows]=useState([])
  const [units,setUnits]=useState([])
  const [reports,setReports]=useState([])
  const [items,setItems]=useState([])
  const [activePeriodId,setActivePeriodId]=useState('')
  const [activeWindowId,setActiveWindowId]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{const observer=new MutationObserver(()=>setLanguage(readLanguage()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});return()=>observer.disconnect()},[])

  const reload=useCallback(async()=>{
    if(!supabase||access.status!=='authorized'||!access.organizationId){setLoading(false);return}
    setLoading(true);setError('')
    const [periodResponse,windowResponse,unitResponse,reportResponse,itemResponse]=await Promise.all([
      supabase.from('management_period').select('*').eq('organization_id',access.organizationId).order('start_date',{ascending:false}),
      supabase.from('management_report_window').select('*').eq('organization_id',access.organizationId).eq('active',true).order('sort_order'),
      supabase.from('organization_unit').select('*').eq('organization_id',access.organizationId).eq('active',true).order('sort_order').order('name'),
      supabase.from('unit_management_report').select('*').eq('organization_id',access.organizationId).order('updated_at',{ascending:false}),
      supabase.from('unit_management_report_item').select('*').eq('organization_id',access.organizationId).order('sort_order'),
    ])
    const firstError=periodResponse.error||windowResponse.error||unitResponse.error||reportResponse.error||itemResponse.error
    if(firstError)setError(firstError.message)
    else{
      const periodRows=periodResponse.data??[]
      setPeriods(periodRows);setWindows(windowResponse.data??[]);setUnits(unitResponse.data??[]);setReports(reportResponse.data??[]);setItems(itemResponse.data??[])
      setActivePeriodId((current)=>current&&periodRows.some((row)=>row.id===current)?current:periodRows.find((row)=>row.status==='active')?.id||periodRows[0]?.id||'')
    }
    setLoading(false)
  },[access.organizationId,access.status])
  useEffect(()=>{reload()},[reload])

  const periodWindows=useMemo(()=>windows.filter((row)=>row.management_period_id===activePeriodId),[windows,activePeriodId])
  useEffect(()=>{if(!periodWindows.some((row)=>row.id===activeWindowId))setActiveWindowId(periodWindows[0]?.id||'')},[periodWindows,activeWindowId])
  const activeWindow=periodWindows.find((row)=>row.id===activeWindowId)
  const activePeriod=periods.find((row)=>row.id===activePeriodId)
  const directorates=useMemo(()=>units.filter((unit)=>unit.unit_type==='directorate'&&String(unit.code||'').toUpperCase()!=='DIGEN'),[units])
  const reportFor=useCallback((unitId)=>{
    const exact=reports.find((report)=>report.unit_id===unitId&&report.report_window_id===activeWindowId)
    if(exact)return exact
    if(activeWindow?.window_type==='annual')return reports.find((report)=>report.unit_id===unitId&&report.management_period_id===activePeriodId&&!report.report_window_id)
    return null
  },[reports,activeWindowId,activeWindow,activePeriodId])
  const currentReports=useMemo(()=>directorates.map((unit)=>reportFor(unit.id)).filter(Boolean),[directorates,reportFor])
  const submitted=currentReports.filter((report)=>['submitted','reviewed','approved','closed'].includes(report.status)).length
  const approved=currentReports.filter((report)=>['approved','closed'].includes(report.status)).length
  const pending=directorates.length-submitted
  const reportItems=(report,type)=>report?items.filter((item)=>item.report_id===report.id&&item.item_type===type).sort((a,b)=>a.sort_order-b.sort_order):[]

  if(access.status!=='authorized')return <OperatorAccessScreen access={access} copy={{languageLabel:language==='en'?'Language':'Idioma'}} language={language} onLanguageChange={()=>{}}/>

  return <ManagementStandaloneShell access={access}><div className="management-panel digen-reports-page">
    <div className="management-panel-heading no-print"><div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.intro}</span></div><div className="digen-heading-actions"><a href="/app/management/reports?scope=own">{t.own}</a><button onClick={()=>window.print()}>{t.print}</button></div></div>
    {error&&<p className="management-flash error">{error}</p>}
    {loading?<div className="management-loading"><span/><p>{t.loading}</p></div>:<>
      <section className="digen-report-route"><div><small>{t.route}</small><strong>DIGEN · Dirección General</strong></div><p>{t.routeHelp}</p></section>
      <section className="digen-report-filters no-print"><label><span>{t.year}</span><select value={activePeriodId} onChange={(event)=>{setActivePeriodId(event.target.value);setActiveWindowId('')}}>{periods.map((period)=><option key={period.id} value={period.id}>{period.name}</option>)}</select></label><label><span>{t.window}</span><select value={activeWindowId} onChange={(event)=>setActiveWindowId(event.target.value)}>{periodWindows.map((window)=><option key={window.id} value={window.id}>{window.title}</option>)}</select></label>{activeWindow&&<div><small>{activePeriod?.name}</small><strong>{formatDate(activeWindow.start_date,language)} — {formatDate(activeWindow.end_date,language)}</strong></div>}</section>
      <section className="digen-report-summary"><article><span>{t.directions}</span><strong>{directorates.length}</strong></article><article><span>{t.submitted}</span><strong>{submitted}</strong></article><article><span>{t.approved}</span><strong>{approved}</strong></article><article><span>{t.pending}</span><strong>{pending}</strong></article></section>
      <section className="digen-consolidated"><header><small>{t.consolidated}</small><h2>{t.consolidatedTitle}</h2><p>{activeWindow?.title} · {activePeriod?.name}</p></header><div className="digen-direction-list">{directorates.map((unit)=>{const report=reportFor(unit.id);const achievements=reportItems(report,'achievement');const challenges=reportItems(report,'challenge');const nextSteps=reportItems(report,'next_step');return <article className="digen-direction-report" key={unit.id}><header><span>{unit.code}</span><div><h3>{unit.name}</h3><small>{report?`${statuses[language][report.status]} · ${t.updated} ${formatDate(report.updated_at,language)}`:t.noReport}</small></div><b className={`report-state ${report?.status||'none'}`}>{statuses[language][report?.status||'none']}</b></header>{report?<div className="digen-report-body">{report.executive_summary&&<section><h4>{t.summary}</h4><p>{report.executive_summary}</p></section>}<section><h4>{t.statements}</h4>{achievements.length?<ol>{achievements.map((item)=><li key={item.id}>{item.statement}</li>)}</ol>:<p>{t.noItems}</p>}</section>{challenges.length>0&&<section><h4>{t.challenges}</h4><ol>{challenges.map((item)=><li key={item.id}>{item.statement}</li>)}</ol></section>}{nextSteps.length>0&&<section><h4>{t.next}</h4><ol>{nextSteps.map((item)=><li key={item.id}>{item.statement}</li>)}</ol></section>}</div>:<p className="digen-report-empty">{t.noReport}</p>}</article>})}</div></section>
    </>}
  </div></ManagementStandaloneShell>
}
