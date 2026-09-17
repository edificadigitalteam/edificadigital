import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { managementTranslationPatterns, managementTranslations } from '../../i18n/managementTranslations.js'
import { platformTranslations } from '../../i18n/platformTranslations.js'
import { portalTranslationPatterns, portalTranslations } from '../../i18n/portalTranslations.js'
import { memberCatalogs } from './memberCatalogs.js'

// The dashboard reaches English through the runtime translator in
// src/i18n/GlobalLanguageController.jsx: panels are written in Spanish and every
// text node, placeholder, title and aria-label is looked up in these
// dictionaries. Parity for Miembros and Mantenedores therefore means dictionary
// coverage, and this file is what keeps it from drifting.
const dictionary = new Map([
  ...Object.entries(portalTranslations),
  ...Object.entries(platformTranslations),
  ...Object.entries(managementTranslations),
])
const patterns = [...portalTranslationPatterns, ...managementTranslationPatterns]

// Mirrors translateValue() in GlobalLanguageController, minus the whitespace
// bookkeeping, and returns null when nothing covers the string.
function translate(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (dictionary.has(text)) return dictionary.get(text)
  for (const [pattern, replacement] of patterns) {
    pattern.lastIndex = 0
    if (pattern.test(text)) return text.replace(pattern, replacement)
  }
  return null
}

const panelSources = [
  './MembersPanel.jsx',
  './MemberCatalogPanel.jsx',
  './memberCatalogs.js',
  './members.js',
  // Renaming a module is a Mantenedores screen, so its copy is covered here too.
  '../settings/ModuleLabelsPanel.jsx',
  '../settings/moduleLabels.js',
].map((name) => readFileSync(new URL(name, import.meta.url), 'utf8'))

// Literals that read like copy but are arguments: 'NFD' is the Unicode
// normalization form slugifyCatalogCode asks for.
const NOT_COPY = new Set(['NFD'])

// Identifiers, CSS class names, Supabase column names and paths — never copy.
const IDENTIFIER = /^[a-z][a-zA-Z]*$|[_/]|^[a-z-]+$/
const SYMBOLS_ONLY = /^[\s\d\W_]*$/

// A phrase a person reads has a space in it, starts with a capital, or carries
// Spanish characters. Detecting Spanish by diacritics alone is not enough:
// "Relaciones con organizaciones" has none.
function isCopy(text) {
  if (text.length < 2 || SYMBOLS_ONLY.test(text) || IDENTIFIER.test(text) || NOT_COPY.has(text)) return false
  return /\s/.test(text) || /^[A-ZÁÉÍÓÚÑ＋]/.test(text) || /[áéíóúñ…]/.test(text)
}

function collectCopy(source) {
  const stripped = source.replace(/^\s*\/\/.*$/gm, '')
  const found = new Set()
  // JSX text between tags, on one line, with no interpolation inside it.
  for (const match of stripped.matchAll(/>([^<>{}\n]+)</g)) found.add(match[1].trim())
  // title= and placeholder= attributes written as plain string literals.
  for (const match of stripped.matchAll(/(?:title|placeholder)=["']([^"'\n]+)["']/g)) found.add(match[1].trim())
  // Every other single-line literal: label maps, catalog copy, validation text.
  // Empty literals are matched first so a `|| ''` earlier on the line cannot
  // swallow the opening quote of the real string that follows it.
  for (const match of stripped.matchAll(/''|'([^'\n\\]+)'/g)) {
    if (match[1]) found.add(match[1].trim())
  }
  return new Set([...found].filter(isCopy))
}

