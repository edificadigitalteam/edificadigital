import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DashboardApp from './features/dashboard/DashboardApp.jsx'
import { ErrorBoundary } from './lib/ErrorBoundary.jsx'
import { installGlobalErrorLogging } from './lib/logger.js'

installGlobalErrorLogging()

const isDashboard = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
const isLanding = window.location.pathname === '/'

function RootApplication() {
  if (isDashboard) return <DashboardApp />

  return (
    <>
      <App />
      {isLanding && (
        <a
          href="/app"
          aria-label="Iniciar sesión en Edifica"
          style={{
            position: 'fixed',
            right: '22px',
            bottom: '22px',
            zIndex: 50,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '48px',
            padding: '0 20px',
            borderRadius: '999px',
            background: '#173f33',
            color: '#fff',
            fontFamily: 'Manrope, system-ui, sans-serif',
            fontSize: '.9rem',
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 14px 32px rgba(16, 47, 39, .24)',
          }}
        >
          Iniciar sesión
        </a>
      )}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <RootApplication />
    </ErrorBoundary>
  </StrictMode>,
)
