import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DashboardApp from './features/dashboard/DashboardApp.jsx'
import { ErrorBoundary } from './lib/ErrorBoundary.jsx'
import { installGlobalErrorLogging } from './lib/logger.js'

installGlobalErrorLogging()

const isDashboard = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
const isOperationalForm = window.location.pathname.startsWith('/donations/')

function OperationalNavigationGuard() {
  useEffect(() => {
    if (!isOperationalForm) return undefined

    const rewriteLinks = () => {
      document.querySelectorAll('a[href="/"]').forEach((link) => {
        link.setAttribute('href', '/app')
      })

      document.querySelectorAll('.intake-back-home').forEach((link) => {
        const isEnglish = document.documentElement.lang === 'en'
        const icon = link.querySelector('svg')
        link.replaceChildren(...(icon ? [icon] : []), document.createTextNode(isEnglish ? ' Back to dashboard' : ' Volver al panel'))
      })
    }

    rewriteLinks()
    const observer = new MutationObserver(rewriteLinks)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}

function RootApplication() {
  return (
    <>
      {isOperationalForm && <OperationalNavigationGuard />}
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
