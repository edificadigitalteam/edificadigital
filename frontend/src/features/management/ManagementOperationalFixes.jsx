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
    let frame = 0

    const updateLanguage = () => setLanguage(currentLanguage())
    const languageObserver = new MutationObserver(updateLanguage)
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

    const root = document.getElementById('root') || document.body
    const observerOptions = { childList: true, subtree: true }
    const observer = new MutationObserver(() => {
      if (frame) return
      frame = window.requestAnimationFrame(() => { frame = 0; findTargets() })
    })
    const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value }

    const findTargets = () => {
      observer.disconnect()
      try {
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
        setText(directButtons[4]?.querySelector('span'), '09')
        setText(directButtons[5]?.querySelector('span'), '10')
        setNavTarget(mount)
      } finally {
        observer.observe(root, observerOptions)
      }
    }

    findTargets()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      languageObserver.disconnect()
      if (injectedMount?.isConnected) injectedMount.remove()
    }
  }, [isManagement])

  useEffect(() => {
    const cleanPath = window.location.pathname.replace(/\/$/, '')
    if (cleanPath !== '/app/management/tracking') return undefined
    const openDedicatedIndicatorPage = (event) => {
      const button = event.target.closest?.('.management-panel-heading button')
      if (!button || button.disabled) return
      const label = button.textContent || ''
      if (!label.includes('Crear indicador') && !label.includes('Create indicator')) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      const filters = Array.from(document.querySelectorAll('.management-filter-row select'))
      const params = new URLSearchParams()
      if (filters[0]?.value) params.set('period', filters[0].value)
      if (filters[1]?.value) params.set('unit', filters[1].value)
      const query = params.toString()
      window.location.assign(`/app/management/tracking/new${query ? `?${query}` : ''}`)
    }
    document.addEventListener('click', openDedicatedIndicatorPage, true)
    return () => document.removeEventListener('click', openDedicatedIndicatorPage, true)
  }, [])

  if (!isManagement || access.status !== 'authorized') return null

  const usersText = language === 'en' ? 'Users and access' : 'Usuarios y accesos'
  const resourcesText = language === 'en' ? 'Contributions and resources' : 'Aportes y recursos'
  const alliesText = language === 'en' ? 'Partners and donors' : 'Aliados y donantes'
  const volunteersText = language === 'en' ? 'Volunteers' : 'Voluntariado'
  const financeText = language === 'en' ? 'Finance / DIAF' : 'Finanzas / DIAF'
  const path = window.location.pathname

  return <>
    {navTarget && createPortal(
      <>
        <a className={path.startsWith('/app/management/resources') ? 'management-extra-nav-link active' : 'management-extra-nav-link'} href="/app/management/resources"><span>05</span>{resourcesText}</a>
        <a className={path.startsWith('/app/management/allies') ? 'management-extra-nav-link active' : 'management-extra-nav-link'} href="/app/management/allies"><span>06</span>{alliesText}</a>
        <a className={path.startsWith('/app/management/volunteers') ? 'management-extra-nav-link active' : 'management-extra-nav-link'} href="/app/management/volunteers"><span>07</span>{volunteersText}</a>
        <a className={path.startsWith('/app/management/finance') ? 'management-extra-nav-link active' : 'management-extra-nav-link'} href="/app/management/finance"><span>08</span>{financeText}</a>
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
    {mobileTarget && !mobileTarget.querySelector('.management-finance-mobile-link') && createPortal(
      <a className="management-finance-mobile-link" href="/app/management/finance">{language === 'en' ? 'Finance' : 'Finanzas'}</a>,
      mobileTarget,
    )}
    {canAdmin && mobileTarget && !mobileTarget.querySelector('.management-users-mobile-link') && createPortal(
      <a className="management-users-mobile-link" href="/app/admin/operators">{usersText}</a>,
      mobileTarget,
    )}
  </>
}
