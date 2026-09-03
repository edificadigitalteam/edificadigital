import { useEffect } from 'react'

function currentLanguage() {
  try {
    return document.documentElement.lang === 'en' || window.localStorage.getItem('edifica-language') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

function parseCompletion(text) {
  const matches = Array.from(String(text || '').matchAll(/(-?\d+(?:[.,]\d+)?)\s*%/g))
  if (!matches.length) return null
  const value = Number(matches[matches.length - 1][1].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function isNumericReportIndicator(article) {
  const targetText = article.querySelector(':scope > span')?.textContent || ''
  const resultText = article.querySelector(':scope > b')?.textContent || ''
  const targetValue = targetText.includes(':') ? targetText.slice(targetText.indexOf(':') + 1) : targetText
  const achievedSegment = resultText.includes('·') ? resultText.slice(0, resultText.lastIndexOf('·')) : resultText
  return /\d/.test(targetValue) && /\d/.test(achievedSegment)
}

function enhanceReportIndicators() {
  if (!window.location.pathname.startsWith('/app/management/reports')) return

  document.querySelectorAll('.reports-v2-page .report-indicator-grid > article').forEach((article) => {
    const completion = parseCompletion(article.querySelector(':scope > b')?.textContent)
    if (completion === null || !isNumericReportIndicator(article)) {
      article.classList.remove('report-indicator-visualized')
      article.style.removeProperty('--report-progress')
      article.style.removeProperty('--report-angle')
      article.removeAttribute('data-completion-label')
      return
    }

    const clamped = Math.max(0, Math.min(completion, 100))
    const label = `${new Intl.NumberFormat(currentLanguage() === 'en' ? 'en-US' : 'es-VE', { maximumFractionDigits: 1 }).format(completion)}%`
    article.classList.add('report-indicator-visualized')
    article.style.setProperty('--report-progress', `${clamped}%`)
    article.style.setProperty('--report-angle', `${clamped * 3.6}deg`)
    article.setAttribute('data-completion-label', label)
    article.setAttribute('aria-label', `${article.querySelector(':scope > strong')?.textContent || 'Indicador'} · ${currentLanguage() === 'en' ? 'Execution' : 'Ejecución'} ${label}`)
  })
}

function normalizeTrackingValues() {
  if (!window.location.pathname.startsWith('/app/management/tracking')) return
  document.querySelectorAll('.indicator-values-three > div > strong').forEach((node) => {
    const text = node.textContent || ''
    node.setAttribute('title', text.trim())
  })
}

function ensureResourceRequestLink() {
  if (window.location.pathname !== '/app/management/finance' && window.location.pathname !== '/app/management/finance/') return
  const actions = document.querySelector('.finance-page .finance-heading-actions')
  if (!actions || actions.querySelector('.finance-resource-requests-link')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'finance-resource-requests-link'
  button.textContent = currentLanguage() === 'en' ? '＋ Resource requests' : '＋ Solicitudes de recursos'
  button.addEventListener('click', () => window.location.assign('/app/management/finance/requests'))
  actions.prepend(button)
}

function removePaymentRequestOption() {
  if (!window.location.pathname.startsWith('/app/management/finance')) return

  document.querySelectorAll('.finance-page select').forEach((select) => {
    const option = Array.from(select.options).find((item) => item.value === 'payment_request')
    if (!option) return

    if (select.value === 'payment_request') {
      select.value = 'invoice'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    option.remove()
  })

  document.querySelectorAll('.finance-heading-actions button').forEach((button) => {
    const text = button.textContent || ''
    if (text.includes('Cargar factura o solicitud')) button.textContent = '＋ Cargar factura o documento'
    if (text.includes('Upload invoice or request')) button.textContent = '＋ Upload invoice or document'
  })

  document.querySelectorAll('.finance-inbox-card .management-card-heading h2').forEach((heading) => {
    if (heading.textContent === 'Facturas y solicitudes') heading.textContent = 'Facturas y documentos'
    if (heading.textContent === 'Invoices and requests') heading.textContent = 'Invoices and documents'
  })

  document.querySelectorAll('.finance-page .management-panel-heading span, .finance-inbox-card .management-card-heading p').forEach((node) => {
    const text = node.textContent || ''
    if (text.includes('facturas y solicitudes financieras')) node.textContent = text.replace('facturas y solicitudes financieras', 'facturas y documentos financieros')
    if (text.includes('facturas y solicitudes enviadas')) node.textContent = text.replace('facturas y solicitudes enviadas', 'facturas y documentos enviados')
    if (text.includes('invoices and financial requests')) node.textContent = text.replace('invoices and financial requests', 'invoices and financial documents')
    if (text.includes('invoices and requests submitted')) node.textContent = text.replace('invoices and requests submitted', 'invoices and documents submitted')
  })

  ensureResourceRequestLink()
}

function scrollToActiveFinanceForm() {
  let attempts = 0
  const locate = () => {
    const form = document.querySelector('.finance-page form.finance-form')
    if (form) {
      const targetTop = Math.max(0, form.getBoundingClientRect().top + window.scrollY - 24)
      window.scrollTo({ top: targetTop, behavior: 'smooth' })
      form.classList.add('finance-form-attention')
      window.setTimeout(() => form.classList.remove('finance-form-attention'), 900)
      return
    }
    attempts += 1
    if (attempts < 15) window.setTimeout(locate, 50)
  }
  window.requestAnimationFrame(locate)
}

export default function ManagementRuntimeEnhancements() {
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let frame = 0

    const applyEnhancements = () => {
      enhanceReportIndicators()
      normalizeTrackingValues()
      removePaymentRequestOption()
      ensureResourceRequestLink()
    }

    const observer = new MutationObserver(() => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        applyEnhancements()
      })
    })

    const handleClick = (event) => {
      if (!window.location.pathname.startsWith('/app/management/finance')) return
      const button = event.target.closest?.('.finance-inline-actions button')
      if (!button) return
      const label = (button.textContent || '').toLowerCase()
      if (label.includes('registrar movimiento') || label.includes('record movement') || label.includes('transferir entre fondos') || label.includes('transfer between funds')) {
        window.setTimeout(scrollToActiveFinanceForm, 0)
      }
    }

    observer.observe(root, { childList: true, subtree: true, characterData: true })
    document.addEventListener('click', handleClick, true)
    applyEnhancements()

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}
