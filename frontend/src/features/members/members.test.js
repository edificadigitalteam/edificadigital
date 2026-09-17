import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MEMBERS_MODULE_LABEL,
  catalogLabel,
  categoryFitsMemberType,
  filterMembers,
  friendlyMemberError,
  resolveMembersModuleLabel,
  slugifyCatalogCode,
  validateCatalogEntry,
  validateMember,
} from './members.js'

test('the module label falls back to the default when the tenant set no override', () => {
  assert.equal(resolveMembersModuleLabel(null), DEFAULT_MEMBERS_MODULE_LABEL)
  assert.equal(resolveMembersModuleLabel({ members_module_label: null }), 'Miembros')
  assert.equal(resolveMembersModuleLabel({ members_module_label: '   ' }), 'Miembros')
})

test('the tenant override replaces the default module label', () => {
  assert.equal(resolveMembersModuleLabel({ members_module_label: ' Iglesias miembro ' }), 'Iglesias miembro')
})

test('a catalog entry shows the label of the active language and falls back to the other one', () => {
  const entry = { name_es: 'Iglesia', name_en: 'Church' }
  assert.equal(catalogLabel(entry, 'es'), 'Iglesia')
  assert.equal(catalogLabel(entry, 'en'), 'Church')
  assert.equal(catalogLabel({ name_es: 'Iglesia', name_en: '' }, 'en'), 'Iglesia')
  assert.equal(catalogLabel(null), '')
})

test('a catalog code is derived from the Spanish name without accents or spaces', () => {
  assert.equal(slugifyCatalogCode('Pastor Principal'), 'pastor_principal')
  assert.equal(slugifyCatalogCode('  Organización  '), 'organizacion')
  assert.equal(slugifyCatalogCode('***'), '')
})

test('a catalog entry needs both languages and a usable code', () => {
  assert.equal(validateCatalogEntry({ name_es: 'Iglesia', name_en: 'Church', applies_to: 'organization' }), '')
  assert.equal(validateCatalogEntry({ name_es: '', name_en: 'Church' }), 'Escribe el nombre en español.')
  assert.equal(validateCatalogEntry({ name_es: 'Iglesia', name_en: ' ' }), 'Escribe el nombre en inglés.')
  assert.equal(validateCatalogEntry({ name_es: '***', name_en: 'Church' }), 'Escribe un nombre con al menos una letra o número.')
})

test('a category catalog entry must declare which member type it applies to', () => {
  assert.equal(
    validateCatalogEntry({ name_es: 'Iglesia', name_en: 'Church', applies_to: '' }, { requireAppliesTo: true }),
    'Indica si la categoría aplica a personas, a organizaciones o a ambas.',
  )
  assert.equal(
    validateCatalogEntry({ name_es: 'Iglesia', name_en: 'Church', applies_to: 'both' }, { requireAppliesTo: true }),
    '',
  )
})

test('a category that applies to both sides fits every member type', () => {
  assert.equal(categoryFitsMemberType({ applies_to: 'both' }, 'person'), true)
  assert.equal(categoryFitsMemberType({ applies_to: 'both' }, 'organization'), true)
  assert.equal(categoryFitsMemberType({ applies_to: 'person' }, 'organization'), false)
  assert.equal(categoryFitsMemberType(null, 'person'), true)
})

test('a member needs a name and a member type', () => {
  assert.equal(validateMember({ name: '  ', member_type: 'person' }), 'Escribe el nombre del miembro.')
  assert.equal(validateMember({ name: 'Ana Pérez', member_type: '' }), 'Indica si el miembro es una persona o una organización.')
  assert.equal(validateMember({ name: 'Ana Pérez', member_type: 'person' }), '')
})

test('a member email is optional but validated when present', () => {
  assert.equal(validateMember({ name: 'Ana Pérez', member_type: 'person', email: '' }), '')
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', email: 'ana@' }),
    'Corrige el correo del miembro o deja el campo vacío.',
  )
})

test('a member rejects a category that applies to the other member type', () => {
  const categories = [
    { id: 'cat-person', applies_to: 'person' },
    { id: 'cat-org', applies_to: 'organization' },
  ]
  assert.equal(validateMember({ name: 'Ana Pérez', member_type: 'person', member_category_id: 'cat-person' }, categories), '')
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', member_category_id: 'cat-org' }, categories),
    'Esta categoría aplica a otro tipo de miembro. Elige una categoría compatible.',
  )
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', member_category_id: 'cat-missing' }, categories),
    'Selecciona una categoría disponible en tu organización.',
  )
})

test('database errors are surfaced in the language of the people using the module', () => {
  assert.equal(friendlyMemberError({ code: '42501' }), 'Tu acceso no permite esta acción. Contacta al administrador de la organización.')
  assert.equal(friendlyMemberError({ code: '23505' }), 'Ya existe un registro igual en tu organización.')
  assert.equal(friendlyMemberError({ code: '23503' }), 'Este valor todavía está en uso. Desactívalo en lugar de eliminarlo.')
  assert.equal(friendlyMemberError({ code: '23514' }), 'Los datos no cumplen una regla del registro. Revisa el tipo de miembro y su categoría.')
  assert.equal(friendlyMemberError({ message: 'network down' }), 'network down')
  assert.equal(friendlyMemberError(null), '')
})

test('the member list filters by search, type, status and category together', () => {
  const members = [
    { id: '1', name: 'Iglesia Bautista El Centro', member_type: 'organization', status: 'active', member_category_id: 'cat-church' },
    { id: '2', name: 'Ana Pérez', member_type: 'person', status: 'active', member_category_id: 'cat-person', email: 'ana@iglesia.org' },
    { id: '3', name: 'Iglesia Bautista del Valle', member_type: 'organization', status: 'inactive', member_category_id: 'cat-church' },
  ]
  assert.deepEqual(filterMembers(members, {}).map((member) => member.id), ['1', '2', '3'])
  assert.deepEqual(filterMembers(members, { search: 'iglesia bautista' }).map((member) => member.id), ['1', '3'])
  assert.deepEqual(filterMembers(members, { search: 'ana@iglesia' }).map((member) => member.id), ['2'])
  assert.deepEqual(filterMembers(members, { memberType: 'organization', status: 'active' }).map((member) => member.id), ['1'])
  assert.deepEqual(filterMembers(members, { categoryId: 'cat-person' }).map((member) => member.id), ['2'])
  assert.deepEqual(filterMembers(undefined, {}), [])
})
