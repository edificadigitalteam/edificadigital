# SPRINT-S10.2 · Administrador del tenant sin restricciones en Gestión

**Fecha:** 2026-10-22
**Issue:** #136
**Estado:** Implementado en rama de revisión. Migración `20261022150000_tenant_admin_full_management_access.sql` pendiente de aplicar en `edifydb`.

## Decisión del product owner (2026-10-22)

El administrador del tenant debe poder hacer todo, sin restricciones, en los módulos de Gestión. Esta decisión reemplaza la opción 2 de #136 (S10.1: el admin edita y no revisa). En concreto, el admin:

1. **Calendario:** valida u observa actividades de cualquier unidad, y activa o desactiva la vista compartida.
2. **Calendario:** borra actividades y usa «Vaciar calendario» en cualquier unidad.
3. **Asuntos pendientes:** emite, reescribe y borra instrucciones DIGEN, igual que el director de DIGEN.
4. **Evaluación:** lee también los borradores de las autoevaluaciones.

«Administrador del tenant» es `private.can_manage_organization(org)`, la misma condición que ya usa la edición transversal (`20261008145936`). Como ese chequeo también incluye a `super_admin`, el host recibe estos mismos permisos sobre el tenant que consulta.

## Lo que no cambia

- Ningún permiso anterior se retira. GEN/DIGEN, las unidades supervisoras y los miembros de cada unidad conservan exactamente lo que tenían.
- Los líderes GEN/DIGEN editan y revisan todas las unidades, pero borran solo en las unidades donde son miembros.
- El admin **lee** los borradores, pero no puede crearlos ni modificarlos: solo el director autor escribe su evaluación, y un envío sigue siendo definitivo.
- Las instrucciones DIGEN siguen yendo a unidades distintas de GEN y DIGEN, y siguen registrando `issued_by_unit_id = DIGEN`. Quién la emitió queda en `created_by`.
- La unidad destinataria solo cambia el estado de una instrucción.

## Base de datos

Migración `20261022150000_tenant_admin_full_management_access.sql`. Cada función reemplazada se copió de su definición en vivo en `edifydb` y solo se agregó al admin:

| Objeto | Cambio |
|---|---|
| `private.can_issue_digen_instructions(uuid)` (nueva) | Director DIGEN **o** admin del tenant. `anon` sin ejecución |
| `private.guard_pending_issue_scope()` | Quien emite instrucciones pasa a ser el helper nuevo |
| `private.pending_instruction_target_unit_ids_json(uuid)` | Usa el helper nuevo |
| `public.pending_issue_access_overview(uuid)` | `can_issue_instructions` usa el helper nuevo; sigue como `security invoker` |
| Políticas `unit_pending_issue_select/insert/update/delete` | Instrucciones DIGEN: el helper nuevo en lugar de solo el director DIGEN |
| `private.guard_calendar_activity_review()`, `public.review_calendar_activity`, `public.set_calendar_joint_review` | `or private.can_manage_organization(org)` |
| Política `unit_work_activity_delete` | `or private.can_manage_organization(organization_id)` |
| `public.calendar_access_overview` | `can_review*` incluye al admin; nueva clave `can_delete_consolidated` |
| Política `executive_evaluation_read` | El admin lee todas las filas de su organización |
| `public.evaluation_access_overview` | Nueva clave `can_read_draft_evaluations`; `can_review_all_evaluations` incluye al admin |

## Interfaz

- **Calendario:** «Vaciar calendario» aparece cuando la persona es miembro de la unidad o tiene `can_delete_consolidated` (`canClearUnitCalendar`). La revisión ya usa `can_review_consolidated`.
- **Evaluación:** la colección muestra también los borradores cuando llega `can_read_draft_evaluations` (`evaluationsForCollection`), con el estado de cada fila.
- **Asuntos pendientes:** sin cambio de código; el botón «Asignar instrucción» aparece por `can_issue_instructions`.
- **Textos ES/EN actualizados:** aviso del admin en Calendario, confirmación de «Vaciar calendario», y la consulta de Evaluación («GEN, DIGEN y la administración»).

## Pruebas

- pgTAP `026_tenant_admin_full_management_access_test.sql`, 24 aserciones de comportamiento con datos de prueba: admin, director DIGEN y director DIME. Sin la migración fallan 12 y la última no llega a ejecutarse; con la migración pasan 24/24.
- `025` actualizada a la decisión nueva: el admin revisa y controla la vista compartida. Sin la migración fallan 5; con ella, 24/24.
- `021`, `022` y `023` actualizadas: sus comprobaciones de texto citaban el helper o la regla anteriores.
- Suite pgTAP completa en local: 415 aserciones, 0 fallos.
- `node --test`: `canClearUnitCalendar` y `evaluationsForCollection` fallan antes y pasan después.

## Verificación pendiente

Requiere autorización explícita para `edifydb`. Pasos: prueba en una transacción revertida con 025 y 026, aplicar con `apply_migration`, renombrar el archivo a la versión registrada, correr los advisors y actualizar este plan, `docs/DATABASE.md` y el PR.

## Riesgos y reversión

- El admin gana permisos de escritura y borrado en datos de todas las unidades, y lectura de borradores privados. Es la decisión del product owner y queda registrada en `AGENTS.md` → "Access model".
- Reversión: una migración correctiva que restaure las definiciones de `20261022135016` (calendario) y `20261007182032` / `20261007182445` / `20261021142000` (instrucciones y evaluación), y revertir el PR.
