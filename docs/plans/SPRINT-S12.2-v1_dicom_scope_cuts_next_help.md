# S12.2 — DICOM / Plan Anual, cortes 2027 y ayuda de próximos pasos

**Fecha:** 2026-10-28. **Estado:** Corrección urgente de interfaz; no modificar autorizaciones RLS sin acceso al proyecto.

## Reportes del usuario
- La cuenta DICOM intenta crear un objetivo en Gestión 2026 y recibe `new row violates row-level security policy for table "unit_work_plan"`.
- En Plan Anual, solo los administradores institucionales autorizados (GEN, DIGEN, DIPROM, DIAF cuando tengan rol o permiso institucional) consultan todas las Direcciones; las demás cuentas deben ver exclusivamente su propia Dirección.
- En Gestión 2027 las cuatro ventanas: Junta Ejecutiva Marzo (ene-mar), Julio (abr-jul), Noviembre (ago-nov), e Informe anual (ene-dic).
- La explicación de «Próximos pasos» debería mostrarse en una ayuda discreta por hover/foco/clic sin deformar el botón «Agregar».

## Causas verificadas
- `ManagementAnnualPlanPage` obtenía todas las filas de `organization_unit_member` de la organización y usaba esa lista **sin filtrar por usuario actual**, con lo cual todos los operadores veían unidades de terceros y la UI habilitaba acciones que la RLS rechaza.
- `ensurePlan` realizaba un `upsert ... onConflict(management_period_id,unit_id)`; una operación de UPSERT requiere permiso INSERT/UPDATE y puede fallar si no está configurado. Se consultará primero el plan y se hará solo INSERT si falta, con respuesta útil ante error RLS. El privilegio de insertar sigue protegido por `private.can_manage_unit`.
- `create_annual_management_cycle` ya define 4 cortes de 2027, pero requiere administración. Mostrar explícitamente sus cuatro estados y permitir completar los faltantes con el RPC existente.
- `SimpleListEditor` mostraba el texto de ayuda en el encabezado flex, desplazando el botón «Agregar».

## Autorización
Consultar `calendar_access_overview` para leer los `unit_ids` de la identidad validada por Supabase y `can_edit_consolidated`. Para directores ordinarios, bloquear navegación a otras unidades y elegir su propia unidad. Los administradores con permiso institucional pueden ver todas; la **edición real sigue limitada por RLS** de planes y objetivos. No ampliamos permisos por pertenecer al código GEN/DIGEN/DIPROM/DIAF solamente.

**Bloqueo de backend:** el conector Supabase `edifydb` (`rrqyihsjftlloizsccvi`) sigue rechazando las consultas. Por ello no es posible afirmar ni modificar la asignación de la cuenta DICOM; si la cuenta no tiene membresía activa `director/manager/operator/reviewer`, un administrador deberá corregir esa asignación desde la app o restablecer acceso para diagnóstico. No cambiar RLS globalmente para ocultar el error.

## Pruebas
- Node: unidad de permisos de selector y visibilidad por perfil, planes inexistentes, manejo de error; cuatro cortes 2027; ayuda accesible sin desplazamiento. Estructura de CI bloqueante, lint y compilación.
- Prueba E2E con DICOM y admin cuando exista sesión conectada, comprobación del insert sobre el propio plan y denegación a terceros; pruebas de navegador tablet y móvil.
- Publicar los arreglos frontend tras revisión y aprobación humana. No requiere migración de DB.
