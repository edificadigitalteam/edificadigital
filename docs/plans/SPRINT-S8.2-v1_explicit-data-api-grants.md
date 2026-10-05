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

Migración `supabase/migrations/20261005170000_explicit_data_api_grants.sql`. Solo `grant`/`revoke`; sin cambios de tablas, columnas, políticas ni funciones.

Efecto en `edifydb`: quita privilegios automáticos que la aplicación no usa (acceso de `anon`, `TRUNCATE`/`REFERENCES`/`TRIGGER`, escritura directa en tablas `finance_*`). El comportamiento de la aplicación no cambia.

## Riesgos

- Revocar `anon` en las 8 tablas: ninguna política RLS sirve a `anon` y el sitio público no las consulta.
- Revocar escrituras en `finance_*` para `authenticated`: ya estaban bloqueadas por RLS (solo hay políticas `select`) y el frontend solo hace `select`.

## Verification

- pgTAP `supabase/tests/021_explicit_data_api_grants_test.sql` (20 aserciones): permisos exactos por tabla, guardas para que toda tabla/vista de `public` tenga permisos de `authenticated` y `service_role`, y lectura real como `authenticated`.
- Stack local con el comportamiento posterior al 2026-10-30 simulado (migración temporal, no versionada, que revoca los privilegios por defecto de `postgres` en `public` antes de las demás): 021 en rojo antes de la migración y en verde después.
- Stack local con los privilegios automáticos actuales (como `edifydb`): la migración se aplica encima y 021 pasa.
- PostgREST local: `anon` recibe `42501` en `unit_work_plan`; `service_role` lee.
- Suite pgTAP completa: los mismos 7 fallos con y sin este cambio (000 #36, 003 #12, 013 #6–7, 019 #2–4); son anteriores y ajenos a los permisos.

## Hallazgo fuera de alcance

Las migraciones no se pueden reproducir desde cero: `20260917031741_add_digen_and_management_report_oversight.sql` lanza error si no existe la organización `cnbv`, y `20261001214651_cnbv_general_level_unit.sql` lanza error si `cnbv` existe sin una unidad `GEN`. La verificación local usó fixtures temporales no versionados. Esto bloquea igualmente preview branches y `db reset`, y requiere un cambio aparte.

## Status

- [x] Plan
- [x] Prueba pgTAP (rojo antes de la migración)
- [x] Migración y verificación local
- [x] Documentación (`AGENTS.md`, `CLAUDE.md`, `docs/DATABASE.md`)
- [ ] Aplicar en `edifydb` (este entorno no tiene acceso al proyecto) y correr advisors
