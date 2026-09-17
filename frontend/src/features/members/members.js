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

export function validateMember(member, categories = []) {
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
