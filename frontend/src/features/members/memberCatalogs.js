// The two Mantenedores catalogs. Each carries its own fully written phrases
// instead of a shared template built around the noun: "Categoría" is feminine and
// "Rol" masculine, so `${itemLabel} creado correctamente.` reads wrong for one of
// them, and half a sentence is not a unit the src/i18n dictionary can translate.
export const memberCatalogs = {
  categories: {
    table: 'organization_member_category',
    kicker: 'MANTENEDORES',
    title: 'Categorías de miembros',
    description: 'Define las categorías que tu organización usa para clasificar a sus miembros, y a qué tipo de miembro aplica cada una.',
    withAppliesTo: true,
    copy: {
      newLabel: 'Nueva categoría',
      newTitle: 'Crear una nueva categoría de miembros',
      backTitle: 'Volver al listado de categorías de miembros',
      createTitle: 'Crear esta categoría',
      saveTitle: 'Guardar los cambios de esta categoría',
      created: 'Categoría creada correctamente.',
      updated: 'Categoría actualizada correctamente.',
      activated: 'Categoría activada.',
      deactivated: 'Categoría desactivada.',
    },
  },
  roles: {
    table: 'organization_member_relationship_role',
    kicker: 'MANTENEDORES',
    title: 'Roles de relación',
    description: 'Define los roles con los que una persona se vincula a una organización miembro, por ejemplo Pastor Principal o Presidente.',
    withAppliesTo: false,
    copy: {
      newLabel: 'Nuevo rol',
      newTitle: 'Crear un nuevo rol de relación',
      backTitle: 'Volver al listado de roles de relación',
      createTitle: 'Crear este rol',
      saveTitle: 'Guardar los cambios de este rol',
      created: 'Rol creado correctamente.',
      updated: 'Rol actualizado correctamente.',
      activated: 'Rol activado.',
      deactivated: 'Rol desactivado.',
    },
  },
}
