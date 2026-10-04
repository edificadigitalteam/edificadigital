import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase.js'
import { useOperatorAccess } from '../in-kind/useOperatorAccess.js'
import './management-fixes.css'
import './management-grouped-nav.css'
import './management-legacy-mobile-nav.css'

function currentLanguage() {
  return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
}

export default function ManagementOperationalFixes() {
  const access = useOperatorAccess()
  const [language, setLanguage] = useState(currentLanguage)
  const [mobileTarget, setMobileTarget] = useState(null)
  const [navTarget, setNavTarget] = useState(null)
  const [legacySidebarTarget, setLegacySidebarTarget] = useState(null)
  const [legacyMobileMenuNeeded, setLegacyMobileMenuNeeded] = useState(false)
  const [legacyMobileMenuOpen, setLegacyMobileMenuOpen] = useState(false)
  const [financeNoticeTarget, setFinanceNoticeTarget] = useState(null)
  const [maintainersOpen, setMaintainersOpen] = useState(window.location.pathname.startsWith('/app/management/settings'))
  const [calendarOverride, setCalendarOverride] = useState('')
  const isManagement = window.location.pathname.startsWith('/app/management') || window.location.pathname.startsWith('/app/church')
  const canAdmin = access.role === 'admin' || access.role === 'super_admin'

  useEffect(() => {
    if (!supabase || access.status !== 'authorized' || !access.organizationId) return undefined
    let cancelled = false
    supabase.from('organization').select('calendar_module_label').eq('id', access.organizationId).single()
      .then(({ data }) => {
        if (!cancelled) setCalendarOverride(String(data?.calendar_module_label || '').trim())
      })
    return () => { cancelled = true }
  }, [access.organizationId, access.status])

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
        const header = document.querySelector('.management-mobile-header')
        const sidebar = document.querySelector('.management-sidebar')
        const hasCanonicalMobileMenu = Boolean(header?.querySelector('.management-mobile-menu-button:not(.management-legacy-mobile-menu-button)'))
        const needsLegacyMobileMenu = Boolean(header && sidebar && !hasCanonicalMobileMenu)

        setMobileTarget(header)
        setLegacySidebarTarget(sidebar)
        setLegacyMobileMenuNeeded(needsLegacyMobileMenu)
        header?.classList.toggle('management-legacy-mobile-header', needsLegacyMobileMenu)
        if (needsLegacyMobileMenu && sidebar && !sidebar.id) sidebar.id = 'management-legacy-mobile-sidebar'

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

        const nav = sidebar?.querySelector('nav')
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
      document.querySelectorAll('.management-legacy-mobile-header').forEach((node) => node.classList.remove('management-legacy-mobile-header'))
      document.querySelectorAll('.management-legacy-mobile-open').forEach((node) => node.classList.remove('management-legacy-mobile-open'))
      if (injectedNavMount?.isConnected) injectedNavMount.remove()
      if (injectedFinanceMount?.isConnected) injectedFinanceMount.remove()
    }
  }, [isManagement])

  useEffect(() => {
    const sidebar = legacySidebarTarget
    if (!legacyMobileMenuNeeded || !sidebar) {
      sidebar?.classList.remove('management-legacy-mobile-open')
      return undefined
    }
    if (!legacyMobileMenuOpen) {
      sidebar.classList.remove('management-legacy-mobile-open')
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    sidebar.classList.add('management-legacy-mobile-open')
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const onKeyDown = (event) => { if (event.key === 'Escape') setLegacyMobileMenuOpen(false) }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      sidebar.classList.remove('management-legacy-mobile-open')
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [legacyMobileMenuNeeded, legacyMobileMenuOpen, legacySidebarTarget])

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
    overview: 'Overview', structure: 'Structure', objectives: 'Annual plan', calendar: calendarOverride || 'Calendar', projects: 'Projects', resources: 'Contributions and resources', allies: 'Partners and donors', members: 'Members', volunteers: 'Volunteers', finance: 'Finance', tracking: 'Tracking', pendingIssues: 'Pending issues', reports: 'Reports', users: 'Users and access',
    maintainers: 'Catalogs', memberCategories: 'Member categories', relationshipRoles: 'Relationship roles', moduleLabels: 'Module names',
    showMaintainers: 'Show the catalogs', hideMaintainers: 'Hide the catalogs',
  } : {
    start: 'Inicio', planning: 'Planificación', operation: 'Recursos y operación', control: 'Control y rendición', administration: 'Administración',
    overview: 'Resumen', structure: 'Estructura', objectives: 'Plan anual', calendar: calendarOverride || 'Calendario', projects: 'Proyectos', resources: 'Aportes y recursos', allies: 'Aliados y donantes', members: 'Miembros', volunteers: 'Voluntariado', finance: 'Finanzas', tracking: 'Seguimiento', pendingIssues: 'Asuntos pendientes', reports: 'Informes', users: 'Usuarios y accesos',
    maintainers: 'Mantenedores', memberCategories: 'Categorías de miembros', relationshipRoles: 'Roles de relación', moduleLabels: 'Nombres de los módulos',
    showMaintainers: 'Mostrar los mantenedores', hideMaintainers: 'Ocultar los mantenedores',
  }
  const groups = [
    [labels.start, [[labels.overview, '/app/management']]],
    [labels.planning, [[labels.structure, '/app/management/structure'], [labels.objectives, '/app/management/objectives'], [labels.calendar, '/app/management/calendar'], [labels.projects, '/app/management/projects']]],
    [labels.operation, [[labels.resources, '/app/management/resources'], [labels.allies, '/app/management/allies'], [labels.members, '/app/management/members'], [labels.volunteers, '/app/management/volunteers'], [labels.finance, '/app/management/finance']]],
    [labels.control, [[labels.tracking, '/app/management/tracking'], [labels.pendingIssues, '/app/management/pending-issues'], [labels.reports, '/app/management/reports']]],
  ]
  const isActive = (href) => href === '/app/management' ? path === href : path.startsWith(href)

  return <>
    {navTarget && createPortal(
      <div className="management-grouped-nav">
        {groups.map(([groupLabel, items]) => <div className="management-nav-group" key={groupLabel}>
          <p className="management-nav-group-label">{groupLabel}</p>
          {items.map(([label, href]) => <a className={`management-nav-action${isActive(href) ? ' active' : ''}`} href={href} key={href}>{label}</a>)}
        </div>)}
        {canAdmin && <div className="management-nav-group">
          <p className="management-nav-group-label">{labels.administration}</p>
          <a className="management-nav-action" href="/app/admin/operators">{labels.users}</a>
          <button
            type="button"
            className={`management-nav-collapse${maintainersOpen ? ' open' : ''}`}
            aria-expanded={maintainersOpen}
            aria-controls="management-legacy-nav-maintainers"
            onClick={() => setMaintainersOpen((current) => !current)}
            title={maintainersOpen ? labels.hideMaintainers : labels.showMaintainers}
          >
            <span>{labels.maintainers}</span>
            <i aria-hidden="true" />
          </button>
          <div id="management-legacy-nav-maintainers" className="management-nav-collapse-panel" hidden={!maintainersOpen}>
            <a className={`management-nav-action${isActive('/app/management/settings/member-categories') ? ' active' : ''}`} href="/app/management/settings/member-categories">{labels.memberCategories}</a>
            <a className={`management-nav-action${isActive('/app/management/settings/relationship-roles') ? ' active' : ''}`} href="/app/management/settings/relationship-roles">{labels.relationshipRoles}</a>
            <a className={`management-nav-action${isActive('/app/management/settings/module-labels') ? ' active' : ''}`} href="/app/management/settings/module-labels">{labels.moduleLabels}</a>
          </div>
        </div>}
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
    {mobileTarget && legacyMobileMenuNeeded && createPortal(
      <button
        type="button"
        className="management-mobile-menu-button management-legacy-mobile-menu-button"
        aria-expanded={legacyMobileMenuOpen}
        aria-controls="management-legacy-mobile-sidebar"
        aria-label={legacyMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        title={legacyMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setLegacyMobileMenuOpen((current) => !current)}
      >
        <span /><span /><span />
      </button>,
      mobileTarget,
    )}
    {legacyMobileMenuOpen && typeof document !== 'undefined' && createPortal(
      <button type="button" className="management-mobile-backdrop management-legacy-mobile-backdrop" aria-label="Cerrar menú" onClick={() => setLegacyMobileMenuOpen(false)} />,
      document.body,
    )}
    {legacyMobileMenuOpen && legacySidebarTarget && createPortal(
      <button type="button" className="management-legacy-mobile-close-button" aria-label="Cerrar menú" title="Cerrar menú" onClick={() => setLegacyMobileMenuOpen(false)}>×</button>,
      legacySidebarTarget,
    )}
  </>
}
