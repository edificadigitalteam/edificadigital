const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

function compareUnits(left, right) {
  const order = Number(left.sort_order || 0) - Number(right.sort_order || 0)
  return order || collator.compare(left.name || left.code || '', right.name || right.code || '')
}

export function buildOrganizationForest(units = []) {
  const nodesById = new Map(units.map((unit) => [unit.id, { unit, children: [] }]))
  const resolution = new Map()

  function resolvesToRoot(unitId, visiting = new Set()) {
    if (resolution.has(unitId)) return resolution.get(unitId)
    const node = nodesById.get(unitId)
    if (!node || visiting.has(unitId)) return false
    if (!node.unit.parent_unit_id) { resolution.set(unitId, true); return true }
    if (!nodesById.has(node.unit.parent_unit_id)) { resolution.set(unitId, false); return false }

    const next = new Set(visiting)
    next.add(unitId)
    const resolved = resolvesToRoot(node.unit.parent_unit_id, next)
    resolution.set(unitId, resolved)
    return resolved
  }

  const roots = []
  const orphans = []
  for (const node of nodesById.values()) {
    if (!resolvesToRoot(node.unit.id)) { orphans.push(node); continue }
    if (!node.unit.parent_unit_id) roots.push(node)
    else nodesById.get(node.unit.parent_unit_id).children.push(node)
  }

  const sortNodes = (nodes) => {
    nodes.sort((left, right) => compareUnits(left.unit, right.unit))
    nodes.forEach((node) => sortNodes(node.children))
  }
  sortNodes(roots)
  sortNodes(orphans)

  return { roots, orphans }
}

export function flattenOrganizationForest(nodes, path = [], depth = 0) {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node.unit]
    return [
      { ...node, depth, path: nextPath },
      ...flattenOrganizationForest(node.children, nextPath, depth + 1),
    ]
  })
}
