# SPRINT-S8.3-v1 · Quitar los permisos de `anon` en tablas de `public`

**Fecha:** 2026-10-23
**Issue:** #141
**Estado:** Migración `20261023170000_revoke_anon_table_privileges.sql` **pendiente** en `edifydb`. Requiere autorización explícita para aplicarla.

## Resultado

Ninguna tabla ni vista de `public` da permisos a `anon`. `authenticated` conserva exactamente lo que declaró la migración que creó cada tabla.

## Hallazgo (consulta de solo lectura en `edifydb`, 2026-10-23)

En 14 tablas, `anon` conservaba los privilegios automáticos del Data API, porque ninguna migración los revocó:

| Tablas | `anon` | `authenticated` hoy | Migración que las creó |
|---|---|---|---|
| `indicator_progress`, `institutional_objective`, `management_indicator`, `management_period`, `objective_unit_assignment`, `organization_unit`, `organization_unit_member`, `project_objective`, `project_organization_unit`, `unit_management_report` | todos (incluye escritura y `TRUNCATE`) | todos | `20260815194500`: `select, insert, update, delete` |
| `organization_subscription`, `subscription_payment`, `subscription_plan` | todos | todos | `20260726010000`: solo `select` |
| `finance_resource_request` | `SELECT`, `TRUNCATE`, `REFERENCES`, `TRIGGER` | los mismos | `20260903013000`: solo `select` |

- RLS bloquea las filas, porque todas las políticas de estas tablas son `to authenticated`. Pero `TRUNCATE` no pasa por RLS, y estos permisos contradicen la línea base de `AGENTS.md` («anonymous table privileges revoked»).
- Las otras 43 tablas y la vista `inventory_lot_balance` ya no tienen permisos para `anon`.
- Ninguna página pública (`/`, `/donations/*`) lee estas tablas: todas se usan dentro de `/app`, con sesión.
- Las tablas de suscripción y `finance_resource_request` solo tienen políticas `select`, y se escriben por RPC `security definer`. Ninguna función `security invoker` escribe en ellas.

## Cambio de base de datos

Migración `20261023170000_revoke_anon_table_privileges.sql`, solo `grant`/`revoke`:

1. `revoke all … from public, anon, authenticated` en las 14 tablas.
2. `grant select, insert, update, delete … to authenticated` en las 10 tablas de gestión.
3. `grant select … to authenticated` en las 3 de suscripción y en `finance_resource_request`.

`service_role` no cambia. No cambian tablas, columnas, políticas ni funciones.

**Efecto en `edifydb`:** quita los permisos de `anon`, y a `authenticated` le quita `TRUNCATE`/`REFERENCES`/`TRIGGER` en estas 14 tablas y la escritura directa en las 4 de solo lectura. La aplicación no usa ninguno de esos permisos.

## Pruebas

- pgTAP `supabase/tests/028_revoke_anon_table_privileges_test.sql` (29 aserciones):
  - `anon` sin permisos en cada una de las 14 tablas;
  - `authenticated` con los permisos exactos de cada tabla (regresión);
  - una guarda que falla si cualquier tabla o vista de `public`, presente o futura, da algún permiso a `anon`.
- **Rojo:** sin la migración, 29 de 29 fallan en la base local. La guarda lista las mismas 14 tablas que `edifydb`.
- **Verde:** suite completa en local, 464/464, con los privilegios automáticos actuales y también con el cambio del 2026-10-30 simulado.
- **Prueba revertida en `edifydb`:** la migración con las 29 aserciones, 29/29, sin dejar cambios.

## Pendiente

- [x] Plan
- [x] Prueba pgTAP (rojo antes de la migración)
- [x] Migración y verificación local
- [x] Prueba revertida en `edifydb`
- [ ] Aplicar en `edifydb` (requiere autorización), renombrar el archivo a la versión registrada y correr advisors

## Fuera de alcance

- `authenticated` todavía tiene `TRUNCATE`, `REFERENCES` y `TRIGGER` en otras 36 tablas de `public` (50 en total menos estas 14). Son privilegios automáticos que la API no expone.
- Los privilegios por defecto de `postgres` y `supabase_admin` en `public` siguen dando todo a `anon` en tablas nuevas. La regla 14 de `AGENTS.md` y esta guarda obligan a revocarlo en cada migración.

## Riesgos y reversión

- Riesgo bajo: solo quita permisos que la aplicación no usa. La autorización real sigue en RLS y en las RPC.
- Reversión: una migración correctiva que vuelva a dar los permisos quitados, y revertir el PR.
