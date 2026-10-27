import { useEffect, useState } from 'react'
import { calendarYearTitle, validateCalendarYearHeader } from './annualHeader.js'

const labels={
 es:{ plan:'Plan quinquenal',pillar:'Pilar anual',bible:'Texto Bíblico',edit:'Editar encabezado',save:'Guardar encabezado',cancel:'Cancelar',saving:'Guardando…',error:'El texto supera la longitud permitida.',title:'Título del proyecto de calendario',saved:'Encabezado guardado.' },
 en:{ plan:'Five-year plan',pillar:'Annual pillar',bible:'Bible verse',edit:'Edit heading',save:'Save heading',cancel:'Cancel',saving:'Saving…',error:'One of the fields is too long.',title:'Calendar project title',saved:'Heading saved.' },
}
export default function CalendarYearHeader({header,period,language='es',canEdit=false,onSave,saving=false,compact=false}) {
 const t=labels[language]||labels.es
 const [editing,setEditing]=useState(false)
 const [draft,setDraft]=useState(header)
 const [error,setError]=useState('')
 useEffect(()=>{setDraft(header);setEditing(false);setError('')},[header,period?.id])
 const save=async(event)=>{
  event.preventDefault()
  if(!canEdit||saving) return
  if(!validateCalendarYearHeader(draft)){setError(t.error);return}
  setError('')
  const ok=await onSave(draft)
  if(ok) setEditing(false)
 }
 return <section className={'calendar-annual-header'+(compact?' is-compact':'')} aria-label={calendarYearTitle(header,period,language)}>
   <div className="calendar-annual-header-top">
     <div>
       <h2>{calendarYearTitle(header,period,language)}</h2>
       <div className="calendar-annual-header-details">
         <p><strong>{t.plan}:</strong> <span>{header?.five_year_plan||'—'}</span></p>
         <p><strong>{t.pillar}:</strong> <span>{header?.annual_pillar||'—'}</span></p>
         <p><strong>{t.bible}:</strong> <span>{header?.bible_text||'—'}</span></p>
       </div>
     </div>
     {canEdit&&<button type="button" className="calendar-header-edit-toggle" onClick={()=>{setEditing(v=>!v);setDraft(header);setError('')}} disabled={saving} title={t.edit}>{editing?t.cancel:t.edit}</button>}
   </div>
   {editing&&canEdit&&<form className="calendar-header-editor" onSubmit={save}>
     <label>{t.title}<input maxLength={160} value={draft?.calendar_title||''} placeholder={calendarYearTitle({},period,language)} onChange={e=>setDraft(v=>({...v,calendar_title:e.target.value}))}/></label>
     <label>{t.plan}<input maxLength={250} value={draft?.five_year_plan||''} onChange={e=>setDraft(v=>({...v,five_year_plan:e.target.value}))}/></label>
     <label>{t.pillar}<input maxLength={250} value={draft?.annual_pillar||''} onChange={e=>setDraft(v=>({...v,annual_pillar:e.target.value}))}/></label>
     <label>{t.bible}<textarea maxLength={500} rows={2} value={draft?.bible_text||''} onChange={e=>setDraft(v=>({...v,bible_text:e.target.value}))}/></label>
     {error&&<p role="alert" className="calendar-header-error">{error}</p>}
     <div className="calendar-header-actions"><button type="button" onClick={()=>{setEditing(false);setError('')}}>{t.cancel}</button><button type="submit" className="primary" disabled={saving}>{saving?t.saving:t.save}</button></div>
   </form>}
 </section>
}
