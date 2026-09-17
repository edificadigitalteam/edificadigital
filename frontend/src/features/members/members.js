export const DEFAULT_MEMBERS_MODULE_LABEL = 'Miembros'

export function resolveMembersModuleLabel(organization) {
  const override = String(organization?.members_module_label || '').trim()
  return override || DEFAULT_MEMBERS_MODULE_LABEL
}

export function catalogLabel(entry, language = 'es') {
  if (!entry) return ''
  const preferred = language === 'en' ? entry.name_en : entry.name_es
  return String(preferred || entry.name_es || entry.name_en || '').trim()
}

export function slugifyCatalogCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export function validateCatalogEntry(entry, { requireAppliesTo = false } = {}) {
  if (!String(entry?.name_es || '').trim()) return 'Escribe el nombre en español.'
  if (!String(entry?.name_en || '').trim()) return 'Escribe el nombre en inglés.'
  if (!slugifyCatalogCode(entry?.code || entry?.name_es)) return 'Escribe un nombre con al menos una letra o número.'
  if (requireAppliesTo && !['person', 'organization', 'both'].includes(entry?.applies_to)) {
    return 'Indica si la categoría aplica a personas, a organizaciones o a ambas.'
  }
  return ''
}

export function isValidMemberEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function categoryFitsMemberType(category, memberType) {
  if (!category) return true
  return category.applies_to === 'both' || category.applies_to === memberType
}

// ---------------------------------------------------------------------------
// The two optional member dates (Sprint S6)
// ---------------------------------------------------------------------------

// Both dates are complete or absent, so a stored value is always a real
// calendar date. Parsing at midday keeps the value on its own day whatever the
// viewer's timezone, the same guard the rest of the dashboard uses, and the
// round-trip check rejects a rolled-over date like 2026-02-30, which the Date
// constructor would otherwise silently turn into 2 March.
export function parseMemberDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').slice(0, 10))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day, 12)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return parsed
}

export function isFutureMemberDate(value, today = new Date()) {
  const parsed = parseMemberDate(value)
  if (!parsed) return false
  const reference = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  return parsed.getTime() > reference.getTime()
}

// Whole elapsed months, then years, counted the way a person does: the
// anniversary has to have arrived. A 29 February date reaches one year on
// 1 March of a common year, not on the 28th.
export function elapsedSince(value, today = new Date()) {
  const from = parseMemberDate(value)
  if (!from) return null
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  if (from.getTime() > to.getTime()) return null
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return { years: Math.floor(months / 12), months: months % 12, totalMonths: months }
}

// Reads as whole years once there is at least one, months below that, and says
// nothing under a month: counting days would be noise on a founding or
// affiliation date.
export function elapsedLabel(value, today = new Date()) {
  const elapsed = elapsedSince(value, today)
  if (!elapsed) return ''
  if (elapsed.years >= 1) return elapsed.years === 1 ? '1 año' : `${elapsed.years} años`
  if (elapsed.totalMonths >= 1) return elapsed.totalMonths === 1 ? '1 mes' : `${elapsed.totalMonths} meses`
  return ''
}

// One column, one meaning; only the label changes with the member type.
export function celebrationDateLabel(memberType) {
  return memberType === 'person' ? 'Fecha de cumpleaños' : 'Fecha de fundación'
}

export function celebrationShortLabel(memberType) {
  return memberType === 'person' ? 'Cumpleaños' : 'Fundación'
}

// What the elapsed figure beside each date is called, so each reads naturally
// instead of sharing one vague word.
export function elapsedCaption(kind, memberType) {
  if (kind === 'membership') return 'Antigüedad'
  return memberType === 'person' ? 'Edad' : 'Tiempo desde la fundación'
}

// Dates render in Spanish throughout the management module, matching
// ProjectsPanel; the panels mark them data-no-translate so the runtime
// translator leaves the month abbreviation alone.
export function formatMemberDate(value) {
  const parsed = parseMemberDate(value)
  if (!parsed) return ''
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(parsed)
}

export function validateMember(member, categories = [], today = new Date()) {
  if (!String(member?.name || '').trim()) return 'Escribe el nombre del miembro.'
  if (!['person', 'organization'].includes(member?.member_type)) return 'Indica si el miembro es una persona o una organización.'
  const email = String(member?.email || '').trim()
  if (email && !isValidMemberEmail(email)) return 'Corrige el correo del miembro o deja el campo vacío.'
  if (member?.member_category_id) {
    const category = categories.find((entry) => entry.id === member.member_category_id)
    if (!category) return 'Selecciona una categoría disponible en tu organización.'
    if (!categoryFitsMemberType(category, member.member_type)) {
      return 'Esta categoría aplica a otro tipo de miembro. Elige una categoría compatible.'
    }
  }
  if (member?.celebration_date && !parseMemberDate(member.celebration_date)) {
    return member.member_type === 'person'
      ? 'Revisa la fecha de cumpleaños: escribe una fecha real o deja el campo vacío.'
      : 'Revisa la fecha de fundación: escribe una fecha real o deja el campo vacío.'
  }
  if (isFutureMemberDate(member?.celebration_date, today)) {
    return member.member_type === 'person'
      ? 'La fecha de cumpleaños no puede ser futura. Corrígela o deja el campo vacío.'
      : 'La fecha de fundación no puede ser futura. Corrígela o deja el campo vacío.'
  }
  if (member?.membership_since && !parseMemberDate(member.membership_since)) {
    return 'Revisa la fecha de "Miembro desde": escribe una fecha real o deja el campo vacío.'
  }
  if (isFutureMemberDate(member?.membership_since, today)) {
    return 'La fecha de "Miembro desde" no puede ser futura. Corrígela o deja el campo vacío.'
  }
  return ''
}

// Postgres error codes surfaced to people in their own words, following the
// mapping pattern introduced with the toast notifications sprint.
export function friendlyMemberError(error) {
  if (!error) return ''
  if (error.code === '42501') return 'Tu acceso no permite esta acción. Contacta al administrador de la organización.'
  if (error.code === '23505') return 'Ya existe un registro igual en tu organización.'
  if (error.code === '23514') return 'Los datos no cumplen una regla del registro. Revisa el tipo de miembro y su categoría.'
  if (error.code === '23503') return 'Este valor todavía está en uso. Desactívalo en lugar de eliminarlo.'
  return error.message || 'La operación falló. Intenta nuevamente.'
}

export function filterMembers(members, { search = '', memberType = 'all', status = 'all', categoryId = 'all' } = {}) {
  const query = String(search || '').trim().toLowerCase()
  return (members ?? []).filter((member) => {
    const matchesSearch = !query || [member.name, member.email, member.phone]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
    const matchesType = memberType === 'all' || member.member_type === memberType
    const matchesStatus = status === 'all' || member.status === status
    const matchesCategory = categoryId === 'all' || member.member_category_id === categoryId
    return matchesSearch && matchesType && matchesStatus && matchesCategory
  })
}
