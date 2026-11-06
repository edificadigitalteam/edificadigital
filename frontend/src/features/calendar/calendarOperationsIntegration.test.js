import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const dir=new URL('.',import.meta.url)
const screen=readFileSync(new URL('ManagementCalendarPage.jsx',dir),'utf8')
const presenter=readFileSync(new URL('CalendarPresentationView.jsx',dir),'utf8')
const pdf=readFileSync(new URL('calendarPdf.js',dir),'utf8')

test('three calendar views expose activity delete with existing RLS-backed permissions',()=>{
 assert.match(screen,/canDeleteCalendarActivity\(/)
 assert.match(screen,/window\.confirm\(/)
 assert.match(screen,/\.from\('unit_work_activity'\)\.delete\(\)/)
 assert.match(screen,/\.from\('association_calendar_notice'\)\.delete\(\)/)
 assert.match(screen,/\.select\('id'\)\.maybeSingle\(\)/)
 assert.match(screen,/onClick=\{\(\)=>deleteCalendarActivity\(activity\)\}/)
 assert.match(presenter,/onDelete\(activity\)/)
})
test('presenter and standard editor allow authorized change of Directorate and person',()=>{
 assert.match(screen,/resolveCalendarResponsibilityUpdate\(/)
 assert.match(screen,/periodPlans\.find/)
 assert.match(screen,/canReassignResponsibleUnit/)
 assert.match(presenter,/responsibleUnitOptions/)
 assert.match(presenter,/responsible_name/)
})
test('PDF backup downloads in current scope, and is available in presentation too',()=>{
 assert.match(screen,/pdfMake\.createPdf\(doc\)\.getBlob/)
 assert.match(screen,/downloadPdf/)
 assert.match(screen,/onDownloadPdf=\{downloadPdf\}/)
 assert.match(presenter,/onDownloadPdf/)
 assert.match(pdf,/pageOrientation:'landscape'/)
})
