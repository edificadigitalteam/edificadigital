// Temporary diagnostic tracing: ships every call (not deduped, unlike
// reportClientError) to /api/log so a stuck-screen report can be diagnosed
// from Vercel logs without needing the user's own console. Each entry is
// tagged with a per-page-load boot id and an incrementing sequence number
// so the order is reconstructable from logs regardless of arrival order.
const bootId = Math.random().toString(36).slice(2, 8)
let seq = 0

export function trace(scope, step, extra = {}) {
  const detail = { boot: bootId, seq: ++seq, path: typeof window !== 'undefined' ? window.location.pathname : '', ...extra }
  console.info(`[${scope}]`, step, detail)
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level: 'warn',
      context: scope,
      message: `[${scope}] ${step}`,
      stack: JSON.stringify(detail),
      url: window.location.href,
      userAgent: window.navigator?.userAgent ?? '',
    }),
    keepalive: true,
  }).catch(() => {})
}
