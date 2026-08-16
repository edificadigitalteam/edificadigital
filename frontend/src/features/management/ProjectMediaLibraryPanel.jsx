import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './project-supporting-files.css'

const IMAGE_LIMIT = 10 * 1024 * 1024
const VIDEO_LIMIT = 50 * 1024 * 1024
const types = new Map([
  ['image/jpeg','image'],['image/png','image'],['image/webp','image'],['application/pdf','document'],['video/mp4','video'],['video/quicktime','video'],
])
function sanitizeFileName(name) { const dot=name.lastIndexOf('.'); const ext=dot>=0?name.slice(dot).toLowerCase():''; const base=(dot>=0?name.slice(0,dot):name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'evidencia'; return `${base}${ext.replace(/[^.a-z0-9]/g,'')}` }
function formatDate(value) { return value ? new Intl.DateTimeFormat('es-VE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—' }
function formatSize(bytes) { const value=Number(bytes||0); return value<1024*1024?`${Math.max(1,Math.round(value/1024))} KB`:`${(value/1024/1024).toFixed(1)} MB` }

export default function ProjectMediaLibraryPanel({ access, projectId }) {
  const inputId=useId()
  const [project,setProject]=useState(null)
  const [media,setMedia]=useState([])
  const [files,setFiles]=useState([])
  const [caption,setCaption]=useState('')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const canDelete=access.role==='admin'||access.role==='super_admin'

  const load=useCallback(async()=>{
    if(!supabase||!projectId)return
    setLoading(true);setError('')
    const [projectResponse,directResponse,outputResponse]=await Promise.all([
      supabase.from('project').select('id,organization_id,code,name').eq('id',projectId).single(),
      supabase.from('project_media_evidence').select('id,organization_id,project_id,evidence_type,storage_path,file_name,mime_type,file_size_bytes,caption,created_at').eq('project_id',projectId).order('created_at',{ascending:false}),
      supabase.from('project_output_evidence').select('id,organization_id,project_id,project_output_id,evidence_type,storage_path,file_name,mime_type,file_size_bytes,caption,created_at,output:project_output(name)').eq('project_id',projectId).neq('evidence_type','beneficiary_list').order('created_at',{ascending:false}),
    ])
    const firstError=projectResponse.error||directResponse.error||outputResponse.error
    if(firstError){setError(firstError.message);setLoading(false);return}
    setProject(projectResponse.data)
    const combined=[...(directResponse.data??[]).map(item=>({...item,source:'project'})),...(outputResponse.data??[]).map(item=>({...item,source:'output'}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
    const withUrls=await Promise.all(combined.map(async item=>{const {data}=await supabase.storage.from('project-evidence').createSignedUrl(item.storage_path,3600);return{...item,signed_url:data?.signedUrl||''}}))
    setMedia(withUrls);setLoading(false)
  },[projectId])
  useEffect(()=>{load()},[load])

  const choose=(event)=>{const selected=Array.from(event.target.files??[]);const invalid=selected.find(file=>{const type=types.get(file.type);return !type||file.size>(type==='video'?VIDEO_LIMIT:IMAGE_LIMIT)});if(invalid)setError(`${invalid.name}: usa JPG, PNG, WEBP, PDF, MP4 o MOV dentro del tamaño permitido.`);else{setError('');setFiles(current=>[...current,...selected])}event.target.value=''}
  const upload=async()=>{if(!project||!files.length||saving)return;setSaving(true);setError('');setMessage('');try{for(const file of files){const unique=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(16).slice(2)}`;const path=`${project.organization_id}/${project.id}/library/${unique}-${sanitizeFileName(file.name)}`;const result=await supabase.storage.from('project-evidence').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});if(result.error)throw result.error;const {error:recordError}=await supabase.from('project_media_evidence').insert({organization_id:project.organization_id,project_id:project.id,evidence_type:types.get(file.type),storage_path:result.data?.path??path,file_name:file.name,mime_type:file.type,file_size_bytes:file.size,caption:caption.trim()||null,created_by:access.userId});if(recordError){await supabase.storage.from('project-evidence').remove([result.data?.path??path]);throw recordError}}setFiles([]);setCaption('');setMessage('Evidencias agregadas al proyecto.');await load()}catch(requestError){setError(requestError?.message||'No fue posible cargar las evidencias.')}setSaving(false)}
  const remove=async(item)=>{if(!canDelete||item.source!=='project'||!window.confirm('¿Eliminar esta evidencia general?'))return;const {error:deleteError}=await supabase.from('project_media_evidence').delete().eq('id',item.id);if(deleteError){setError(deleteError.message);return}await supabase.storage.from('project-evidence').remove([item.storage_path]);await load()}
  const directCount=useMemo(()=>media.filter(item=>item.source==='project').length,[media])

  if(!projectId)return null
  return <section className="project-supporting-files project-media-only">
    <header><div><p>EVIDENCIAS DEL PROYECTO</p><h2>Biblioteca multimedia y documental</h2><span>Fotografías, videos, PDF y evidencias generales. Los soportes de beneficiarios se administran dentro de su requisito de seguimiento.</span></div><div><strong>{media.length}</strong><span>evidencias</span></div></header>
    {error&&<p className="project-files-feedback error">{error}</p>}{message&&<p className="project-files-feedback success">{message}</p>}
    <article className="project-files-card">
      <div className="project-files-card-heading"><div><small>MULTIMEDIA</small><h3>Banco de evidencias</h3><p>{directCount} archivos fueron cargados directamente en esta biblioteca; también se muestran evidencias vinculadas a avances del proyecto.</p></div></div>
      <div className="project-files-upload no-print"><label htmlFor={inputId}>＋ Seleccionar evidencias</label><input id={inputId} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime" onChange={choose}/><input value={caption} onChange={event=>setCaption(event.target.value)} placeholder="Descripción general de estos archivos (opcional)"/>{files.length>0&&<div className="project-pending-files">{files.map((file,index)=><span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}>×</button></span>)}</div>}<button className="primary" type="button" disabled={!files.length||saving} onClick={upload}>{saving?'Cargando…':`Cargar ${files.length||''} evidencia${files.length===1?'':'s'}`}</button></div>
      {loading?<p className="project-files-empty">Cargando…</p>:!media.length?<p className="project-files-empty">Todavía no hay evidencias multimedia.</p>:<div className="project-media-grid">{media.map(item=><div key={`${item.source}-${item.id}`}><a href={item.signed_url||'#'} target="_blank" rel="noreferrer">{item.evidence_type==='image'&&item.signed_url?<img src={item.signed_url} alt={item.caption||item.file_name}/>:<span className={`project-file-icon ${item.evidence_type}`}>{item.evidence_type==='video'?'▶':'PDF'}</span>}<strong>{item.file_name}</strong></a><small>{item.source==='output'?`Avance: ${item.output?.name||'registro de ejecución'}`:'Evidencia general'} · {formatSize(item.file_size_bytes)} · {formatDate(item.created_at)}</small>{item.caption&&<p>{item.caption}</p>}{canDelete&&item.source==='project'&&<button type="button" onClick={()=>remove(item)}>Eliminar</button>}</div>)}</div>}
    </article>
  </section>
}
