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
  const [projectTarget, setProjectTarget] = useState(null)
  const [projectActionError, setProjectActionError] = useState(false)
  const isManagement = window.location.pathname.startsWith('/app/management') || window.location.pathname.startsWith('/app/church')
  const isProjects = window.location.pathname.startsWith('/app/management/projects')
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

  useEffect(() => {
    if (!isProjects || !canAdmin || access.status !== 'authorized') {
      setProjectTarget(null)
      return undefined
    }

    let host = document.getElementById('management-project-create-portal')
    const attach = () => {
      const header = document.querySelector('.project-portal-header')
      if (!header) return false
      host = document.getElementById('management-project-create-portal')
      if (!host) {
        host = document.createElement('div')
        host.id = 'management-project-create-portal'
        header.insertAdjacentElement('afterend', host)
      }
      setProjectTarget(host)
      return true
    }

    if (!attach()) {
      const observer = new MutationObserver(() => {
        if (attach()) observer.disconnect()
      })
      observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
      return () => observer.disconnect()
    }

    return undefined
  }, [access.status, canAdmin, isProjects])

  if (!isManagement || access.status !== 'authorized') return null

  const triggerNewProject = () => {
    const buttons = Array.from(document.querySelectorAll('.project-list-card .module-list-heading button'))
    const target = buttons.find((button) => /nuevo proyecto|new project/i.test(button.textContent || '')) || buttons[0]
    if (target) {
      setProjectActionError(false)
      target.click()
    } else {
      setProjectActionError(true)
    }
  }

  const text = language === 'en' ? {
    users: 'Users and access',
    projectEyebrow: 'CREATE PROJECT',
    projectTitle: 'Register a new project, program, campaign, or initiative',
    projectCopy: 'You can create it now and link an organizational area, institutional objectives, donor, budget, and beneficiaries as they become available.',
    projectButton: '＋ Create project',
    projectError: 'The project form could not be opened. Reload this page and try again.',
  } : {
    users: 'Usuarios y accesos',
    projectEyebrow: 'CREAR PROYECTO',
    projectTitle: 'Registra un nuevo proyecto, programa, campaña o iniciativa',
    projectCopy: 'Puedes crearlo ahora y vincular después el área responsable, objetivos institucionales, donante, presupuesto y beneficiarios según corresponda.',
    projectButton: '＋ Crear proyecto',
    projectError: 'No fue posible abrir el formulario de proyecto. Recarga esta página e inténtalo nuevamente.',
  }

  return <>
    {canAdmin && footerTarget && !footerTarget.querySelector('.management-users-link') && createPortal(<a className="management-users-link" href="/app/admin/operators">{text.users}</a>, footerTarget)}
    {canAdmin && mobileTarget && !mobileTarget.querySelector('.management-users-mobile-link') && createPortal(<a className="management-users-mobile-link" href="/app/admin/operators">{text.users}</a>, mobileTarget)}
    {projectTarget && createPortal(<section className="management-project-create-card"><div><small>{text.projectEyebrow}</small><strong>{text.projectTitle}</strong><p>{text.projectCopy}</p>{projectActionError && <em>{text.projectError}</em>}</div><button type="button" onClick={triggerNewProject}>{text.projectButton}</button></section>, projectTarget)}
  </>
}
