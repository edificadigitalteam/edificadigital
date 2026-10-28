/** Management reports: drafts are deliberately less strict than final submissions. */
export function reportCanSaveDraft({windowId,unitId,saving=false}={}) {
 return Boolean(windowId && unitId && !saving)
}
export function reportCanSubmit(statements=[],availableIndicators=[]) {
 const actual=statements.filter(row=>String(row.statement||'').trim())
 return actual.length>0 && actual.every(row=>{
  if(!row.objective_id && !row.indicator_id) return false
  const hasIndicators=availableIndicators.some(i=>i.objective_id===row.objective_id)
  return !hasIndicators||Boolean(row.indicator_id)
 })
}
const date=(year,month,day)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
export function requiredReportingWindows(year) {
 const y=Number(year)
 if(!Number.isInteger(y)||y<2000||y>2100)return []
 return [
  {code:'MAR',start:date(y,1,1),end:date(y,3,31)},
  {code:'JUL',start:date(y,4,1),end:date(y,7,31)},
  {code:'NOV',start:date(y,8,1),end:date(y,11,30)},
  {code:'ANNUAL',start:date(y,1,1),end:date(y,12,31)}
 ]
}
export function isCalendarCutComplete(windows=[]) {
 return ['MAR','JUL','NOV','ANNUAL'].every(code=>windows.some(row=>row.code===code))
}
export const NEXT_STEPS_HELP_ES='Indica las acciones concretas que esta Dirección realizará en el próximo período, preferiblemente con fecha y responsable. Ejemplo: «Capacitar a los tesoreros de las asociaciones durante abril, responsable: equipo DIAF».'
export const NEXT_STEPS_HELP_EN='Describe concrete actions your unit will carry out next period, ideally with a date and owner. Example: “Train association treasurers during April; responsible: finance team”.'
