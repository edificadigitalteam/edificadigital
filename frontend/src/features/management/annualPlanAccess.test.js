import test from 'node:test'
import assert from 'node:assert/strict'
import { annualPlanUnitScope, annualPlanCanEditUnit, expectedBoardWindows2027 } from './annualPlanAccess.js'

const units=[
  {id:'dicom',code:'DICOM',name:'Dirección de Comunicaciones'},
  {id:'diprom',code:'DIPROM',name:'Promoción'},
  {id:'digen',code:'DIGEN',name:'Director General'},
]
test('ordinary director only sees their own DICOM unit, regardless of all-tenant membership rows',()=>{
 const x=annualPlanUnitScope(units,{unit_ids:['dicom'],can_edit_consolidated:false},'operator')
 assert.deepEqual(x.units.map(row=>row.id),['dicom'])
 assert.equal(x.canViewAll,false)
 assert.equal(annualPlanCanEditUnit('dicom',x,'operator'),true)
 assert.equal(annualPlanCanEditUnit('diprom',x,'operator'),false)
})
test('tenant admins and permissioned institutional supervisors see all units, but cannot write outside RLS ownership',()=>{
 const admin=annualPlanUnitScope(units,{unit_ids:[]},'admin')
 assert.equal(admin.units.length,3)
 assert.equal(annualPlanCanEditUnit('diprom',admin,'admin'),true)
 const supervisor=annualPlanUnitScope(units,{unit_ids:['digen'],can_edit_consolidated:true},'operator')
 assert.equal(supervisor.units.length,3)
 assert.equal(annualPlanCanEditUnit('digen',supervisor,'operator'),true)
 assert.equal(annualPlanCanEditUnit('dicom',supervisor,'operator'),false)
})
test('no authorized membership must never display every Directorate by default',()=>{
 const x=annualPlanUnitScope(units,null,'operator')
 assert.deepEqual(x.units,[])
 assert.equal(x.canViewAll,false)
 assert.equal(annualPlanCanEditUnit('dicom',x,'operator'),false)
})
test('board windows for 2027 always describe all four dates, and statuses reflect actual DB records',()=>{
 const rows=expectedBoardWindows2027([{code:'MAR'},{code:'JUL'},{code:'NOV'}])
 assert.deepEqual(rows.map(row=>row.code),['MAR','JUL','NOV','ANNUAL'])
 assert.deepEqual(rows.map(row=>row.available),[true,true,true,false])
 assert.deepEqual(rows.map(row=>row.title),['Junta Ejecutiva · Marzo','Junta Ejecutiva · Julio','Junta Ejecutiva · Noviembre','Informe anual'])
 assert.equal(rows[3].start,'2027-01-01')
 assert.equal(rows[3].end,'2027-12-31')
})
