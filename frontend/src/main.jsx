import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DashboardApp from './features/dashboard/DashboardApp.jsx'
import OrganizationalManagementApp from './features/management/OrganizationalManagementApp.jsx'
import ActivateAccountPage from './features/auth/ActivateAccountPage.jsx'
import GlobalLanguageController from './i18n/GlobalLanguageController.jsx'
import { ToastProvider } from './features/notifications/ToastProvider.jsx'
import { ErrorBoundary } from './lib/ErrorBoundary.jsx'
import { installGlobalErrorLogging } from './lib/logger.js'

installGlobalErrorLogging()

const pathname = window.location.pathname
const isDashboard = pathname === '/app' || pathname.startsWith('/app/') || pathname.startsWith('/donations/')
const isManagement = pathname.startsWith('/app/management') || pathname.startsWith('/app/church')
const isActivationPage = pathname === '/activar'

function PublicLoginGuard() {
  useEffect(() => {
    if (isDashboard) return undefined

    const openLogin = (event) => {
      const link = event.target.closest?.('a.product-login[href="/app"], a.nav-cta[href="/app"]')
      if (!link) return
      event.preventDefault()
      window.location.assign(`/app?login=1&t=${Date.now()}`)
    }

    document.addEventListener('click', openLogin, true)
    return () => document.removeEventListener('click', openLogin, true)
  }, [])

  return null
}

function RootApplication() {
  if (isActivationPage) {
    return (
      <>
        <GlobalLanguageController />
        <ActivateAccountPage />
      </>
    )
  }

  return (
    <>
      <PublicLoginGuard />
      <GlobalLanguageController />
      {isManagement ? <OrganizationalManagementApp /> : isDashboard ? <DashboardApp /> : <App />}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <RootApplication />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
