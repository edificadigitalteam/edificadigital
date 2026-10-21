# SPRINT-S10 · Evaluación ejecutiva privada y revisión conjunta del Calendario

**Fecha:** 2026-10-21  
**Estado:** Implementado en rama de revisión. Pendiente aplicación/verificación de migración en `edifydb`, pruebas pgTAP, aprobación y merge del PR.

## Solicitud y decisiones

- Sección nueva **Control y rendición → Evaluación**, disponible para los directores activos de cada Dirección o agencia, dentro de su organización.
- Cada director completa su propia autoevaluación en línea, en la gestión seleccionada, y puede guardar borradores o enviarla de forma definitiva.
- Los responsables autorizados de **GEN** (membresías activas `director`, `manager`, `operator` o `reviewer`) y el **director de DIGEN** (membresía activa `director`) pueden consultar las autoevaluaciones de otros usuarios. Los demás directores consultan sus propias evaluaciones.
- El documento de la CNBV «Evaluación a titular de posición ejecutiva · Gestión 2026» guía el formulario, conservando las 4 categorías DOFA (3 campos cada una), 18 criterios con 6 valoraciones y 7 logros. La suma muestra **conteos** de fortalezas y debilidades, sin inventar una calificación institucional.
- Los registros enviados quedan cerrados. La interfaz puede abrirlos en modo lectura; GEN y DIGEN ven la lista de evaluaciones enviadas.
- Se puede renombrar «Evaluación» en Mantenedores según el sistema de nombres actual; la navegación funciona en escritorio y teléfono.
- Se mantiene soporte ES/EN.
- GEN y DIGEN pueden revisar, validar y **editar las actividades de cualquier unidad** en el Calendario 2026/2027, desde la vista consolidada. El consolidado recarga cada 12 segundos y tiene un botón de actualización inmediata para uso en la reunión.
- Los directores siguen editando actividades de su unidad; los administradores conservan su lectura institucional y la gestión de pendientes, con las modificaciones transversales del calendario reservadas a los responsables autorizados de GEN y al director de DIGEN.
- «Vaciar calendario» y permisos de eliminación solo contemplan actividades de una unidad propia.

## Archivos y cambios de base de datos

Migración `supabase/migrations/20261021142000_private_executive_evaluations_digen_calendar.sql`:

1. Columna `organization.evaluation_module_label`.
2. Tabla `public.executive_self_evaluation` (organización, gestión, unidad, autor, datos generales, DOFA, competencias, logros, borrador/envío, trazabilidad, unicidad por autor/gestión/unidad).
3. Trigger `private.guard_executive_evaluation` de integridad, 18 competencias válidas y cierre de envíos.
4. RLS y permisos de tabla: lectura privada de autor/GEN/DIGEN, escritura propia con cargo director, solo borradores, ninguna eliminación concedida.
5. `private.can_self_evaluate_unit`, `public.evaluation_access_overview`, `public.admin_set_evaluation_module_label`.
6. Funciones y políticas de Calendario que autorizan lectura, edición y validación transversal a GEN/DIGEN, conservando la lectura administrativa y visibilidad conjunta.
7. Política de borrado de actividades limitada a una membresía activa de la unidad.

Pruebas: `supabase/tests/023_private_executive_evaluations_digen_calendar_test.sql` y actualización de `022_admin_unit_edit_access_test.sql`. Lógica de datos: `frontend/src/features/evaluation/evaluation.test.js` y `frontend/src/features/calendar/calendar.test.js`.

## Seguridad, validación y despliegue

- La autorización se verifica con la base de datos mediante RLS y funciones privadas; la interfaz usa las respuestas verificadas de los RPC.
- Revisar accesos de usuario normal, director, GEN, DIGEN y administrador, junto con las fronteras de organización y el cierre de envíos.
- Correr `pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build` en `frontend/`.
- Ejecutar pgTAP y SQL de prueba transaccional primero sobre Supabase local. Validar con advisors de seguridad y rendimiento. Probar en móvil 320/375/414/768 y escritorio.
- Aplicar la migración exclusivamente al proyecto `edifydb` (`rrqyihsjftlloizsccvi`) después de verificar su conexión y historial. La conexión de Supabase consultada el 21/10/2026 ofrece solo `tusfraseskids` y `speak-mode`; la consulta directa a `edifydb` devuelve `You do not have permission to perform this action`. El proyecto `edifydb` figuraba antes bajo la organización Supabase `yg_bocadoapp`, por lo que la migración aún está **pendiente**; no debe integrarse a producción mientras siga pendiente.
- Solicitar revisión humana del PR, después integrar `main` y comprobar el deployment Vercel. Tras desplegar, probar el formulario, acceso confidencial y edición en vivo con usuarios reales autorizados.
- **Rollback:** revertir el PR para volver a la UI anterior. Para la migración, preferir una migración correctiva auditada; evitar borrar evaluaciones existentes.
