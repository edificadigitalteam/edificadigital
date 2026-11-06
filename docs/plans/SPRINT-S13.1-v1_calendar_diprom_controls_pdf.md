# S13.1 · Calendario DIPROM: eliminación puntual, responsables y respaldo PDF

**Fecha:** 2026-11-06. **Urgencia:** presentación institucional del calendario.  
**Aprobación del responsable:** solicitud expresa «necesito… URGENTE… publícalo».

## Alcance
1. En el Calendario anual, Listado y Presentación: botón «Eliminar» por actividad (incluidas `observed`), con confirmación que menciona título y fecha; únicamente para actividades que la sesión puede borrar realmente. Guardado auditable mediante restricciones por `organization_id` e ID y comprobación de fila afectada; error visible si RLS deniega.
2. «Editar» permite modificar el nombre de la persona responsable. Para perfiles con `calendar_access_overview.can_edit_consolidated`, también seleccionar la **Dirección responsable** entre planes existentes del mismo período. Reasignar `work_plan_id` borra vínculos `objective_id` y `indicator_id` de la Dirección anterior, y devuelve la actividad a revisión `pending`; mantiene el contenido restante. Personas con permisos sobre una unidad solamente pueden editar la suya.
3. Asociaciones informativas conservan su propia tabla `association_calendar_notice`; solo sus administradores pueden editar/eliminar, sin asociarlas a una Dirección ficticia.
4. «Descargar PDF» en el encabezado del Calendario y en modo Presentación genera directamente un PDF local de **la vista actual** (Mi Calendario / Consolidado), por mes, en A4 horizontal, con encabezados y texto bíblico del período, fecha, actividad, responsable y estado de revisión, fecha/hora de respaldo y paginación. El PDF es estático y reproducible; el calendario sigue en línea para cambios en vivo. Biblioteca `pdfmake` ya instalada.
5. Priorizar el botón PDF y controles de eliminación de cara a reunión, con estados accesibles. No borrar grupos de actividades sin confirmación independiente.

## Seguridad de base de datos
**Sin migraciones ni cambios de RLS.** Según `20261022142118_tenant_admin_full_management_access.sql`, la política de borrado permite al admin tenant actuar en todas sus Direcciones y a miembros activos solo en su propia unidad. `calendar_access_overview.can_delete_consolidated` expresa acceso administrativo. `calendar.manage_all` permite edición transversal, pero no borrado transversal; esta diferencia se respeta (no se confunde con permiso de eliminación). `unit_work_activity.update` requiere `private.can_manage_calendar_plan`; la edición institucional de `work_plan_id` usa estos permisos existentes.
El conector Supabase en esta sesión no consigue leer `edifydb` (ref `rrqyihsjftlloizsccvi`). Una cuenta DIPROM con membresía activa en DIPROM puede eliminar sus propias actividades, y un administrador puede eliminar las del consolidado; **no se garantiza autorización transversal sin comprobar el rol real de esa cuenta**. Errores de denegación deben mostrarse sin fingir éxito.

## Pruebas
- Pruebas por estados de revisión, permisos (mi unidad, admin, supervisor que solo puede editar, asociación), reasignaciones válidas/denegadas, responsable personal, exportación anual de doce meses e integración en tres formatos.
- Suite específica GitHub Actions, lint, build y Vercel preview; inspección manual si hay navegador autenticado. Fusionar a `main` tras aprobación y CI exitosa, confirmar despliegue Vercel.
