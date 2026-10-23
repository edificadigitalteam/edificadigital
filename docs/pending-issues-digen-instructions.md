# Asuntos pendientes · Instrucciones DIGEN

## Comportamiento vigente

El módulo `Asuntos pendientes` admite dos orígenes de registro:

- `unit`: asunto ordinario creado y administrado por su propia unidad.
- `digen_instruction`: instrucción emitida por el Director General desde la unidad `DIGEN` y asignada a una unidad destinataria.

`unit_pending_issue.unit_id` representa siempre la unidad responsable/destinataria. Las instrucciones DIGEN guardan además `issued_by_unit_id` y conservan el mismo seguimiento visual del módulo: `pending`, `in_progress` y `completed`.

## Autorización

La capacidad `can_issue_instructions` se concede únicamente a un operador con membresía activa `director` en la unidad activa cuyo código es `DIGEN`. El rol genérico de administrador o una posición superior en el árbol no sustituye esta condición funcional.

El Director General puede seleccionar cualquier unidad activa del tenant excepto los contenedores `GEN` y `DIGEN`. La lista autorizada se entrega mediante `pending_issue_access_overview(uuid)` como `instruction_target_unit_ids`.

La unidad destinataria puede leer la instrucción y actualizar su `status`. El trigger `private.guard_pending_issue_scope()` impide que el destinatario cambie título, descripción, urgencia, fecha límite, período, destinatario, origen o emisor. La unidad destinataria tampoco puede eliminar la instrucción. DIGEN conserva la edición/reasignación de las instrucciones emitidas.

## Visibilidad

Los asuntos ordinarios siguen la visibilidad jerárquica definida por `private.current_visible_unit_ids()`. La excepción adicional de lectura aplica únicamente a filas con `origin = 'digen_instruction'`, de modo que el Director General puede seguir una instrucción enviada a cualquier unidad autorizada sin cambiar la regla de los asuntos ordinarios.

## Migraciones y pruebas

- `20261007182032_digen_pending_instructions.sql`
- `20261007182445_digen_pending_instruction_visibility_scope.sql`
- `supabase/tests/021_digen_pending_instruction_test.sql`

La verificación transaccional de producción confirmó creación por DIGEN, visibilidad para la unidad destinataria, actualización de estado por el destinatario, bloqueo de edición del contenido y bloqueo de eliminación. Los registros de verificación fueron revertidos.
