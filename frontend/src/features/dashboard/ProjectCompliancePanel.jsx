import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import ProjectBeneficiariesPanel from './ProjectBeneficiariesPanel.jsx'
import { buildComplianceReportDocDefinition } from './complianceReportPdf.js'
import {
  donationStatusLabels,
  donationTypeLabels,
  donationValue,
  expenseStatusLabels,
  formatBreakdown,
  formatDate,
  formatMoney,
  formatNumber,
  outputStatusLabels,
  percentage,
} from './reportFormatting.js'
import './operations.css'
import './compliance.css'

const IMAGE_LIMIT = 10 * 1024 * 1024
const VIDEO_LIMIT = 50 * 1024 * 1024
const evidenceMimeTypes = new Map([
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
  ['application/pdf', 'document'],
  ['video/mp4', 'video'],
  ['video/quicktime', 'video'],
])

const emptyOutput = {
  id: '',
  name: '',
  unit_of_measure_id: '',
  unit_label: '',
  target_quantity: '',
  produced_quantity: '',
  delivered_quantity: '',
  beneficiary_count: '',
  status: 'in_progress',
  notes: '',
}

const createEmptyExpense = () => ({
  id: '',
  expense_date: new Date().toISOString().slice(0, 10),
  supplier_name: '',
  category: '',
  description: '',
  amount: '',
  payment_reference: '',
  invoice_number: '',
  status: 'reported',
})

