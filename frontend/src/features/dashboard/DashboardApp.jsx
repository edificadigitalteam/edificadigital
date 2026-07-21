import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './dashboard.css'

const typeLabels = {
  monetary: 'Monetaria',
  in_kind: 'En especies',
  mixed: 'Mixta',
}

const statusLabels = {
  draft: 'Borrador',
  announced: 'Anunciada',
  received: 'Recibida',
  verified: 'Verificada',
  closed: 'Cerrada',
}

function LoginCard({ access }) {
  const [email, setEmail] = useState(access.email ?? '')
  const busy = access.status === 'loading' || access.status === 'sending_link'

  const submit = async (event) => {
    event.preventDefault()
    if (email.trim()) await access.requestMagicLink(email.trim().toLowerCase())
  }

  return (
    <main className="edifica-login-shell">
      <section className="edifica-login-card">
        <a className="edifica-wordmark" href="/">edifica<span>digital</span></a>
        <p className="edifica-kicker">ACCESO AL SISTEMA</p>
        <h1>Ingresa al panel de Edifica</h1>
        <p>Usa el correo habilitado por el administrador. Recibirás un enlace seguro para iniciar sesión.</p>

        {access.status === 'link_sent' ? (
          <div className="edifica-message success">
            Revisa tu correo. El enlace de acceso fue enviado a <strong>{access.email}</strong>.
          </div>
        ) : access.status === 'restricted' ? (
          <div className="edifica-message error">
            Este correo todavía requiere autorización administrativa.
            <button type="button" onClick={access.signOut}>Cerrar sesión</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="dashboard-email">Correo electrónico</label>
            <input
              id="dashboard-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@organizacion.org"
              required
            />
            {access.message && <p className="edifica-form-error">{access.message}</p>}
            <button className="edifica-primary-button" type="submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar enlace de acceso'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(value))
}

export default function DashboardApp() {
  const access = useOperatorAccess()
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (access.status !== 'authorized' || !supabase) return

    let active = true
    const loadDonations = async () => {
      setLoading(true)
      const { data, error: queryError } = await supabase
        .from('donation')
        .select('id, donation_type, status, received_at, created_at, donor:actor(name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!active) return
      if (queryError) {
        setError(queryError.message)
        setDonations([])
      } else {
        setError('')
        setDonations(data ?? [])
      }
      setLoading(false)
    }

    loadDonations()
    return () => { active = false }
  }, [access.status])

  const totals = useMemo(() => ({
    all: donations.length,
    monetary: donations.filter((item) => item.donation_type === 'monetary').length,
    inKind: donations.filter((item) => item.donation_type === 'in_kind').length,
  }), [donations])

  if (access.status !== 'authorized') return <LoginCard access={access} />

  return (
    <div className="edifica-dashboard-shell">
      <aside className="edifica-sidebar">
        <a className="edifica-wordmark light" href="/">edifica<span>digital</span></a>
        <nav>
          <a className="active" href="/app">Resumen</a>
          <a href="/donations/monetary/new">Nueva donación monetaria</a>
          <a href="/donations/in-kind/new">Nueva donación en especies</a>
          <a href="#registros">Mis registros</a>
          <span className="edifica-nav-section">ADMINISTRACIÓN</span>
          <button type="button" disabled>Personas habilitadas</button>
          <button type="button" disabled>Organizaciones</button>
        </nav>
        <button className="edifica-signout" type="button" onClick={access.signOut}>Cerrar sesión</button>
      </aside>

      <main className="edifica-dashboard-main">
        <header className="edifica-dashboard-header">
          <div>
            <p className="edifica-kicker">PANEL OPERATIVO</p>
            <h1>Resumen de donaciones</h1>
          </div>
          <div className="edifica-user-chip">{access.email}</div>
        </header>

        <section className="edifica-metrics">
          <article><span>Total registrado</span><strong>{totals.all}</strong></article>
          <article><span>Donaciones monetarias</span><strong>{totals.monetary}</strong></article>
          <article><span>Donaciones en especies</span><strong>{totals.inKind}</strong></article>
        </section>

        <section className="edifica-actions">
          <a href="/donations/monetary/new"><strong>Registrar donación monetaria</strong><span>Transferencias, efectivo, pago móvil, billeteras y otros medios.</span></a>
          <a href="/donations/in-kind/new"><strong>Registrar donación en especies</strong><span>Productos, insumos, contenedores, envíos y evidencias.</span></a>
        </section>

        <section className="edifica-records" id="registros">
          <div className="edifica-section-heading">
            <div><p className="edifica-kicker">HISTORIAL</p><h2>Registros disponibles</h2></div>
            <span>{donations.length} registros</span>
          </div>

          {loading ? <p className="edifica-empty">Cargando registros…</p> : error ? (
            <p className="edifica-empty error">No se pudo cargar el listado: {error}</p>
          ) : donations.length === 0 ? (
            <p className="edifica-empty">Todavía no hay donaciones registradas.</p>
          ) : (
            <div className="edifica-table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Donante</th><th>Estado</th></tr></thead>
                <tbody>
                  {donations.map((donation) => (
                    <tr key={donation.id}>
                      <td>{formatDate(donation.received_at ?? donation.created_at)}</td>
                      <td>{typeLabels[donation.donation_type] ?? donation.donation_type}</td>
                      <td>{donation.donor?.name ?? 'Donante registrado'}</td>
                      <td><span className={`edifica-status ${donation.status}`}>{statusLabels[donation.status] ?? donation.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
