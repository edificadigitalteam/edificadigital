import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DashboardApp from './features/dashboard/DashboardApp.jsx'
import GlobalLanguageController from './i18n/GlobalLanguageController.jsx'
import { ErrorBoundary } from './lib/ErrorBoundary.jsx'
import { installGlobalErrorLogging } from './lib/logger.js'

installGlobalErrorLogging()

const isDashboard = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
const isOperationalForm = window.location.pathname.startsWith('/donations/')

function OperationalNavigationGuard() {
  useEffect(() => {
    if (!isOperationalForm) return undefined

    const rewriteVisibleLinks = () => {
      document.querySelectorAll('a[href="/"]').forEach((link) => {
        link.setAttribute('href', '/app')
      })

      document.querySelectorAll('.intake-back-home').forEach((link) => {
        if (link.dataset.panelLinkFixed === 'true') return
        const isEnglish = document.documentElement.lang === 'en'
        const icon = link.querySelector('svg')
        link.replaceChildren(...(icon ? [icon] : []), document.createTextNode(isEnglish ? ' Back to dashboard' : ' Volver al panel'))
        link.dataset.panelLinkFixed = 'true'
      })
    }

    const redirectRootLinks = (event) => {
      const link = event.target.closest?.('a[href="/"]')
      if (!link) return
      event.preventDefault()
      window.location.assign('/app')
    }

    rewriteVisibleLinks()
    const immediate = window.setTimeout(rewriteVisibleLinks, 0)
    const afterRender = window.setTimeout(rewriteVisibleLinks, 250)
    document.addEventListener('click', redirectRootLinks, true)

    return () => {
      window.clearTimeout(immediate)
      window.clearTimeout(afterRender)
      document.removeEventListener('click', redirectRootLinks, true)
    }
  }, [])

  return null
}

function PublicLoginGuard() {
  useEffect(() => {
    if (isDashboard || isOperationalForm) return undefined

    const openLogin = (event) => {
      const link = event.target.closest?.('a.nav-cta[href="/app"]')
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
  return (
    <>
      <PublicLoginGuard />
      {isOperationalForm && <OperationalNavigationGuard />}
      <GlobalLanguageController />
      {isDashboard ? <DashboardApp /> : <App />}
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
