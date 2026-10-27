import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const dir=new URL('.',import.meta.url)
const screen=readFileSync(new URL('ManagementCalendarPage.jsx',dir),'utf8')
const presenter=readFileSync(new URL('CalendarPresentationView.jsx',dir),'utf8')

test('manual creation is permission gated and information uses its own table',()=>{
 assert.match(screen,/canManageNotices && <button/)
 assert.match(screen,/associationFormOpen && canManageNotices && <AssociationNoticeForm/)
 assert.match(screen,/\.from\('association_calendar_notice'\)\.insert/)
 assert.match(screen,/canManageAssociationNotices\(access,calendarAccess\)/)
})
test('all three formats show merged calendar activities and association ownership',()=>{
 assert.match(screen,/mergeCalendarActivities\(/)
 assert.match(screen,/presentation==='calendar'/)
 assert.match(screen,/presentation==='list'/)
 assert.match(screen,/<CalendarPresentationView/)
 assert.match(presenter,/informationOnly\?t.association/)
})
test('association entries are not routed through work plans or review RPC',()=>{
 assert.match(screen,/if \(isAssociationNotice\(activity\)\)/)
 assert.match(screen,/canReviewActivity = \(activity\)=>!isAssociationNotice\(activity\)/)
 assert.match(screen,/association_name:String\(draft.responsible_name/)
})
