# SPRINT-S8.4-v1 · Quitar TRUNCATE, REFERENCES y TRIGGER a `authenticated`

**Fecha:** 2026-10-23
**Issue:** #143
**Estado:** Migración `20261023180000_revoke_authenticated_maintenance_privileges.sql` **pendiente** en `edifydb`. Requiere autorización explícita para aplicarla.

## Resultado

Ningún objeto de `public` da `TRUNCATE`, `REFERENCES` ni `TRIGGER` a `authenticated`. Cada tabla y vista conserva los permisos de lectura y escritura que declaró la migración que la creó, y `edifydb` queda igual que una base reconstruida desde migraciones.

## Hallazgo (consulta de solo lectura en `edifydb`, 2026-10-23)

- **36 objetos con permisos de mantenimiento:** 35 tablas y la vista `inventory_lot_balance` daban a `authenticated` los privilegios automáticos `TRUNCATE`, `REFERENCES` y `TRIGGER`, además de `SELECT, INSERT, UPDATE, DELETE`.
  - PostgREST no expone esos tres privilegios y la aplicación no los usa.
  - `TRUNCATE` no pasa por RLS.
- **4 objetos con más permisos de los declarados.** Sus migraciones declararon permisos más estrechos que los que hoy tienen en `edifydb`:

| Objeto | Declarado | En `edifydb` | Políticas RLS |
|---|---|---|---|
| `executive_self_evaluation` (`20261021142000`) | `select, insert, update` | también `delete` | `select`, `insert`, `update` |
| `project_media_evidence` (`20260816030000`) | `select, insert, delete` | también `update` | `select`, `insert`, `delete` |
| `project_beneficiary_document` (`20260816030000`) | `select, insert, delete` | también `update` | `select`, `insert`, `delete` |
| `inventory_lot_balance` (vista, `202607190001`) | `select` | también `insert, update, delete` | vista de agregados, solo lectura |

  - RLS ya rechazaba esos permisos de más, porque ninguna política los cubre. El frontend no los usa.
  - `docs/DATABASE.md` ya decía que la evaluación no da permiso de borrado; en vivo, sí lo daba.
  - En una base reconstruida con el cambio de Supabase del 2026-10-30 simulado, estos 4 objetos quedan con lo declarado. Por eso `edifydb` y esa base no coincidían.

## Cambio de base de datos

Migración `20261023180000_revoke_authenticated_maintenance_privileges.sql`, solo `revoke`:

1. `revoke truncate, references, trigger on all tables in schema public from authenticated`.
2. `revoke delete` en `executive_self_evaluation`.
3. `revoke update` en `project_media_evidence` y `project_beneficiary_document`.
4. `revoke insert, update, delete` en `inventory_lot_balance`.

No cambian tablas, columnas, políticas ni funciones. `anon` y `service_role` no cambian.

## Pruebas

- pgTAP `supabase/tests/029_revoke_authenticated_maintenance_privileges_test.sql` (37 aserciones):
  - los permisos exactos de `authenticated` en los 36 objetos (regresión);
  - una guarda que falla si cualquier tabla o vista de `public`, presente o futura, da `TRUNCATE`, `REFERENCES` o `TRIGGER` a `authenticated`.
- **Rojo:** sin la migración, en la base local con los privilegios automáticos (como `edifydb`), 37 de 37 fallan.
- **Diferencia con el 2026-10-30 simulado:** una primera versión de la prueba esperaba `select, insert, update, delete` en los 36 objetos. Con el cambio simulado fallaron los 4 objetos de la tabla, lo que mostró la diferencia con lo declarado.
- **Verde:** suite completa en local, 501/501, con los privilegios automáticos y también con el cambio simulado.
- **Prueba revertida en `edifydb`:** la migración con las 37 aserciones, 37/37, sin dejar cambios.

## Estado

- [x] Plan
- [x] Prueba pgTAP (rojo antes de la migración)
- [x] Migración y verificación local
- [x] Prueba revertida en `edifydb`
- [ ] Aplicar en `edifydb` (requiere autorización), renombrar el archivo a la versión registrada y correr advisors

## Fuera de alcance

- Los privilegios por defecto de `public` siguen dando `TRUNCATE`, `REFERENCES` y `TRIGGER` a `authenticated` en tablas nuevas. Lo cubre #144; mientras tanto, la guarda de 029 falla en CI si una migración no los revoca.
- Otras escrituras directas que podrían ir solo por RPC. Necesitan una revisión por módulo.

## Riesgos y reversión

- Riesgo bajo: solo quita permisos que la aplicación no usa y que RLS ya rechazaba.
- Reversión: una migración correctiva que vuelva a dar los permisos quitados, y revertir el PR.
