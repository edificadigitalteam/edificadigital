import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import '../dashboard/operations.css'
import './billing.css'

const emptySubscription = {
  plan_id: '',
  billing_cycle: 'monthly',
  status: 'trial',
  seat_limit: '1',
  agreed_amount: '',
  currency: 'USD',
  current_period_start: '',
  current_period_end: '',
  next_billing_date: '',
  payment_provider: '',
  external_customer_id: '',
  external_subscription_id: '',
  notes: '',
}

const emptyPayment = {
  payment_date: new Date().toISOString().slice(0, 10),
  amount: '',
  currency: 'USD',
  status: 'paid',
  payment_method: '',
  external_reference: '',
  period_start: '',
  period_end: '',
  notes: '',
}

function money(amount, currency = 'USD') {
  if (amount === null || amount === undefined || amount === '') return 'Por definir'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(Number(amount))
}

export default function BillingPanel({ access }) {
  const [organizations, setOrganizations] = useState([])
  const [plans, setPlans] = useState([])
  const [organizationId, setOrganizationId] = useState(access.organizationId || '')
  const [overview, setOverview] = useState(null)
  const [subscription, setSubscription] = useState(emptySubscription)
  const [payment, setPayment] = useState(emptyPayment)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isSuperAdmin = access.role === 'super_admin'

  const loadCatalog = useCallback(async () => {
    if (!supabase) return
    const requests = [supabase.from('subscription_plan').select('id, code, name_es, name_en, monthly_price, annual_price, currency, included_users, max_users, active').eq('active', true).order('name_es')]
    if (isSuperAdmin) requests.push(supabase.rpc('admin_list_organizations'))
    const [planResponse, organizationResponse] = await Promise.all(requests)
    if (planResponse.error || organizationResponse?.error) {
      setError(planResponse.error?.message ?? organizationResponse?.error?.message ?? 'No fue posible cargar facturación.')
      return
    }
    setPlans(planResponse.data ?? [])
    if (isSuperAdmin) {
      const nextOrganizations = organizationResponse.data ?? []
      setOrganizations(nextOrganizations)
      setOrganizationId((current) => current || nextOrganizations[0]?.id || '')
    }
  }, [isSuperAdmin])

  const loadOverview = useCallback(async () => {
    if (!supabase || !organizationId) {
      setOverview(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('organization_billing_overview', {
      target_organization_id: organizationId,
    })
    if (requestError) {
      setOverview(null)
      setError(requestError.message)
    } else {
      setOverview(data)
      setSubscription({
        plan_id: data?.plan_id ?? '',
        billing_cycle: data?.billing_cycle ?? 'monthly',
        status: data?.status ?? 'trial',
        seat_limit: String(data?.seat_limit ?? 1),
        agreed_amount: data?.agreed_amount ?? '',
        currency: data?.currency ?? 'USD',
        current_period_start: data?.current_period_start ?? '',
        current_period_end: data?.current_period_end ?? '',
        next_billing_date: data?.next_billing_date ?? '',
        payment_provider: data?.payment_provider ?? '',
        external_customer_id: '',
        external_subscription_id: '',
        notes: '',
      })
      setPayment((current) => ({ ...current, currency: data?.currency ?? 'USD' }))
    }
    setLoading(false)
  }, [organizationId])

  useEffect(() => { loadCatalog() }, [loadCatalog])
  useEffect(() => { loadOverview() }, [loadOverview])

  const usagePercent = useMemo(() => {
    if (!overview?.seat_limit) return 0
    return Math.min(100, Math.round((Number(overview.active_users || 0) / Number(overview.seat_limit)) * 100))
  }, [overview])

  const saveSubscription = async (event) => {
    event.preventDefault()
    if (!supabase || !isSuperAdmin || saving || !organizationId) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: requestError } = await supabase.rpc('admin_save_organization_subscription', {
      payload: {
        organization_id: organizationId,
        ...subscription,
        seat_limit: Number(subscription.seat_limit || 1),
        agreed_amount: subscription.agreed_amount === '' ? null : Number(subscription.agreed_amount),
      },
    })
    if (requestError) setError(requestError.message)
    else {
      setMessage('Plan y condiciones de la organización actualizados.')
      await loadOverview()
    }
    setSaving(false)
  }

  const recordPayment = async (event) => {
    event.preventDefault()
    if (!supabase || !isSuperAdmin || saving || !organizationId) return
    setSaving(true)
    setError('')
    setMessage('')
    const { error: requestError } = await supabase.rpc('admin_record_subscription_payment', {
      payload: {
        organization_id: organizationId,
        subscription_id: overview?.subscription_id ?? null,
        ...payment,
        amount: Number(payment.amount),
      },
    })
    if (requestError) setError(requestError.message)
    else {
      setMessage('Pago de suscripción registrado.')
      setPayment({ ...emptyPayment, currency: overview?.currency ?? 'USD' })
      await loadOverview()
    }
    setSaving(false)
  }

  return (
    <div className="operations-page billing-page">
      <header className="edifica-dashboard-header">
        <div>
          <p className="edifica-kicker">CUENTA COMERCIAL DEL TENANT</p>
          <h1>Planes y facturación</h1>
          <p className="operations-intro">Controla la suscripción de cada organización, el cupo de usuarios y los pagos recibidos por el uso de Edifica.</p>
        </div>
      </header>

      {isSuperAdmin && <section className="operations-card billing-organization-selector"><label><span>Organización cliente</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Seleccionar</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label></section>}

      {error && <p className="operations-feedback error">{error}</p>}
      {message && <p className="operations-feedback success">{message}</p>}

      {loading ? <section className="operations-card"><p className="edifica-empty">Cargando cuenta comercial…</p></section> : !overview?.organization_id ? <section className="operations-card"><p className="edifica-empty">Selecciona una organización para consultar su suscripción.</p></section> : (
        <>
          <section className="billing-summary-grid">
            <article><span>Organización cliente</span><strong>{overview.organization_name}</strong><small>{overview.billing_email || 'Correo de facturación pendiente'}</small></article>
            <article><span>Plan</span><strong>{overview.plan_name_es || 'Personalizado'}</strong><small>{overview.billing_cycle === 'annual' ? 'Facturación anual' : 'Facturación mensual'}</small></article>
            <article><span>Usuarios activos</span><strong>{overview.active_users} / {overview.seat_limit}</strong><small>{overview.available_seats} cupos disponibles</small><div className="seat-progress"><span style={{ width: `${usagePercent}%` }} /></div></article>
            <article><span>Importe acordado</span><strong>{money(overview.agreed_amount, overview.currency)}</strong><small>Próximo cobro: {overview.next_billing_date || 'por definir'}</small></article>
          </section>

          {isSuperAdmin && (
            <section className="operations-card billing-admin-grid">
              <form className="billing-form" onSubmit={saveSubscription}>
                <div className="edifica-section-heading"><div><p className="edifica-kicker">SUSCRIPCIÓN</p><h2>Condiciones del plan</h2></div></div>
                <div className="operations-form">
                  <label><span>Plan</span><select value={subscription.plan_id} onChange={(event) => setSubscription((current) => ({ ...current, plan_id: event.target.value }))}><option value="">Personalizado</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name_es}</option>)}</select></label>
                  <label><span>Ciclo</span><select value={subscription.billing_cycle} onChange={(event) => setSubscription((current) => ({ ...current, billing_cycle: event.target.value }))}><option value="monthly">Mensual</option><option value="annual">Anual</option></select></label>
                  <label><span>Estado</span><select value={subscription.status} onChange={(event) => setSubscription((current) => ({ ...current, status: event.target.value }))}><option value="trial">Prueba</option><option value="active">Activa</option><option value="past_due">Pago pendiente</option><option value="suspended">Suspendida</option><option value="cancelled">Cancelada</option></select></label>
                  <label><span>Límite de usuarios</span><input type="number" min="1" step="1" value={subscription.seat_limit} onChange={(event) => setSubscription((current) => ({ ...current, seat_limit: event.target.value }))} required /></label>
                  <label><span>Importe acordado</span><input type="number" min="0" step="0.01" value={subscription.agreed_amount} onChange={(event) => setSubscription((current) => ({ ...current, agreed_amount: event.target.value }))} /></label>
                  <label><span>Moneda</span><select value={subscription.currency} onChange={(event) => setSubscription((current) => ({ ...current, currency: event.target.value }))}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
                  <label><span>Inicio del período</span><input type="date" value={subscription.current_period_start} onChange={(event) => setSubscription((current) => ({ ...current, current_period_start: event.target.value }))} /></label>
                  <label><span>Fin del período</span><input type="date" value={subscription.current_period_end} onChange={(event) => setSubscription((current) => ({ ...current, current_period_end: event.target.value }))} /></label>
                  <label><span>Próxima fecha de cobro</span><input type="date" value={subscription.next_billing_date} onChange={(event) => setSubscription((current) => ({ ...current, next_billing_date: event.target.value }))} /></label>
                  <label><span>Proveedor de pago</span><input value={subscription.payment_provider} onChange={(event) => setSubscription((current) => ({ ...current, payment_provider: event.target.value }))} placeholder="Manual, Stripe u otro" /></label>
                  <label className="wide"><span>Observaciones</span><textarea value={subscription.notes} onChange={(event) => setSubscription((current) => ({ ...current, notes: event.target.value }))} /></label>
                  <div className="compliance-form-actions"><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar suscripción'}</button></div>
                </div>
              </form>

              <form className="billing-form" onSubmit={recordPayment}>
                <div className="edifica-section-heading"><div><p className="edifica-kicker">PAYMENTS</p><h2>Registrar pago recibido</h2></div></div>
                <div className="operations-form">
                  <label><span>Fecha</span><input type="date" value={payment.payment_date} onChange={(event) => setPayment((current) => ({ ...current, payment_date: event.target.value }))} required /></label>
                  <label><span>Monto</span><input type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required /></label>
                  <label><span>Moneda</span><select value={payment.currency} onChange={(event) => setPayment((current) => ({ ...current, currency: event.target.value }))}><option value="USD">USD</option><option value="EUR">EUR</option><option value="VES">VES</option></select></label>
                  <label><span>Estado</span><select value={payment.status} onChange={(event) => setPayment((current) => ({ ...current, status: event.target.value }))}><option value="paid">Pagado</option><option value="pending">Pendiente</option><option value="failed">Fallido</option><option value="refunded">Reembolsado</option></select></label>
                  <label><span>Método</span><input value={payment.payment_method} onChange={(event) => setPayment((current) => ({ ...current, payment_method: event.target.value }))} /></label>
                  <label><span>Referencia</span><input value={payment.external_reference} onChange={(event) => setPayment((current) => ({ ...current, external_reference: event.target.value }))} /></label>
                  <label><span>Período desde</span><input type="date" value={payment.period_start} onChange={(event) => setPayment((current) => ({ ...current, period_start: event.target.value }))} /></label>
                  <label><span>Período hasta</span><input type="date" value={payment.period_end} onChange={(event) => setPayment((current) => ({ ...current, period_end: event.target.value }))} /></label>
                  <label className="wide"><span>Observaciones</span><textarea value={payment.notes} onChange={(event) => setPayment((current) => ({ ...current, notes: event.target.value }))} /></label>
                  <div className="compliance-form-actions"><button className="edifica-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar pago'}</button></div>
                </div>
              </form>
            </section>
          )}

          <section className="operations-card">
            <div className="edifica-section-heading"><div><p className="edifica-kicker">HISTORIAL</p><h2>Pagos de la organización</h2></div><span>{overview.payments?.length ?? 0} pagos</span></div>
            {!overview.payments?.length ? <p className="edifica-empty">Todavía faltan pagos por registrar.</p> : <div className="edifica-table-wrap"><table className="operations-table"><thead><tr><th>Fecha</th><th>Período</th><th>Método / referencia</th><th>Estado</th><th>Monto</th></tr></thead><tbody>{overview.payments.map((item) => <tr key={item.id}><td>{item.payment_date}</td><td>{[item.period_start, item.period_end].filter(Boolean).join(' → ') || '—'}</td><td><strong>{item.payment_method || '—'}</strong><span>{item.external_reference || ''}</span></td><td>{item.status}</td><td><strong>{money(item.amount, item.currency)}</strong></td></tr>)}</tbody></table></div>}
          </section>
        </>
      )}
    </div>
  )
}
