import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DashboardApp from './features/dashboard/DashboardApp.jsx'
import { ErrorBoundary } from './lib/ErrorBoundary.jsx'
import { installGlobalErrorLogging } from './lib/logger.js'

installGlobalErrorLogging()

const isDashboard = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')

function RootApplication() {
  return isDashboard ? <DashboardApp /> : <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <RootApplication />
    </ErrorBoundary>
  </StrictMode>,
)
