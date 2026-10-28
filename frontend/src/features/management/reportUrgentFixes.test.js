import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reportCanSaveDraft, reportCanSubmit, requiredReportingWindows, isCalendarCutComplete } from './reportFlow.js'
const here=new URL('.',import.meta.url)
const create=readFileSync(new URL('ManagementReportCreatePage.jsx',here),'utf8')
const unified=readFileSync(new URL('ManagementReportsUnifiedPage.jsx',here),'utf8')
const annual=readFileSync(new URL('ManagementAnnualPlanPage.jsx',here),'utf8')
const responsive=readFileSync(new URL('management-reports-tablet.css',here),'utf8')

test('drafts are allowed at the very beginning, submitted reports require linked outcomes',()=>{
 assert.equal(reportCanSaveDraft({ windowId:'w',unitId:'u',saving:false}),true)
 assert.equal(reportCanSaveDraft({ windowId:'',unitId:'u'}),false)
 assert.equal(reportCanSaveDraft({ windowId:'w',unitId:'u',saving:true}),false)
 assert.equal(reportCanSubmit([{statement:'',objective_id:''}],[]),false)
 assert.equal(reportCanSubmit([{statement:'Logro',objective_id:'o'}],[]),true)
 assert.equal(reportCanSubmit([{statement:'Logro',objective_id:''}],[]),false)
 assert.equal(reportCanSubmit([{statement:'Logro',objective_id:'o',indicator_id:''}],[{objective_id:'o'}]),false)
})
test('2027 windows are March/July/November and complete annual calendar',()=>{
 const windows=requiredReportingWindows(2027)
 assert.deepEqual(windows.map(w=>w.code),['MAR','JUL','NOV','ANNUAL'])
 assert.deepEqual(windows.map(w=>[w.start,w.end]),[
  ['2027-01-01','2027-03-31'],['2027-04-01','2027-07-31'],
  ['2027-08-01','2027-11-30'],['2027-01-01','2027-12-31']])
 assert.equal(isCalendarCutComplete([{code:'MAR'},{code:'JUL'},{code:'NOV'}]),false)
 assert.equal(isCalendarCutComplete(windows),true)
})
test('report editor draft is never gated on existing objectives',()=>{
 assert.doesNotMatch(create,/disabled=\{saving \|\| !unitObjectives.length\}/)
 assert.match(create,/reportCanSaveDraft\(/)
 assert.match(unified,/reportCanSaveDraft\(/)
 assert.match(unified,/reportCanSubmit\(/)
})
test('annual plan links users to Calendar instead of creating a second activity form',()=>{
 assert.doesNotMatch(annual,/onClick=\{\(\)=>openNewActivity/)
 assert.match(annual,/\/app\/management\/calendar/)
})
test('tablet CSS constrains every report grid and calendar panel',()=>{
 assert.match(responsive,/@media\s*\(min-width:\s*700px\)\s*and\s*\(max-width:\s*1180px\)/)
 assert.match(responsive,/min-width:\s*0/)
 assert.match(responsive,/max-width:\s*100%/)
})
