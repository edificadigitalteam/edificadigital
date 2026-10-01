// Pure filtering helpers for the "Personas habilitadas" directory
// (OperatorAdminPanel.jsx), kept separate from presentation so they can be
// tested with node:test.

export const accessStatusOptions = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Confirmación pendiente' },
  { value: 'confirmed', label: 'Correo confirmado' },
  { value: 'active', label: 'Activos' },
  { value: 'suspended', label: 'Suspendidos' },
]

export function isPendingConfirmation(operator) {
  return !operator.email_confirmed_at
}

const statusMatchers = {
  pending: isPendingConfirmation,
  confirmed: (operator) => !isPendingConfirmation(operator),
  active: (operator) => operator.active,
  suspended: (operator) => !operator.active,
}

export function filterOperators(operators, { search = '', organizationId = 'all', status = 'all' } = {}) {
  const query = search.trim().toLowerCase()
  const matchesStatus = statusMatchers[status] ?? (() => true)
  return operators
    .filter((operator) => organizationId === 'all' || operator.organization_id === organizationId)
    .filter(matchesStatus)
    .filter((operator) => !query || [operator.display_name, operator.email, operator.organization_name]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query)))
}
