const STATUS = {
  es: {
    pending: { label: 'Pendiente', tone: 'red', icon: '●' },
    in_progress: { label: 'En proceso', tone: 'yellow', icon: '◐' },
    completed: { label: 'Realizado', tone: 'green', icon: '✓' },
  },
  en: {
    pending: { label: 'Pending', tone: 'red', icon: '●' },
    in_progress: { label: 'In progress', tone: 'yellow', icon: '◐' },
    completed: { label: 'Completed', tone: 'green', icon: '✓' },
  },
}

const URGENCY = {
  es: {
    low: { label: 'Baja', tone: 'low' },
    medium: { label: 'Media', tone: 'medium' },
    high: { label: 'Alta', tone: 'high' },
    critical: { label: 'Crítica', tone: 'critical' },
  },
  en: {
    low: { label: 'Low', tone: 'low' },
    medium: { label: 'Medium', tone: 'medium' },
    high: { label: 'High', tone: 'high' },
    critical: { label: 'Critical', tone: 'critical' },
  },
}

const urgencyRank = { critical: 0, high: 1, medium: 2, low: 3 }
const statusRank = { pending: 0, in_progress: 1, completed: 2 }

export function pendingIssueStatusMeta(status, language = 'es') {
  const labels = STATUS[language] || STATUS.es
  return labels[status] || labels.pending
}

export function pendingIssueUrgencyMeta(urgency, language = 'es') {
  const labels = URGENCY[language] || URGENCY.es
  return labels[urgency] || labels.medium
}

export function sortPendingIssues(rows = []) {
  return [...rows].sort((a, b) => {
    const aCompleted = a?.status === 'completed' ? 1 : 0
    const bCompleted = b?.status === 'completed' ? 1 : 0
    if (aCompleted !== bCompleted) return aCompleted - bCompleted
    const urgencyDiff = (urgencyRank[a?.urgency] ?? 9) - (urgencyRank[b?.urgency] ?? 9)
    if (urgencyDiff !== 0) return urgencyDiff
    const statusDiff = (statusRank[a?.status] ?? 9) - (statusRank[b?.status] ?? 9)
    if (statusDiff !== 0) return statusDiff
    const aDate = a?.due_date || '9999-12-31'
    const bDate = b?.due_date || '9999-12-31'
    if (aDate !== bDate) return aDate.localeCompare(bDate)
    return String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''))
  })
}

export function pendingIssueSummary(rows = []) {
  return rows.reduce((summary, row) => {
    if (row?.status === 'pending') summary.pending += 1
    if (row?.status === 'in_progress') summary.inProgress += 1
    if (row?.status === 'completed') summary.completed += 1
    if (row?.status !== 'completed' && (row?.urgency === 'high' || row?.urgency === 'critical')) summary.urgent += 1
    return summary
  }, { pending: 0, inProgress: 0, completed: 0, urgent: 0 })
}

export function isDigenInstruction(issue) {
  return issue?.origin === 'digen_instruction'
}

export function canRespondToPendingInstruction(issue, access) {
  if (!isDigenInstruction(issue) || access?.canIssueInstructions) return false
  const own = new Set(access?.ownUnitIds ?? [])
  return Boolean(issue?.unit_id && own.has(issue.unit_id))
}

export function canManagePendingIssueContent(issue, access) {
  if (isDigenInstruction(issue)) return Boolean(access?.canIssueInstructions)
  const own = new Set(access?.ownUnitIds ?? [])
  return Boolean(issue?.unit_id && own.has(issue.unit_id))
}

export function canEditPendingIssue(issue, access) {
  return canManagePendingIssueContent(issue, access)
}
