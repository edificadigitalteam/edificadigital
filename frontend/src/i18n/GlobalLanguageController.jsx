import { useEffect, useState } from 'react'
import { portalTranslationPatterns, portalTranslations } from './portalTranslations.js'
import './global-language.css'

const LANGUAGE_KEY = 'edifica-language'
const translations = new Map(Object.entries(portalTranslations))
const textState = new WeakMap()
const attributeState = new WeakMap()
const translatedAttributes = ['placeholder', 'title', 'aria-label']

function translateValue(value) {
  const match = String(value ?? '').match(/^(\s*)([\s\S]*?)(\s*)$/)
  const prefix = match?.[1] ?? ''
  const text = match?.[2] ?? value
  const suffix = match?.[3] ?? ''
  if (!text) return value
  const exact = translations.get(text)
  if (exact) return `${prefix}${exact}${suffix}`
  for (const [pattern, replacement] of portalTranslationPatterns) {
    pattern.lastIndex = 0
    if (pattern.test(text)) return `${prefix}${text.replace(pattern, replacement)}${suffix}`
  }
  return value
}

function shouldSkip(node) {
  const parent = node.parentElement
  return !parent || parent.closest('[data-no-translate], script, style, textarea, [contenteditable="true"]')
}

function applyLanguage(root, language) {
  if (!root) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (!shouldSkip(node)) {
      const current = node.nodeValue
      let state = textState.get(node)
      if (!state || current !== state.applied) state = { source: current, applied: current }
      const next = language === 'en' ? translateValue(state.source) : state.source
      state.applied = next
      textState.set(node, state)
      if (current !== next) node.nodeValue = next
    }
    node = walker.nextNode()
  }

  root.querySelectorAll?.('*').forEach((element) => {
    if (element.closest('[data-no-translate]')) return
    const states = attributeState.get(element) ?? {}
    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return
      const current = element.getAttribute(attribute)
      let state = states[attribute]
      if (!state || current !== state.applied) state = { source: current, applied: current }
      const next = language === 'en' ? translateValue(state.source) : state.source
      state.applied = next
      states[attribute] = state
      if (current !== next) element.setAttribute(attribute, next)
    })
    attributeState.set(element, states)
  })
}

function readLanguage() {
  try { return window.localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'es' } catch { return 'es' }
}

export default function GlobalLanguageController() {
  const isPortal = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
  const [language, setLanguage] = useState(readLanguage)

  useEffect(() => {
    if (!isPortal) return undefined
    document.documentElement.lang = language
    window.localStorage.setItem(LANGUAGE_KEY, language)
    const root = document.getElementById('root')
    applyLanguage(root, language)

    let frame = 0
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => applyLanguage(root, language))
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatedAttributes })
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [isPortal, language])

  if (!isPortal) return null

  return (
    <button className="global-language-control" type="button" onClick={() => setLanguage((current) => current === 'es' ? 'en' : 'es')} aria-label={language === 'es' ? 'Change language to English' : 'Cambiar idioma a español'} data-no-translate>
      <span className={language === 'es' ? 'active' : ''}>ES</span><i>/</i><span className={language === 'en' ? 'active' : ''}>EN</span>
    </button>
  )
}
