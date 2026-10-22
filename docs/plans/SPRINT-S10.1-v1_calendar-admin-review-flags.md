# SPRINT-S10.1 · Calendario: el admin edita, pero no revisa

**Fecha:** 2026-10-22
**Issue:** #136
**Estado:** En revisión. Migración pendiente de aplicar en `edifydb`.

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
- Antes de aplicar en `edifydb`: autorización explícita del product owner, prueba en una transacción revertida, aplicar con `apply_migration`, renombrar el archivo a la versión registrada y correr los advisors.

## Riesgos y reversión

- Riesgo bajo: solo cambian banderas de lectura. La autorización real sigue en las RPC y en RLS.
- Reversión: una migración correctiva que restaure la definición anterior de `calendar_access_overview`, y revertir el PR.