test('every Spanish string in the Miembros and Mantenedores panels has an English translation', () => {
  const strings = new Set()
  panelSources.forEach((source) => collectCopy(source).forEach((text) => strings.add(text)))

  // Guards the extraction itself: a regex that silently stopped matching would
  // otherwise make this test pass over an empty set. These three cover the
  // shapes it has to reach — JSX text, a label map, and validation text.
  assert.ok(strings.size > 120, `expected to collect the panel copy, got ${strings.size} strings`)
  assert.ok(strings.has('Relaciones con organizaciones'), 'JSX text was not collected')
  assert.ok(strings.has('Persona'), 'label-map values were not collected')
  assert.ok(strings.has('Escribe el nombre del miembro.'), 'validation copy was not collected')
  assert.ok(strings.has('Nombres de los módulos'), 'the module-names maintainer copy was not collected')

  const missing = [...strings].filter((text) => translate(text) === null)
  assert.deepEqual(missing, [], `these panel strings have no English translation: ${missing.join(' | ')}`)
})

test('the two catalogs carry their own fully written phrases, so neither reads ungrammatically', () => {
  const { categories, roles } = memberCatalogs

  // "Categoría" is feminine and "Rol" masculine: a shared `${noun} creado`
  // template produced "Categoría creado correctamente." before this was split.
  assert.equal(categories.copy.created, 'Categoría creada correctamente.')
  assert.equal(categories.copy.updated, 'Categoría actualizada correctamente.')
  assert.equal(categories.copy.deactivated, 'Categoría desactivada.')
  assert.equal(categories.copy.createTitle, 'Crear esta categoría')
  assert.equal(roles.copy.created, 'Rol creado correctamente.')
  assert.equal(roles.copy.updated, 'Rol actualizado correctamente.')
  assert.equal(roles.copy.deactivated, 'Rol desactivado.')
  assert.equal(roles.copy.createTitle, 'Crear este rol')

  // Every one of those phrases is a translatable unit on its own.
  Object.values(categories.copy).concat(Object.values(roles.copy)).forEach((phrase) => {
    assert.notEqual(translate(phrase), null, `no English translation for "${phrase}"`)
  })
})

test('interface copy translates while the tenant\'s own catalog values stay untouched', () => {
  assert.equal(translate('Miembros'), 'Members')
  assert.equal(translate('Categorías de miembros'), 'Member categories')
  assert.equal(translate('Roles de relación'), 'Relationship roles')
  assert.equal(translate('Personas y organizaciones'), 'People and organizations')
  assert.equal(translate('Relación agregada correctamente.'), 'Relationship added successfully.')
  assert.equal(translate('Este valor todavía está en uso. Desactívalo en lugar de eliminarlo.'), 'This value is still in use. Deactivate it instead of deleting it.')

  // A tenant naming a member "Organización Bautista" keeps that name: the panels
  // mark member and catalog names data-no-translate so the walker skips them.
  const members = readFileSync(new URL('./MembersPanel.jsx', import.meta.url), 'utf8')
  const catalog = readFileSync(new URL('./MemberCatalogPanel.jsx', import.meta.url), 'utf8')
  assert.match(members, /<strong data-no-translate>\{member\.name\}<\/strong>/)
  assert.match(members, /<td data-no-translate><span>\{member\.email/)
  assert.match(catalog, /<td data-no-translate><strong>\{entry\.name_es\}/)
  assert.match(catalog, /<td data-no-translate>\{entry\.name_en\}<\/td>/)
})

test('the elapsed-time figures resolve through patterns, not one entry per number', () => {
  // elapsedLabel() builds these, so only the singular forms are literals in
  // the source; every other count has to come from a pattern.
  assert.equal(translate('1 año'), '1 year')
  assert.equal(translate('1 mes'), '1 month')
  assert.equal(translate('28 años'), '28 years')
  assert.equal(translate('8 meses'), '8 months')
  assert.equal(translate('2 años'), '2 years')

  // And the captions and short labels beside them.
  assert.equal(translate('Edad'), 'Age')
  assert.equal(translate('Antigüedad'), 'Tenure')
  assert.equal(translate('Tiempo desde la fundación'), 'Time since founding')
  assert.equal(translate('Miembro desde'), 'Member since')
  assert.equal(translate('Fundación'), 'Founded')
  assert.equal(translate('Cumpleaños'), 'Birthday')
})
