import { buildLogEntry } from './sanitize.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.end()
    return
  }

  const entry = buildLogEntry(req.body)
  const line = JSON.stringify({ source: 'frontend', ...entry })

  if (entry.level === 'warn') {
    console.warn(line)
  } else {
    console.error(line)
  }

  res.statusCode = 204
  res.end()
}
