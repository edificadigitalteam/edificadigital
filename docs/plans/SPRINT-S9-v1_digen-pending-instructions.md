# SPRINT-S9 · Instrucciones DIGEN en Asuntos pendientes

## Outcome

Permitir que el Director General (DIGEN) emita una instrucción a una Dirección u organización específica desde **Asuntos pendientes**, que la unidad destinataria la vea en su propia bandeja y que pueda actualizar únicamente su estado de atención.

## Product rules

- `unit_pending_issue.unit_id` sigue representando la unidad responsable/destinataria.
- Se agrega `origin` con valores `unit` y `digen_instruction`.
- Se agrega `issued_by_unit_id` para identificar la unidad emisora.
- Solo un operador con membresía activa `director` en la unidad código `DIGEN` puede crear o administrar una instrucción DIGEN.
- DIGEN puede seleccionar cualquier Dirección u organización activa de su tenant excepto los contenedores `GEN` y `DIGEN`.
- La unidad destinataria puede ver la instrucción por RLS y cambiar su seguimiento: Pendiente, En proceso o Realizado.
- La unidad destinataria no puede cambiar título, descripción, urgencia, fecha límite, destinatario ni procedencia de una instrucción DIGEN.
- La unidad destinataria no puede borrar una instrucción DIGEN.
- DIGEN conserva la vista consolidada y puede editar/reasignar las instrucciones que emitió.
- Los asuntos ordinarios creados por una unidad conservan su comportamiento actual.

## UX

- DIGEN ve un botón adicional **+ Asignar instrucción**.
- El formulario de instrucción incluye **Asignar a Dirección / organización** y los campos actuales de asunto, descripción, urgencia y fecha límite.
- Una instrucción se crea con estado Pendiente.
- La tarjeta muestra una insignia **Instrucción DIGEN** y la unidad destinataria.
- En la bandeja de la unidad destinataria aparecen tres acciones rápidas de estado: Pendiente, En proceso y Realizado.
- En teléfono las acciones se apilan y conservan objetivos táctiles >=44 px.

## Database / security

- Nuevas columnas aditivas en `public.unit_pending_issue`.
- Helper privado para identificar al Director General real por membresía y código `DIGEN`.
- RLS INSERT/UPDATE/DELETE ampliada solo para instrucciones DIGEN.
- Trigger protege las columnas de una instrucción cuando la actualización viene de la unidad destinataria.
- `pending_issue_access_overview(uuid)` agrega `can_issue_instructions` e `instruction_target_unit_ids`.
- `anon` permanece sin acceso.

## Verification

- pgTAP `supabase/tests/021_digen_pending_instruction_test.sql`.
- Tests frontend de permisos y origen de la instrucción.
- Verificación live de columnas, políticas, trigger y access overview.
- Security/Performance Advisors después de aplicar la migración.
- Vercel preview verde antes del merge.
