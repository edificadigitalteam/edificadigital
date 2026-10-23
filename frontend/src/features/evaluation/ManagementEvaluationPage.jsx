import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { OperatorAccessScreen } from '../in-kind/OperatorAccess.jsx'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import ManagementStandaloneShell from '../management/ManagementStandaloneShell.jsx'
import {
  EXECUTIVE_COMPETENCIES, SWOT_GROUPS, COMPETENCY_RATINGS,
  blankEvaluation, normalizeEvaluation, evaluationIsComplete,
  evaluationPayload, evaluationRatingCounts, evaluationsForCollection, eligibleEvaluationUnits, isEvaluationResultUnit } from './evaluation.js'
import './management-evaluation.css'

const competencyEn = [
  'Relationship management and negotiation', 'Teamwork',
  'Personnel coordination, organization and supervision', 'Conflict management',
  'Leadership', 'Decision-making', 'Written and verbal communication',
  'New technologies', 'Administrative knowledge', 'Strategic planning',
  'Public relations', 'Report writing', 'Analytical and interpretive skills',
  'Creativity, initiative and research', 'Ethics and personal development',
  'Motivating others', 'Event organization', 'Resilience',
]
const messages = {
  es: {
    eyebrow: 'CONTROL Y RENDICIÓN', title: 'Evaluación', intro: 'Autoevaluación ejecutiva institucional. Cada Dirección completa su autoevaluación institucional; GEN y DIGEN reciben los resultados enviados.',
    period: 'Gestión', unit: 'Dirección / agencia', personal: 'Autoevaluación de la Dirección', collection: 'Evaluaciones recibidas',
    director: 'Director(a)', joined: 'Año de ingreso', number: 'Nº de período', date: 'Fecha', location: 'Lugar',
    swot: 'Matriz DOFA', groups: { strengths: 'Fortalezas', opportunities: 'Oportunidades', weaknesses: 'Debilidades', threats: 'Amenazas' },
    profile: 'Perfil ocupacional', skill: 'Talento humano', rating: 'Autoevaluación',
    achievement: 'Logros alcanzados en el período según los objetivos de la Dirección',
    ratings: ['Fortaleza · Alto','Fortaleza · Medio','Fortaleza · Bajo','Debilidad · Alto','Debilidad · Medio','Debilidad · Bajo'],
    choose: 'Selecciona una valoración', save: 'Guardar borrador', submit: 'Enviar a GEN y DIGEN', saving: 'Guardando…',
    draftSaved: 'Borrador guardado.', submitted: 'Autoevaluación enviada a GEN y DIGEN.',
    complete: 'Completa los datos generales y las 18 valoraciones del perfil ocupacional para enviar.',
    confirm: '¿Enviar la autoevaluación a GEN y DIGEN? Después de enviarla quedará cerrada.',
    received: 'Enviadas', drafts: 'Borradores', ownSubmitted: 'Esta autoevaluación fue enviada a GEN y DIGEN y quedó cerrada.',
    ownDraft: 'Puedes guardar y continuar tu autoevaluación cuando lo necesites.',
    listEmpty: 'Todavía no hay evaluaciones registradas para esta gestión.',
    onlyDirectors: 'Los directores de cada Dirección pueden completar su evaluación. GEN y DIGEN reciben los resultados enviados; la administración conserva su acceso de supervisión.',
    open: 'Ver evaluación', close: 'Cerrar detalle', completed: 'Valoraciones completadas', strengths: 'Fortalezas', weaknesses: 'Debilidades',
    status: 'Estado', submittedStatus: 'Enviada', draftStatus: 'Borrador', readOnly: 'Consulta reservada a GEN, DIGEN y la administración', adminKicker: 'Administración',
    privacy: 'Acceso privado. Los resultados individuales quedan disponibles para su autor y para los responsables autorizados de GEN y DIGEN.',
    loading: 'Cargando evaluaciones…', noPeriod: 'Aún no hay gestiones registradas.', failed: 'Se produjo un error. Revisa el mensaje e inténtalo nuevamente.',
  },
  en: {
    eyebrow: 'ACCOUNTABILITY', title: 'Evaluation', intro: 'Each directorate completes its institutional self-evaluation; GEN and DIGEN receive submitted results.',
    period: 'Management period', unit: 'Unit / agency', personal: 'Directorate self-evaluation', collection: 'Received evaluations',
    director: 'Director', joined: 'Year joined', number: 'Term number', date: 'Date', location: 'Location',
    swot: 'SWOT matrix', groups: { strengths: 'Strengths', opportunities: 'Opportunities', weaknesses: 'Weaknesses', threats: 'Threats' },
    profile: 'Occupational profile', skill: 'Competency', rating: 'Self-rating',
    achievement: 'Achievements during the period aligned with the unit’s objectives',
    ratings: ['Strength · High','Strength · Medium','Strength · Low','Weakness · High','Weakness · Medium','Weakness · Low'],
    choose: 'Choose a rating', save: 'Save draft', submit: 'Submit to GEN and DIGEN', saving: 'Saving…',
    draftSaved: 'Draft saved.', submitted: 'Self-evaluation submitted to GEN and DIGEN.',
    complete: 'Complete the general details and all 18 occupational ratings before submitting.',
    confirm: 'Submit this evaluation to GEN and DIGEN? It will be final after submission.',
    received: 'Submitted', drafts: 'Drafts', ownSubmitted: 'This evaluation has been submitted to GEN and DIGEN and is final.',
    ownDraft: 'You can save and return to your self-evaluation as needed.',
    listEmpty: 'There are no evaluations for this period yet.',
    onlyDirectors: 'Active directorate directors complete evaluations. GEN and DIGEN receive submitted results; administration retains oversight.',
    open: 'View evaluation', close: 'Close details', completed: 'Rated competencies', strengths: 'Strengths', weaknesses: 'Weaknesses',
    status: 'Status', submittedStatus: 'Submitted', draftStatus: 'Draft', readOnly: 'Review reserved to GEN, DIGEN and administration', adminKicker: 'Administration',
    privacy: 'Private access. Individual responses are available to their author and authorized GEN and DIGEN leaders.',
    loading: 'Loading evaluations…', noPeriod: 'No management periods available.', failed: 'An error occurred. Review the message and try again.',
  },
}
const getLanguage = () => {
  try { return document.documentElement.lang === 'en' ? 'en' : 'es' }
  catch { return 'es' }
}
const listToText = (values = []) => values.filter((item) => String(item || '').trim())

