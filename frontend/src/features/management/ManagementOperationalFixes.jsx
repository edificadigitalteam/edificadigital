import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './management-fixes.css'

function currentLanguage() {
  return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
}

export default function ManagementOperationalFixes() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(currentLanguage)
  const [footerTarget, setFooterTarget] = useState(null)
  const [mobileTarget, setMobileTarget] = useState(null)
  const isManagement = window.location.pathname.startsWith('/app/management') || window.location.pathname.startsWith('/app/church')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  useEffect(() => {
    if (!isManagement) return undefined

    const updateLanguage = () => setLanguage(currentLanguage())
    const languageObserver = new MutationObserver(updateLanguage)
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

    const findTargets = () => {
      setFooterTarget(document.querySelector('.management-sidebar-footer'))
      setMobileTarget(document.querySelector('.management-mobile-header'))
    }

    findTargets()
    const observer = new MutationObserver(findTargets)
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      languageObserver.disconnect()
    }
  }, [isManagement])

  if (!isManagement || access.status !== 'authorized' || !canAdmin) return null

  const usersText = language === 'en' ? 'Users and access' : 'Usuarios y accesos'

  return <>
    {footerTarget && !footerTarget.querySelector('.management-users-link') && createPortal(
      <a className="management-users-link" href="/app/admin/operators">{usersText}</a>,
      footerTarget,
    )}
    {mobileTarget && !mobileTarget.querySelector('.management-users-mobile-link') && createPortal(
      <a className="management-users-mobile-link" href="/app/admin/operators">{usersText}</a>,
      mobileTarget,
    )}
  </>
}
