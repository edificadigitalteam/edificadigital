# SPRINT-S7.2 · Carga rápida de actividades del calendario

## Outcome

Eliminar el bloqueo de creación cuando una Dirección todavía no ha definido objetivos del Plan Anual y permitir registrar varias actividades del calendario en una sola carga.

## Product decisions

- El calendario sigue siendo tenant-scoped.
- Cada actividad continúa perteneciendo al Plan de Trabajo de una Dirección y a un período de gestión.
- El vínculo con un objetivo del Plan Anual pasa a ser opcional para actividades creadas desde Calendario.
- Cuando exista un objetivo, puede seleccionarse y conservarse como vínculo de trazabilidad.
- La vista de Plan Anual mantiene su flujo propio y puede seguir exigiendo objetivo al crear actividades desde ese módulo.
- Crear actividades desde Calendario usa una carga por lote: datos compartidos arriba y filas repetibles para nombre, fecha de inicio, fecha de cierre y notas.

## Database change

1. `unit_work_activity.objective_id` pasa de requerido a opcional.
2. La FK hacia `institutional_objective` cambia de `ON DELETE CASCADE` a `ON DELETE SET NULL` para conservar actividades de calendario si se elimina un objetivo.
3. Sin cambios de RLS ni permisos.

## Frontend changes

- “Nueva actividad” deja de depender de que existan objetivos.
- El formulario de alta se convierte en “Cargar actividades”.
- Campos compartidos: objetivo opcional, indicador opcional cuando corresponda, responsable, modalidad y estado.
- Filas: actividad, inicio, cierre y notas.
- Se pueden agregar o quitar filas antes de guardar.
- El guardado usa un único bulk insert con un array de filas.
- La edición individual conserva el formulario detallado actual.
- Responsive prioritario para 320, 375, 414 y 768 px.

## Risks

- Una actividad sin objetivo debe mostrarse correctamente en calendario, listado y revisiones DIGEN.
- Un indicador nunca debe enviarse si no existe objetivo seleccionado.
- La eliminación futura de un objetivo debe conservar la actividad y limpiar su vínculo.
- Todas las filas de un bulk insert deben pertenecer al mismo plan y unidad.

## Verification

- pgTAP: `objective_id` nullable y FK `ON DELETE SET NULL`.
- Tests de payload de carga múltiple.
- Test que confirma que el botón de alta ya no depende del número de objetivos.
- Frontend test, lint y build.
- Verificación transaccional de inserción con objetivo nulo bajo el modelo de datos.
- Security/performance advisors después de aplicar la migración.
