# S11.4 · Actividades informativas de asociaciones en Calendario

**Fecha:** 27/10/2026. **Estado:** completado. Migración aplicada en edifydb y PR #157 fusionado el 27/10/2026.

## Necesidad y decisiones
Las asociaciones regionales del país anuncian actividades (asambleas y encuentros) que deben aparecer en el calendario general de la CNBV aunque no sean actividades de las Direcciones ni organizaciones incluidas como unidades de trabajo. Los administradores pueden cargarlas manualmente y especificar asociación responsable.

**Dentro del módulo Calendario ya existente**, no se crea un nuevo menú. Formulario «＋ Actividad informativa», con fecha inicio/fin, título, asociación responsable obligatoria y descripción. Una misma gestión tiene muchos anuncios. Los anuncios deben tener identidad propia, independientes de `organization_unit`, `unit_work_plan` y de asignaciones de Dirección.

## Modelo de seguridad
Nueva entidad `public.association_calendar_notice`: ID, organización, gestión, título, asociación responsable, descripción, fechas, metadatos de auditoría. RLS:
- Consultar: operadores autorizados de la misma organización. Informativas son globales y aparecen incluso en «Mi calendario», para comunicar fechas a todas las Direcciones.
- Crear, editar y eliminar: únicamente administradores tenant (función `private.can_manage_organization`) o quienes tengan el permiso institucional `calendar.manage_all` (personal de GEN/DIGEN al que se haya concedido). Un director común puede editar sus actividades ordinarias pero **no** las informativas.
- La organización y gestión se validan mediante FK y trigger; las fechas deben corresponder al período asociado. No hay acceso anónimo ni entre tenants.
- Los registros informativos no participan en el proceso de revisión de planes (sin estados validada/observada ni `review_calendar_activity`): distintivo de clase «Informativa · Asociación» y fondo diferenciable.

## Interfaz
Carga manual y edición a través del mismo Calendario; en Listado, Calendario anual y Presentación se combinan informativas y actividades existentes en orden cronológico, sin escribir unidades ficticias. El responsable es la asociación indicada. Se conserva el diseño de encabezado anual y los colores de revisión. En Presentación hay edición directa para administradores autorizados. Los contadores muestran ambos tipos de actividades, pero «Unidades visibles» no incluye asociaciones.

## Entrega / pruebas
- Migración nueva y pgTAP (seguridad/validación/visibilidad).
- Suite frontend con normalización, autoridad, fechas y visualización, lint + build.
- CI `Database checks` usa Supabase local para migraciones y tests; aplicar la migración en **edifydb `rrqyihsjftlloizsccvi`** antes de publicar, tras verificar permiso del conector. Aplicada el 27/10/2026 tras una prueba en seco revertida; versión registrada `20261027170000`.
- Revisión humana del PR para fusión y limpieza de rama.
