const FIELDS = ['calendar_title', 'five_year_plan', 'annual_pillar', 'bible_text']
const START = '\n<<EDIFICA_CALENDAR_HEADER_V1>>\n'
const END = '\n<</EDIFICA_CALENDAR_HEADER_V1>>'
const empty = () => ({ calendar_title:'', five_year_plan:'', annual_pillar:'', bible_text:'' })

function locate(notes) {
 const source=String(notes ?? '')
 if (!source.endsWith(END)) return null
 const start=source.lastIndexOf(START)
 if (start<0) return null
 const raw=source.slice(start+START.length,-END.length)
 try {
  const obj=JSON.parse(raw)
  if (!obj || typeof obj!=='object' || Array.isArray(obj)) return null
  return {source,start,obj}
 } catch {return null}
}

export function readCalendarYearHeader(notes) {
 const found=locate(notes)
 const result=empty()
 if (!found) return result
 for (const key of FIELDS) result[key]=typeof found.obj[key]==='string'?found.obj[key]:''
 return result
}

export function removeCalendarYearHeader(notes) {
 const found=locate(notes)
 return found ? found.source.slice(0,found.start) : String(notes ?? '')
}

export function writeCalendarYearHeader(notes,header) {
 const base=removeCalendarYearHeader(notes)
 const next=empty()
 for (const key of FIELDS) next[key]=String(header?.[key] ?? '').trim()
 return base+START+JSON.stringify(next)+END
}

export function calendarYearTitle(header,period,language='es') {
 const custom=String(header?.calendar_title ?? '').trim()
 if(custom) return custom
 const year=period?.start_date ? String(period.start_date).slice(0,4) : ''
 return language==='en' ? `CALENDAR PROJECT ${year}`.trim() : `PROYECTO DE CALENDARIO ${year}`.trim()
}

export function validateCalendarYearHeader(header) {
 const limits={ calendar_title:160, five_year_plan:250, annual_pillar:250, bible_text:500 }
 return FIELDS.every(key=>String(header?.[key]??'').length<=limits[key])
}
