const MAX_TRACKED_ERRORS = 20

const LIMITS = {
  message: 500,
  stack: 2000,
  context: 200,
  url: 300,
  userAgent: 300,
}

const seen = new Set()

function truncate(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

export function buildErrorPayload({ message, stack, context, level = 'error' } = {}, { href = '', userAgent = '' } = {}) {
  return {
    level,
    message: truncate(String(message ?? 'Unknown error'), LIMITS.message),
    stack: truncate(stack ?? '', LIMITS.stack),
    context: truncate(context ?? '', LIMITS.context),
    url: truncate(href, LIMITS.url),
    userAgent: truncate(userAgent, LIMITS.userAgent),
  }
}

export function reportClientError(details) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return

  const payload = buildErrorPayload(details, {
    href: window.location.href,
    userAgent: window.navigator?.userAgent ?? '',
  })

  const key = payload.level + ':' + payload.message
  if (seen.has(key)) return
  if (seen.size >= MAX_TRACKED_ERRORS) seen.clear()
  seen.add(key)

  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

export function installGlobalErrorLogging() {
  if (typeof window === 'undefined' || window.__edificaLoggingInstalled) return
  window.__edificaLoggingInstalled = true

  window.addEventListener('error', (event) => {
    reportClientError({
      message: event.error?.message ?? event.message,
      stack: event.error?.stack,
      context: 'window.onerror',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportClientError({
      message: reason?.message ?? String(reason),
      stack: reason?.stack,
      context: 'unhandledrejection',
    })
  })
}
