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
  const [navTarget, setNavTarget] = useState(null)
  const isManagement = window.location.pathname.startsWith('/app/management') || window.location.pathname.startsWith('/app/church')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  useEffect(() => {
    if (!isManagement) return undefined
    let injectedMount = null

    const updateLanguage = () => setLanguage(currentLanguage())
    const languageObserver = new MutationObserver(updateLanguage)
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

    const findTargets = () => {
      setFooterTarget(document.querySelector('.management-sidebar-footer'))
      setMobileTarget(document.querySelector('.management-mobile-header'))
      const nav = document.querySelector('.management-sidebar nav')
      if (!nav || nav.classList.contains('management-canonical-nav')) {
        setNavTarget(null)
        return
      }
      let mount = nav.querySelector('.management-extra-nav-mount')
      if (!mount) {
        mount = document.createElement('div')
        mount.className = 'management-extra-nav-mount'
        const buttons = Array.from(nav.children).filter((node) => node.tagName === 'BUTTON')
        const trackingButton = buttons[4] || null
        nav.insertBefore(mount, trackingButton)
        injectedMount = mount
      }
      const directButtons = Array.from(nav.children).filter((node) => node.tagName === 'BUTTON')
      if (directButtons[4]?.querySelector('span')) directButtons[4].querySelector('span').textContent = '08'
      if (directButtons[5]?.querySelector('span')) directButtons[5].querySelector('span').textContent = '09'
      setNavTarget(mount)
    }

    findTargets()
    const observer = new MutationObserver(findTargets)
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      languageObserver.disconnect()
      if (injectedMount?.isConnected) injectedMount.remove()
    }
  }, [isManagement])

  if (!isManagement || access.status !== 'authorized') return null

  const usersText = language === 'en' ? 'Users and access' : 'Usuarios y accesos'
  const resourcesText = language === 'en' ? 'Contributions and resources' : 'Aportes y recursos'
  const alliesText = language === 'en' ? 'Partners and donors' : 'Aliados y donantes'
  const volunteersText = language === 'en' ? 'Volunteers' : 'Voluntariado'
  const path = window.location.pathname

  return <>
    {navTarget && createPortal(
      <>
        <a className={path.startsWith('/app/management/resources') ? 'management-extra-nav-link active' : 'management-extra-nav-link'} href="/app/management/resources"><span>05</span>{resourcesText}</a>
        <a className={path.startsWith('/app/management/allies') ? 'management-extra-nav-link active' : 'management-extra-nav-link'} href="/app/management/allies"><span>06</span>{alliesText}</a>
        <a className={path.startsWith('/app/management/volunteers') ? 'management-extra-nav-link active' : 'management-extra-nav-link'} href="/app/management/volunteers"><span>07</span>{volunteersText}</a>
      </>,
      navTarget,
    )}
    {canAdmin && footerTarget && !footerTarget.querySelector('.management-users-link') && createPortal(
      <a className="management-users-link" href="/app/admin/operators">{usersText}</a>,
      footerTarget,
    )}
    {mobileTarget && !mobileTarget.querySelector('.management-resources-mobile-link') && createPortal(
      <a className="management-resources-mobile-link" href="/app/management/resources">{language === 'en' ? 'Resources' : 'Aportes'}</a>,
      mobileTarget,
    )}
    {canAdmin && mobileTarget && !mobileTarget.querySelector('.management-users-mobile-link') && createPortal(
      <a className="management-users-mobile-link" href="/app/admin/operators">{usersText}</a>,
      mobileTarget,
    )}
  </>
}
