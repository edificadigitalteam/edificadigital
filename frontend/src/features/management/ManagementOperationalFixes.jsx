import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './management-fixes.css'
import './management-grouped-nav.css'

function currentLanguage() {
  return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
}

export default function ManagementOperationalFixes() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(currentLanguage)
  const [mobileTarget, setMobileTarget] = useState(null)
  const [navTarget, setNavTarget] = useState(null)
  const [financeNoticeTarget, setFinanceNoticeTarget] = useState(null)
  const isManagement = window.location.pathname.startsWith('/app/management') || window.location.pathname.startsWith('/app/church')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  useEffect(() => {
    if (!isManagement) return undefined
    let injectedNavMount = null
    let injectedFinanceMount = null
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
        setMobileTarget(document.querySelector('.management-mobile-header'))

        const financeHeading = document.querySelector('.finance-page .management-panel-heading')
        if (financeHeading) {
          setText(financeHeading.querySelector('p'), currentLanguage() === 'en' ? 'FINANCE' : 'FINANZAS')
          let financeMount = document.querySelector('.finance-access-note-mount')
          if (!financeMount) {
            financeMount = document.createElement('div')
            financeMount.className = 'finance-access-note-mount'
            financeHeading.insertAdjacentElement('afterend', financeMount)
            injectedFinanceMount = financeMount
          }
          setFinanceNoticeTarget(financeMount)
        } else {
          setFinanceNoticeTarget(null)
        }

        const requestsIntro = document.querySelector('.finance-resource-requests-page .management-panel-heading > div:first-child > span')
        if (requestsIntro) setText(requestsIntro, currentLanguage() === 'en'
          ? 'Every request from a directorate, agency, auxiliary, or other unit is routed to DIAF for review, approval, and release from an institutional fund.'
          : 'Toda solicitud de una Dirección, agencia, auxiliar u otra unidad llega a DIAF para su revisión, aprobación y posterior liberación desde un fondo institucional.')

        const nav = document.querySelector('.management-sidebar nav')
        if (!nav || nav.classList.contains('management-canonical-nav')) {
          setNavTarget(null)
          return
        }
        nav.classList.add('management-legacy-nav-replaced')
        let mount = nav.querySelector('.management-grouped-nav-mount')
        if (!mount) {
          mount = document.createElement('div')
          mount.className = 'management-grouped-nav-mount'
          nav.appendChild(mount)
          injectedNavMount = mount
        }
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
      if (injectedNavMount?.isConnected) injectedNavMount.remove()
      if (injectedFinanceMount?.isConnected) injectedFinanceMount.remove()
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

  const path = window.location.pathname.replace(/\/$/, '') || '/app/management'
  const labels = language === 'en' ? {
    start: 'Start', planning: 'Planning', operation: 'Resources and operations', control: 'Control and reporting', administration: 'Administration',
    overview: 'Overview', structure: 'Structure', objectives: 'Objectives', projects: 'Projects', resources: 'Contributions and resources', allies: 'Partners and donors', volunteers: 'Volunteers', finance: 'Finance', tracking: 'Tracking', reports: 'Reports', users: 'Users and access',
  } : {
    start: 'Inicio', planning: 'Planificación', operation: 'Recursos y operación', control: 'Control y rendición', administration: 'Administración',
    overview: 'Resumen', structure: 'Estructura', objectives: 'Objetivos', projects: 'Proyectos', resources: 'Aportes y recursos', allies: 'Aliados y donantes', volunteers: 'Voluntariado', finance: 'Finanzas', tracking: 'Seguimiento', reports: 'Informes', users: 'Usuarios y accesos',
  }
  const groups = [
    [labels.start, [[labels.overview, '/app/management']]],
    [labels.planning, [[labels.structure, '/app/management/structure'], [labels.objectives, '/app/management/objectives'], [labels.projects, '/app/management/projects']]],
    [labels.operation, [[labels.resources, '/app/management/resources'], [labels.allies, '/app/management/allies'], [labels.volunteers, '/app/management/volunteers'], [labels.finance, '/app/management/finance']]],
    [labels.control, [[labels.tracking, '/app/management/tracking'], [labels.reports, '/app/management/reports']]],
  ]
  const isActive = (href) => href === '/app/management' ? path === href : path.startsWith(href)

  return <>
    {navTarget && createPortal(
      <div className="management-grouped-nav">
        {groups.map(([groupLabel, items]) => <div className="management-nav-group" key={groupLabel}>
          <p className="management-nav-group-label">{groupLabel}</p>
          {items.map(([label, href]) => <a className={`management-nav-action${isActive(href) ? ' active' : ''}`} href={href} key={href}>{label}</a>)}
        </div>)}
        {canAdmin && <div className="management-nav-group"><p className="management-nav-group-label">{labels.administration}</p><a className="management-nav-action" href="/app/admin/operators">{labels.users}</a></div>}
      </div>,
      navTarget,
    )}
    {financeNoticeTarget && createPortal(
      <section className="finance-access-note">
        <div><span>{language === 'en' ? 'ROUTED TO DIAF' : 'CENTRALIZADO EN DIAF'}</span><strong>{language === 'en' ? 'Every financial record and resource request submitted by any unit reaches DIAF.' : 'Todo registro financiero y toda solicitud de recursos enviada por cualquier unidad llega a DIAF.'}</strong></div>
        <p>{language === 'en' ? 'Directorates, agencies, auxiliaries, and other units can submit their documentation. DIAF receives the institutional inbox and controls review, funds, approvals, transfers, and releases.' : 'Direcciones, agencias, auxiliares y demás unidades pueden cargar su documentación. DIAF recibe la bandeja institucional y controla revisión, fondos, aprobaciones, transferencias y liberación de recursos.'}</p>
      </section>,
      financeNoticeTarget,
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
      <a className="management-users-mobile-link" href="/app/admin/operators">{labels.users}</a>,
      mobileTarget,
    )}
  </>
}
