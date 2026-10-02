# SPRINT-S8-v1 · Visibilidad por jerarquía de unidades

## Outcome

Cada persona ve su unidad y todas las unidades que dependen de ella en el organigrama. En CNBV:

| Persona en | Ve |
|---|---|
| GEN | Todas las unidades |
| DIGEN | DIGEN, DIAF, DEDEC, DIME, DISES, DICOM y DIPROM |
| DIAF, DIME, DEDEC, DICOM, DIPROM, DISES, FBCC, STBV, auxiliares | Solo su unidad |
| `admin` de la organización | Todas las unidades |

Reemplaza las reglas que buscaban la unidad `DIGEN` por su código.

## Product decisions (2026-10-01/02)

- Se mantienen los roles `admin` y `operator`. El `admin` ve todo.
- La visibilidad sigue el organigrama (`organization_unit.parent_unit_id`), con `GEN` como nivel 1.
- Ver no es editar: cada unidad edita solo lo propio.
- DIAF conserva sus dos funciones transversales: Finanzas de todas las unidades y revisión de los informes que le envían, con la lectura de indicadores, planes y objetivos que esa revisión necesita. En Asuntos pendientes y Calendario, DIAF ve solo lo suyo.
- Revisión del calendario (validar/observar): la hace quien está arriba de la unidad en el organigrama.
- La revisión conjunta del calendario de toda la organización solo la abre quien ve todas las unidades por membresía (GEN).
- Un cargo `member` ve solo su unidad; `director`, `manager`, `operator` y `reviewer` ven también lo que depende de ella.

## Database impact

Migración `20261002193537_unit_hierarchy_visibility.sql`, aplicada en `edifydb`:

- Funciones nuevas en `private`: `current_visible_unit_ids()`, `current_supervised_unit_ids()`, `can_view_unit`, `can_supervise_unit`, `current_operator_has_oversight`, `current_operator_oversees_organization`, `current_top_unit_id`, `visible_unit_ids_json`, `supervised_unit_ids_json`.
- Políticas SELECT modificadas con `alter policy`: `management_indicator`, `indicator_progress`, `unit_work_plan`, `objective_unit_assignment`, `institutional_objective`, `unit_management_report`, `unit_management_report_item`, `unit_pending_issue`.
- Pasan a la jerarquía:
  - `can_view_calendar_plan`, `can_access_finance_unit`, `can_view_all_management_reports`, `current_operator_is_digen` (se conserva por compatibilidad: ahora significa "supervisa otras unidades") y el trigger `guard_calendar_activity_review`.
  - `review_calendar_activity` y `set_calendar_joint_review`.
  - Los RPC `calendar_access_overview`, `pending_issue_access_overview` y `management_report_access_overview`. Conservan sus claves y agregan `visible_unit_ids`, `supervised_unit_ids`, `can_review` y `can_manage_joint_review`; `digen_unit_id` pasa a ser la unidad propia más alta.
- Índice nuevo `organization_unit_parent_unit_id_idx`.
- Las políticas de escritura no cambian.

## Interface

- Módulo nuevo `frontend/src/features/management/unitScope.js`: `visibleUnits`, `supervisedUnits`, `defaultOwnUnitId` y `canReviewUnitActivity`.
- **Asuntos pendientes:** el filtro consolidado lista solo las unidades visibles, y la unidad por defecto es la propia más alta.
- **Calendario:** validar/observar aparece solo en unidades supervisadas, y el botón de revisión conjunta solo para la unidad general.
- **Consolidado de informes:** lista las unidades supervisadas, en lugar de "todas las de tipo Dirección menos DIGEN".
- Los textos dejan de nombrar a DIGEN.

## Risks

- Operadores sin unidad dejan de ver indicadores, planes y objetivos, que antes eran de toda la organización. En CNBV hay dos operadores activos sin unidad.
- Proyectos, donaciones, voluntariado, aliados y donantes, y el directorio de miembros siguen siendo de toda la organización: no tienen unidad dueña.

## Verification

- pgTAP `supabase/tests/020_unit_hierarchy_visibility_test.sql` (25 aserciones con datos de prueba GEN > DIGEN > (DIAF, DIME) y GEN > FBCC):
  - 14 de 24 fallaban antes del cambio, en la primera versión de la prueba.
  - 25/25 pasan en el ensayo revertido y otra vez después de aplicar.
- `supabase/tests/018_pending_issues_test.sql`: actualizada para la nueva política; 16/16 pasan.
- Comprobación con datos reales de CNBV: el director de GEN ve las 14 unidades, cada director de Dirección ve solo la suya y los `admin` ven todo.
- Advisors de seguridad y rendimiento: sin hallazgos nuevos; los avisos de llaves foráneas sin índice bajan de 52 a 51.
- Frontend:
  - `node --test`: 192 pasan. Los 7 que fallan (landing, `llms.txt`, Miembros) fallan igual en `main`.
  - `oxlint` sin avisos en los archivos cambiados.
  - `vite build` correcto.

## Status

- [x] Plan
- [x] Pruebas en rojo
- [x] Migración aplicada en `edifydb`
- [x] Pantallas
- [x] Verificación y documentación
