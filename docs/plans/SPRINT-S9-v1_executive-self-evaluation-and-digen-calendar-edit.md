# Sprint — Autoevaluación ejecutiva y corrección de calendario por DIGEN

## Alcance aprobado

**Evaluación** aparece en la agrupación **Control y rendición** del menú de Gestión Organizacional. El módulo es tenant-scoped; la unidad del autor y el año institucional determinan el alcance de una autoevaluación. Cada titular (director o presidente con rol `director`/`manager` en su unidad) completa en línea la estructura del documento proporcionado:

- Identificación: nombre, Dirección, fecha, lugar, año de ingreso y número de período.
- Matriz DOFA: hasta tres entradas por categoría (Fortalezas, Oportunidades, Debilidades y Amenazas).
- Perfil ocupacional: las 18 competencias, con una opción exclusiva entre Fortaleza (Alto/Medio/Bajo) o Debilidad (Alto/Medio/Bajo), seis posibilidades por competencia.
- Subtotales de cada nivel y total de competencias valoradas, derivados en pantalla sin almacenar un puntaje engañoso.
- Hasta siete logros del período, según los objetivos de la Dirección.

Se puede guardar borrador y posteriormente **Enviar a DIGEN**. El borrador permanece privado para su autor. Después del envío, DIGEN (miembro activo de la unidad DIGEN con rol `director`) lo puede consultar; el registro enviado se mantiene en solo lectura para el autor. No existe la operación de carga de archivo como alternativa al formulario digital.

## Calendario

Conserva la tabla `unit_work_activity` existente, el Plan Anual, los indicadores asociados y los estados de revisión. DIGEN puede editar nombre, descripción, fecha de inicio/fin, estado, responsable y modalidad de una actividad perteneciente a una unidad que supervise. Se mantiene su unidad, Plan Anual, objetivo, indicador y creador. Cada corrección pasa por el RPC `digen_update_calendar_activity`, que:

- Comprueba una identidad activa de titular DIGEN y la relación jerárquica de supervisión.
- Comprueba que ambas fechas pertenezcan al período y que sean coherentes.
- Rechaza sobrescrituras cuando `updated_at` ya cambió por edición concurrente.
- Reinicia la validación anterior y guarda un registro privado de valores antes/después, identidad del corrector y fecha.
- Acepta exclusivamente las claves del contenido que la UI puede editar.

La reunión de revisión se realiza con la vista consolidada ya existente. El botón **Editar** figura en la tarjeta mensual y en el listado. La posibilidad de vaciar el calendario de otra unidad o cambiar relaciones del Plan Anual no se amplía.

## Seguridad y cambios SQL

Migración: `supabase/migrations/20261021130000_executive_self_evaluations_and_digen_calendar_edits.sql`.

Objetos creados:
- `public.executive_self_evaluation`, RLS select/insert/update.
- `private.calendar_activity_correction`, auditoría privada.
- `private.is_digen_evaluation_viewer`, `private.can_write_executive_evaluation`, `private.guard_executive_self_evaluation`.
- `public.executive_evaluation_access_overview`, `public.digen_update_calendar_activity`, `public.admin_set_evaluation_module_label`.
- `public.organization.evaluation_module_label`, personalización por tenant.
- Índices y restricciones, revocaciones explícitas a `anon` y `public`.

La política de lectura no hereda el privilegio financiero de DIAF. DIGEN observa únicamente registros **enviados**; otras Direcciones no pueden leer evaluaciones ajenas ni borradores privados. La función de edición DIGEN no altera ingresos, fondos, solicitudes ni informes.

## Verificación y despliegue

Pruebas de dominio: `frontend/src/features/calendar/calendar.test.js` (supervisión y módulo renombrable). Pruebas SQL: `supabase/tests/017_executive_evaluation_and_digen_calendar_test.sql`. Vercel preview compiló correctamente en la rama.

**Pendiente técnico:** la conexión Supabase de esta sesión rechaza acciones por permisos. Es obligatorio aplicar la migración, correr las pruebas pgTAP, inspeccionar RLS y asesores de seguridad y efectuar una prueba reversible con director, otra Dirección y DIGEN antes de hacer merge. El flujo de revisión humana del repositorio también exige aprobación del PR antes de fusionar a `main`.

**Recuperación:** mientras la rama no se fusione, `main` permanece intacto. Antes del merge no hay migraciones nuevas aplicadas por este cambio. Luego del merge, si hiciera falta revertir, conservar las evaluaciones y la auditoría; desactivar la ruta mediante una reversión de frontend y aplicar una migración correctiva en vez de borrar datos.
