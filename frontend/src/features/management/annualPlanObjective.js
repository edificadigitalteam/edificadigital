// Keep React form inputs as strings even when optional database columns are NULL.
const str=(value)=>String(value??'')

export function normalizeAnnualObjective(value) {
  const source=value&&typeof value==='object'?value:{}
  return {
    ...source,
    id:str(source.id),
    code:str(source.code),
    title:str(source.title),
    description:str(source.description),
    objective_level:str(source.objective_level)||'specific',
    weight:source.weight==null?'':source.weight,
    status:str(source.status)||'active',
  }
}

export function annualObjectiveFields(value) {
  const source=normalizeAnnualObjective(value)
  const rawWeight=source.weight
  const weight=rawWeight===''||rawWeight==null?null:Number(rawWeight)
  if(weight!==null&&(!Number.isFinite(weight)||weight<0||weight>100)) {
    throw new Error('El peso debe estar entre 0 y 100.')
  }
  return {
    title:source.title.trim(),
    description:source.description.trim()||null,
    objective_level:source.objective_level,
    weight,
    status:source.status,
  }
}

export function requiresResponsibleAssignment(assignments,objectiveId,unitId) {
  return !Array.isArray(assignments) || !assignments.some((row)=>
    row.objective_id===objectiveId && row.unit_id===unitId && row.assignment_type==='responsible'
  )
}
