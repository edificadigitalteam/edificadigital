import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOrganizationForest, flattenOrganizationForest } from './organizationTree.js'
import { managementTranslationPatterns } from '../../i18n/managementTranslations.js'

const units = [
  { id: 'youth', parent_unit_id: 'ministry', name: 'Coordinación de Jóvenes', code: 'JOVENES', sort_order: 2 },
  { id: 'orphan', parent_unit_id: 'missing', name: 'Unidad sin superior', code: 'HUERFANA', sort_order: 1 },
  { id: 'ministry', parent_unit_id: null, name: 'Ministerio de Proclamación', code: 'PROCLAMACION', sort_order: 2 },
  { id: 'women', parent_unit_id: 'ministry', name: 'Coordinación de Mujeres', code: 'MUJERES', sort_order: 1 },
  { id: 'direction', parent_unit_id: null, name: 'Dirección general', code: 'DIRECCION', sort_order: 1 },
]

test('buildOrganizationForest groups descendants below their parent and sorts siblings', () => {
  const forest = buildOrganizationForest(units)

  assert.deepEqual(forest.roots.map((node) => node.unit.id), ['direction', 'ministry'])
  assert.deepEqual(forest.roots[1].children.map((node) => node.unit.id), ['women', 'youth'])
  assert.deepEqual(forest.orphans.map((node) => node.unit.id), ['orphan'])
})

test('flattenOrganizationForest returns a pre-order list with path and depth', () => {
  const forest = buildOrganizationForest(units)
  const rows = flattenOrganizationForest(forest.roots)

  assert.deepEqual(rows.map((row) => row.unit.id), ['direction', 'ministry', 'women', 'youth'])
  assert.equal(rows.find((row) => row.unit.id === 'women').depth, 1)
  assert.deepEqual(rows.find((row) => row.unit.id === 'women').path.map((unit) => unit.name), [
    'Ministerio de Proclamación',
    'Coordinación de Mujeres',
  ])
})

test('buildOrganizationForest treats cycles as unresolved instead of recursing forever', () => {
  const forest = buildOrganizationForest([
    { id: 'a', parent_unit_id: 'b', name: 'A', code: 'A', sort_order: 1 },
    { id: 'b', parent_unit_id: 'a', name: 'B', code: 'B', sort_order: 2 },
  ])

  assert.equal(forest.roots.length, 0)
  assert.deepEqual(forest.orphans.map((node) => node.unit.id), ['a', 'b'])
})

test('OrganizationTree exposes an accessible disclosure and touch-sized controls', () => {
  const component = readFileSync(new URL('./OrganizationTree.jsx', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('./management.css', import.meta.url), 'utf8')

  assert.match(component, /aria-expanded=\{expanded\}/)
  assert.match(component, /aria-controls=\{groupId\}/)
  assert.match(styles, /\.unit-disclosure[^}]+min-height: 44px/s)
  assert.match(styles, /\.unit-edit-action[^}]+min-height: 44px/s)
})

test('hierarchy details have English translation patterns', () => {
  const translate = (value) => {
    for (const [pattern, replacement] of managementTranslationPatterns) {
      pattern.lastIndex = 0
      if (pattern.test(value)) return value.replace(pattern, replacement)
    }
    return value
  }

  assert.equal(translate('2 unidades dependientes'), '2 dependent units')
  assert.equal(translate('Dentro de Ministerio de Proclamación'), 'Within Ministerio de Proclamación')
})
