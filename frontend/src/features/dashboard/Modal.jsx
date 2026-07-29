import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ titleId, kicker, title, onClose, closeLabel = 'Cerrar', className = '', children }) {
  const modalRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const modalNode = modalRef.current
    modalNode?.querySelector(FOCUSABLE_SELECTOR)?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = modalNode?.querySelectorAll(FOCUSABLE_SELECTOR)
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  return (
    <div className="edifica-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section ref={modalRef} className={`edifica-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="edifica-modal-header">
          <div><p className="edifica-kicker">{kicker}</p><h2 id={titleId}>{title}</h2></div>
          <button className="edifica-modal-close" type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel}>×</button>
        </header>
        {children}
      </section>
    </div>
  )
}
