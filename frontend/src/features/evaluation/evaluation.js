export const EXECUTIVE_COMPETENCIES = [
  'Capacidad de relación, gestión y negociación',
  'Habilidad para trabajar en equipo',
  'Coordinación, organización y supervisión de personal',
  'Manejo de conflictos',
  'Liderazgo',
  'Habilidad para tomar decisiones',
  'Buena redacción y fluidez verbal',
  'Destreza en el manejo de nuevas tecnologías',
  'Conocimientos en el área administrativa',
  'Conocimientos en planificación estratégica',
  'Conocimientos en técnicas de relaciones públicas',
  'Conocimientos en técnicas de redacción de informes',
  'Capacidad analítica y de interpretación',
  'Creatividad, proactividad e investigación',
  'Ética y desarrollo personal',
  'Capacidad para motivar',
  'Capacidad de organizar eventos',
  'Capacidad de resiliencia',
]

export const SWOT_GROUPS = ['strengths', 'opportunities', 'weaknesses', 'threats']
export const COMPETENCY_RATINGS = [
  'strength_high', 'strength_medium', 'strength_low',
  'weakness_high', 'weakness_medium', 'weakness_low',
]
const triple = () => ['', '', '']
export function blankEvaluation(displayName = '') {
  return {
    director_name: displayName, year_joined: '', period_number: '',
    evaluation_date: new Date().toISOString().slice(0, 10),
    location: '',
    swot: Object.fromEntries(SWOT_GROUPS.map((group) => [group, triple()])),
    competencies: {},
    achievements: Array.from({ length: 7 }, () => ''),
  }
}
export function normalizeEvaluation(row, displayName = '') {
  const fresh = blankEvaluation(displayName)
  if (!row) return fresh
  return {
    ...fresh,
    director_name: row.director_name || displayName,
    year_joined: row.year_joined ?? '',
    period_number: row.period_number ?? '',
    evaluation_date: row.evaluation_date || fresh.evaluation_date,
    location: row.location || '',
    swot: Object.fromEntries(SWOT_GROUPS.map((group) => [
      group, Array.from({ length: 3 }, (_, index) => String(row.swot?.[group]?.[index] || '')),
    ])),
    competencies: row.competencies || {},
    achievements: Array.from({ length: 7 }, (_, index) => String(row.achievements?.[index] || '')),
  }
}
export function evaluationPayload(form) {
  return {
    director_name: String(form.director_name || '').trim(),
    year_joined: form.year_joined === '' ? null : Number(form.year_joined),
    period_number: form.period_number === '' ? null : Number(form.period_number),
    evaluation_date: form.evaluation_date,
    location: String(form.location || '').trim(),
    swot: Object.fromEntries(SWOT_GROUPS.map((group) => [group,
      (form.swot?.[group] || triple()).slice(0, 3).map((value) => String(value || '').trim()),
    ])),
    competencies: Object.fromEntries(
      Object.entries(form.competencies || {}).filter(([key, value]) =>
        Number(key) >= 1 && Number(key) <= 18 && COMPETENCY_RATINGS.includes(value)),
    ),
    achievements: Array.from({ length: 7 }, (_, index) => String(form.achievements?.[index] || '').trim()),
  }
}
export function evaluationIsComplete(form) {
  const payload = evaluationPayload(form)
  return Boolean(
    payload.director_name && payload.location && payload.evaluation_date
    && Number.isInteger(payload.year_joined) && payload.year_joined >= 1900 && payload.year_joined <= 2100
    && Number.isInteger(payload.period_number) && payload.period_number >= 1
    && EXECUTIVE_COMPETENCIES.every((_, index) => COMPETENCY_RATINGS.includes(payload.competencies[index + 1])),
  )
}
export function evaluationRatingCounts(competencies = {}) {
  const values = Object.values(competencies)
  return {
    strengths: values.filter((value) => String(value).startsWith('strength_')).length,
    weaknesses: values.filter((value) => String(value).startsWith('weakness_')).length,
    completed: values.filter((value) => COMPETENCY_RATINGS.includes(value)).length,
  }
}

// Rows shown in the "Evaluaciones recibidas" collection for one period: submitted ones,
// plus drafts for the tenant admin (can_read_draft_evaluations). RLS decides what arrives.
export function evaluationsForCollection(rows, periodId, { includeDrafts = false } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row.management_period_id === periodId)
    .filter((row) => includeDrafts || row.status === 'submitted')
}
