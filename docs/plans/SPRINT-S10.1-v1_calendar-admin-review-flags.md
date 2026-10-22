# SPRINT-S10.1 · Calendario: el admin edita, pero no revisa

**Fecha:** 2026-10-22
**Issue:** #136
**Estado:** Migración aplicada en `edifydb` (`rrqyihsjftlloizsccvi`) el 22/10/2026 como versión `20261022135016`. PR pendiente de merge.

> **Decisión reemplazada el mismo día.** El product owner decidió después que el admin del tenant actúe sin restricciones (revisa, borra, emite instrucciones DIGEN y lee borradores). Ver `SPRINT-S10.2-v1_tenant-admin-full-management-access.md`. Esta migración sigue en el historial; su clave `can_review_consolidated` se mantiene y ahora también es verdadera para el admin.

## Resultado

Las banderas que recibe la interfaz coinciden con lo que la base de datos permite. El administrador del tenant sigue consultando y editando el calendario de todas las unidades, pero ya no ve los botones **Validar** / **Observar** ni **Habilitar/Deshabilitar vista consolidada**, porque `review_calendar_activity` y `set_calendar_joint_review` lo rechazan (`42501`). La decisión del product owner (2026-10-22) es la opción 2 del issue: el admin edita y no revisa.

## Supuestos

- La revisión (`validated` / `observed`) y el control de la vista compartida siguen siendo de las unidades supervisoras, de quien ve todas las unidades por membresía, y de los líderes GEN/DIGEN (`AGENTS.md` → "Access model").
- Si el admin además es líder GEN/DIGEN o pertenece a una unidad supervisora, conserva esos permisos por esa membresía.

## Cambio de base de datos

Una migración nueva reemplaza `public.calendar_access_overview(uuid, uuid)`. Se conservan la firma, `security definer`, `search_path` y los permisos (`authenticated` puede ejecutarla; `anon` no):

| Clave | Antes | Después |
|---|---|---|
| `can_review` | supervisión **o** admin **o** GEN/DIGEN | supervisión **o** GEN/DIGEN |
| `can_manage_joint_review` | ve todas por membresía **o** admin **o** GEN/DIGEN | ve todas por membresía **o** GEN/DIGEN |
| `can_review_consolidated` (nueva) | — | GEN/DIGEN |
| `can_edit_consolidated` | admin **o** GEN/DIGEN | sin cambios |
| `can_view_consolidated` y demás claves | — | sin cambios |

No cambian tablas, políticas, triggers ni las RPC de revisión.

## Interfaz

- `canReviewUnitActivity` (`frontend/src/features/management/unitScope.js`) usa `can_review_consolidated` en lugar de `can_edit_consolidated`. Así deja de mostrar Validar/Observar al admin.
- El botón de vista compartida ya lee `can_manage_joint_review`, que ahora llega en `false` para el admin.
- Revisé el texto del aviso (`adminEditView`): dice "consultar y editar" y no menciona revisar, así que queda igual.

## Pruebas

- pgTAP `supabase/tests/025_calendar_admin_review_flags_test.sql`, con datos de prueba reales (admin sin membresía, director DIGEN, miembro GEN, director de una unidad supervisora). Comprueba las banderas de cada caso, que el admin conserve la edición y que las RPC sigan rechazando al admin.
- `node --test`: `unitScope.test.js` cubre al admin con `can_edit_consolidated` sin `can_review_consolidated`.

## Verificación

- Stack local de Supabase (`supabase start`, solo la base) con todas las migraciones. pgTAP 022, 023 y 025.
- `pnpm test`, `pnpm lint`, `pnpm build` en `frontend/`.
- `edifydb`: el product owner lo autorizó por chat el 22/10/2026. La migración y las 24 aserciones de 025 corrieron primero en una transacción revertida (24/24 ok, sin datos persistidos). Se aplicó con `apply_migration` (versión `20261022135016`, 75 entradas en el historial) y el archivo se renombró a esa versión. Advisors iguales antes y después: seguridad 3/50/1 y rendimiento 51/3/124, sin hallazgos nuevos.

## Riesgos y reversión

- Riesgo bajo: solo cambian banderas de lectura. La autorización real sigue en las RPC y en RLS.
- Reversión: una migración correctiva que restaure la definición anterior de `calendar_access_overview`, y revertir el PR.
