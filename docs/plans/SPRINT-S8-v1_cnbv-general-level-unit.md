# SPRINT-S8-v1 · Unidad de nivel general (GEN) en el organigrama de CNBV

## Outcome

Colocar una unidad de nivel 1, `GEN` · Dirección General, por encima de todo el organigrama de CNBV, y renumerar `organization_unit.sort_order` para que el organigrama y los selectores planos muestren el mismo orden.

Este cambio prepara la regla de visibilidad jerárquica ("cada persona ve su unidad y todo lo que depende de ella"). Esa regla es un cambio posterior, con sus propias pruebas; este paso **no modifica permisos**.

## Decisión del product owner

Estructura y orden aprobados (2026-10-01):

| Nivel | Unidad | `sort_order` |
|---|---|---|
| 1 | GEN | 10 |
| 2 | └ DIGEN | 20 |
| 3 | &nbsp;&nbsp;└ DIAF | 30 |
| 3 | &nbsp;&nbsp;└ DEDEC | 40 |
| 3 | &nbsp;&nbsp;└ DIME | 50 |
| 3 | &nbsp;&nbsp;└ DISES | 60 |
| 3 | &nbsp;&nbsp;└ DICOM | 70 |
| 3 | &nbsp;&nbsp;└ DIPROM | 80 |
| 2 | └ FBCC | 90 |
| 2 | └ STBV | 100 |
| 2 | └ UNJB | 110 |
| 2 | └ UFBMV | 120 |
| 2 | └ UNVBMV | 130 |
| 2 | └ UPBV | 140 |

La numeración sigue el árbol en preorden con saltos de 10, así el orden plano coincide con el orden del organigrama y queda espacio para insertar unidades nuevas.

## Assumptions

- La unidad `GEN` la creó el product owner desde la pantalla de estructura antes de aplicar la migración.
- Todas las demás unidades activas en el nivel principal pasan a depender de `GEN`.
- Las Direcciones internas de DIGEN conservan su dependencia de DIGEN.

## Database impact

- Migración de datos `20261001214651_cnbv_general_level_unit.sql`: solo `UPDATE` sobre `public.organization_unit` (`parent_unit_id`, `sort_order`) de la organización `cnbv`.
- Sin cambios de esquema, políticas, funciones ni grants.
- Si la organización `cnbv` no existe (replay en otra base), la migración no hace nada. Si existe pero `GEN` falta o está duplicada, falla.

## Risks

- `create_annual_management_cycle` crea un plan de trabajo para toda unidad activa, así que `GEN` recibirá uno en el próximo ciclo. Pendiente decidir si el nivel 1 debe tenerlo.
- Las reglas actuales que buscan `DIGEN` por código siguen dando el consolidado a los miembros de DIGEN hasta que se implemente la regla jerárquica.

## Verification

- pgTAP `supabase/tests/019_cnbv_general_level_unit_test.sql`: falla antes de la migración y pasa después.
- Ensayo de la migración en una transacción revertida contra `edifydb`.
- Consulta del árbol después de aplicarla.
- Advisors de seguridad y rendimiento.

## Status

- [x] Plan
- [x] Prueba pgTAP (rojo antes de aplicar)
- [x] Migración aplicada en `edifydb`
- [x] Verificación y documentación
