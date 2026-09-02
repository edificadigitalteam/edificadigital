import { useMemo, useState } from 'react'
import { buildOrganizationForest } from './organizationTree.js'

function descendantCount(node) {
  return node.children.reduce((total, child) => total + 1 + descendantCount(child), 0)
}

function UnitIdentity({ node, path, unitTypeLabels }) {
  const { unit } = node
  const ancestry = path.map((item) => item.name).join(' › ')
  const dependentCount = descendantCount(node)
  const hierarchyDetail = ancestry
    ? `Dentro de ${ancestry}`
    : dependentCount > 0 ? `${dependentCount} unidad${dependentCount === 1 ? '' : 'es'} dependiente${dependentCount === 1 ? '' : 's'}` : ''
  return <span className="unit-tree-identity">
    <span className="unit-code">{unit.code}</span>
    <span className="unit-title-block">
      <strong>{unit.name}</strong>
      <small>
        {unitTypeLabels[unit.unit_type] || unit.unit_type}
        {hierarchyDetail && <><span aria-hidden="true"> · </span><span>{hierarchyDetail}</span></>}
      </small>
    </span>
  </span>
}

function TreeNode({ node, path, level, collapsedIds, toggle, unitTypeLabels, renderPeople, canAdmin, onEdit, editLabel }) {
  const { unit, children } = node
  const hasChildren = children.length > 0
  const expanded = hasChildren && !collapsedIds.has(unit.id)
  const groupId = `organization-unit-children-${unit.id}`
  const identity = <UnitIdentity node={node} path={path} unitTypeLabels={unitTypeLabels} />

  return <div className="unit-tree-branch" data-level={level}>
    <article className={`unit-tree-row${unit.active ? '' : ' inactive'}`}>
      {hasChildren ? <button
        type="button"
        className="unit-disclosure"
        aria-expanded={expanded}
        aria-controls={groupId}
        onClick={() => toggle(unit.id)}
      ><span className="unit-chevron" aria-hidden="true">›</span>{identity}</button> : <div className="unit-disclosure unit-disclosure-static"><span className="unit-chevron-placeholder" aria-hidden="true" />{identity}</div>}
      <div className="unit-people">{renderPeople(unit)}</div>
      {canAdmin && <button className="unit-edit-action" type="button" onClick={() => onEdit(unit)}>{editLabel}</button>}
    </article>
    {hasChildren && <div className="unit-tree-children" id={groupId} hidden={!expanded}>
      {children.map((child) => <TreeNode
        key={child.unit.id}
        node={child}
        path={[...path, unit]}
        level={level + 1}
        collapsedIds={collapsedIds}
        toggle={toggle}
        unitTypeLabels={unitTypeLabels}
        renderPeople={renderPeople}
        canAdmin={canAdmin}
        onEdit={onEdit}
        editLabel={editLabel}
      />)}
    </div>}
  </div>
}

export default function OrganizationTree({ units, unitTypeLabels, renderPeople, canAdmin, onEdit, editLabel = 'Editar equipo' }) {
  const forest = useMemo(() => buildOrganizationForest(units), [units])
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const toggle = (unitId) => setCollapsedIds((current) => {
    const next = new Set(current)
    if (next.has(unitId)) next.delete(unitId)
    else next.add(unitId)
    return next
  })

  return <div className="organization-forest">
    {forest.roots.map((node) => <TreeNode
      key={node.unit.id}
      node={node}
      path={[]}
      level={0}
      collapsedIds={collapsedIds}
      toggle={toggle}
      unitTypeLabels={unitTypeLabels}
      renderPeople={renderPeople}
      canAdmin={canAdmin}
      onEdit={onEdit}
      editLabel={editLabel}
    />)}
    {forest.orphans.length > 0 && <section className="unit-tree-unresolved" aria-labelledby="unresolved-units-title">
      <div className="unit-tree-unresolved-heading">
        <strong id="unresolved-units-title">Ubicación pendiente</strong>
        <span>{forest.orphans.length} unidad{forest.orphans.length === 1 ? '' : 'es'}</span>
        <p>Estas unidades necesitan una unidad superior válida para aparecer dentro del organigrama.</p>
      </div>
      {forest.orphans.map((node) => <TreeNode
        key={node.unit.id}
        node={{ ...node, children: [] }}
        path={[]}
        level={0}
        collapsedIds={collapsedIds}
        toggle={toggle}
        unitTypeLabels={unitTypeLabels}
        renderPeople={renderPeople}
        canAdmin={canAdmin}
        onEdit={onEdit}
        editLabel={editLabel}
      />)}
    </section>}
  </div>
}
