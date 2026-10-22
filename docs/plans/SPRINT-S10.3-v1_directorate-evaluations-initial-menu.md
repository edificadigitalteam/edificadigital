# SPRINT S10.3 · Evaluaciones por Dirección y acceso inmediato en el menú

**Fecha:** 2026-10-22  
**Estado:** Implementado en rama de corrección; pendiente aplicación y comprobación en `edifydb` y aprobación de despliegue.

## Objetivo y alcance
- Los **directores activos de las Direcciones** completan una autoevaluación por gestión y unidad. Pueden guardar borradores y enviar el formulario.
- **GEN** y **DIGEN** son receptores/supervisores institucionales: consultan las autoevaluaciones **enviadas**, sin formularios propios. Un supervisor con pertenencia simultánea a otra Dirección tampoco puede autoevaluarse.
- GEN/DIGEN como unidades (códigos de organización) tampoco pueden generar evaluaciones aunque sus cuentas tengan rol de director.
- La administración tenant conserva su acceso aprobado en S10.2 a borradores y enviados; no obtiene autorización para escribir evaluaciones ajenas.
- La visualización consolidada muestra solo evaluaciones de unidades diferentes de GEN y DIGEN. Las evaluaciones históricas se conservan sin borrarlas.
- «Evaluación» aparece en el primer render bajo **Control y rendición**, en navegación canónica y navegación heredada, escritorio y móvil; se respeta `organization.evaluation_module_label`.

## Seguridad y migración
El cambio de autorización requiere migración **nueva**:
`supabase/migrations/20261022182000_directorate_only_self_evaluations.sql`.
Modifica únicamente:
1. `private.can_self_evaluate_unit(uuid,uuid)`: director activo de unidad activa, distinta de GEN/DIGEN y sin cargo de supervisor GEN/DIGEN.
2. `public.evaluation_access_overview(uuid)`: lista de unidades evaluadoras ya filtrada y bandera `is_evaluation_supervisor`; conserva `can_review_all_evaluations` y `can_read_draft_evaluations` del admin.

Las políticas RLS, filas existentes y permisos administrativos de Calendario/Pendientes permanecen intactos; las políticas de Evaluación heredan la restricción de escritura por el helper central.

## Pruebas y publicación
- Node: `frontend/src/features/evaluation/evaluation.test.js` comprueba inclusiones/exclusiones; `frontend/src/features/management/evaluationNavigation.test.js` verifica las dos variantes del menú y el nombre configurable.
- pgTAP: `supabase/tests/027_directorate_only_self_evaluations_test.sql` contiene 8 aserciones para autorización, RPC y conservación de permisos.
- CI del frontend: pruebas del cambio, lint, build; suite completa como auditoría (8 fallos heredados ya documentados).
- **Pendiente:** conexión Supabase a `edifydb` (`rrqyihsjftlloizsccvi`) devuelve autorización denegada desde este conector. No ejecutar esta migración sobre `speak-mode` ni `tusfraseskids`; validar historial, inspeccionar funciones vivas, probar pgTAP en transacción revertida, aplicar al proyecto correcto, revisar advisors y efectuar pruebas E2E con director DIPROM, GEN, DIGEN y admin.
- **Publicación:** requiere aprobación humana del PR por la norma `AGENTS.md`. `main` y la base de producción no se alteran durante esta rama.

## Pruebas manuales sugeridas
1. Refrescar `/app/management` en teléfono y escritorio: «Evaluación» aparece inmediatamente.
2. Director DIPROM: formulario habilitado y borrador editable.
3. Director GEN, DIGEN y cualquier usuario de GEN/DIGEN con doble asignación: solo resultados enviados.
4. Administración tenant: resultados enviados y borradores visibles en modo lectura, según autorización existente.
5. Director de otra Dirección: sus propias respuestas únicamente; sin acceso a otras evaluaciones.
6. Comprobar gestiones 2026/2027, ES/EN y etiquetas personalizadas.
