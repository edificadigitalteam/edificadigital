# SPRINT-S8.5-v1 · Privilegios por defecto sin `anon`

**Fecha:** 2026-10-23
**Issue:** #144
**Estado:** Migración aplicada en `edifydb` el 2026-10-23 como versión `20261023165913` (80 entradas en el historial). El product owner autorizó por chat aplicarla y fusionar el #146.

## Resultado

- Las tablas y secuencias nuevas que crea `postgres` en `public` ya no dan permisos a `anon`.
- Las tablas nuevas ya no dan `TRUNCATE`, `REFERENCES`, `TRIGGER` ni `MAINTAIN` a `authenticated`.
- `anon` solo ejecuta las 3 RPC públicas a propósito: `confirm_operator_activation`, `request_login_access` y `resolve_tenant_host`.

## Hallazgo (consulta de solo lectura en `edifydb`, 2026-10-23)

- **Quién crea los objetos.** Todas las tablas, vistas y funciones de `public` son de `postgres`, y las migraciones corren como `postgres`.
- **Permisos por defecto de `postgres` en `public`.** Daban todo a `anon`:
  - en tablas, `arwdDxtm`;
  - en secuencias, `rwU`;
  - en funciones, `X`.

  `authenticated` recibía `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN` en cada tabla nueva.
- **`MAINTAIN` (nuevo en Postgres 17).** Permite `VACUUM`, `ANALYZE`, `REINDEX` y `LOCK TABLE`. `authenticated` todavía lo tenía en los mismos 36 objetos de #143.
  - #145 no lo quitó, porque `information_schema` no lo lista y la guarda de 029 no lo revisaba.
  - PostgREST no lo expone.
- **Funciones de disparador.** `anon` podía ejecutar `set_updated_at()` y `ensure_in_kind_shipment_donation()`.
  - Un disparador no revisa `EXECUTE` al dispararse, y una función de disparador no se puede llamar directamente.
- **Límite de Postgres.** Postgres da `EXECUTE` a `PUBLIC` en toda función nueva, como valor global. Los permisos por defecto de un esquema solo pueden sumar a ese valor, no quitarlo.
  - Cambiar el valor global afectaría también a las funciones de `private` que usan las políticas RLS.
  - Por eso las funciones nuevas siguen necesitando `revoke execute … from public, anon` en su migración. La guarda de 030 falla en CI si alguna lo omite.
- **`supabase_admin`.** Sus permisos por defecto no se pueden cambiar desde `postgres`. Ninguna migración crea objetos como `supabase_admin`.
- **Secuencias.** No hay secuencias en `public` hoy.

## Cambio de base de datos

Migración `20261023165913_default_privileges_without_anon.sql` (escrita como `20261023190000_…` y renombrada a la versión registrada al aplicarla):

1. `alter default privileges for role postgres in schema public`:
   - `revoke all on tables from anon`;
   - `revoke all on sequences from anon`;
   - `revoke all on functions from anon`, que quita solo la entrada explícita;
   - `revoke truncate, references, trigger, maintain on tables from authenticated`.
2. `revoke maintain on all tables in schema public from authenticated`, para completar #143.
3. `revoke execute on function public.set_updated_at(), public.ensure_in_kind_shipment_donation() from public, anon`.

No cambian tablas, columnas, políticas ni funciones. `authenticated` y `service_role` conservan sus demás permisos, tanto los actuales como los por defecto.

## Pruebas

- pgTAP nueva `supabase/tests/030_default_privileges_without_anon_test.sql` (11 aserciones):
  - los permisos por defecto de `postgres` en `public`, leídos de `pg_default_acl`;
  - una tabla y una secuencia creadas dentro de la prueba;
  - la guarda «`anon` ejecuta solo las 3 RPC públicas»;
  - la regresión de esas 3 RPC.
- La guarda de `029` ahora también revisa `MAINTAIN`.
- **Rojo:** sin la migración, 030 falla 8 de 11 y la guarda de 029 falla por `MAINTAIN` en los 36 objetos.
- **Verde:** suite completa en local, 512/512, con los privilegios automáticos y también con el cambio del 2026-10-30 simulado.
- **Prueba revertida en `edifydb`:** la migración con 029 y 030 (48 aserciones), 48/48. Después se comprobó que nada persistió.

## Estado

- [x] Plan
- [x] Pruebas pgTAP (rojo antes de la migración)
- [x] Migración y verificación local
- [x] Prueba revertida en `edifydb`
- [x] Aplicada en `edifydb` (2026-10-23), archivo renombrado a la versión registrada y advisors sin hallazgos nuevos

### Aplicación en `edifydb` (2026-10-23)

- Autorizada por el product owner por chat. Ante el pedido de autorizar la aplicación y la fusión del #146, respondió «te autorizo».
- Justo antes de aplicar se confirmó el mismo estado de la prueba revertida (79 entradas, permisos por defecto con `anon`), y el CI estaba en verde en `632f332`.
- Aplicada con `apply_migration`; versión `20261023165913`.
- Revisión en vivo:
  - Los permisos por defecto de `postgres` en `public` ya no incluyen a `anon`.
  - En tablas nuevas, `authenticated` recibe `arwd`.
  - Ningún objeto da `MAINTAIN` a `authenticated`.
  - `anon` solo ejecuta las 3 RPC públicas.
- Advisors iguales antes y después: seguridad 3/50/1, rendimiento 51/3/122.

## Riesgos y reversión

- Riesgo bajo.
  - Los permisos por defecto solo afectan objetos futuros.
  - `MAINTAIN` y `EXECUTE` en funciones de disparador no se usan desde la aplicación.
  - Una migración futura que haga `drop` y `create` de una RPC pública debe volver a dar `execute` a `anon`. Ya lo hacen hoy, y la regresión de 030 lo detecta.
- Reversión: una migración correctiva con `alter default privileges … grant …` y los `grant` quitados, y revertir el PR.
