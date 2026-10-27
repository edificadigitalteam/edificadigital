import { Fragment, useEffect, useRef, useState } from 'react'
import { presentationYearSections, presentationDayRange, presentationReviewState, validatePresentationEdit } from './presentation.js'
import CalendarYearHeader from './CalendarYearHeader.jsx'

const phrases = {
  es: {
    eyebrow:'CALENDARIO INSTITUCIONAL', title:'Proyecto de Calendario', calendar:'Actividades institucionales',
    management:'Gestión', responsables:'RESPONSABLES', monthActivity:'ACTIVIDADES DEL MES',
    date:'FECHA', one:'actividad', many:'actividades', empty:'Sin actividades registradas para este mes.',
    months:'Ir al mes', fullscreen:'Pantalla completa', exit:'Salir de pantalla completa', refresh:'Actualizar',
    legend:'Estados de revisión', edit:'Editar', save:'Guardar cambios', saving:'Guardando…', cancel:'Cancelar',
    name:'Actividad', from:'Fecha de inicio', to:'Fecha de cierre', who:'Persona responsable (opcional)',
    missing:'Escribe el nombre de la actividad e indica la fecha de inicio.',
    invalid:'Las fechas deben estar dentro de la gestión seleccionada y la fecha de cierre debe ser igual o posterior a la de inicio.',
    fail:'No se pudieron guardar los cambios. Revisa el aviso e inténtalo nuevamente.',
    saved:'Cambios guardados.', validate:'Validar', observe:'Observar', pending:'Poner en revisión',
    note:'Observación', unit:'Dirección', direct:'Editar actividad durante la reunión',
    readOnly:'Consulta', editing:'Edición de actividad',
  },
  en: {
    eyebrow:'INSTITUTIONAL CALENDAR', title:'Calendar Project', calendar:'Institutional activities',
    management:'Management year', responsables:'RESPONSIBLE', monthActivity:'MONTHLY ACTIVITIES',
    date:'DATE', one:'activity', many:'activities', empty:'No activities scheduled for this month.',
    months:'Jump to month', fullscreen:'Full screen', exit:'Exit full screen', refresh:'Refresh',
    legend:'Review statuses', edit:'Edit', save:'Save changes', saving:'Saving…', cancel:'Cancel',
    name:'Activity', from:'Start date', to:'End date', who:'Responsible person (optional)',
    missing:'Provide an activity name and start date.',
    invalid:'Dates must be within the selected year and the end date must be on or after the start date.',
    fail:'Changes could not be saved. Review the message and try again.',
    saved:'Changes saved.', validate:'Validate', observe:'Observe', pending:'Send for review',
    note:'Review note', unit:'Unit', direct:'Edit activity during the meeting',
    readOnly:'Read-only', editing:'Edit activity',
  },
}

