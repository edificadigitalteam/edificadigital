# SPRINT-S8.2-v1 · Permisos explícitos del Data API

## Outcome

Que una base construida desde las migraciones del repositorio tenga los mismos permisos del Data API que `edifydb`, después del cambio de Supabase del 2026-10-30.

## Contexto

Desde el 2026-10-30, Supabase deja de dar automáticamente acceso del Data API (`anon`, `authenticated`, `service_role`) a las tablas nuevas de `public` en proyectos existentes. Las tablas que ya existen conservan sus permisos, así que `edifydb` sigue funcionando.

El cambio sí afecta a toda base creada desde migraciones: `supabase db reset` o `supabase start` local, preview branches y proyectos nuevos. Ahí, una tabla sin `grant` explícito queda inaccesible (`42501 permission denied`).

## Hallazgos

- 8 tablas de `public` se crearon sin ningún `grant` y dependían del permiso automático:
  - `20260902230000_diaf_finance_and_structured_unit_reports.sql`: `finance_fund`, `finance_submission`, `finance_transaction`, `finance_submission_attachment`, `unit_management_report_item`.
  - `20260917013756_annual_work_plans_report_windows_and_objective_metrics.sql`: `unit_work_plan`, `management_report_window`, `unit_work_activity`.
- El frontend las consulta directamente (Finanzas DIAF, Plan Anual, ventanas de informe, calendario).
- Ninguna migración da permisos a `service_role` en tablas de `public`.
- Todas las políticas RLS de `public` son `to authenticated`; `anon` no lee ni escribe ninguna tabla operativa.

## Decisiones

- Las cuatro tablas `finance_*` reciben solo `select` para `authenticated`; sus políticas RLS son solo de lectura y las escrituras pasan por RPC `security definer`. Es el mismo patrón que `finance_resource_request`.
- `unit_management_report_item`, `unit_work_plan`, `unit_work_activity` y `management_report_window` reciben `select, insert, update, delete` para `authenticated`; tienen políticas RLS para las cuatro operaciones y el frontend escribe en ellas.
- Las 8 tablas revocan todo de `public` y `anon`.
- `service_role` recibe `select, insert, update, delete` en todas las tablas y vistas de `public`, que es el acceso que ya tiene en `edifydb`.
- Las migraciones aplicadas no se editan; la corrección es una migración nueva.
- No se restauran los privilegios por defecto (`alter default privileges`): cada migración declara sus permisos.

## Impacto en base de datos

Migración `supabase/migrations/20261023161252_explicit_data_api_grants.sql`. Solo `grant`/`revoke`; sin cambios de tablas, columnas, políticas ni funciones.

Efecto en `edifydb`: quita privilegios automáticos que la aplicación no usa (acceso de `anon`, `TRUNCATE`/`REFERENCES`/`TRIGGER`, escritura directa en tablas `finance_*`). El comportamiento de la aplicación no cambia.

## Riesgos

- Revocar `anon` en las 8 tablas: ninguna política RLS sirve a `anon` y el sitio público no las consulta.
- Revocar escrituras en `finance_*` para `authenticated`: ya estaban bloqueadas por RLS (solo hay políticas `select`) y el frontend solo hace `select`.

## Verification

- pgTAP `supabase/tests/027_explicit_data_api_grants_test.sql` (20 aserciones): permisos exactos por tabla, guardas para que toda tabla/vista de `public` tenga permisos de `authenticated` y `service_role`, y lectura real como `authenticated`.
- Stack local con el comportamiento posterior al 2026-10-30 simulado (migración temporal, no versionada, que revoca los privilegios por defecto de `postgres` en `public` antes de las demás): 027 en rojo antes de la migración y en verde después.
- Stack local con los privilegios automáticos actuales (como `edifydb`): la migración se aplica encima y 027 pasa.
- PostgREST local: `anon` recibe `42501` en `unit_work_plan`; `service_role` lee.
- Suite pgTAP completa: los mismos 7 fallos con y sin este cambio (000 #36, 003 #12, 013 #6–7, 019 #2–4); son anteriores y ajenos a los permisos.

### Actualización 2026-10-23 (merge de `main`)

- **Renombres.**
  - La migración pasó de `20261005170000_…` a `20261023160000_…` (y al aplicarla, a `20261023161252_…`, la versión registrada). Con la fecha anterior corría antes de 9 migraciones ya aplicadas, y en una base nueva el `grant … to service_role` no cubría las tablas creadas después, como `unit_pending_issue` o `executive_self_evaluation`. No se había aplicado en ningún lado, así que se podía renombrar.
  - El test pasó de `021` a `027`, porque `021` ya era `021_digen_pending_instruction_test.sql`.
- **Ninguna tabla nueva sin permisos.** Las tablas creadas desde el 2026-10-05 (`unit_pending_issue`, `executive_self_evaluation`) ya declaran sus permisos para `authenticated`.
- **Base local reconstruida desde cero con las 75 migraciones** (imagen `supabase/postgres:17.11.0.004`):
  - Con los privilegios automáticos actuales: suite pgTAP completa, 435/435.
  - Con el 2026-10-30 simulado (`alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role` antes de las migraciones): 435/435.
  - Sin la migración, con el cambio simulado, 027 falla 12 de 20. Las mismas 8 tablas quedan sin `select` para `authenticated`, y 58 tablas y vistas sin acceso para `service_role`.
- **Los fallos anteriores de la suite ya no existen.** `main` corrigió la reproducción desde cero (regla 13 de `AGENTS.md`, workflow `Database checks`, #131), así que el hallazgo fuera de alcance de abajo quedó resuelto.
- **`edifydb`, solo lectura:** las 8 tablas tienen hoy todos los privilegios automáticos, incluido `anon`, y `service_role` ya lee las 58 tablas y vistas. La migración solo quita privilegios. El frontend solo hace `select` en `finance_*`.
- **`CLAUDE.md`:** ahora solo apunta a `AGENTS.md`, así que la regla vive únicamente en `AGENTS.md` (regla 14).

## Status

- [x] Plan
- [x] Prueba pgTAP (rojo antes de la migración)
- [x] Migración y verificación local
- [x] Documentación (`AGENTS.md` regla 14, `docs/DATABASE.md`)
- [x] Actualizado con `main` (2026-10-23) y verificado en local
- [x] Aplicada en `edifydb` el 2026-10-23 y advisors sin hallazgos nuevos

### Aplicación en `edifydb` (2026-10-23)

- El product owner la autorizó por chat: «Te autorizo, aplícala en edifydb y fusiona el #123».
- Prueba revertida antes de aplicar: la migración con las 20 aserciones de 027, 20/20; después se comprobó que nada persistió.
- Aplicada con `apply_migration`; versión registrada `20261023161252` (77 entradas). El archivo se renombró a esa versión.
- Revisión en vivo: las 4 tablas `finance_*` solo tienen `SELECT` para `authenticated`; las otras 4, `SELECT, INSERT, UPDATE, DELETE`; `anon` no tiene permisos en ninguna de las 8; `service_role` lee todas las tablas y vistas de `public`.
- Advisors iguales antes y después: seguridad 3/50/1, rendimiento 51/3/122.