function sanitizeFileName(name) {
  const lastDot = name.lastIndexOf('.')
  const extension = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : ''
  const base = (lastDot >= 0 ? name.slice(0, lastDot) : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'evidence'
  return `${base}${extension.replace(/[^.a-z0-9]/g, '')}`
}

function evidenceType(file) {
  return evidenceMimeTypes.get(file?.type) ?? null
}

function validateEvidence(file) {
  const type = evidenceType(file)
  if (!type) return 'Formato no permitido. Usa JPG, JPEG, PNG, WEBP, PDF, MP4 o MOV.'
  const maximum = type === 'video' ? VIDEO_LIMIT : IMAGE_LIMIT
  if (Number(file.size) > maximum) return type === 'video' ? 'Cada video puede pesar hasta 50 MB.' : 'Cada imagen o PDF puede pesar hasta 10 MB.'
  return ''
}

export default function ProjectCompliancePanel({ access }) {
  const query = new URLSearchParams(window.location.search)
  const queryProject = query.get('project') ?? ''
  const querySection = query.get('section') ?? ''
  const evidenceInputId = useId()
  const [projects, setProjects] = useState([])
  const [units, setUnits] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(queryProject)
  const [outputs, setOutputs] = useState([])
  const [expenses, setExpenses] = useState([])
  const [evidences, setEvidences] = useState([])
  const [summary, setSummary] = useState(null)
  const [funding, setFunding] = useState(null)
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [outputForm, setOutputForm] = useState(emptyOutput)
  const [expenseForm, setExpenseForm] = useState(createEmptyExpense)
  const [activeForm, setActiveForm] = useState(querySection === 'beneficiary' ? 'beneficiary' : 'output')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enablingBeneficiaries, setEnablingBeneficiaries] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManageProject = access.role === 'admin' || access.role === 'super_admin'
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const evidenceByOutput = useMemo(() => {
    const grouped = new Map()
    evidences.forEach((evidence) => {
      const current = grouped.get(evidence.project_output_id) ?? []
      current.push(evidence)
      grouped.set(evidence.project_output_id, current)
    })
    return grouped
  }, [evidences])

  const loadProjects = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [projectResponse, unitResponse] = await Promise.all([
      supabase
        .from('project')
        .select('id, organization_id, code, name, funding_partner_actor_id, funding_partner, status, start_date, end_date, approved_budget, currency, objective, expected_results, reporting_requirements, beneficiary_detail_enabled, organization:organization(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('unit_of_measure')
        .select('id, code, name_es, name_en, abbreviation')
        .eq('active', true)
        .order('name_es'),
    ])

    if (projectResponse.error || unitResponse.error) {
      setProjects([])
      setUnits([])
      setError(projectResponse.error?.message ?? unitResponse.error?.message ?? 'No fue posible cargar el catálogo.')
      setLoading(false)
      return
    }

    const nextProjects = projectResponse.data ?? []
    setProjects(nextProjects)
    setUnits(unitResponse.data ?? [])
    setSelectedProjectId((current) => {
      if (current && nextProjects.some((project) => project.id === current)) return current
      return nextProjects[0]?.id ?? ''
    })
    setLoading(false)
  }, [])

  const loadExecution = useCallback(async (projectId) => {
    if (!supabase || !projectId) {
      setOutputs([])
      setExpenses([])
      setEvidences([])
      setSummary(null)
      setFunding(null)
      return
    }

    setLoading(true)
    setError('')
    const [outputResponse, expenseResponse, summaryResponse, fundingResponse] = await Promise.all([
      supabase
        .from('project_output')
        .select('id, organization_id, project_id, name, unit_of_measure_id, unit_label, target_quantity, produced_quantity, delivered_quantity, beneficiary_count, status, notes, created_at, updated_at, unit:unit_of_measure(id, code, name_es, name_en, abbreviation)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_expense')
        .select('id, project_id, expense_date, supplier_name, category, description, amount, currency, payment_reference, invoice_number, status, created_at, updated_at')
        .eq('project_id', projectId)
        .order('expense_date', { ascending: false }),
      supabase.rpc('project_compliance_summary', { target_project_id: projectId }),
      supabase.rpc('project_funding_reconciliation', { target_project_id: projectId }),
    ])

    if (outputResponse.error || expenseResponse.error || summaryResponse.error || fundingResponse.error) {
      setError(outputResponse.error?.message ?? expenseResponse.error?.message ?? summaryResponse.error?.message ?? fundingResponse.error?.message ?? 'No fue posible cargar la ejecución.')
      setLoading(false)
      return
    }

    const nextOutputs = outputResponse.data ?? []
    let nextEvidences = []
    if (nextOutputs.length) {
      const { data: evidenceData, error: evidenceError } = await supabase
        .from('project_output_evidence')
        .select('id, organization_id, project_id, project_output_id, evidence_type, storage_path, file_name, mime_type, file_size_bytes, caption, created_at')
        .in('project_output_id', nextOutputs.map((output) => output.id))
        .order('created_at', { ascending: true })

      if (evidenceError) {
        setError(evidenceError.message)
      } else {
        nextEvidences = await Promise.all((evidenceData ?? []).map(async (evidence) => {
          const { data } = await supabase.storage.from('project-evidence').createSignedUrl(evidence.storage_path, 3600)
          return { ...evidence, signed_url: data?.signedUrl ?? '' }
        }))
      }
    }

    setOutputs(nextOutputs)
    setExpenses(expenseResponse.data ?? [])
    setEvidences(nextEvidences)
    setSummary(summaryResponse.data ?? null)
    setFunding(fundingResponse.data ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { loadExecution(selectedProjectId) }, [loadExecution, selectedProjectId])

  const resetForms = () => {
    setOutputForm(emptyOutput)
    setExpenseForm(createEmptyExpense())
    setEvidenceFiles([])
    setError('')
    setMessage('')
    setActiveForm('output')
  }

  const editOutput = (output) => {
    setActiveForm('output')
    setOutputForm({
      id: output.id,
      name: output.name,
      unit_of_measure_id: output.unit_of_measure_id ?? '',
      unit_label: output.unit_label,
      target_quantity: output.target_quantity,
      produced_quantity: output.produced_quantity,
      delivered_quantity: output.delivered_quantity,
      beneficiary_count: output.beneficiary_count,
      status: output.status,
      notes: output.notes ?? '',
    })
    setEvidenceFiles([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const editExpense = (expense) => {
    setActiveForm('expense')
    setExpenseForm({
      id: expense.id,
      expense_date: expense.expense_date,
      supplier_name: expense.supplier_name,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      payment_reference: expense.payment_reference ?? '',
      invoice_number: expense.invoice_number ?? '',
      status: expense.status,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const chooseEvidence = (event) => {
    const selected = Array.from(event.target.files ?? [])
    const invalid = selected.map((file) => ({ file, error: validateEvidence(file) })).find((entry) => entry.error)
    if (invalid) {
      setError(`${invalid.file.name}: ${invalid.error}`)
      event.target.value = ''
      return
    }
    setError('')
    setEvidenceFiles((current) => [...current, ...selected])
    event.target.value = ''
  }

  const removePendingEvidence = (index) => setEvidenceFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))

  const uploadEvidence = async (outputId, files) => {
    for (const file of files) {
      const type = evidenceType(file)
      const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const path = `${selectedProject.organization_id}/${selectedProject.id}/${outputId}/${uniqueId}-${sanitizeFileName(file.name)}`
      const upload = await supabase.storage.from('project-evidence').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      })
      if (upload.error) throw upload.error
      const { error: recordError } = await supabase.from('project_output_evidence').insert({
        organization_id: selectedProject.organization_id,
        project_id: selectedProject.id,
        project_output_id: outputId,
        evidence_type: type,
        storage_path: upload.data?.path ?? path,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        created_by: access.userId,
      })
      if (recordError) {
        await supabase.storage.from('project-evidence').remove([upload.data?.path ?? path])
        throw recordError
      }
    }
  }

  const saveOutput = async (event) => {
    event.preventDefault()
    if (!supabase || !selectedProject || saving) return
    const existingEvidence = outputForm.id ? (evidenceByOutput.get(outputForm.id) ?? []) : []
    if (!evidenceFiles.length && !existingEvidence.length) {
      setError('Cada avance o entrega debe incluir al menos una evidencia multimedia.')
      return
    }
    if (!outputForm.unit_of_measure_id) {
      setError('Selecciona una unidad de medida del catálogo.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    const selectedUnit = units.find((unit) => unit.id === outputForm.unit_of_measure_id)
    const payload = {
      organization_id: selectedProject.organization_id,
      project_id: selectedProject.id,
      name: outputForm.name.trim(),
      unit_of_measure_id: outputForm.unit_of_measure_id,
      unit_label: selectedUnit?.abbreviation || selectedUnit?.name_es || 'u',
      target_quantity: Number(outputForm.target_quantity || 0),
      produced_quantity: Number(outputForm.produced_quantity || 0),
      delivered_quantity: Number(outputForm.delivered_quantity || 0),
      beneficiary_count: Number(outputForm.beneficiary_count || 0),
      status: outputForm.status,
      notes: outputForm.notes.trim() || null,
      created_by: access.userId,
      updated_by: access.userId,
    }

    try {
      const request = outputForm.id
        ? supabase.from('project_output').update(payload).eq('id', outputForm.id).select('id').single()
        : supabase.from('project_output').insert(payload).select('id').single()
      const { data: savedOutput, error: requestError } = await request
      if (requestError) throw requestError
      if (evidenceFiles.length) await uploadEvidence(savedOutput.id, evidenceFiles)
      setMessage(outputForm.id ? 'Avance actualizado.' : 'Avance registrado.')
      setOutputForm(emptyOutput)
      setEvidenceFiles([])
      await loadExecution(selectedProject.id)
    } catch (requestError) {
      setError(requestError?.message ?? 'No fue posible guardar el avance y sus evidencias.')
    }
    setSaving(false)
  }

  const saveExpense = async (event) => {
    event.preventDefault()
    if (!supabase || !selectedProject || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    const payload = {
      project_id: selectedProject.id,
      expense_date: expenseForm.expense_date,
      supplier_name: expenseForm.supplier_name.trim(),
      category: expenseForm.category.trim(),
      description: expenseForm.description.trim(),
      amount: Number(expenseForm.amount),
      currency: selectedProject.currency,
      payment_reference: expenseForm.payment_reference.trim() || null,
      invoice_number: expenseForm.invoice_number.trim() || null,
      status: expenseForm.status,
      created_by: access.userId,
    }
    const request = expenseForm.id
      ? supabase.from('project_expense').update(payload).eq('id', expenseForm.id)
      : supabase.from('project_expense').insert(payload)
    const { error: requestError } = await request
    if (requestError) setError(requestError.message)
    else {
      setMessage(expenseForm.id ? 'Inversión actualizada.' : 'Inversión ejecutada registrada.')
      setExpenseForm(createEmptyExpense())
      await loadExecution(selectedProject.id)
    }
    setSaving(false)
  }

  const enableBeneficiaryRegistry = async () => {
    if (!supabase || !selectedProject || !canManageProject || enablingBeneficiaries) return
    setEnablingBeneficiaries(true)
    setError('')
    const { error: requestError } = await supabase
      .from('project')
      .update({ beneficiary_detail_enabled: true, updated_by: access.userId })
      .eq('id', selectedProject.id)
    if (requestError) setError(requestError.message)
    else {
      setMessage('El registro individual de personas beneficiadas quedó activado para este proyecto.')
      await loadProjects()
      setActiveForm('beneficiary')
    }
    setEnablingBeneficiaries(false)
  }

  const fallbackInvestment = useMemo(() => expenses
    .filter((expense) => expense.status !== 'rejected' && expense.currency === selectedProject?.currency)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [expenses, selectedProject?.currency])
  const fallbackBeneficiaries = useMemo(() => outputs.reduce((sum, output) => sum + Number(output.beneficiary_count || 0), 0), [outputs])
  const fallbackCompliance = useMemo(() => {
    const measurable = outputs.filter((output) => Number(output.target_quantity) > 0)
    if (!measurable.length) return 0
    return Math.round(measurable.reduce((sum, output) => sum + percentage(output.delivered_quantity, output.target_quantity), 0) / measurable.length)
  }, [outputs])

  const investment = Number(summary?.investment ?? fallbackInvestment)
  const beneficiaries = Number(summary?.beneficiary_count ?? fallbackBeneficiaries)
  const averageCompliance = Number(summary?.compliance_percent ?? fallbackCompliance)
  const budgetCompliance = Number(summary?.budget_percent ?? percentage(investment, selectedProject?.approved_budget))
  const linkedDonations = Array.isArray(funding?.donations) ? funding.donations : []
  const receivedProjectCurrency = Number(funding?.received_project_currency ?? 0)
  const executedAmount = Number(funding?.executed_amount ?? investment)
  const availableBalance = Number(funding?.balance_after_execution ?? receivedProjectCurrency - executedAmount)

  const exportPdf = async () => {
    if (!selectedProject || exportingPdf) return
    setExportingPdf(true)
    setError('')
    try {
      const { default: pdfMake } = await import('pdfmake/build/pdfmake.js')
      const { default: pdfFonts } = await import('pdfmake/build/vfs_fonts.js')
      pdfMake.vfs = pdfFonts
      const docDefinition = buildComplianceReportDocDefinition({
        project: selectedProject,
        generatedAt: new Date(),
        metrics: { investment, beneficiaries, averageCompliance, budgetCompliance },
        funding: {
          receivedProjectCurrency,
          executedAmount,
          availableBalance,
          receivedByCurrency: funding?.received_by_currency,
          inKindReferenceByCurrency: funding?.in_kind_reference_by_currency,
          linkedDonations,
        },
        outputs,
        expenses,
        evidenceByOutput,
        organizationName: selectedProject.organization?.name ?? '',
      })
      pdfMake.createPdf(docDefinition).open()
    } catch (exportError) {
      setError(exportError?.message ?? 'No fue posible generar el PDF del informe.')
    }
    setExportingPdf(false)
  }

  return (
    <div className="operations-page compliance-page">
      <header className="edifica-dashboard-header compliance-header">
        <div><p className="edifica-kicker">CUMPLIMIENTO DEL PROYECTO</p><h1>Ejecución e informe final</h1><p className="operations-intro">Coteja lo aprobado, lo recibido y lo ejecutado; registra avances, personas beneficiadas, inversiones y evidencias.</p></div>
        <div className="compliance-header-actions no-print">
          <button className="compliance-export" type="button" onClick={exportPdf} disabled={!selectedProject || exportingPdf}>{exportingPdf ? 'Generando vista previa…' : 'Exportar PDF'}</button>
        </div>
      </header>

      <section className="compliance-selector operations-card">
        <label><span>Proyecto</span><select value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); resetForms() }}><option value="">Seleccionar proyecto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
        {selectedProject && <div><strong>{selectedProject.funding_partner}</strong><span>{selectedProject.organization?.name}</span></div>}
      </section>

      {error && <p className="operations-feedback error">{error}</p>}
      {message && <p className="operations-feedback success">{message}</p>}

      {!selectedProject ? <section className="operations-card"><p className="edifica-empty">Crea o selecciona un proyecto para registrar su ejecución.</p></section> : (
        <>
          <section className="compliance-metrics print-summary">
            <article><span>Monto aprobado u otorgado</span><strong>{formatMoney(selectedProject.approved_budget, selectedProject.currency)}</strong><small>{selectedProject.currency}</small></article>
            <article><span>Donaciones recibidas</span><strong>{formatMoney(receivedProjectCurrency, selectedProject.currency)}</strong><small>{funding?.received_usd ? `${formatMoney(funding.received_usd, 'USD')} base USD` : `${linkedDonations.length} registros asociados`}</small></article>
            <article><span>Inversión ejecutada</span><strong>{formatMoney(investment, selectedProject.currency)}</strong><small>{budgetCompliance}% del presupuesto</small></article>
            <article><span>Cumplimiento físico</span><strong>{averageCompliance}%</strong><small>Promedio de metas entregadas</small></article>
            <article><span>Personas beneficiadas</span><strong>{formatNumber(beneficiaries)}</strong><small>{selectedProject.beneficiary_detail_enabled ? 'Según registro individual' : 'Según avances reportados'}</small></article>
          </section>

          <section className="beneficiary-access-card no-print">
            <div><p className="edifica-kicker">PERSONAS BENEFICIADAS</p><h2>{selectedProject.beneficiary_detail_enabled ? 'Registro individual disponible' : 'Registro individual opcional'}</h2><p>{selectedProject.beneficiary_detail_enabled ? 'Puedes cargar, consultar y editar a las personas vinculadas con este proyecto.' : 'Actívalo cuando el aliado o donante solicite información detallada por persona.'}</p></div>
            {selectedProject.beneficiary_detail_enabled ? <button type="button" onClick={() => setActiveForm('beneficiary')}>Abrir registro</button> : canManageProject ? <button type="button" onClick={enableBeneficiaryRegistry} disabled={enablingBeneficiaries}>{enablingBeneficiaries ? 'Activando…' : 'Activar registro individual'}</button> : <span>Requiere un administrador</span>}
          </section>

          <section className="operations-card compliance-entry-card no-print">
            <div className="compliance-tabs">
              <button className={activeForm === 'output' ? 'active' : ''} type="button" onClick={() => setActiveForm('output')}>Avances y entregas</button>
              <button className={activeForm === 'expense' ? 'active' : ''} type="button" onClick={() => setActiveForm('expense')}>Inversión ejecutada</button>
              <button className={activeForm === 'beneficiary' ? 'active' : ''} type="button" onClick={() => setActiveForm('beneficiary')}>Personas beneficiadas</button>
            </div>

            {activeForm === 'output' && (
              <form className="operations-form" onSubmit={saveOutput} key={`output-${outputForm.id || 'new'}`}>
                <label className="wide"><span>Actividad o producto</span><input value={outputForm.name} onChange={(event) => setOutputForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej.: Kits de alimentos" required /></label>
                <label><span>Unidad de medida</span><select value={outputForm.unit_of_measure_id} onChange={(event) => setOutputForm((current) => ({ ...current, unit_of_measure_id: event.target.value }))} required><option value="">Seleccionar unidad</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name_es} ({unit.abbreviation})</option>)}</select></label>
                <label><span>Estado</span><select value={outputForm.status} onChange={(event) => setOutputForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(outputStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Meta comprometida</span><input type="number" min="0" step="0.001" value={outputForm.target_quantity} onChange={(event) => setOutputForm((current) => ({ ...current, target_quantity: event.target.value }))} required /></label>
                <label><span>Cantidad armada o producida</span><input type="number" min="0" step="0.001" value={outputForm.produced_quantity} onChange={(event) => setOutputForm((current) => ({ ...current, produced_quantity: event.target.value }))} /></label>
                <label><span>Cantidad entregada</span><input type="number" min="0" step="0.001" value={outputForm.delivered_quantity} onChange={(event) => setOutputForm((current) => ({ ...current, delivered_quantity: event.target.value }))} /></label>
                {!selectedProject.beneficiary_detail_enabled && <label><span>Personas beneficiadas</span><input type="number" min="0" step="1" value={outputForm.beneficiary_count} onChange={(event) => setOutputForm((current) => ({ ...current, beneficiary_count: event.target.value }))} /></label>}
                <label className="wide"><span>Observaciones y método de verificación</span><textarea value={outputForm.notes} onChange={(event) => setOutputForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Actas, listas, fotografías, centros atendidos..." /></label>
                <div className="wide compliance-evidence-field"><div><strong>Evidencias multimedia</strong><span>Agrega fotografías, PDF o videos que sustenten esta ejecución.</span></div><input id={evidenceInputId} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov,image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime" onChange={chooseEvidence} /><label htmlFor={evidenceInputId}>Agregar evidencias</label><small>Imágenes y PDF: máximo 10 MB. Videos MP4 o MOV: máximo 50 MB.</small>{outputForm.id && (evidenceByOutput.get(outputForm.id) ?? []).length > 0 && <p>{(evidenceByOutput.get(outputForm.id) ?? []).length} evidencias guardadas para este avance.</p>}{evidenceFiles.length > 0 && <div className="pending-evidence-list">{evidenceFiles.map((file, index) => <div key={`${file.name}-${index}`}><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small><button type="button" onClick={() => removePendingEvidence(index)}>Eliminar</button></div>)}</div>}</div>
                <div className="compliance-form-actions"><button type="button" onClick={() => { setOutputForm(emptyOutput); setEvidenceFiles([]) }}>Limpiar</button><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : outputForm.id ? 'Guardar cambios' : 'Registrar avance'}</button></div>
              </form>
            )}

            {activeForm === 'expense' && (
              <form className="operations-form" onSubmit={saveExpense} key={`expense-${expenseForm.id || 'new'}`}>
                <label><span>Fecha de gasto</span><input type="date" value={expenseForm.expense_date} onChange={(event) => setExpenseForm((current) => ({ ...current, expense_date: event.target.value }))} required /></label>
                <label><span>Estado</span><select value={expenseForm.status} onChange={(event) => setExpenseForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(expenseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Proveedor</span><input value={expenseForm.supplier_name} onChange={(event) => setExpenseForm((current) => ({ ...current, supplier_name: event.target.value }))} required /></label>
                <label><span>Categoría</span><input value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} placeholder="Alimentos, transporte, salud..." required /></label>
                <label className="wide"><span>Descripción</span><input value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} required /></label>
                <label><span>Monto ({selectedProject.currency})</span><input type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} required /></label>
                <label><span>Número de factura</span><input value={expenseForm.invoice_number} onChange={(event) => setExpenseForm((current) => ({ ...current, invoice_number: event.target.value }))} /></label>
                <label className="wide"><span>Referencia de pago</span><input value={expenseForm.payment_reference} onChange={(event) => setExpenseForm((current) => ({ ...current, payment_reference: event.target.value }))} /></label>
                <div className="compliance-form-actions"><button type="button" onClick={() => setExpenseForm(createEmptyExpense())}>Limpiar</button><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : expenseForm.id ? 'Guardar cambios' : 'Registrar inversión'}</button></div>
              </form>
            )}

            {activeForm === 'beneficiary' && (selectedProject.beneficiary_detail_enabled
              ? <ProjectBeneficiariesPanel project={selectedProject} onChanged={() => loadExecution(selectedProject.id)} />
              : <div className="beneficiary-disabled-state"><strong>Registro individual desactivado</strong><p>El proyecto usa actualmente cifras agregadas. Un administrador puede activarlo desde esta pantalla o desde la edición del proyecto.</p>{canManageProject && <button type="button" onClick={enableBeneficiaryRegistry} disabled={enablingBeneficiaries}>{enablingBeneficiaries ? 'Activando…' : 'Activar ahora'}</button>}</div>)}
          </section>

          <section className="operations-card final-report-card">
            <div className="final-report-heading"><div><p className="edifica-kicker">INFORME DE CUMPLIMIENTO</p><h2>{selectedProject.name}</h2><span>{selectedProject.code} · {selectedProject.funding_partner}</span></div><div className="final-report-score"><strong>{averageCompliance}%</strong><span>cumplimiento físico</span></div></div>
            <div className="final-report-project-data"><div><span>Objetivo</span><p>{selectedProject.objective}</p></div><div><span>Resultados esperados</span><p>{selectedProject.expected_results || 'Pendiente de definir'}</p></div><div><span>Exigencias de reporte</span><p>{selectedProject.reporting_requirements || 'Según convenio del proyecto'}</p></div></div>

            <div className="final-report-section funding-reconciliation-section">
              <div className="edifica-section-heading"><div><p className="edifica-kicker">COTEJO FINANCIERO</p><h2>Otorgado, recibido y ejecutado</h2></div><span>{linkedDonations.length} donaciones asociadas</span></div>
              <div className="funding-comparison-grid">
                <article><span>Aprobado u otorgado</span><strong>{formatMoney(selectedProject.approved_budget, selectedProject.currency)}</strong><small>Presupuesto del proyecto</small></article>
                <article><span>Recibido</span><strong>{formatMoney(receivedProjectCurrency, selectedProject.currency)}</strong><small>{formatBreakdown(funding?.received_by_currency)}</small></article>
                <article><span>Ejecutado</span><strong>{formatMoney(executedAmount, selectedProject.currency)}</strong><small>Gastos válidos registrados</small></article>
                <article className={availableBalance < 0 ? 'negative' : ''}><span>Saldo frente a lo recibido</span><strong>{formatMoney(availableBalance, selectedProject.currency)}</strong><small>{availableBalance < 0 ? 'Ejecución superior a los fondos asociados' : 'Disponible según registros asociados'}</small></article>
              </div>
              {Object.keys(funding?.in_kind_reference_by_currency ?? {}).length > 0 && <p className="funding-in-kind-note"><strong>Valor referencial de donaciones en especies:</strong> {formatBreakdown(funding.in_kind_reference_by_currency)}</p>}
              {linkedDonations.length === 0 ? <p className="edifica-empty">Todavía faltan donaciones asociadas a este proyecto.</p> : (
                <div className="edifica-table-wrap"><table className="compliance-table funding-donations-table"><thead><tr><th>Fecha</th><th>Referencia</th><th>Aliado o donante</th><th>Tipo y estado</th><th>Valor recibido</th></tr></thead><tbody>{linkedDonations.map((donation) => { const value = donationValue(donation); return <tr key={donation.id}><td>{formatDate(donation.received_at || donation.created_at)}</td><td>{donation.reference_code || '—'}</td><td><strong>{donation.donor_name}</strong></td><td><strong>{donationTypeLabels[donation.donation_type] ?? donation.donation_type}</strong><span>{donationStatusLabels[donation.status] ?? donation.status}</span></td><td><strong>{value.primary}</strong>{value.secondary && <span>{value.secondary}</span>}</td></tr> })}</tbody></table></div>
              )}
            </div>

            <div className="final-report-section"><div className="edifica-section-heading"><div><p className="edifica-kicker">EJECUCIÓN FÍSICA</p><h2>Metas y avances</h2></div><span>{outputs.length} indicadores</span></div>{loading ? <p className="edifica-empty">Cargando ejecución…</p> : outputs.length === 0 ? <p className="edifica-empty">Todavía faltan avances y entregas por registrar.</p> : <div className="edifica-table-wrap"><table className="compliance-table"><thead><tr><th>Actividad / producto</th><th>Meta</th><th>Armado</th><th>Entregado</th><th>Cumplimiento</th><th>Beneficiarios</th><th>Evidencias</th><th className="no-print">Acción</th></tr></thead><tbody>{outputs.map((output) => { const progress = percentage(output.delivered_quantity, output.target_quantity); const outputEvidence = evidenceByOutput.get(output.id) ?? []; const unitLabel = output.unit?.abbreviation || output.unit_label; return <tr key={output.id}><td><strong>{output.name}</strong><span>{unitLabel} · {outputStatusLabels[output.status]}</span></td><td>{formatNumber(output.target_quantity)}</td><td>{formatNumber(output.produced_quantity)}</td><td>{formatNumber(output.delivered_quantity)}</td><td><div className="compliance-progress"><span style={{ width: `${Math.min(progress, 100)}%` }} /><b>{progress}%</b></div></td><td>{selectedProject.beneficiary_detail_enabled ? 'Ver registro' : formatNumber(output.beneficiary_count)}</td><td><strong>{outputEvidence.length}</strong></td><td className="no-print"><button type="button" onClick={() => editOutput(output)}>Editar</button></td></tr> })}</tbody></table></div>}</div>
            {evidences.length > 0 && <div className="final-report-section evidence-report-section"><div className="edifica-section-heading"><div><p className="edifica-kicker">SOPORTES MULTIMEDIA</p><h2>Evidencias de ejecución</h2></div><span>{evidences.length} archivos</span></div><div className="evidence-report-grid">{outputs.map((output) => { const outputEvidence = evidenceByOutput.get(output.id) ?? []; if (!outputEvidence.length) return null; return <article key={output.id}><header><strong>{output.name}</strong><span>{outputEvidence.length} evidencias</span></header><div>{outputEvidence.map((evidence) => <figure key={evidence.id} className={`evidence-preview ${evidence.evidence_type}`}>{evidence.evidence_type === 'image' && evidence.signed_url ? <img src={evidence.signed_url} alt={evidence.caption || evidence.file_name} /> : null}{evidence.evidence_type === 'video' && evidence.signed_url ? <video controls preload="metadata" src={evidence.signed_url} /> : null}{evidence.evidence_type === 'document' ? <a href={evidence.signed_url} target="_blank" rel="noreferrer"><span>PDF</span></a> : null}<figcaption>{evidence.file_name}</figcaption></figure>)}</div></article> })}</div></div>}
            <div className="final-report-section"><div className="edifica-section-heading"><div><p className="edifica-kicker">EJECUCIÓN FINANCIERA</p><h2>Inversión y comprobantes</h2></div><span>{formatMoney(investment, selectedProject.currency)}</span></div>{expenses.length === 0 ? <p className="edifica-empty">Todavía faltan inversiones o gastos por registrar.</p> : <div className="edifica-table-wrap"><table className="compliance-table"><thead><tr><th>Fecha</th><th>Proveedor / concepto</th><th>Factura</th><th>Estado</th><th>Monto</th><th className="no-print">Acción</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td>{expense.expense_date}</td><td><strong>{expense.supplier_name}</strong><span>{expense.category} · {expense.description}</span></td><td>{expense.invoice_number || '—'}</td><td>{expenseStatusLabels[expense.status]}</td><td><strong>{formatMoney(expense.amount, expense.currency)}</strong></td><td className="no-print"><button type="button" onClick={() => editExpense(expense)}>Editar</button></td></tr>)}</tbody></table></div>}</div>
          </section>
        </>
      )}
    </div>
  )
}