function EvaluationReadOnly({ row, unit, period, t, language }) {
  const counts = evaluationRatingCounts(row.competencies)
  const skills = language === 'en' ? competencyEn : EXECUTIVE_COMPETENCIES
  return <div className="evaluation-readonly">
    <div className="evaluation-summary-grid">
      <div><span>{t.director}</span><strong>{row.director_name}</strong></div>
      <div><span>{t.unit}</span><strong>{unit?.name || '—'}</strong></div>
      <div><span>{t.period}</span><strong>{period?.name || '—'}</strong></div>
      <div><span>{t.date}</span><strong>{row.evaluation_date}</strong></div>
      <div><span>{t.location}</span><strong>{row.location || '—'}</strong></div>
      <div><span>{t.joined}</span><strong>{row.year_joined || '—'}</strong></div>
      <div><span>{t.number}</span><strong>{row.period_number || '—'}</strong></div>
      <div><span>{t.status}</span><strong>{row.status === 'submitted' ? t.submittedStatus : t.draftStatus}</strong></div>
    </div>
    <h3>{t.swot}</h3>
    <div className="evaluation-dofa-grid">{SWOT_GROUPS.map((key) => <div key={key}>
      <h4>{t.groups[key]}</h4>
      <ol>{listToText(row.swot?.[key]).map((value, index) => <li key={index}>{value}</li>)}</ol>
      {!listToText(row.swot?.[key]).length && <span>—</span>}
    </div>)}</div>
    <h3>{t.profile}</h3>
    <div className="evaluation-counts"><span>{t.completed}: <b>{counts.completed}/18</b></span>
      <span>{t.strengths}: <b>{counts.strengths}</b></span><span>{t.weaknesses}: <b>{counts.weaknesses}</b></span></div>
    <div className="evaluation-skill-list">{skills.map((skill,index) => {
      const rating = row.competencies?.[index + 1]
      const label = messages[language].ratings[COMPETENCY_RATINGS.indexOf(rating)]
      return <div key={skill}><span>{index+1}. {skill}</span><strong>{label || '—'}</strong></div>
    })}</div>
    <h3>{t.achievement}</h3>
    <ol className="evaluation-achievements">{listToText(row.achievements).map((value,index) => <li key={index}>{value}</li>)}</ol>
  </div>
}

