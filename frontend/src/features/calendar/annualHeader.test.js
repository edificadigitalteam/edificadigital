import test from 'node:test'
import assert from 'node:assert/strict'
import { readCalendarYearHeader, writeCalendarYearHeader, removeCalendarYearHeader, calendarYearTitle } from './annualHeader.js'

test('each period stores its own four-year-header fields without losing existing notes', () => {
 const old='Observaciones previas del período.\nDetalle histórico.'
 const a={ calendar_title:'Proyecto de Calendario 2027',five_year_plan:'Creciendo a la medida de Dios',annual_pillar:'Crecimiento espiritual',bible_text:'Colosenses 2:19' }
 const stored=writeCalendarYearHeader(old,a)
 assert.deepEqual(readCalendarYearHeader(stored),a)
 assert.equal(removeCalendarYearHeader(stored),old)
 assert.deepEqual(readCalendarYearHeader(old),{ calendar_title:'',five_year_plan:'',annual_pillar:'',bible_text:''})
 assert.deepEqual(readCalendarYearHeader(writeCalendarYearHeader(stored,{...a,annual_pillar:'Oración'})).annual_pillar,'Oración')
 assert.equal(removeCalendarYearHeader(writeCalendarYearHeader(stored,a)),old)
})
test('period editor can save ordinary notes without losing calendar metadata',()=>{
 const old=writeCalendarYearHeader('Histórico',{calendar_title:'Calendario 2026',five_year_plan:'Plan',annual_pillar:'Pilar',bible_text:'Texto'})
 const changed=writeCalendarYearHeader('Notas modificadas',readCalendarYearHeader(old))
 assert.equal(removeCalendarYearHeader(changed),'Notas modificadas')
 assert.equal(readCalendarYearHeader(changed).annual_pillar,'Pilar')
})
test('calendar annual title defaults to year without inventing strategy',()=>{
 assert.equal(calendarYearTitle({}, {start_date:'2027-01-01'},'es'),'PROYECTO DE CALENDARIO 2027')
 assert.equal(calendarYearTitle({calendar_title:'  Calendario institucional  '},{start_date:'2027-01-01'},'es'),'Calendario institucional')
 assert.equal(calendarYearTitle({}, {start_date:'2027-01-01'},'en'),'CALENDAR PROJECT 2027')
})
test('invalid or unrelated notes remain unmodified and valid inputs are trimmed',()=>{
 const text='\n### unstructured note {"x":1}'
 assert.equal(removeCalendarYearHeader(text),text)
 assert.equal(readCalendarYearHeader(text).five_year_plan,'')
 assert.equal(readCalendarYearHeader(writeCalendarYearHeader(text,{annual_pillar:'  Educación cristiana  '})).annual_pillar,'Educación cristiana')
})
