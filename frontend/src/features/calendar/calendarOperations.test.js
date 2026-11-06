import test from 'node:test'
import assert from 'node:assert/strict'
import { canDeleteCalendarActivity, resolveCalendarResponsibilityUpdate, calendarPdfFilename } from './calendarOperations.js'
import { buildCalendarPdfDefinition } from './calendarPdf.js'

const units=[{id:'diprom',code:'DIPROM',name:'Dirección de Promociones'},{id:'dicom',code:'DICOM',name:'Dirección de Comunicaciones'}]
const plans=[{id:'p1',unit_id:'diprom',management_period_id:'2027'},{id:'p2',unit_id:'dicom',management_period_id:'2027'}]
const regular={id:'act',title:'Vigilia nacional',unit_id:'diprom',work_plan_id:'p1',objective_id:'obj',indicator_id:'ind',review_status:'observed',start_date:'2027-01-12',end_date:null,responsible_name:'Equipo DIPROM'}
const association={id:'notice',activity_type:'association_notice',review_status:'informational',title:'Asamblea de Asociación',association_name:'ASIBEB',start_date:'2027-04-14',end_date:null}

test('a DIPROM member can delete a DIPROM observed activity; cross-unit requires tenant admin',()=>{
 assert.equal(canDeleteCalendarActivity(regular,{unit_ids:['diprom'],can_delete_consolidated:false},false),true)
 assert.equal(canDeleteCalendarActivity({...regular,unit_id:'dicom'},{unit_ids:['diprom'],can_edit_consolidated:true,can_delete_consolidated:false},false),false)
 assert.equal(canDeleteCalendarActivity({...regular,unit_id:'dicom'},{unit_ids:['diprom'],can_delete_consolidated:true},false),true)
 assert.equal(canDeleteCalendarActivity(association,{unit_ids:['diprom'],can_delete_consolidated:false},true),true)
 assert.equal(canDeleteCalendarActivity(association,{unit_ids:['diprom'],can_delete_consolidated:false},false),false)
})

test('change responsible person in the same unit without breaking objective links or review',()=>{
 assert.deepEqual(resolveCalendarResponsibilityUpdate(regular,{unit_id:'diprom',responsible_name:'  Coordinación de Oración  '},plans,'2027',false),{
  work_plan_id:'p1',responsible_name:'Coordinación de Oración',
 })
})
test('authorized supervisor may reassign Directorate, clearing incompatible objective/indicator and review',()=>{
 assert.deepEqual(resolveCalendarResponsibilityUpdate(regular,{unit_id:'dicom',responsible_name:'Dirección de Comunicaciones'},plans,'2027',true),{
  work_plan_id:'p2',responsible_name:'Dirección de Comunicaciones',objective_id:null,indicator_id:null,
  review_status:'pending',review_note:null,reviewed_at:null,reviewed_by:null,
 })
 assert.throws(()=>resolveCalendarResponsibilityUpdate(regular,{unit_id:'dicom'},plans,'2027',false),/permissions/)
 assert.throws(()=>resolveCalendarResponsibilityUpdate(regular,{unit_id:'dicom'},plans,'2026',true),/plan/)
})
test('PDF has twelve months, carries the institutional header and retains observed status and owners',()=>{
 const periods={id:'2027',start_date:'2027-01-01',name:'Gestión 2027'}
 const notices=[regular,association]
 const doc=buildCalendarPdfDefinition({organizationName:'Convención Nacional Bautista de Venezuela',period:periods,
   header:{calendar_title:'PROYECTO DE CALENDARIO 2027',five_year_plan:'Edificando juntos',annual_pillar:'Servicio',bible_text:'Efesios 4:12'},
   activities:notices,units,language:'es',scopeLabel:'Consolidado institucional',generatedAt:new Date('2026-11-06T12:30:00.000Z')})
 assert.equal(doc.pageOrientation,'landscape')
 assert.equal(doc.pageSize,'A4')
 const s=JSON.stringify(doc.content)
 assert.match(s,/Edificando juntos/)
 assert.match(s,/Efesios 4:12/)
 assert.match(s,/OBSERVADA|Observada/)
 assert.match(s,/DIPROM/)
 assert.match(s,/ASIBEB/)
 for(const month of ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])assert.ok(s.includes(month),month)
 assert.equal((s.match(/\"monthSection\"/g)||[]).length,12)
 assert.match(calendarPdfFilename(periods,'es'),/2027.*\.pdf$/)
})