export default function ManagementEvaluationPage() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(getLanguage)
  const t = messages[language]
  const organizationId = access.organizationId || ''
  const [organization, setOrganization] = useState(null)
  const [periods, setPeriods] = useState([])
  const [units, setUnits] = useState([])
  const [overview, setOverview] = useState({ director_unit_ids: [], can_review_all_evaluations: false, is_evaluation_supervisor: false })
  const [rows, setRows] = useState([])
  const [periodId, setPeriodId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [form, setForm] = useState(() => blankEvaluation(access.displayName || ''))
  const [selectedDetail, setSelectedDetail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const observer = new MutationObserver(() => setLanguage(getLanguage()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  const load = useCallback(async () => {
    if (!supabase || access.status !== 'authorized' || !organizationId) return
    setLoading(true)
    const results = await Promise.all([
      supabase.rpc('evaluation_access_overview', { target_organization_id: organizationId }),
      supabase.from('organization').select('id,name,evaluation_module_label').eq('id',organizationId).single(),
      supabase.from('management_period').select('id,name,start_date,end_date').eq('organization_id',organizationId).order('start_date',{ ascending: false }),
      supabase.from('organization_unit').select('id,code,name,active,sort_order').eq('organization_id',organizationId).order('sort_order'),
      supabase.from('executive_self_evaluation').select('*').eq('organization_id',organizationId).order('created_at',{ ascending: false }),
    ])
    const failed = results.find((result) => result.error)
    if (failed) { setError(failed.error.message); setLoading(false); return }
    setOverview(results[0].data || { director_unit_ids: [], can_review_all_evaluations: false, is_evaluation_supervisor: false })
    setOrganization(results[1].data)
    const periodRows = results[2].data || []
    setPeriods(periodRows); setUnits(results[3].data || []); setRows(results[4].data || [])
    setPeriodId((current) => periodRows.some((p) => p.id === current) ? current : (periodRows[0]?.id || ''))
    setError(''); setLoading(false)
  }, [access.status, organizationId])

  useEffect(() => { load() }, [load])
  const directorUnitIds = useMemo(() => new Set(overview.director_unit_ids || []), [overview.director_unit_ids])
  const directorUnits = useMemo(() => eligibleEvaluationUnits(units, [...directorUnitIds], Boolean(overview.is_evaluation_supervisor)), [units, directorUnitIds, overview.is_evaluation_supervisor])
  useEffect(() => {
    setUnitId((current) => directorUnits.some((unit) => unit.id === current) ? current : (directorUnits[0]?.id || ''))
  }, [directorUnits])
  const ownRow = rows.find((row) => row.management_period_id === periodId && row.unit_id === unitId && row.evaluator_user_id === access.userId)
  useEffect(() => {
    setForm(normalizeEvaluation(ownRow, access.displayName || ''))
  }, [ownRow, periodId, unitId, access.displayName])
  const canReviewAll = Boolean(overview.can_review_all_evaluations)
  const evaluableUnitIds = new Set(units.filter(isEvaluationResultUnit).map((unit) => unit.id))
  const periodRows = rows.filter((row) => row.management_period_id === periodId && evaluableUnitIds.has(row.unit_id))
  const submittedRows = periodRows.filter((row) => row.status === 'submitted')
  const currentPeriod = periods.find((period) => period.id === periodId)
  const includeDrafts = Boolean(overview.can_read_draft_evaluations)
  const collectionRows = evaluationsForCollection(periodRows, periodId, { includeDrafts })
  const detail = canReviewAll ? collectionRows.find((row) => row.id === selectedDetail) : null

  const save = async (status) => {
    if (saving || !directorUnits.some((unit) => unit.id === unitId) || !periodId || ownRow?.status === 'submitted') return
    if (status === 'submitted') {
      if (!evaluationIsComplete(form)) { setError(t.complete); return }
      if (!window.confirm(t.confirm)) return
    }
    setSaving(true); setError(''); setMessage('')
    const payload = {
      ...evaluationPayload(form), status,
      organization_id: organizationId,
      management_period_id: periodId,
      unit_id: unitId,
      evaluator_user_id: access.userId,
    }
    const request = ownRow
      ? supabase.from('executive_self_evaluation').update(payload).eq('id', ownRow.id)
      : supabase.from('executive_self_evaluation').insert(payload)
    const { error: requestError } = await request
    if (requestError) setError(requestError.message)
    else { setMessage(status === 'submitted' ? t.submitted : t.draftSaved); await load() }
    setSaving(false)
  }
  const setSwot = (key, index, value) => setForm((current) => ({
    ...current, swot: { ...current.swot, [key]: current.swot[key].map((item, i) => i === index ? value : item) },
  }))
  const setAchievement = (index, value) => setForm((current) => ({
    ...current, achievements: current.achievements.map((item, i) => i === index ? value : item),
  }))

  if (access.status !== 'authorized') return <OperatorAccessScreen access={access} language={language} copy={{ languageLabel: language === 'en' ? 'Language' : 'Idioma' }} onLanguageChange={() => {}} />
  return <ManagementStandaloneShell access={access}>
    <div className="management-panel management-evaluation-page">
      <header className="management-panel-heading">
        <div><p>{t.eyebrow}</p><h1 data-no-translate>{organization?.evaluation_module_label || t.title}</h1><span>{t.intro}</span></div>
      </header>
      <p className="evaluation-private-hint">{t.privacy}</p>
      {error && <p className="management-flash error" role="alert">{error}</p>}
      {message && <p className="management-flash success" role="status">{message}</p>}
      {loading ? <div className="management-loading"><span/><p>{t.loading}</p></div> : <>
        <section className="evaluation-toolbar">
          <label><span>{t.period}</span><select value={periodId} onChange={(e) => { setPeriodId(e.target.value); setSelectedDetail('') }}>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label>
          {directorUnits.length > 0 && <label><span>{t.unit}</span><select value={unitId} onChange={(e) => setUnitId(e.target.value)}>{directorUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>}
        </section>
        {!periods.length && <p className="management-empty">{t.noPeriod}</p>}
        {periodId && directorUnits.length > 0 && <section className="evaluation-form-panel">
          <div className="evaluation-section-header"><div><small>{t.personal}</small><h2>{units.find((unit) => unit.id === unitId)?.name}</h2></div>
            <span className={'evaluation-status ' + (ownRow?.status || 'draft')}>{ownRow?.status === 'submitted' ? t.submittedStatus : t.draftStatus}</span></div>
          {ownRow?.status === 'submitted' ? <>
            <p className="evaluation-info">{t.ownSubmitted}</p>
            <EvaluationReadOnly row={ownRow} unit={units.find((unit)=>unit.id===unitId)} period={currentPeriod} t={t} language={language} />
          </> : <>
            <p className="evaluation-info">{t.ownDraft}</p>
            <div className="evaluation-form-grid">
              <label><span>{t.director} *</span><input value={form.director_name} onChange={(e) => setForm((f)=>({...f,director_name:e.target.value}))} /></label>
              <label><span>{t.date} *</span><input type="date" value={form.evaluation_date} onChange={(e) => setForm((f)=>({...f,evaluation_date:e.target.value}))} /></label>
              <label><span>{t.location} *</span><input value={form.location} onChange={(e) => setForm((f)=>({...f,location:e.target.value}))} /></label>
              <label><span>{t.joined} *</span><input type="number" min="1900" max="2100" value={form.year_joined} onChange={(e) => setForm((f)=>({...f,year_joined:e.target.value}))} /></label>
              <label><span>{t.number} *</span><input type="number" min="1" max="100" value={form.period_number} onChange={(e) => setForm((f)=>({...f,period_number:e.target.value}))} /></label>
            </div>
            <h3>{t.swot}</h3>
            <div className="evaluation-dofa-grid">{SWOT_GROUPS.map((key) => <fieldset key={key}>
              <legend>{t.groups[key]}</legend>
              {form.swot[key].map((value,index) => <label key={index}><span>{index+1}</span><textarea rows="2" value={value} onChange={(e)=>setSwot(key,index,e.target.value)} /></label>)}
            </fieldset>)}</div>
            <h3>{t.profile}</h3>
            <p className="evaluation-info">{t.completed}: {evaluationRatingCounts(form.competencies).completed}/18</p>
            <div className="evaluation-skill-list">{EXECUTIVE_COMPETENCIES.map((skill,index)=><label key={index}>
              <span>{index+1}. {language==='en' ? competencyEn[index] : skill}</span>
              <select value={form.competencies[index+1] || ''} onChange={(e)=>setForm((f)=>({...f,competencies:{...f.competencies,[index+1]:e.target.value}}))}>
                <option value="">{t.choose}</option>
                {COMPETENCY_RATINGS.map((rating,i)=><option key={rating} value={rating}>{t.ratings[i]}</option>)}
              </select>
            </label>)}</div>
            <h3>{t.achievement}</h3>
            <div className="evaluation-achievement-inputs">{form.achievements.map((value,index) => <label key={index}><span>{index+1}</span><textarea rows="2" value={value} onChange={(e)=>setAchievement(index,e.target.value)} /></label>)}</div>
            <div className="evaluation-actions"><button className="secondary" type="button" disabled={saving} onClick={()=>save('draft')}>{saving ? t.saving : t.save}</button>
              <button type="button" disabled={saving} onClick={()=>save('submitted')}>{saving ? t.saving : t.submit}</button></div>
          </>}
        </section>}
        {!directorUnits.length && !canReviewAll && <p className="management-empty">{t.onlyDirectors}</p>}
        {canReviewAll && periodId && <section className="evaluation-consolidated">
          <div className="evaluation-section-header"><div><small>{includeDrafts ? t.adminKicker : 'GEN · DIGEN'}</small><h2>{t.collection}</h2></div>
            <div className="evaluation-counts"><span>{t.received}: <b>{submittedRows.length}</b></span><span>{t.drafts}: <b>{periodRows.length-submittedRows.length}</b></span></div></div>
          {!collectionRows.length && <p className="management-empty">{t.listEmpty}</p>}
          {collectionRows.map((row) => <article className="evaluation-submission" key={row.id}>
            <div><strong>{row.director_name}</strong><span>{units.find((unit)=>unit.id===row.unit_id)?.name || '—'} · {row.evaluation_date}{includeDrafts ? ` · ${row.status === 'submitted' ? t.submittedStatus : t.draftStatus}` : ''}</span></div>
            <button type="button" onClick={()=>setSelectedDetail((id)=>id===row.id ? '' : row.id)}>{selectedDetail===row.id ? t.close : t.open}</button>
          </article>)}
          {detail && <div className="evaluation-details" aria-live="polite">
            <div className="evaluation-section-header"><h2>{detail.director_name}</h2><span>{t.readOnly}</span></div>
            <EvaluationReadOnly row={detail} unit={units.find((unit)=>unit.id===detail.unit_id)} period={currentPeriod} t={t} language={language} />
          </div>}
        </section>}
      </>}
    </div>
  </ManagementStandaloneShell>
}
