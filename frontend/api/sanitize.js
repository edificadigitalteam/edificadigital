const LEVELS = new Set(['error', 'warn', 'info'])

const LIMITS = {
  message: 500,
  stack: 2000,
  context: 200,
  url: 300,
  userAgent: 300,
}

function clean(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\r\n]+/g, ' ').slice(0, max)
}

export function buildLogEntry(body = {}) {
  const level = LEVELS.has(body.level) ? body.level : 'error'

  return {
    level,
    message: clean(body.message, LIMITS.message) || 'Unknown client error',
    stack: clean(body.stack, LIMITS.stack),
    context: clean(body.context, LIMITS.context),
    url: clean(body.url, LIMITS.url),
    userAgent: clean(body.userAgent, LIMITS.userAgent),
    timestamp: new Date().toISOString(),
  }
}
