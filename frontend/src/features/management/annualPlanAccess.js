import { requiredReportingWindows } from './reportFlow.js'

const writeRoles=new Set(['admin','super_admin'])

/** Selectors must use the signed-in operator's RPC unit_ids, never tenant-wide memberships. */
export function annualPlanUnitScope(units=[],overview={},role='operator') {
 const ownIds=new Set(Array.isArray(overview?.unit_ids)?overview.unit_ids:[])
 const canViewAll=writeRoles.has(role)||overview?.can_edit_consolidated===true
 const available=canViewAll?units:units.filter(u=>ownIds.has(u.id))
 // For ordinary operators with multiple memberships, prioritize their first
 // assigned Directorate, rather than expose the institutional directory.
 const primary=Array.isArray(overview?.unit_ids)?overview.unit_ids.find(id=>ownIds.has(id)&&available.some(u=>u.id===id)):''
 return {units:canViewAll?available:available.filter(u=>u.id===primary),canViewAll,ownIds}
}
export function annualPlanCanEditUnit(unitId,scope,role='operator') {
 return Boolean(unitId&&(writeRoles.has(role)||scope?.ownIds?.has(unitId)))
}
export function expectedBoardWindows2027(windows=[]) {
 const names={
 MAR:'Junta Ejecutiva · Marzo',
 JUL:'Junta Ejecutiva · Julio',
 NOV:'Junta Ejecutiva · Noviembre',
 ANNUAL:'Informe anual',
 }
 return requiredReportingWindows(2027).map(row=>({...row,title:names[row.code],available:windows.some(w=>w.code===row.code&&w.active!==false)}))
}
