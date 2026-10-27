import { useState } from 'react'
import { validateAssociationNotice } from './associationNotices.js'

const blank=()=>({title:'',association_name:'',start_date:'',end_date:'',description:''})
const words={
 es:{new:'Nueva actividad informativa',edit:'Editar actividad informativa',notice:'Actividad institucional informativa de asociación; no pertenece a una Dirección.',title:'Actividad',association:'Asociación responsable',start:'Desde',end:'Hasta (opcional)',details:'Detalles',save:'Guardar actividad informativa',saving:'Guardando…',cancel:'Cancelar',missing:'Indica actividad, asociación responsable y fecha de inicio.',dates:'Las fechas deben estar dentro de la gestión seleccionada.',length:'La información supera la longitud permitida.'},
 en:{new:'New association notice',edit:'Edit association notice',notice:'Institutional association information; not owned by a Directorate.',title:'Activity',association:'Responsible association',start:'From',end:'Through (optional)',details:'Notes',save:'Save association notice',saving:'Saving…',cancel:'Cancel',missing:'Activity, responsible association and start date are required.',dates:'Dates must be within the selected management year.',length:'Field exceeds the allowed length.'},
}
export default function AssociationNoticeForm({initial=null,period,language='es',saving=false,onSave,onCancel}) {
 const t=words[language]||words.es
 const [value,setValue]=useState(()=>initial?{title:initial.title||'',association_name:initial.association_name||'',start_date:initial.start_date||'',end_date:initial.end_date||'',description:initial.description||''}:blank())
 const [issue,setIssue]=useState('')
 const set=(key,next)=>setValue(current=>({...current,[key]:next}))
 const submit=(event)=>{
   event.preventDefault()
   const result=validateAssociationNotice(value,period)
   if(result){setIssue(t[result]||t.dates);return}
   setIssue('')
   onSave(value,initial)
 }
 return <form className="management-form-card calendar-association-form" onSubmit={submit}>
  <div className="management-form-title"><div><small>{period?.name||''} · {t.notice}</small><h2>{initial?.id?t.edit:t.new}</h2></div><button type="button" onClick={onCancel}>{t.cancel}</button></div>
  <div className="management-form-grid">
   <label className="wide"><span>{t.title} *</span><input autoFocus required maxLength={300} value={value.title} onChange={e=>set('title',e.target.value)}/></label>
   <label className="wide"><span>{t.association} *</span><input required maxLength={200} value={value.association_name} onChange={e=>set('association_name',e.target.value)} placeholder={language==='en'?'e.g. ASIBEB — Barinas':'Ej.: ASIBEB · Barinas'}/></label>
   <label><span>{t.start} *</span><input required type="date" min={period?.start_date} max={period?.end_date} value={value.start_date} onChange={e=>set('start_date',e.target.value)}/></label>
   <label><span>{t.end}</span><input type="date" min={value.start_date||period?.start_date} max={period?.end_date} value={value.end_date} onChange={e=>set('end_date',e.target.value)}/></label>
   <label className="wide"><span>{t.details}</span><textarea maxLength={2000} value={value.description} onChange={e=>set('description',e.target.value)}/></label>
  </div>
  {issue&&<p className="management-flash error" role="alert">{issue}</p>}
  <div className="management-form-actions"><button type="button" onClick={onCancel}>{t.cancel}</button><button className="primary" type="submit" disabled={saving}>{saving?t.saving:t.save}</button></div>
 </form>
}
