function sanitizeFileName(name) {
  const dot = name.lastIndexOf('.')
  const extension = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : ''
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'archivo'
  return `${base}${extension}`
}

export function createFinanceAttachmentPath({ userId, submissionId, uniqueId, fileName }) {
  if (!String(userId || '').trim()) throw new Error('An authenticated user is required to upload finance attachments.')
  return `finance/${userId}/${submissionId}/${uniqueId}-${sanitizeFileName(fileName)}`
}
