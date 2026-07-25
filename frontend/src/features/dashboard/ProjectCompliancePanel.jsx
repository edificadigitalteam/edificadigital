import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './operations.css'
import './compliance.css'

const emptyOutput = {
  id: '',
  name: '',
  unit_label: 'kits',
  target_quantity: '',
  produced_quantity: '',
  delivered_quantity: '',
  beneficiary_count: '',
  status: 'in_progress',
  notes: '',
}

const emptyExpense = {
  id: '',
  expense_date: new Date().toISOString().slice(0, 10),
  supplier_name: '',
  category: '',
  description: '',
  amount: '',
  payment_reference: '',
  invoice_number: '',
  status: 'reported',
}

const outputStatusLabels = {
  planned: 'Planificado',
  in_progress: 'En ejecución',
  completed: 'Completado',
  verified: 'Verificado',
}

const expenseStatusLabels = {
  reported: 'Reportado',
  verified: 'Verificado',
  rejected: 'Rechazado',
}

function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0))
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(Number(value || 0))
}

function percentage(value, target) {
  const safeTarget = Number(target || 0)
  if (safeTarget <= 0) return 0
  return Math.min(999, Math.round((Number(value || 0) / safeTarget) * 100))
}

export default function ProjectCompliancePanel({ access }) {
  const queryProject = new URLSearchParams(window.location.search).get('project') ?? ''
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(queryProject)
  const [outputs, setOutputs] = useState([])
  const [expenses, setExpenses] = useState([])
  const [outputForm, setOutputForm] = useState(emptyOutput)
  const [expenseForm, setExpenseForm] = useState(emptyExpense)
  const [activeForm, setActiveForm] = useState('output')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const loadProjects = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase
      .from('project')
      .select('id, organization_id, code, name, funding_partner, status, start_date, end_date, approved_budget, currency, objective, expected_results, reporting_requirements, organization:organization(name)')
      .order('created_at', { ascending: false })

    if (requestError) {
      setProjects([])
      setError(requestError.message)
      setLoading(false)
      return
    }

    const nextProjects = data ?? []
    setProjects(nextProjects)
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
      return
    }

    setLoading(true)
    setError('')
    const [outputResponse, expenseResponse] = await Promise.all([
      supabase
        .from('project_output')
        .select('id, organization_id, project_id, name, unit_label, target_quantity, produced_quantity, delivered_quantity, beneficiary_count, status, notes, created_at, updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_expense')
        .select('id, project_id, expense_date, supplier_name, category, description, amount, currency, payment_reference, invoice_number, status, created_at, updated_at')
        .eq('project_id', projectId)
        .order('expense_date', { ascending: false }),
    ])

    if (outputResponse.error || expenseResponse.error) {
      setError(outputResponse.error?.message ?? expenseResponse.error?.message ?? 'No fue posible cargar la ejecución.')
    } else {
      setOutputs(outputResponse.data ?? [])
      setExpenses(expenseResponse.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { loadExecution(selectedProjectId) }, [loadExecution, selectedProjectId])

  const resetForms = () => {
    setOutputForm(emptyOutput)
    setExpenseForm({ ...emptyExpense, expense_date: new Date().toISOString().slice(0, 10) })
    setError('')
    setMessage('')
  }

  const editOutput = (output) => {
    setActiveForm('output')
    setOutputForm({
      id: output.id,
      name: output.name,
      unit_label: output.unit_label,
      target_quantity: output.target_quantity,
      produced_quantity: output.produced_quantity,
      delivered_quantity: output.delivered_quantity,
      beneficiary_count: output.beneficiary_count,
      status: output.status,
      notes: output.notes ?? '',
    })
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

  const saveOutput = async (event) => {
    event.preventDefault()
    if (!supabase || !selectedProject || saving) return
    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      organization_id: selectedProject.organization_id,
      project_id: selectedProject.id,
      name: outputForm.name.trim(),
      unit_label: outputForm.unit_label.trim(),
      target_quantity: Number(outputForm.target_quantity || 0),
      produced_quantity: Number(outputForm.produced_quantity || 0),
      delivered_quantity: Number(outputForm.delivered_quantity || 0),
      beneficiary_count: Number(outputForm.beneficiary_count || 0),
      status: outputForm.status,
      notes: outputForm.notes.trim() || null,
      created_by: access.userId,
      updated_by: access.userId,
    }

    const request = outputForm.id
      ? supabase.from('project_output').update(payload).eq('id', outputForm.id)
      : supabase.from('project_output').insert(payload)
    const { error: requestError } = await request

    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(outputForm.id ? 'Resultado actualizado.' : 'Resultado tangible registrado.')
      setOutputForm(emptyOutput)
      await loadExecution(selectedProject.id)
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

    if (requestError) {
      setError(requestError.message)
    } else {
      setMessage(expenseForm.id ? 'Inversión actualizada.' : 'Inversión ejecutada registrada.')
      setExpenseForm({ ...emptyExpense, expense_date: new Date().toISOString().slice(0, 10) })
      await loadExecution(selectedProject.id)
    }
    setSaving(false)
  }

  const investment = useMemo(
    () => expenses
      .filter((expense) => expense.status !== 'rejected' && expense.currency === selectedProject?.currency)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses, selectedProject?.currency],
  )

  const beneficiaries = useMemo(
    () => outputs.reduce((sum, output) => sum + Number(output.beneficiary_count || 0), 0),
    [outputs],
  )

  const averageCompliance = useMemo(() => {
    const measurable = outputs.filter((output) => Number(output.target_quantity) > 0)
    if (!measurable.length) return 0
    return Math.round(measurable.reduce((sum, output) => sum + percentage(output.delivered_quantity, output.target_quantity), 0) / measurable.length)
  }, [outputs])

  const budgetCompliance = percentage(investment, selectedProject?.approved_budget)

  return (
    <div className="operations-page compliance-page">
      <header className="edifica-dashboard-header compliance-header">
        <div>
          <p className="edifica-kicker">CUMPLIMIENTO DEL PROYECTO</p>
          <h1>Resultados e informe final</h1>
          <p className="operations-intro">Convierte cada proyecto en resultados verificables: metas, kits armados, entregas, beneficiarios, inversión y soportes para el informe al aliado financiador.</p>
        </div>
        <button className="compliance-print" type="button" onClick={() => window.print()} disabled={!selectedProject}>Imprimir informe</button>
      </header>

      <section className="compliance-selector operations-card">
        <label>
          <span>Proyecto</span>
          <select value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); resetForms() }}>
            <option value="">Seleccionar proyecto</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
          </select>
        </label>
        {selectedProject && <div><strong>{selectedProject.funding_partner}</strong><span>{selectedProject.organization?.name}</span></div>}
      </section>

      {error && <p className="operations-feedback error">{error}</p>}
      {message && <p className="operations-feedback success">{message}</p>}

      {!selectedProject ? (
        <section className="operations-card"><p className="edifica-empty">Crea o selecciona un proyecto para registrar su ejecución.</p></section>
      ) : (
        <>
          <section className="compliance-metrics">
            <article><span>Presupuesto aprobado</span><strong>{formatMoney(selectedProject.approved_budget, selectedProject.currency)}</strong><small>{selectedProject.currency}</small></article>
            <article><span>Inversión ejecutada</span><strong>{formatMoney(investment, selectedProject.currency)}</strong><small>{budgetCompliance}% del presupuesto</small></article>
            <article><span>Cumplimiento físico</span><strong>{averageCompliance}%</strong><small>Promedio de metas entregadas</small></article>
            <article><span>Personas beneficiadas</span><strong>{formatNumber(beneficiaries)}</strong><small>Según resultados reportados</small></article>
          </section>

          <section className="operations-card compliance-entry-card no-print">
            <div className="compliance-tabs">
              <button className={activeForm === 'output' ? 'active' : ''} type="button" onClick={() => setActiveForm('output')}>Resultado tangible</button>
              <button className={activeForm === 'expense' ? 'active' : ''} type="button" onClick={() => setActiveForm('expense')}>Inversión ejecutada</button>
            </div>

            {activeForm === 'output' ? (
              <form className="operations-form" onSubmit={saveOutput}>
                <label className="wide"><span>Resultado o producto</span><input value={outputForm.name} onChange={(event) => setOutputForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej.: Kits de alimentos" required /></label>
                <label><span>Unidad de medida</span><input value={outputForm.unit_label} onChange={(event) => setOutputForm((current) => ({ ...current, unit_label: event.target.value }))} placeholder="kits, litros, consultas" required /></label>
                <label><span>Estado</span><select value={outputForm.status} onChange={(event) => setOutputForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(outputStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Meta comprometida</span><input type="number" min="0" step="0.001" value={outputForm.target_quantity} onChange={(event) => setOutputForm((current) => ({ ...current, target_quantity: event.target.value }))} required /></label>
                <label><span>Cantidad armada o producida</span><input type="number" min="0" step="0.001" value={outputForm.produced_quantity} onChange={(event) => setOutputForm((current) => ({ ...current, produced_quantity: event.target.value }))} /></label>
                <label><span>Cantidad entregada</span><input type="number" min="0" step="0.001" value={outputForm.delivered_quantity} onChange={(event) => setOutputForm((current) => ({ ...current, delivered_quantity: event.target.value }))} /></label>
                <label><span>Personas beneficiadas</span><input type="number" min="0" step="1" value={outputForm.beneficiary_count} onChange={(event) => setOutputForm((current) => ({ ...current, beneficiary_count: event.target.value }))} /></label>
                <label className="wide"><span>Observaciones y método de verificación</span><textarea value={outputForm.notes} onChange={(event) => setOutputForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Actas, listas de beneficiarios, fotografías, centros atendidos..." /></label>
                <div className="compliance-form-actions"><button type="button" onClick={() => setOutputForm(emptyOutput)}>Limpiar</button><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : outputForm.id ? 'Guardar cambios' : 'Registrar resultado'}</button></div>
              </form>
            ) : (
              <form className="operations-form" onSubmit={saveExpense}>
                <label><span>Fecha</span><input type="date" value={expenseForm.expense_date} onChange={(event) => setExpenseForm((current) => ({ ...current, expense_date: event.target.value }))} required /></label>
                <label><span>Estado</span><select value={expenseForm.status} onChange={(event) => setExpenseForm((current) => ({ ...current, status: event.target.value }))}>{Object.entries(expenseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Proveedor</span><input value={expenseForm.supplier_name} onChange={(event) => setExpenseForm((current) => ({ ...current, supplier_name: event.target.value }))} required /></label>
                <label><span>Categoría</span><input value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} placeholder="Alimentos, transporte, salud..." required /></label>
                <label className="wide"><span>Descripción</span><input value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} required /></label>
                <label><span>Monto ({selectedProject.currency})</span><input type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} required /></label>
                <label><span>Número de factura</span><input value={expenseForm.invoice_number} onChange={(event) => setExpenseForm((current) => ({ ...current, invoice_number: event.target.value }))} /></label>
                <label className="wide"><span>Referencia de pago</span><input value={expenseForm.payment_reference} onChange={(event) => setExpenseForm((current) => ({ ...current, payment_reference: event.target.value }))} /></label>
                <div className="compliance-form-actions"><button type="button" onClick={() => setExpenseForm({ ...emptyExpense, expense_date: new Date().toISOString().slice(0, 10) })}>Limpiar</button><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : expenseForm.id ? 'Guardar cambios' : 'Registrar inversión'}</button></div>
              </form>
            )}
          </section>

          <section className="operations-card final-report-card">
            <div className="final-report-heading">
              <div><p className="edifica-kicker">INFORME DE CUMPLIMIENTO</p><h2>{selectedProject.name}</h2><span>{selectedProject.code} · {selectedProject.funding_partner}</span></div>
              <div className="final-report-score"><strong>{averageCompliance}%</strong><span>cumplimiento físico</span></div>
            </div>

            <div className="final-report-project-data">
              <div><span>Objetivo</span><p>{selectedProject.objective}</p></div>
              <div><span>Resultados esperados</span><p>{selectedProject.expected_results || 'Pendiente de definir'}</p></div>
              <div><span>Exigencias de reporte</span><p>{selectedProject.reporting_requirements || 'Según convenio del proyecto'}</p></div>
            </div>

            <div className="final-report-section">
              <div className="edifica-section-heading"><div><p className="edifica-kicker">EJECUCIÓN FÍSICA</p><h2>Metas y resultados</h2></div><span>{outputs.length} indicadores</span></div>
              {loading ? <p className="edifica-empty">Cargando ejecución…</p> : outputs.length === 0 ? <p className="edifica-empty">Todavía faltan resultados tangibles por registrar.</p> : (
                <div className="edifica-table-wrap"><table className="compliance-table"><thead><tr><th>Resultado</th><th>Meta</th><th>Armado</th><th>Entregado</th><th>Cumplimiento</th><th>Beneficiarios</th><th className="no-print">Acción</th></tr></thead><tbody>{outputs.map((output) => {
                  const progress = percentage(output.delivered_quantity, output.target_quantity)
                  return <tr key={output.id}><td><strong>{output.name}</strong><span>{output.unit_label} · {outputStatusLabels[output.status]}</span></td><td>{formatNumber(output.target_quantity)}</td><td>{formatNumber(output.produced_quantity)}</td><td>{formatNumber(output.delivered_quantity)}</td><td><div className="compliance-progress"><span style={{ width: `${Math.min(progress, 100)}%` }} /><b>{progress}%</b></div></td><td>{formatNumber(output.beneficiary_count)}</td><td className="no-print"><button type="button" onClick={() => editOutput(output)}>Editar</button></td></tr>
                })}</tbody></table></div>
              )}
            </div>

            <div className="final-report-section">
              <div className="edifica-section-heading"><div><p className="edifica-kicker">EJECUCIÓN FINANCIERA</p><h2>Inversión y comprobantes</h2></div><span>{formatMoney(investment, selectedProject.currency)}</span></div>
              {expenses.length === 0 ? <p className="edifica-empty">Todavía faltan inversiones o gastos por registrar.</p> : (
                <div className="edifica-table-wrap"><table className="compliance-table"><thead><tr><th>Fecha</th><th>Proveedor / concepto</th><th>Factura</th><th>Estado</th><th>Monto</th><th className="no-print">Acción</th></tr></thead><tbody>{expenses.map((expense) => (
                  <tr key={expense.id}><td>{expense.expense_date}</td><td><strong>{expense.supplier_name}</strong><span>{expense.category} · {expense.description}</span></td><td>{expense.invoice_number || '—'}</td><td>{expenseStatusLabels[expense.status]}</td><td><strong>{formatMoney(expense.amount, expense.currency)}</strong></td><td className="no-print"><button type="button" onClick={() => editExpense(expense)}>Editar</button></td></tr>
                ))}</tbody></table></div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
