import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './project-supporting-files.css'

const IMAGE_LIMIT = 10 * 1024 * 1024
const VIDEO_LIMIT = 50 * 1024 * 1024
const DOCUMENT_LIMIT = 20 * 1024 * 1024

const mediaTypes = new Map([
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
  ['application/pdf', 'document'],
  ['video/mp4', 'video'],
  ['video/quicktime', 'video'],
])

const beneficiaryTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
])

const beneficiaryTypeLabels = {
  beneficiary_list: 'Lista de beneficiarios',
  attendance_list: 'Lista de asistencia',
  distribution_list: 'Lista de entrega o distribución',
  other: 'Otro soporte',
}

function sanitizeFileName(name) {
  const lastDot = name.lastIndexOf('.')
  const extension = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : ''
  const base = (lastDot >= 0 ? name.slice(0, lastDot) : name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'archivo'
  return `${base}${extension.replace(/[^.a-z0-9]/g, '')}`
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatSize(bytes) {
  const size = Number(bytes || 0)
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function ProjectSupportingFilesPanel({ access, projectId }) {
  const mediaInputId = useId()
  const beneficiaryInputId = useId()
  const [project, setProject] = useState(null)
  const [media, setMedia] = useState([])
  const [beneficiaryDocs, setBeneficiaryDocs] = useState([])
  const [mediaFiles, setMediaFiles] = useState([])
  const [beneficiaryFiles, setBeneficiaryFiles] = useState([])
  const [caption, setCaption] = useState('')
  const [documentType, setDocumentType] = useState('beneficiary_list')
  const [documentNotes, setDocumentNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingMedia, setSavingMedia] = useState(false)
  const [savingDocs, setSavingDocs] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canDelete = access.role === 'admin' || access.role === 'super_admin'

  const load = useCallback(async () => {
    if (!supabase || !projectId) return
    setLoading(true)
    setError('')
    const [projectResponse, directResponse, outputResponse, docsResponse] = await Promise.all([
      supabase.from('project').select('id, organization_id, code, name').eq('id', projectId).single(),
      supabase.from('project_media_evidence').select('id, organization_id, project_id, evidence_type, storage_path, file_name, mime_type, file_size_bytes, caption, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_output_evidence').select('id, organization_id, project_id, project_output_id, evidence_type, storage_path, file_name, mime_type, file_size_bytes, caption, created_at, output:project_output(name)').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_beneficiary_document').select('id, organization_id, project_id, document_type, storage_path, file_name, mime_type, file_size_bytes, notes, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    ])
    const firstError = [projectResponse, directResponse, outputResponse, docsResponse].find((response) => response.error)?.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }
    setProject(projectResponse.data)
    const combined = [
      ...(directResponse.data ?? []).map((item) => ({ ...item, source: 'project' })),
      ...(outputResponse.data ?? []).map((item) => ({ ...item, source: 'output' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const withUrls = await Promise.all(combined.map(async (item) => {
      const { data } = await supabase.storage.from('project-evidence').createSignedUrl(item.storage_path, 3600)
      return { ...item, signed_url: data?.signedUrl ?? '' }
    }))
    const docsWithUrls = await Promise.all((docsResponse.data ?? []).map(async (item) => {
      const { data } = await supabase.storage.from('project-evidence').createSignedUrl(item.storage_path, 3600)
      return { ...item, signed_url: data?.signedUrl ?? '' }
    }))
    setMedia(withUrls)
    setBeneficiaryDocs(docsWithUrls)
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const validateMedia = (file) => {
    const type = mediaTypes.get(file.type)
    if (!type) return `${file.name}: usa JPG, PNG, WEBP, PDF, MP4 o MOV.`
    const max = type === 'video' ? VIDEO_LIMIT : IMAGE_LIMIT
    if (file.size > max) return `${file.name}: ${type === 'video' ? 'máximo 50 MB' : 'máximo 10 MB'}.`
    return ''
  }

  const selectMedia = (event) => {
    const files = Array.from(event.target.files ?? [])
    const invalid = files.map((file) => validateMedia(file)).find(Boolean)
    if (invalid) setError(invalid)
    else { setError(''); setMediaFiles((current) => [...current, ...files]) }
    event.target.value = ''
  }

  const selectBeneficiaryDocs = (event) => {
    const files = Array.from(event.target.files ?? [])
    const invalid = files.find((file) => !beneficiaryTypes.has(file.type) || file.size > DOCUMENT_LIMIT)
    if (invalid) setError(`${invalid.name}: usa PDF, Excel o CSV y un máximo de 20 MB.`)
    else { setError(''); setBeneficiaryFiles((current) => [...current, ...files]) }
    event.target.value = ''
  }

  const uploadMedia = async () => {
    if (!project || !mediaFiles.length || savingMedia) return
    setSavingMedia(true); setError(''); setMessage('')
    try {
      for (const file of mediaFiles) {
        const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
        const path = `${project.organization_id}/${project.id}/library/${unique}-${sanitizeFileName(file.name)}`
        const upload = await supabase.storage.from('project-evidence').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
        if (upload.error) throw upload.error
        const type = mediaTypes.get(file.type)
        const { error: recordError } = await supabase.from('project_media_evidence').insert({
          organization_id: project.organization_id,
          project_id: project.id,
          evidence_type: type,
          storage_path: upload.data?.path ?? path,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          caption: caption.trim() || null,
          created_by: access.userId,
        })
        if (recordError) {
          await supabase.storage.from('project-evidence').remove([upload.data?.path ?? path])
          throw recordError
        }
      }
      setMediaFiles([]); setCaption(''); setMessage('Evidencias agregadas al proyecto.'); await load()
    } catch (requestError) { setError(requestError?.message ?? 'No fue posible cargar las evidencias.') }
    setSavingMedia(false)
  }

  const uploadBeneficiaryDocs = async () => {
    if (!project || !beneficiaryFiles.length || savingDocs) return
    setSavingDocs(true); setError(''); setMessage('')
    try {
      for (const file of beneficiaryFiles) {
        const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
        const path = `${project.organization_id}/${project.id}/beneficiaries/${unique}-${sanitizeFileName(file.name)}`
        const upload = await supabase.storage.from('project-evidence').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
        if (upload.error) throw upload.error
        const { error: recordError } = await supabase.from('project_beneficiary_document').insert({
          organization_id: project.organization_id,
          project_id: project.id,
          document_type: documentType,
          storage_path: upload.data?.path ?? path,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          notes: documentNotes.trim() || null,
          created_by: access.userId,
        })
        if (recordError) {
          await supabase.storage.from('project-evidence').remove([upload.data?.path ?? path])
          throw recordError
        }
      }
      setBeneficiaryFiles([]); setDocumentNotes(''); setMessage('Soportes de beneficiarios cargados.'); await load()
    } catch (requestError) { setError(requestError?.message ?? 'No fue posible cargar los soportes.') }
    setSavingDocs(false)
  }

  const removeRecord = async (kind, item) => {
    if (!canDelete || !window.confirm('El archivo será retirado del proyecto. ¿Continuar?')) return
    const table = kind === 'media' ? 'project_media_evidence' : 'project_beneficiary_document'
    const { error: deleteError } = await supabase.from(table).delete().eq('id', item.id)
    if (deleteError) { setError(deleteError.message); return }
    await supabase.storage.from('project-evidence').remove([item.storage_path])
    setMessage('Archivo eliminado.'); await load()
  }

  const directCount = useMemo(() => media.filter((item) => item.source === 'project').length, [media])

  if (!projectId) return null

  return (
    <section className="project-supporting-files">
      <header><div><p>EVIDENCIAS Y SOPORTES</p><h2>Archivo documental del proyecto</h2><span>Centraliza fotografías, videos, PDFs y listas de beneficiarios. Las evidencias cargadas dentro de avances también aparecen aquí.</span></div><div><strong>{media.length}</strong><span>evidencias</span><strong>{beneficiaryDocs.length}</strong><span>listas</span></div></header>
      {error && <p className="project-files-feedback error">{error}</p>}
      {message && <p className="project-files-feedback success">{message}</p>}

      <div className="project-files-columns">
        <article className="project-files-card">
          <div className="project-files-card-heading"><div><small>MULTIMEDIA</small><h3>Banco de evidencias</h3><p>Fotos, videos y documentos generales del proyecto. {directCount} archivos fueron cargados directamente en esta biblioteca.</p></div></div>
          <div className="project-files-upload no-print">
            <label htmlFor={mediaInputId}>＋ Seleccionar evidencias</label><input id={mediaInputId} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime" onChange={selectMedia} />
            <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Descripción general de estos archivos (opcional)" />
            {mediaFiles.length > 0 && <div className="project-pending-files">{mediaFiles.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setMediaFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}
            <button className="primary" type="button" disabled={!mediaFiles.length || savingMedia} onClick={uploadMedia}>{savingMedia ? 'Cargando…' : `Cargar ${mediaFiles.length || ''} evidencia${mediaFiles.length === 1 ? '' : 's'}`}</button>
          </div>
          {loading ? <p className="project-files-empty">Cargando…</p> : !media.length ? <p className="project-files-empty">Todavía no hay evidencias multimedia.</p> : <div className="project-media-grid">{media.map((item) => <div key={`${item.source}-${item.id}`}><a href={item.signed_url || '#'} target="_blank" rel="noreferrer">{item.evidence_type === 'image' && item.signed_url ? <img src={item.signed_url} alt={item.caption || item.file_name} /> : <span className={`project-file-icon ${item.evidence_type}`}>{item.evidence_type === 'video' ? '▶' : 'PDF'}</span>}<strong>{item.file_name}</strong></a><small>{item.source === 'output' ? `Avance: ${item.output?.name || 'registro de ejecución'}` : 'Evidencia general'} · {formatSize(item.file_size_bytes)} · {formatDate(item.created_at)}</small>{item.caption && <p>{item.caption}</p>}{canDelete && item.source === 'project' && <button type="button" onClick={() => removeRecord('media', item)}>Eliminar</button>}</div>)}</div>}
        </article>

        <article className="project-files-card beneficiary-documents">
          <div className="project-files-card-heading"><div><small>BENEFICIARIOS</small><h3>Listas y soportes escaneados</h3><p>Adjunta PDF, Excel o CSV cuando la rendición requiera listas firmadas, asistencia o distribución.</p></div></div>
          <div className="project-files-upload no-print">
            <label><span>Tipo de documento</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{Object.entries(beneficiaryTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label htmlFor={beneficiaryInputId}>＋ Seleccionar PDF o Excel</label><input id={beneficiaryInputId} type="file" multiple accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,.xlsx,.xls,.csv" onChange={selectBeneficiaryDocs} />
            <textarea value={documentNotes} onChange={(event) => setDocumentNotes(event.target.value)} placeholder="Descripción, comunidad, jornada o aclaración (opcional)" />
            {beneficiaryFiles.length > 0 && <div className="project-pending-files">{beneficiaryFiles.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setBeneficiaryFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}
            <button className="primary" type="button" disabled={!beneficiaryFiles.length || savingDocs} onClick={uploadBeneficiaryDocs}>{savingDocs ? 'Cargando…' : `Cargar ${beneficiaryFiles.length || ''} archivo${beneficiaryFiles.length === 1 ? '' : 's'}`}</button>
          </div>
          {!beneficiaryDocs.length ? <p className="project-files-empty">Todavía no hay listas o soportes documentales.</p> : <div className="beneficiary-document-list">{beneficiaryDocs.map((item) => <div key={item.id}><span className="project-file-icon sheet">{item.mime_type === 'application/pdf' ? 'PDF' : 'XLS'}</span><div><a href={item.signed_url || '#'} target="_blank" rel="noreferrer"><strong>{item.file_name}</strong></a><small>{beneficiaryTypeLabels[item.document_type] || item.document_type} · {formatSize(item.file_size_bytes)} · {formatDate(item.created_at)}</small>{item.notes && <p>{item.notes}</p>}</div>{canDelete && <button type="button" onClick={() => removeRecord('beneficiary', item)}>Eliminar</button>}</div>)}</div>}
        </article>
      </div>
    </section>
  )
}
