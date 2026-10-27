import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const dir=new URL('.',import.meta.url)
const calendar=readFileSync(new URL('ManagementCalendarPage.jsx',dir),'utf8')
const presentation=readFileSync(new URL('CalendarPresentationView.jsx',dir),'utf8')
const styles=readFileSync(new URL('management-calendar.css',dir),'utf8')
const periodEditor=readFileSync(new URL('../management/OrganizationalManagementApp.jsx',dir),'utf8')

test('same annual heading is displayed on annual grid and list, plus fullscreen presentation',()=>{
 assert.match(calendar,/presentation !== 'presenter' && <CalendarYearHeader/)
 assert.match(calendar,/annualHeader=\{calendarYearHeader\}/)
 assert.match(presentation,/<CalendarYearHeader header=\{annualHeader\}/)
})
test('period editor preserves stored metadata and the calendar saves by period and organization',()=>{
 assert.match(periodEditor,/removeCalendarYearHeader\(period.notes\)/)
 assert.match(periodEditor,/writeCalendarYearHeader\(plainNotes,previousHeader\)/)
 assert.match(calendar,/\.eq\('id',activePeriod.id\)\.eq\('organization_id',organizationId\)/)
})
test('pending uses soft slate blue without changing reviewed green and observed red',()=>{
 assert.match(styles,/\.cnv-activity-row\.cnv-state-pending td\{background:#f0f5fa\}/)
 assert.match(styles,/\.cnv-status\.cnv-state-pending\{background:#e3edf7/)
 assert.match(styles,/\.cnv-activity-row\.cnv-state-validated/)
 assert.match(styles,/\.cnv-activity-row\.cnv-state-observed/)
})
