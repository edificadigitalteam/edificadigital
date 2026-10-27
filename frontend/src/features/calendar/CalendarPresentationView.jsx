import { useEffect, useRef, useState } from 'react'
import { nextPresentationMonth, presentationMonthActivities, validatePresentationEdit } from './presentation.js'

const words = {
  es: {
    title:'Presentación mensual', prev:'Mes anterior', next:'Mes siguiente', month:'Seleccionar mes',
    count:'actividades', one:'actividad', noActivities:'Este mes todavía no tiene actividades registradas.',
    expand:'Pantalla completa', closeFull:'Salir de pantalla completa', update:'Actualizar',
    edit:'Editar en vivo', cancel:'Cancelar', save:'Guardar cambios', saving:'Guardando…',
    activity:'Actividad', from:'Inicio', to:'Cierre (opcional)', unit:'Dirección', notes:'Detalles',
    invalid:'La fecha de cierre debe ser posterior o igual al inicio y estar dentro de la gestión seleccionada.',
    missing:'Completa el nombre y la fecha de inicio de la actividad.',
    status:'Revisión', validate:'Validar', observe:'Observar', live:'Los cambios se guardan al instante para todos los participantes.',
    project:'Actividades institucionales', presenter:'Vista de reunión', saveFailed:'Revisa el aviso y vuelve a intentar guardar.',
  },
  en: {
    title:'Monthly presentation', prev:'Previous month', next:'Next month', month:'Select month',
    count:'activities', one:'activity', noActivities:'There are no activities scheduled for this month yet.',
    expand:'Full screen', closeFull:'Exit full screen', update:'Refresh',
    edit:'Live edit', cancel:'Cancel', save:'Save changes', saving:'Saving…',
    activity:'Activity', from:'Start', to:'End (optional)', unit:'Unit', notes:'Details',
    invalid:'The end date must be on or after the start date, within the selected period.',
    missing:'Complete the activity name and start date.',
    status:'Review', validate:'Validate', observe:'Observe', live:'Changes are saved immediately for all meeting participants.',
    project:'Institutional activities', presenter:'Meeting view', saveFailed:'Review the notice and try saving again.',
  },
}
function dayLabel(value, language) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-VE', {
    day:'numeric', month:'short', timeZone:'UTC',
  }).format(new Date(value + 'T12:00:00Z'))
}
export default function CalendarPresentationView({
  activities, units, monthNames, period, language, editableUnits, canReview, onSave,
  onReview, onRefresh, saving, reviewLabel,
}) {
  const t = words[language] || words.es
  const panelRef = useRef(null)
  const [month, setMonth] = useState(0)
  const [fullScreen, setFullScreen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState({ title:'', start_date:'', end_date:'' })
  const [editError, setEditError] = useState('')
  const rows = presentationMonthActivities(activities, month)
  useEffect(() => {
    const change = () => setFullScreen(document.fullscreenElement === panelRef.current)
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])
  const moveMonth = (next) => {
    setEditingId('')
    setEditError('')
    setMonth(next)
    panelRef.current?.scrollTo({ top:0, behavior:'instant' })
  }
  const toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement === panelRef.current) await document.exitFullscreen()
      else if (panelRef.current?.requestFullscreen) await panelRef.current.requestFullscreen()
    } catch {
      // Full-screen permissions depend on the browser; the embedded view remains usable.
    }
  }
  const startEdit = (activity) => {
    if (!editableUnits.has(activity.unit_id)) return
    setEditingId(activity.id)
    setDraft({ title:activity.title || '', start_date:activity.start_date || '', end_date:activity.end_date || '' })
    setEditError('')
  }
  const commit = async (event, activity) => {
    event.preventDefault()
    if (saving || !editableUnits.has(activity.unit_id)) return
    const validation = validatePresentationEdit(draft, period)
    if (validation) { setEditError(validation === 'missing' ? t.missing : t.invalid); return }
    setEditError('')
    const ok = await onSave(activity, draft)
    if (ok) {
      setEditingId('')
      // Follow a moved activity to its new month after the server confirms the save.
      setMonth(Number(draft.start_date.slice(5,7)) - 1)
    } else setEditError(t.saveFailed)
  }
  return <section ref={panelRef} className="calendar-presenter" aria-label={t.title}>
    <header className="calendar-presenter-header">
      <div className="calendar-presenter-brand">
        <span>{t.presenter}</span>
        <strong>{t.project}</strong>
        <small>{period?.name || ''}</small>
      </div>
      <div className="calendar-presenter-toolbar">
        <button type="button" onClick={onRefresh} disabled={saving} title={t.update}>{t.update}</button>
        <button type="button" onClick={toggleFullScreen} title={fullScreen ? t.closeFull : t.expand}>{fullScreen ? t.closeFull : t.expand}</button>
      </div>
    </header>
    <div className="calendar-presenter-month-nav">
      <button type="button" className="calendar-presenter-arrow" onClick={()=>moveMonth(nextPresentationMonth(month,-1))} disabled={month===0} aria-label={t.prev} title={t.prev}>‹</button>
      <div className="calendar-presenter-month-heading">
        <label htmlFor="calendar-presenter-month-select">{t.month}</label>
        <select id="calendar-presenter-month-select" value={month} onChange={(e)=>moveMonth(Number(e.target.value))} aria-label={t.month}>
          {monthNames.map((name,i)=><option key={name} value={i}>{name}</option>)}
        </select>
        <span>{rows.length} {rows.length===1 ? t.one : t.count}</span>
      </div>
      <button type="button" className="calendar-presenter-arrow" onClick={()=>moveMonth(nextPresentationMonth(month,1))} disabled={month===11} aria-label={t.next} title={t.next}>›</button>
    </div>
    <div className="calendar-presenter-activities" aria-live="polite">
      {!rows.length && <p className="calendar-presenter-empty">{t.noActivities}</p>}
      {rows.map((activity)=>{
        const unit = units.find((item)=>item.id===activity.unit_id)
        const editable = editableUnits.has(activity.unit_id)
        const reviewable = canReview(activity)
        return <article key={activity.id} className={'calendar-presenter-activity review-' + (activity.review_status || 'pending')}>
          {editingId === activity.id
            ? <form className="calendar-presenter-edit" onSubmit={(e)=>commit(e,activity)}>
              <div className="calendar-presenter-edit-heading"><strong>{t.edit} · {unit?.code || '—'}</strong></div>
              <label className="wide">{t.activity}<input required value={draft.title} onChange={(e)=>setDraft((value)=>({...value,title:e.target.value}))} /></label>
              <label>{t.from}<input required type="date" min={period?.start_date} max={period?.end_date} value={draft.start_date} onChange={(e)=>setDraft((value)=>({...value,start_date:e.target.value}))} /></label>
              <label>{t.to}<input type="date" min={draft.start_date || period?.start_date} max={period?.end_date} value={draft.end_date} onChange={(e)=>setDraft((value)=>({...value,end_date:e.target.value}))} /></label>
              {editError && <p role="alert" className="calendar-presenter-edit-error">{editError}</p>}
              <div className="calendar-presenter-edit-actions">
                <button type="button" onClick={()=>{setEditingId('');setEditError('')}} disabled={saving}>{t.cancel}</button>
                <button className="primary" type="submit" disabled={saving}>{saving?t.saving:t.save}</button>
              </div>
            </form>
            : <>
              <div className="calendar-presenter-date">
                <strong>{dayLabel(activity.start_date,language)}{activity.end_date && activity.end_date !== activity.start_date ? ' – ' + dayLabel(activity.end_date,language) : ''}</strong>
                <span>{unit?.code || '—'} · {unit?.name || t.unit}</span>
              </div>
              <div className="calendar-presenter-event-details">
                <h3>{activity.title}</h3>
                {activity.description && <p>{activity.description}</p>}
                <div className="calendar-presenter-status"><span>{t.status}: {reviewLabel(activity.review_status,language)}</span></div>
              </div>
              {(editable || reviewable) && <div className="calendar-presenter-activity-actions">
                {editable && <button type="button" onClick={()=>startEdit(activity)} disabled={saving} title={t.edit}>{t.edit}</button>}
                {reviewable && <button type="button" onClick={()=>onReview(activity,'validated')} disabled={saving} title={t.validate}>{t.validate}</button>}
                {reviewable && <button type="button" onClick={()=>onReview(activity,'observed')} disabled={saving} title={t.observe}>{t.observe}</button>}
              </div>}
            </>}
        </article>
      })}
    </div>
    <footer className="calendar-presenter-footer"><span>{t.live}</span><span>{month+1} / 12</span></footer>
  </section>
}
