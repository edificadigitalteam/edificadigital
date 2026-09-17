import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './management-report-create-shortcut.css'

export default function ManagementReportCreateShortcut() {
  const access = useOperatorAccess()
  const [target, setTarget] = useState(null)
  const exactReportsPage = window.location.pathname.replace(/\/$/, '') === '/app/management/reports'

  useEffect(() => {
    if (!exactReportsPage) return undefined
    const find = () => {
      const heading = document.querySelector('.cycle-reports-page .management-panel-heading')
      setTarget(heading || null)
    }
    find()
    const observer = new MutationObserver(find)
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [exactReportsPage])

  if (!exactReportsPage || access.status !== 'authorized' || !target) return null

  return createPortal(
    <a className="management-report-create-shortcut" href="/app/management/reports/new">＋ CREAR INFORME</a>,
    target,
  )
}