export default function CalendarPresentationView({
  activities, units, monthNames, period, language, editableUnits, canReview,
  onSave, onReview, onRefresh, saving, organizationName,
  annualHeader, canEditYearHeader, onSaveYearHeader, savingYearHeader,
}) {
  const t = phrases[language] || phrases.es
  const panelRef = useRef(null)
  const [isFull, setIsFull] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState({title:'',start_date:'',end_date:'',responsible_name:''})
  const [editError, setEditError] = useState('')
  const [notice, setNotice] = useState('')
  const year = period?.start_date ? Number(period.start_date.slice(0,4)) : null
  const sections = presentationYearSections(activities, year)

  useEffect(() => {
    const update = () => setIsFull(document.fullscreenElement === panelRef.current)
    document.addEventListener('fullscreenchange',update)
    return () => document.removeEventListener('fullscreenchange',update)
  }, [])

  useEffect(() => {
    setEditingId('')
    setEditError('')
    setNotice('')
  }, [period?.id])

  const jumpToMonth = (index) => {
    const node = panelRef.current?.querySelector('[data-calendar-month="' + index + '"]')
    node?.scrollIntoView({behavior:'smooth',block:'start'})
  }
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === panelRef.current) await document.exitFullscreen()
      else await panelRef.current?.requestFullscreen?.()
    } catch {
      setNotice('')
    }
  }
  const startEdit = (activity) => {
    if (saving || !editableUnits.has(activity.unit_id)) return
    setDraft({
      title:activity.title || '',
      start_date:activity.start_date || '',
      end_date:activity.end_date || '',
      responsible_name:activity.responsible_name || '',
    })
    setEditingId(activity.id)
    setEditError('')
    setNotice('')
  }
  const save = async (event, activity) => {
    event.preventDefault()
    if (saving || !editableUnits.has(activity.unit_id)) return
    const issue = validatePresentationEdit(draft,period)
    if (issue) {setEditError(issue === 'missing' ? t.missing : t.invalid);return}
    setEditError('')
    const result = await onSave(activity,draft)
    if (result) {
      setEditingId('')
      setNotice(t.saved)
      const oldMonth = Number(activity.start_date.slice(5,7))
      const newMonth = Number(draft.start_date.slice(5,7))
      if (oldMonth !== newMonth) {
        window.requestAnimationFrame(()=>jumpToMonth(newMonth - 1))
      }
    } else setEditError(t.fail)
  }
  return <section className="cnv-calendar-sheet" ref={panelRef} aria-label={t.title}>
    <div className="cnv-sheet-top">
      <div className="cnv-sheet-title">
        <span>{organizationName || t.eyebrow}</span>
        <CalendarYearHeader header={annualHeader} period={period} language={language} canEdit={canEditYearHeader} onSave={onSaveYearHeader} saving={savingYearHeader} compact/>
      </div>
      <div className="cnv-sheet-tools">
        <button type="button" onClick={onRefresh} disabled={saving} title={t.refresh}>{t.refresh}</button>
        <button type="button" className="cnv-fullscreen" onClick={toggleFullscreen} title={isFull ? t.exit : t.fullscreen}>{isFull ? t.exit : t.fullscreen}</button>
      </div>
    </div>
    <div className="cnv-sheet-controls">
      <label>{t.months}
        <select value="" onChange={(event)=>{if(event.target.value)jumpToMonth(Number(event.target.value));event.target.value=''}} aria-label={t.months}>
          <option value="">{t.months}</option>
          {monthNames.map((name,i)=><option key={name} value={i}>{name}</option>)}
        </select>
      </label>
      <div className="cnv-sheet-legend" aria-label={t.legend}>
        {['pending','validated','observed'].map((state)=>{
          const label = presentationReviewState(state,language)
          return <span key={state} className={'cnv-review-legend cnv-state-'+state}><i aria-hidden="true"/>{label.label}</span>
        })}
      </div>
    </div>
    {notice && <p className="cnv-notice" role="status">{notice}</p>}
    <div className="cnv-all-months">
      {sections.map((section)=>{
        const monthName = monthNames[section.index]
        return <section key={section.index} className="cnv-month" data-calendar-month={section.index} aria-label={monthName}>
          <table className="cnv-month-table">
            <colgroup><col className="cnv-col-date"/><col className="cnv-col-activity"/><col className="cnv-col-responsible"/></colgroup>
            <thead><tr>
              <th scope="col" className="cnv-month-name">{monthName}</th>
              <th scope="col" className="cnv-month-description">{t.monthActivity} · {section.activities.length} {section.activities.length===1 ? t.one : t.many}</th>
              <th scope="col" className="cnv-month-responsible">{t.responsables}</th>
            </tr></thead>
            <tbody>
              {!section.activities.length && <tr><td colSpan={3} className="cnv-empty">{t.empty}</td></tr>}
              {section.activities.map((activity)=>{
                const unit = units.find((item)=>item.id===activity.unit_id)
                const state = presentationReviewState(activity.review_status,language)
                const editable = editableUnits.has(activity.unit_id)
                const reviewable = canReview(activity)
                return <Fragment key={activity.id}>
                  <tr className={'cnv-activity-row cnv-state-'+state.tone}>
                    <td className="cnv-day" data-column={t.date}>{presentationDayRange(activity.start_date,activity.end_date,language)}</td>
                    <td className="cnv-activity" data-column={t.name}>
                      <div className="cnv-activity-text">{activity.title}</div>
                      <div className="cnv-activity-bottom">
                        <span className={'cnv-status cnv-state-'+state.tone}>{state.label}</span>
                        {activity.review_note && <span className="cnv-review-note">{t.note}: {activity.review_note}</span>}
                        {(editable || reviewable) && <div className="cnv-row-actions">
                          {editable && <button type="button" onClick={()=>startEdit(activity)} disabled={saving} title={t.direct}>{t.edit}</button>}
                          {reviewable && <>
                            {state.tone!=='validated' && <button type="button" onClick={()=>onReview(activity,'validated')} disabled={saving} title={t.validate}>{t.validate}</button>}
                            {state.tone!=='observed' && <button type="button" onClick={()=>onReview(activity,'observed')} disabled={saving} title={t.observe}>{t.observe}</button>}
                            {state.tone!=='pending' && <button type="button" onClick={()=>onReview(activity,'pending')} disabled={saving} title={t.pending}>{t.pending}</button>}
                          </>}
                        </div>}
                      </div>
                    </td>
                    <td className="cnv-responsible" data-column={t.responsables}>
                      <strong>{unit?.code || '—'}</strong>
                      {activity.responsible_name && <span>{activity.responsible_name}</span>}
                    </td>
                  </tr>
                  {editingId === activity.id && <tr className="cnv-edit-row"><td colSpan={3}>
                    <form className="cnv-edit-form" onSubmit={(event)=>save(event,activity)}>
                      <strong className="cnv-edit-title">{t.editing} · {unit?.code || '—'}</strong>
                      <label className="cnv-edit-name">{t.name}<input required value={draft.title} onChange={(e)=>setDraft((d)=>({...d,title:e.target.value}))}/></label>
                      <label>{t.from}<input type="date" required value={draft.start_date} min={period?.start_date} max={period?.end_date} onChange={(e)=>setDraft((d)=>({...d,start_date:e.target.value}))}/></label>
                      <label>{t.to}<input type="date" value={draft.end_date} min={draft.start_date||period?.start_date} max={period?.end_date} onChange={(e)=>setDraft((d)=>({...d,end_date:e.target.value}))}/></label>
                      <label className="cnv-edit-who">{t.who}<input value={draft.responsible_name} onChange={(e)=>setDraft((d)=>({...d,responsible_name:e.target.value}))}/></label>
                      {editError && <p className="cnv-edit-error" role="alert">{editError}</p>}
                      <div className="cnv-edit-actions">
                        <button type="button" onClick={()=>{setEditingId('');setEditError('')}} disabled={saving}>{t.cancel}</button>
                        <button className="cnv-save" type="submit" disabled={saving}>{saving?t.saving:t.save}</button>
                      </div>
                    </form>
                  </td></tr>}
                </Fragment>
              })}
            </tbody>
          </table>
        </section>
      })}
    </div>
    <footer className="cnv-footer">{organizationName || t.eyebrow} · {t.management} {year || ''}</footer>
  </section>
}
