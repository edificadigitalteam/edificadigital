// Every module a tenant can rename.
//
// The standing rule, set by the product owner on 2026-09-17: a module that
// enters the app is a module whose name the tenant can change. Adding a module
// therefore means adding an entry here — nothing else in the Mantenedores
// screen needs to know about it.
//
// `column` is where the override lives on `public.organization` and `rpc` is
// the security-definer function that writes it, because `public.organization`
// itself only accepts super_admin updates. A new module needs its own pair; see
// docs/plans/SPRINT-S6-v1_member-dates-and-tenure.md's follow-up note on
// generalizing this into one table once there is more than one.
export const renameableModules = [
  {
    key: 'members',
    column: 'members_module_label',
    rpc: 'admin_set_members_module_label',
    defaultLabel: 'Miembros',
    description: 'Directorio de organizaciones y personas afiliadas a tu organización.',
  },
]

export function resolveModuleLabel(module, organization) {
  const override = String(organization?.[module.column] ?? '').trim()
  return override || module.defaultLabel
}

export function isModuleLabelOverridden(module, organization) {
  return Boolean(String(organization?.[module.column] ?? '').trim())
}

// The columns a single select has to fetch to render the screen.
export function moduleLabelColumns(modules = renameableModules) {
  return ['id', 'name', ...modules.map((module) => module.column)].join(', ')
}

export function validateModuleLabel(value) {
  const label = String(value ?? '').trim()
  if (label.length > 60) return 'El nombre del módulo admite hasta 60 caracteres.'
  return ''
}
