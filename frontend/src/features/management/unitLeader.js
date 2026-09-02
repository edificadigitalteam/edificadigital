export function normalizeLeaderEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidLeaderEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeLeaderEmail(value))
}

export function validateUnitLeader(leader) {
  if (!String(leader?.display_name || '').trim()) return 'Indica el nombre y apellido de la persona responsable.'
  const email = normalizeLeaderEmail(leader?.email)
  if (leader?.create_access && !isValidLeaderEmail(email)) return 'Indica un correo válido para crear el acceso de la persona responsable.'
  if (email && !isValidLeaderEmail(email)) return 'Corrige el correo de la persona responsable o deja el campo vacío.'
  return ''
}

export function buildLeaderPayload(leader) {
  return {
    display_name: String(leader?.display_name || '').trim(),
    email: normalizeLeaderEmail(leader?.email),
    create_access: Boolean(leader?.create_access),
  }
}
