import { useMemo, useState } from 'react'
import './calendar-prototype.css'

const months = [
  ['ENERO','Mes de la Unión Femenil Misionera'],
  ['FEBRERO','Mes de la Juventud y del Esfuerzo Cooperativo'],
  ['MARZO','Mes del Seminario y de los Núcleos'],
  ['ABRIL','Mes del Servicio Social'],
  ['MAYO','Mes del Hogar Cristiano'],
  ['JUNIO','Mes de la Oración'],
  ['JULIO','Mes del Compañerismo'],
  ['AGOSTO','Mes de la Evangelización'],
  ['SEPTIEMBRE','Mes de la Biblia y de la CNBV'],
  ['OCTUBRE','Mes de la Familia Pastoral y de las Asociaciones Regionales'],
  ['NOVIEMBRE','Mes de la Mayordomía'],
  ['DICIEMBRE','Mes de las Misiones Nacionales'],
]

const seed = [
  {date:'2026-01-01',unit:'DIPROM',title:'Inicio 365 días de oración',objective:'Movilización nacional de oración',indicator:'Actividades ejecutadas',status:'En curso'},
  {date:'2026-01-18',unit:'DEDEC',title:'Día del Maestro Cristiano',objective:'Fortalecer la educación cristiana',indicator:'Actividades ejecutadas',status:'Completada'},
  {date:'2026-01-23',unit:'DIPROM',title:'1ª vigilia nacional de oración',objective:'Movilización nacional de oración',indicator:'Vigilias nacionales realizadas',status:'Planificada'},
  {date:'2026-01-24',unit:'DIME',title:'Conferencias misioneras regionales',objective:'Fortalecer la movilización misionera',indicator:'Conferencias realizadas',status:'Planificada'},
  {date:'2026-02-02',unit:'DIPROM',title:'Lanzamiento de la campaña Esfuerzo Cooperativo',objective:'Fortalecer el esfuerzo cooperativo',indicator:'Campañas implementadas',status:'Planificada'},
  {date:'2026-02-12',unit:'DEDEC',title:'Congreso de educación cristiana Crecimiento 3D',objective:'Formación y capacitación',indicator:'Participantes',status:'Planificada'},
  {date:'2026-02-27',unit:'DISES',title:'Congreso Impacto 360° región occidental',objective:'Servicio social y formación',indicator:'Congresos realizados',status:'Planificada'},
  {date:'2026-03-05',unit:'DIGEN',title:'Reunión del comité administrativo de la CNBV',objective:'Gobernanza institucional',indicator:'Reuniones realizadas',status:'Planificada'},
  {date:'2026-03-26',unit:'DIGEN',title:'Cumbre de liderazgo',objective:'Fortalecer el liderazgo institucional',indicator:'Participantes',status:'Planificada'},
  {date:'2026-04-17',unit:'DIPROM',title:'2ª vigilia nacional de oración',objective:'Movilización nacional de oración',indicator:'Vigilias nacionales realizadas',status:'Planificada'},
  {date:'2026-06-24',unit:'DIPROM',title:'Día Nacional de Clamor por Venezuela',objective:'Movilización nacional de oración',indicator:'Participación nacional',status:'Planificada'},
  {date:'2026-07-17',unit:'DIPROM',title:'3ª vigilia nacional de oración',objective:'Movilización nacional de oración',indicator:'Vigilias nacionales realizadas',status:'Planificada'},
  {date:'2026-08-29',unit:'DICOM',title:'Evangelización digital / congreso en línea',objective:'Comunicación digital',indicator:'Actividades digitales',status:'Planificada'},
  {date:'2026-10-23',unit:'DIPROM',title:'4ª vigilia nacional de oración',objective:'Movilización nacional de oración',indicator:'Vigilias nacionales realizadas',status:'Planificada'},
  {date:'2026-11-05',unit:'DIGEN',title:'Reunión de directores de agencias',objective:'Gobernanza institucional',indicator:'Reuniones realizadas',status:'Planificada'},
  {date:'2026-12-21',unit:'DIPROM',title:'Antorcha de oración 2026',objective:'Movilización nacional de oración',indicator:'Actividades ejecutadas',status:'Planificada'},
]

