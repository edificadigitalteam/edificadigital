import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './project-beneficiary-requirement.css'

const LIMIT = 20 * 1024 * 1024
const allowedTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
])

function sanitizeFileName(name) {
  const lastDot = name.lastIndexOf('.')
  const extension = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : ''
  const base = (lastDot >= 0 ? name.slice(0, lastDot) : name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'beneficiarios'
  return `${base}${extension.replace(/[^.a-z0-9]/g, '')}`
}
function formatNumber(value) { return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(Number(value || 0)) }
function formatDate(value) { return value ? new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(value)) : '—' }
function formatSize(bytes) { const value = Number(bytes || 0); return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }

export default function ProjectBeneficiaryRequirementPanel({ access, projectId }) {
  const inputId = useId()
  const [project, setProject] = useState(null)
  const [output, setOutput] = useState(null)
  const [personUnitId, setPersonUnitId] = useState('')
  const [evidences, setEvidences] = useState([])
  const [legacyDocs, setLegacyDocs] = useState([])
  const [target, setTarget] = useState('')
  const [documented, setDocumented] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canManage = access.role === 'admin' || access.role === 'super_admin' || access.role === 'operator'

  const load = useCallback(async () => {
    if (!supabase || !projectId) return
    setLoading(true); setError('')
    const [projectResponse, outputResponse, unitResponse, legacyResponse] = await Promise.all([
      supabase.from('project').select('id,organization_id,code,name,reporting_requirements').eq('id', projectId).single(),
      supabase.from('project_output').select('*').eq('project_id', projectId).eq('output_type', 'beneficiary_documentation').order('created_at').limit(1).maybeSingle(),
      supabase.from('unit_of_measure').select('id').eq('code', 'person').eq('active', true).maybeSingle(),
      supabase.from('project_beneficiary_document').select('id,document_type,storage_path,file_name,mime_type,file_size_bytes,notes,created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    ])
    const firstError = projectResponse.error || outputResponse.error || unitResponse.error || legacyResponse.error
    if (firstError) { setError(firstError.message); setLoading(false); return }
    const currentOutput = outputResponse.data ?? null
    setProject(projectResponse.data); setOutput(currentOutput); setPersonUnitId(unitResponse.data?.id || '')
    setTarget(currentOutput ? String(currentOutput.target_quantity ?? '') : '')
    setDocumented(currentOutput ? String(currentOutput.delivered_quantity ?? '') : '')
    setNotes(currentOutput?.notes || '')

    let evidenceRows = []
    if (currentOutput) {
      const { data, error: evidenceError } = await supabase.from('project_output_evidence').select('id,storage_path,file_name,mime_type,file_size_bytes,caption,created_at').eq('project_output_id', currentOutput.id).eq('evidence_type', 'beneficiary_list').order('created_at', { ascending: false })
      if (evidenceError) setError(evidenceError.message)
      else evidenceRows = data ?? []
    }
    const signedEvidence = await Promise.all(evidenceRows.map(async (item) => { const { data } = await supabase.storage.from('project-evidence').createSignedUrl(item.storage_path, 3600); return { ...item, signed_url: data?.signedUrl || '' } }))
    const signedLegacy = await Promise.all((legacyResponse.data ?? []).map(async (item) => { const { data } = await supabase.storage.from('project-evidence').createSignedUrl(item.storage_path, 3600); return { ...item, signed_url: data?.signedUrl || '' } }))
    setEvidences(signedEvidence); setLegacyDocs(signedLegacy); setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const completion = useMemo(() => Number(target || 0) > 0 ? Math.round((Number(documented || 0) / Number(target)) * 1000) / 10 : 0, [documented, target])
  const allDocuments = useMemo(() => [
    ...evidences.map((item) => ({ ...item, source: 'requirement' })),
    ...legacyDocs.map((item) => ({ ...item, source: 'legacy' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [evidences, legacyDocs])

  const chooseFiles = (event) => {
    const selected = Array.from(event.target.files ?? [])
    const invalid = selected.find((file) => !allowedTypes.has(file.type) || file.size > LIMIT)
    if (invalid) setError(`${invalid.name}: usa PDF, Excel o CSV de máximo 20 MB.`)
    else { setError(''); setFiles((current) => [...current, ...selected]) }
    event.target.value = ''
  }

  const uploadFiles = async (outputId) => {
    for (const file of files) {
      const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const path = `${project.organization_id}/${project.id}/${outputId}/beneficiarios/${unique}-${sanitizeFileName(file.name)}`
      const upload = await supabase.storage.from('project-evidence').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
      if (upload.error) throw upload.error
      const { error: recordError } = await supabase.from('project_output_evidence').insert({
        organization_id: project.organization_id,
        project_id: project.id,
        project_output_id: outputId,
        evidence_type: 'beneficiary_list',
        storage_path: upload.data?.path ?? path,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        caption: notes.trim() || 'Lista de beneficiarios',
        created_by: access.userId,
      })
      if (recordError) { await supabase.storage.from('project-evidence').remove([upload.data?.path ?? path]); throw recordError }
    }
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || !project || !canManage || saving) return
    const targetNumber = Number(target)
    const documentedNumber = Number(documented || 0)
    if (!Number.isFinite(targetNumber) || targetNumber <= 0) { setError('Indica la cantidad de beneficiarios que debe quedar documentada como meta del requisito.'); return }
    if (!Number.isFinite(documentedNumber) || documentedNumber < 0) { setError('La cantidad documentada debe ser cero o mayor.'); return }
    if (!output && !personUnitId) { setError('No se encontró la unidad de medida “Persona”.'); return }
    if (!files.length && !allDocuments.length) { setError('Este requisito necesita al menos un PDF, Excel o CSV como evidencia.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const payload = {
        organization_id: project.organization_id,
        project_id: project.id,
        name: 'Beneficiarios documentados',
        output_type: 'beneficiary_documentation',
        unit_of_measure_id: personUnitId || output?.unit_of_measure_id,
        unit_label: 'pers.',
        target_quantity: targetNumber,
        produced_quantity: documentedNumber,
        delivered_quantity: documentedNumber,
        beneficiary_count: documentedNumber,
        status: documentedNumber >= targetNumber ? 'completed' : documentedNumber > 0 ? 'in_progress' : 'planned',
        notes: notes.trim() || 'Requisito documental de beneficiarios solicitado para la rendición del proyecto.',
        updated_by: access.userId,
      }
      let outputId = output?.id
      if (outputId) {
        const { error: updateError } = await supabase.from('project_output').update(payload).eq('id', outputId)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase.from('project_output').insert({ ...payload, created_by: access.userId }).select('id').single()
        if (insertError) throw insertError
        outputId = data.id
      }
      if (files.length) await uploadFiles(outputId)
      setFiles([]); setMessage('Requisito de beneficiarios actualizado con su soporte documental.'); await load()
    } catch (requestError) { setError(requestError?.message || 'No fue posible actualizar el requisito de beneficiarios.') }
    setSaving(false)
  }

  const removeEvidence = async (item) => {
    if (item.source === 'legacy' || !canManage || !window.confirm('¿Eliminar este archivo del requisito?')) return
    const { error: deleteError } = await supabase.from('project_output_evidence').delete().eq('id', item.id)
    if (deleteError) { setError(deleteError.message); return }
    await supabase.storage.from('project-evidence').remove([item.storage_path])
    await load()
  }

  if (!projectId) return null
  if (loading) return <section className="beneficiary-requirement-card"><p>Cargando requisito de beneficiarios…</p></section>

  return <section className="beneficiary-requirement-card">
    <header><div><p>REQUISITO DE SEGUIMIENTO DEL PROYECTO</p><h2>Beneficiarios documentados</h2><span>La lista deja de ser un archivo aislado: aquí funciona como una meta verificable del proyecto y cada avance debe quedar respaldado por PDF, Excel o CSV.</span></div><div className="beneficiary-requirement-score"><strong>{completion}%</strong><span>documentado</span></div></header>
    {project?.reporting_requirements && <div className="beneficiary-partner-note"><strong>Exigencias de rendición del proyecto</strong><p>{project.reporting_requirements}</p></div>}
    {error && <p className="project-files-feedback error">{error}</p>}{message && <p className="project-files-feedback success">{message}</p>}

    <div className="beneficiary-requirement-metrics"><article><span>Meta documental</span><strong>{formatNumber(target)}</strong><small>personas</small></article><article><span>Personas documentadas</span><strong>{formatNumber(documented)}</strong><small>según soportes cargados</small></article><article><span>Pendiente</span><strong>{formatNumber(Math.max(Number(target || 0) - Number(documented || 0), 0))}</strong><small>personas por documentar</small></article><article><span>Soportes</span><strong>{allDocuments.length}</strong><small>archivos vinculados</small></article></div>

    {canManage && <form className="beneficiary-requirement-form" onSubmit={save}>
      <div className="beneficiary-requirement-fields"><label><span>Meta de beneficiarios a documentar *</span><input type="number" min="1" step="1" value={target} onChange={(event) => setTarget(event.target.value)} required /></label><label><span>Cantidad documentada hasta ahora *</span><input type="number" min="0" step="1" value={documented} onChange={(event) => setDocumented(event.target.value)} required /></label><label className="wide"><span>Observación o criterio del aliado</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej.: el aliado exige nombre, comunidad, firma y fecha de entrega." /></label></div>
      <div className="beneficiary-requirement-upload"><div><strong>Adjuntos del avance</strong><span>PDF, XLSX, XLS o CSV · máximo 20 MB por archivo.</span></div><label htmlFor={inputId}>＋ Agregar listas o soportes</label><input id={inputId} type="file" multiple accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,.xlsx,.xls,.csv" onChange={chooseFiles} />{files.length > 0 && <div className="project-pending-files">{files.map((file,index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_,itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}<button className="primary" disabled={saving}>{saving ? 'Guardando…' : output ? 'Actualizar avance documental' : 'Crear requisito y registrar avance'}</button></div>
    </form>}

    <div className="beneficiary-requirement-files"><div className="beneficiary-requirement-files-heading"><div><small>EVIDENCIAS DEL REQUISITO</small><h3>Listas vinculadas a esta meta</h3></div><span>{allDocuments.length}</span></div>{!allDocuments.length ? <p className="project-files-empty">Todavía no existen soportes documentales.</p> : <div>{allDocuments.map((item) => <article key={`${item.source}-${item.id}`}><span className="project-file-icon sheet">{item.mime_type === 'application/pdf' ? 'PDF' : 'XLS'}</span><div><a href={item.signed_url || '#'} target="_blank" rel="noreferrer"><strong>{item.file_name}</strong></a><small>{item.source === 'legacy' ? 'Soporte histórico integrado' : 'Evidencia del requisito'} · {formatSize(item.file_size_bytes)} · {formatDate(item.created_at)}</small>{(item.caption || item.notes) && <p>{item.caption || item.notes}</p>}</div>{canManage && item.source !== 'legacy' && <button type="button" onClick={() => removeEvidence(item)}>Eliminar</button>}</article>)}</div>}</div>
  </section>
}
