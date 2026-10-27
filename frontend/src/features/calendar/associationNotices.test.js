import test from 'node:test'
import assert from 'node:assert/strict'
import { canManageAssociationNotices, associationNoticeToActivity, associationNoticePayload, validateAssociationNotice, mergeCalendarActivities, isAssociationNotice } from './associationNotices.js'

test('institutional admin or calendar supervisor alone may create informational notices',()=>{
 assert.equal(canManageAssociationNotices({ role:'admin' },{}),true)
 assert.equal(canManageAssociationNotices({ role:'operator' },{can_edit_consolidated:true}),true)
 assert.equal(canManageAssociationNotices({ role:'operator' },{is_digen:true,can_edit_consolidated:false}),false)
 assert.equal(canManageAssociationNotices({ role:'operator' },{unit_ids:['unit-id']}),false)
 assert.equal(canManageAssociationNotices({role:'super_admin'},{}),false)
})
test('association notices are separate from directory units and show true association responsibility',()=>{
 const event=associationNoticeToActivity({id:'a',organization_id:'o',management_period_id:'p',title:'Asamblea de Barinas',start_date:'2027-02-14',end_date:null,association_name:'ASIBEB',description:'Encuentro anual'})
 assert.equal(event.activity_type,'association_notice')
 assert.equal(event.unit_id,null)
 assert.equal(event.work_plan_id,null)
 assert.equal(event.responsible_name,'ASIBEB')
 assert.equal(event.review_status,'informational')
 assert.equal(isAssociationNotice(event),true)
 assert.equal(isAssociationNotice({id:'ordinary',unit_id:'u'}),false)
})
test('informational events stay chronological alongside directorate work while preserving period filtering',()=>{
 const rows=mergeCalendarActivities(
  [{id:'regular',title:'Reunión',start_date:'2027-03-20',unit_id:'DIPROM'}],
  [{id:'info',title:'Asamblea',association_name:'ASIBEY',start_date:'2027-03-02',management_period_id:'2027'},
   {id:'wrong-year',title:'Histórica',association_name:'ASIBEB',start_date:'2026-03-02',management_period_id:'2026'}],
  '2027')
 assert.deepEqual(rows.map(r=>r.id),['info','regular'])
 assert.equal(rows[0].association_name,'ASIBEY')
 assert.equal(rows[0].review_status,'informational')
})
test('informational activity needs valid association, title and dates in target year',()=>{
 const period={id:'p',start_date:'2027-01-01',end_date:'2027-12-31'}
 const a={title:'Asamblea regional',association_name:'ASIBEB',start_date:'2027-02-03',end_date:''}
 assert.equal(validateAssociationNotice(a,period),'')
 assert.equal(validateAssociationNotice({...a,association_name:'  '},period),'missing')
 assert.equal(validateAssociationNotice({...a,title:''},period),'missing')
 assert.equal(validateAssociationNotice({...a,start_date:'2028-02-03'},period),'dates')
 assert.equal(validateAssociationNotice({...a,end_date:'2027-01-01'},period),'dates')
 assert.equal(validateAssociationNotice({...a,association_name:'x'.repeat(201)},period),'length')
 const payload=associationNoticePayload(a,{organizationId:'o',periodId:'p',userId:'u'})
 assert.deepEqual(Object.keys(payload).sort(),['association_name','created_by','description','end_date','management_period_id','organization_id','start_date','title','updated_by'].sort())
})
