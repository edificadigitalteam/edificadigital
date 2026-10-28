import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root=new URL('.',import.meta.url)
const page=readFileSync(new URL('./ManagementAnnualPlanPage.jsx',root),'utf8')
const report=readFileSync(new URL('./ManagementReportsUnifiedPage.jsx',root),'utf8')
const style=readFileSync(new URL('./management-reports-tablet.css',root),'utf8')

test('unit selector uses current operator access RPC, not tenant-wide membership list',()=>{
 assert.match(page,/rpc\('calendar_access_overview'/)
 assert.match(page,/annualPlanUnitScope\(units,operatorUnitOverview,access.role\)/)
 assert.doesNotMatch(page,/memberships\.filter\(\(item\)=>\['director','manager','operator','reviewer'\]/)
 assert.match(page,/disabled=\{!scopedUnits\.canViewAll \|\| visibleUnits\.length<=1\}/)
})
test('new annual plan uses INSERT, never UPSERT with UPDATE RLS requirement',()=>{
 assert.doesNotMatch(page,/from\('unit_work_plan'\)\.upsert/)
 assert.match(page,/from\('unit_work_plan'\)\.insert/)
 assert.match(page,/active Directorate membership|asignación activa/)
})
test('2027 four report windows are rendered with accurate database activation status',()=>{
 assert.match(page,/expectedBoardWindows2027\(/)
 assert.match(page,/year2027Cuts\.map/)
 assert.match(page,/Pendiente de habilitar/)
 assert.match(page,/Habilitar cortes e informe anual 2027/)
})
test('next-steps help is compact accessible popover and does not stretch Add',()=>{
 assert.match(report,/<details className="report-next-help-control">/)
 assert.match(report,/<summary aria-label=/)
 assert.doesNotMatch(report,/<p className="report-next-help">/)
 assert.match(style,/\.report-next-help-popup\{position:absolute/)
 assert.match(style,/\.report-next-help-control:hover/)
 assert.match(style,/\.report-next-help-control:focus-within/)
})