const units = ['DIPROM','DIME','DISES','DEDEC','DICOM','DIGEN']

export default function CalendarPrototypePage(){
  const [mode,setMode]=useState('unit')
  const [unit,setUnit]=useState('DIPROM')
  const [events,setEvents]=useState(seed)
  const [tab,setTab]=useState('calendar')
  const [modal,setModal]=useState(false)
  const [form,setForm]=useState({unit:'DIPROM',date:'2026-01-23',title:'',objective:'Movilización nacional de oración',indicator:'Vigilias nacionales realizadas',status:'Planificada'})

  const visible = useMemo(()=>mode==='digen'?events:events.filter(item=>item.unit===unit),[events,mode,unit])
  const monthRows = (monthIndex)=>visible.filter(item=>Number(item.date.slice(5,7))===monthIndex+1)
  const unitCount = mode==='digen'?new Set(visible.map(item=>item.unit)).size:1

  const openModal=()=>{
    setForm(current=>({...current,unit:mode==='digen'?'DIGEN':unit}))
    setModal(true)
  }
  const save=(event)=>{
    event.preventDefault()
    if(!form.title.trim()) return
    setEvents(current=>[...current,{...form,title:form.title.trim()}])
    setForm(current=>({...current,title:''}))
    setModal(false)
  }

  return <div className="calendar-prototype">
    <aside className="calendar-prototype-sidebar">
      <div className="calendar-brand"><span><i/><i/><i/></span><b>edifica<em>digital</em></b></div>
      <small>GESTIÓN ORGANIZACIONAL</small>
      <nav>
        <p>Planificación</p>
        <a>Estructura</a>
        <a>Plan anual</a>
        <a className="active">Calendario</a>
        <p>Control y rendición</p>
        <a>Seguimiento</a>
        <a>Informes</a>
      </nav>
      <div className="calendar-demo-note"><b>Prototipo independiente</b><span>Esta vista vive únicamente en el PR de demostración. No modifica el demo productivo.</span></div>
    </aside>

    <main className="calendar-prototype-main">
      <header className="calendar-prototype-heading">
        <div><small>PLANIFICACIÓN INSTITUCIONAL</small><h1>Calendario anual por Dirección</h1><p>Cada Dirección o agencia registra sus propias actividades. DIGEN puede consultar el consolidado institucional.</p></div>
        <span>DEMO · SIN DATOS REALES</span>
      </header>

      <section className="calendar-controls">
        <label><span>Vista de demostración</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="unit">Dirección / Agencia</option><option value="digen">Director General · DIGEN</option></select></label>
        <label><span>Dirección</span><select value={unit} disabled={mode==='digen'} onChange={e=>setUnit(e.target.value)}>{units.map(code=><option key={code}>{code}</option>)}</select></label>
        <label><span>Año</span><select><option>2026</option><option>2027</option></select></label>
        <button onClick={openModal}>＋ Nueva actividad</button>
      </section>

      <section className="calendar-access">
        <div><b>{mode==='digen'?'Supervisión institucional DIGEN':'Privacidad por Dirección activa'}</b><span>{mode==='digen'?'DIGEN ve el consolidado de todas las Direcciones y agencias. Cada unidad conserva la edición de lo suyo.':unit+' ve y edita únicamente sus actividades. Las demás Direcciones no pueden consultar este contenido.'}</span></div>
        <strong>{mode==='digen'?'VISIBLE: TODA LA ORGANIZACIÓN':'VISIBLE: '+unit+' + DIGEN'}</strong>
      </section>

      <section className="calendar-stats">
        <article><span>Actividades visibles</span><b>{visible.length}</b></article>
        <article><span>En enero</span><b>{monthRows(0).length}</b></article>
        <article><span>Direcciones visibles</span><b>{unitCount}</b></article>
        <article><span>Completadas</span><b>{visible.filter(item=>item.status==='Completada').length}</b></article>
      </section>

      <div className="calendar-tabs"><button className={tab==='calendar'?'active':''} onClick={()=>setTab('calendar')}>Calendario anual</button><button className={tab==='list'?'active':''} onClick={()=>setTab('list')}>Listado consolidado</button></div>

      <section className="calendar-board">
        <header><div><small>PROYECTO DE CALENDARIO 2026</small><h2>{mode==='digen'?'DIGEN · Consolidado institucional 2026':unit+' · Calendario 2026'}</h2></div><div><span>● Mi Dirección</span><span>● Otras unidades · solo DIGEN</span></div></header>
        {tab==='calendar'?<div className="calendar-month-grid">
          {months.map(([name,theme],index)=>{
            const rows=monthRows(index)
            return <article className="calendar-month" key={name}>
              <header><b>{String(index+1).padStart(2,'0')}</b><div><strong>{name}</strong><span>{theme}</span></div><i>{rows.length}</i></header>
              <div>{rows.length?rows.map((item,rowIndex)=><div className={'calendar-event '+(item.unit===unit?'mine':'other')} key={item.date+item.title+rowIndex}><p><b>{item.date.slice(8,10)}</b><span>{item.unit}</span></p><strong>{item.title}</strong><small>{item.objective} · {item.indicator}</small></div>):<p className="calendar-empty">Sin actividades visibles.</p>}</div>
            </article>
          })}
        </div>:<div className="calendar-table-wrap"><table><thead><tr><th>Fecha</th><th>Actividad</th><th>Dirección</th><th>Objetivo / indicador</th><th>Estado</th></tr></thead><tbody>{[...visible].sort((a,b)=>a.date.localeCompare(b.date)).map((item,index)=><tr key={item.date+item.title+index}><td>{item.date}</td><td><b>{item.title}</b></td><td>{item.unit}</td><td>{item.objective}<small>{item.indicator}</small></td><td>{item.status}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="calendar-rule">Regla propuesta: cada Dirección/agencia consulta y edita sus actividades; DIGEN obtiene lectura consolidada institucional. La administración técnica permanece separada.</p>
    </main>

    {modal&&<div className="calendar-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="calendar-modal" onSubmit={save}>
      <header><div><small>NUEVA ACTIVIDAD</small><h2>Registrar actividad en el calendario</h2><p>Formato propuesto para una Dirección o agencia.</p></div><button type="button" onClick={()=>setModal(false)}>×</button></header>
      <div className="calendar-form-grid">
        <label><span>Dirección / agencia</span><select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>{units.map(code=><option key={code}>{code}</option>)}</select></label>
        <label><span>Fecha</span><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label className="wide"><span>Actividad</span><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej.: 1ª Vigilia Nacional de Oración"/></label>
        <label><span>Objetivo del Plan Anual</span><select value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}><option>Movilización nacional de oración</option><option>Formación y capacitación</option><option>Cooperación y sostenimiento</option><option>Gobernanza institucional</option></select></label>
        <label><span>Indicador relacionado</span><select value={form.indicator} onChange={e=>setForm({...form,indicator:e.target.value})}><option>Vigilias nacionales realizadas</option><option>Iglesias participantes</option><option>Actividades ejecutadas</option><option>Participantes</option></select></label>
        <label><span>Modalidad</span><select><option>Presencial</option><option>Virtual</option><option>Híbrida</option></select></label>
        <label><span>Estado</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Planificada</option><option>En curso</option><option>Completada</option></select></label>
        <label className="wide"><span>Notas / detalles</span><textarea rows="3" placeholder="Lugar, alcance, aliados, observaciones..."/></label>
        <div className="calendar-privacy"><b>Privacidad</b><span>Esta actividad será visible para la Dirección que la registra y para DIGEN. Las demás Direcciones no podrán verla.</span></div>
      </div>
      <footer><button type="button" onClick={()=>setModal(false)}>Cancelar</button><button className="primary">Guardar actividad</button></footer>
    </form></div>}
  </div>
}
