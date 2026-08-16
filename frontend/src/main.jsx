import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './features/platform/two-space-layout.css'
import App from './App.jsx'
import DashboardApp from './features/dashboard/DashboardApp.jsx'
import OrganizationalManagementApp from './features/management/OrganizationalManagementApp.jsx'
import ManagementStructurePage from './features/management/ManagementStructurePage.jsx'
import ManagementObjectivesPage from './features/management/ManagementObjectivesPage.jsx'
import ManagementTrackingPage from './features/management/ManagementTrackingPage.jsx'
import ManagementIndicatorFormPage from './features/management/ManagementIndicatorFormPage.jsx'
import ManagementReportsPage from './features/management/ManagementReportsPage.jsx'
import ManagementResourcesPage from './features/management/ManagementResourcesPage.jsx'
import ManagementResourceFormPage from './features/management/ManagementResourceFormPage.jsx'
import ManagementDirectoryPage from './features/management/ManagementDirectoryPage.jsx'
import ManagementProjectWorkspacePage from './features/management/ManagementProjectWorkspacePage.jsx'
import ManagementOperationalFixes from './features/management/ManagementOperationalFixes.jsx'
import GuidedUXControllerV2 from './features/guidance/GuidedUXControllerV2.jsx'
import ActivateAccountPage from './features/auth/ActivateAccountPage.jsx'
import AuthLandingRecovery from './features/auth/AuthLandingRecovery.jsx'
import GlobalLanguageController from './i18n/GlobalLanguageController.jsx'
import { ToastProvider } from './features/notifications/ToastProvider.jsx'
import { ErrorBoundary } from './lib/ErrorBoundary.jsx'
import { installGlobalErrorLogging } from './lib/logger.js'

installGlobalErrorLogging()

const pathname = window.location.pathname
const isDashboard = pathname === '/app' || pathname.startsWith('/app/') || pathname.startsWith('/donations/')
const isManagement = pathname.startsWith('/app/management') || pathname.startsWith('/app/church')
const isManagementProjectWorkspace = pathname.startsWith('/app/management/projects/workspace')
const isManagementResources = pathname === '/app/management/resources' || pathname === '/app/management/resources/'
const isManagementMonetary = pathname.startsWith('/app/management/resources/monetary')
const isManagementInKind = pathname.startsWith('/app/management/resources/in-kind')
const isManagementAllies = pathname.startsWith('/app/management/allies')
const isManagementVolunteers = pathname.startsWith('/app/management/volunteers')
const isManagementStructure = pathname === '/app/management/structure' || pathname === '/app/management/structure/'
const isManagementObjectives = pathname.startsWith('/app/management/objectives')
const isManagementIndicatorNew = pathname === '/app/management/tracking/new' || pathname === '/app/management/tracking/new/'
const isManagementTracking = pathname.startsWith('/app/management/tracking')
const isManagementReports = pathname.startsWith('/app/management/reports')
const isActivationPage = pathname === '/activar'

function legacyTarget() {
  const search = window.location.search || ''
  if (pathname.startsWith('/app/donations/execution') || pathname.startsWith('/app/compliance')) return `/app/management/projects/workspace${search}`
  if (pathname.startsWith('/app/donations/projects') || pathname.startsWith('/app/projects')) return `/app/management/projects${search}`
  if (pathname.startsWith('/app/donations/volunteers') || pathname.startsWith('/app/volunteers')) return `/app/management/volunteers${search}`
  if (pathname.startsWith('/app/donations/donors') || pathname.startsWith('/app/donors')) return `/app/management/allies${search}`
  if (pathname === '/app/donations' || pathname === '/app/donations/') return `/app/management/resources${search}`
  if (pathname.startsWith('/donations/monetary')) return `/app/management/resources/monetary/new${search}`
  if (pathname.startsWith('/donations/in-kind')) return `/app/management/resources/in-kind/new${search}`
  return ''
}

function LegacyRedirect({ target }) {
  useEffect(() => { window.location.replace(target) }, [target])
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>Actualizando acceso…</main>
}

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
  const redirect = legacyTarget()
  if (isActivationPage) {
    return <><GlobalLanguageController /><ActivateAccountPage /></>
  }
  if (redirect) return <LegacyRedirect target={redirect} />

  let content
  if (isManagementProjectWorkspace) content = <ManagementProjectWorkspacePage />
  else if (isManagementMonetary) content = <ManagementResourceFormPage kind="monetary" />
  else if (isManagementInKind) content = <ManagementResourceFormPage kind="in-kind" />
  else if (isManagementResources) content = <ManagementResourcesPage />
  else if (isManagementAllies) content = <ManagementDirectoryPage kind="allies" />
  else if (isManagementVolunteers) content = <ManagementDirectoryPage kind="volunteers" />
  else if (isManagementStructure) content = <ManagementStructurePage />
  else if (isManagementObjectives) content = <ManagementObjectivesPage />
  else if (isManagementIndicatorNew) content = <ManagementIndicatorFormPage />
  else if (isManagementTracking) content = <ManagementTrackingPage />
  else if (isManagementReports) content = <ManagementReportsPage />
  else if (isManagement) content = <OrganizationalManagementApp />
  else if (isDashboard) content = <DashboardApp />
  else content = <App />

  return (
    <>
      <AuthLandingRecovery />
      <PublicLoginGuard />
      <GlobalLanguageController />
      <GuidedUXControllerV2 />
      {isManagement && <ManagementOperationalFixes />}
      {content}
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
