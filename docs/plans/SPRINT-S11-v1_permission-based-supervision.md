# SPRINT-S11-v1 · Supervisión por permisos asignados a personas

**Fecha:** 2026-10-23
**Issue:** #147
**Estado:** ✍️ En curso. Plan aprobado (#149). Etapa 1 aplicada en `edifydb` el 2026-10-23 (#150). Etapa 2 en revisión, **pendiente** de aplicar en `edifydb`.


### Etapa 1: aplicación en `edifydb` (2026-10-23)

- Autorizada por el product owner por chat: «Te autorizo, aplícala en edifydb y fusiona el #150».
- `apply_migration` se cortó dos veces a los 60 s; después de cada intento se verificó que no quedó nada aplicado.
- Se aplicó desde el SQL Editor de Supabase con un script que envuelve la migración en `begin; … commit;` y registra la versión `20261023200000`. El script se probó antes en local. La carga inicial devolvió 7 filas.
- **Revisión en vivo:**
  - 81 entradas en el historial;
  - RLS activa y sin permisos para `anon` ni `authenticated`;
  - 4 índices;
  - 7 permisos para 2 personas, con 7 filas de auditoría;
  - `anon` no ejecuta las funciones nuevas.
- **«Foto» después de aplicar:** 18 operadores activos, 0 diferencias.
- **Advisors:**
  - rendimiento sin cambios (51/3/122);
  - en seguridad aparecen las 2 RPC del admin en `authenticated_security_definer_function_executable` (52) y `rls_enabled_no_policy` (INFO) para `private.operator_permission`. Las dos son intencionales: las RPC validan el acceso por dentro, y la tabla solo se toca desde funciones `security definer`, como `private.operator_access`.

### Etapa 1: verificación (2026-10-23)

- pgTAP `031_supervision_permissions_foundation_test.sql` (29 aserciones de comportamiento): sin la migración no llega a ejecutarse porque la tabla no existe; con la migración, 29/29.
- Suite completa en local: 541/541, con los privilegios automáticos y con el cambio del 2026-10-30 simulado.
- «Foto» en `edifydb`, en una transacción revertida:
  - se aplicó la migración y se recorrieron los 18 operadores activos;
  - para todos, `calendar.manage_all`, `evaluations.review` y `management.read_all` coinciden con `current_operator_is_gen_or_digen_leader`, e `instructions.issue` con `current_operator_is_digen_director`: **0 diferencias**;
  - la carga inicial creó 7 filas: 2 personas con supervisión, de las cuales 1 dirige DIGEN.
  - Esta prueba se corrió sin las cláusulas `on delete` ni el disparador de auditoría, porque la palabra `delete` dispara la confirmación del conector y la primera vez se agotaron los 60 s. Lo comparado no depende de ellas, y se verificó que el intento cortado no dejó nada.

### Etapa 2: Calendario y Evaluación (2026-10-23, pendiente de aplicar)

Migración `20261023210000_supervision_permissions_calendar_evaluation.sql`:

- vuelve a correr `private.backfill_supervision_permissions()` justo antes de cambiar las reglas, por si cambiaron las membresías desde la etapa 1;
- agrega `public.organization.evaluation_reviewers_can_self_evaluate` (por defecto `true`) y la deja en `false` para las organizaciones con unidad GEN o DIGEN activa (CNBV, decisión 8);
- agrega la RPC `public.admin_set_evaluation_reviewers_can_self_evaluate(org, enabled)`, solo para el admin del tenant;
- Calendario: `can_manage_calendar_plan`, `can_view_calendar_plan`, `guard_calendar_activity_review`, `calendar_access_overview`, `review_calendar_activity` y `set_calendar_joint_review` usan `calendar.manage_all` en lugar de `current_operator_is_gen_or_digen_leader`. Cada función se recreó desde su definición en vivo y conserva los permisos del admin del tenant (#125, #136);
- Evaluación: la política `executive_evaluation_read` y `evaluation_access_overview` usan `evaluations.review`. `can_self_evaluate_unit` respeta el ajuste del tenant: si está apagado, quien tiene `evaluations.review` no llena su propia evaluación. `evaluation_access_overview` agrega `is_evaluation_reviewer` y `reviewers_can_self_evaluate` y mantiene las claves que ya lee la interfaz;
- Gestión: las políticas de lectura de `institutional_objective`, `management_indicator` y `unit_work_plan` usan `management.read_all` o `calendar.manage_all`.

Las reglas de Asuntos pendientes siguen igual (etapa 3).

### Etapa 2: verificación (2026-10-23)

- **Rojo** (pruebas nuevas sin la migración): `032` no llega a ejecutarse porque faltan la columna y la RPC; `022` (1) y `023` (6) fallan porque todavía buscan el helper GEN/DIGEN.
- **Verde:** `032_supervision_permissions_calendar_evaluation_test.sql` (33 aserciones de comportamiento) usa un tenant sin unidades GEN ni DIGEN y comprueba que:
  - sin permisos nadie supervisa;
  - `calendar.manage_all` da edición, validación y vista conjunta del calendario;
  - `management.read_all` da lectura de gestión;
  - `evaluations.review` da lectura de evaluaciones enviadas, pero no de borradores;
  - el ajuste vale `true` por defecto y solo el admin lo cambia;
  - con el ajuste apagado, el revisor deja de ver unidades para autoevaluarse y su borrador, y quien no es revisor sigue igual;
  - al quitar el permiso se pierde el acceso.
- `020` y `025` corren la carga inicial después de crear sus membresías GEN/DIGEN; `022` y `023` buscan el permiso nuevo.
- Suite completa en local: 574/574, con los privilegios automáticos y con el cambio del 2026-10-30 simulado.
- **«Foto» en `edifydb`**, en una transacción revertida: se aplicó la migración y se compararon, antes y después, para los 18 operadores activos:
  - `calendar_access_overview` del último período;
  - `evaluation_access_overview`;
  - los planes que cada uno puede editar y ver;
  - las filas que ve como `authenticated` en planes, objetivos, indicadores y evaluaciones.
- **Resultado:** 1 diferencia esperada. A la persona que dirige DIGEN y GEN ya no se le ofrecen esas unidades para autoevaluarse (decisión 8). Esa persona no tiene evaluaciones, así que no pierde ningún borrador. El resto, igual. CNBV quedó con el ajuste en `false`; 7 permisos.

## Resultado

Las funciones de supervisión de Calendario, Evaluación y Asuntos pendientes dejan de depender de los códigos de unidad `GEN` y `DIGEN`, propios del primer cliente (CNBV). Las otorga un **permiso asignado a una persona** dentro de una organización, y lo gestiona el admin del tenant desde «Usuarios y accesos».

- **CNBV:** conserva exactamente el comportamiento de hoy. La migración asigna los permisos a las personas que hoy los ejercen.
- **Los demás tenants:** pueden usar estos módulos sin crear unidades con esos códigos.

## Decisiones del product owner (2026-10-23)

1. Los permisos se asignan **a personas**, no a unidades.
2. **Cada tenant decide** si quien revisa evaluaciones puede llenar la autoevaluación de su propia unidad.
3. El #138 queda en pausa. Su arreglo del menú ya está en `main` (#148).
4. El valor `origin = 'digen_instruction'` se migra a **`institutional_instruction`**.
5. Una instrucción muestra **la unidad y la persona** que la emitió.
6. Las lecturas de objetivos, indicadores y planes de todas las unidades tienen **un permiso propio**, `management.read_all`.
7. Los nombres visibles de los roles son **textos fijos** por ahora.
8. **CNBV** queda con `evaluation_reviewers_can_self_evaluate = false` desde la carga inicial: GEN y DIGEN reciben las evaluaciones y no llenan la suya (pedido del 22/10).

## Inventario (consulta en vivo en `edifydb`, 2026-10-23)

### Dónde se reconoce a GEN y DIGEN por su código

| Función | Regla actual |
|---|---|
| `private.current_operator_is_digen_director(org)` | Membresía activa con `unit_role = 'director'` en una unidad activa con `upper(trim(code)) = 'DIGEN'` |
| `private.current_operator_is_gen_or_digen_leader(org)` | Lo anterior, **o** membresía activa `director`/`manager`/`operator`/`reviewer` en una unidad activa con código `GEN` |
| `private.pending_instruction_target_unit_ids_json(org)` | Destinos posibles: unidades activas con código distinto de `GEN` y `DIGEN` |
| `private.guard_pending_issue_scope()` (disparador) | Busca la unidad `DIGEN`, impide asignarle una instrucción y fija `issued_by_unit_id` = esa unidad |

### Quién depende de esas funciones

| Función base | La usan |
|---|---|
| `current_operator_is_digen_director` | `can_issue_digen_instructions`, `current_operator_is_gen_or_digen_leader`, `public.evaluation_access_overview` |
| `current_operator_is_gen_or_digen_leader` | `can_manage_calendar_plan`, `can_view_calendar_plan`, `guard_calendar_activity_review`, `public.calendar_access_overview`, `public.evaluation_access_overview`, `public.review_calendar_activity`, `public.set_calendar_joint_review` |
| `can_issue_digen_instructions` | `guard_pending_issue_scope`, `pending_instruction_target_unit_ids_json`, `public.pending_issue_access_overview` |

### Políticas RLS que usan esas funciones directamente

- `current_operator_is_gen_or_digen_leader`:
  - `executive_self_evaluation.executive_evaluation_read`;
  - las lecturas de `institutional_objective`, `management_indicator` y `unit_work_plan`.
- `can_issue_digen_instructions` y el valor `origin = 'digen_instruction'`: las 4 políticas de `unit_pending_issue`.

### Datos

- 4 organizaciones; solo CNBV tiene unidades `GEN` y `DIGEN`.
- Membresías que hoy dan la supervisión, todas activas: 3, de **2 personas** (una persona tiene dos cargos):
  - 1 directora o director de `DIGEN`;
  - 1 directora o director de `GEN`;
  - 1 `manager` de `GEN`.
- `unit_pending_issue`:
  - hay 1 instrucción con `origin = 'digen_instruction'`, con su `issued_by_unit_id` lleno;
  - una restricción `CHECK` limita `origin` a `unit` o `digen_instruction`.
- No hay autoevaluaciones guardadas.
- `private.current_operator_is_digen` ya no se usa en ninguna función.

### Frontend

- La interfaz ya trabaja con banderas genéricas del backend: `can_edit_consolidated`, `can_review_consolidated`, `can_delete_consolidated`, `can_manage_joint_review`, `can_issue_instructions`, `can_review_all_evaluations` y `can_read_draft_evaluations`. No cambian de nombre.
- Los textos sí nombran a GEN y DIGEN:
  - `ManagementEvaluationPage.jsx`: «Enviar a GEN y DIGEN», «Consulta reservada a GEN, DIGEN…»;
  - `ManagementPendingIssuesPage.jsx`: «Instrucción DIGEN», «DIGEN ya puede ver el avance»;
  - `moduleLabels.js`: «recibidas por DIGEN»;
  - comentarios en `calendar.js` y `unitScope.js`.
- «Usuarios y accesos» (`/app/admin/operators`) es `frontend/src/features/dashboard/OperatorAdminPanel.jsx`, con las RPC `admin_list_operator_access` y `admin_save_operator_access`.

## Modelo propuesto

### Catálogo de permisos (definido por la plataforma)

| Clave | Qué permite | Hoy lo tienen |
|---|---|---|
| `calendar.manage_all` | Ver, editar y validar u observar el calendario de todas las unidades, y controlar la vista consolidada. Para borrar sigue haciendo falta ser miembro de la unidad o admin. | Líderes de GEN y director de DIGEN |
| `evaluations.review` | Leer las autoevaluaciones **enviadas** de toda la organización. | Líderes de GEN y director de DIGEN |
| `management.read_all` | Leer objetivos, indicadores y planes de todas las unidades. | Líderes de GEN y director de DIGEN |
| `instructions.issue` | Emitir, reescribir y borrar instrucciones institucionales a cualquier unidad activa. | Director de DIGEN |

- Las claves son valores estables en `snake_case` con punto. Los nombres y descripciones visibles van en ES/EN en el frontend.
- El admin del tenant (`private.can_manage_organization`) conserva todo lo que hoy tiene (#136). No necesita permisos asignados.

### Base de datos

1. **Tabla `private.operator_permission`:**
   - columnas: `organization_id`, `operator_access_id`, `permission` (con `CHECK` contra el catálogo), `granted_by`, `granted_at`;
   - clave primaria: `(organization_id, operator_access_id, permission)`;
   - índices en las claves foráneas.
   - Vive en `private`, igual que `operator_access`, y solo se escribe por RPC.
2. **Función `private.current_operator_has_permission(org uuid, permission text)`:**
   - devuelve verdadero si el operador está autorizado, pertenece a la organización y tiene una fila activa en la tabla;
   - es `security definer`, con `revoke execute … from public, anon` y `grant execute … to authenticated` (regla 14).
3. **RPC para el admin:**
   - `public.admin_list_operator_permissions(org)`;
   - `public.admin_set_operator_permissions(org, operator_access_id, permissions text[])`;
   - solo las usa `can_manage_organization`, y registran el cambio en `private.record_change_log`.
4. **Ajuste por tenant:** `organization.evaluation_reviewers_can_self_evaluate boolean not null default true`, editable desde Mantenedores con una RPC.
   - El valor por defecto `true` mantiene el comportamiento de hoy: la función de autoevaluación no excluye a GEN/DIGEN.
5. **Reemplazo de las reglas.** Cada función se copia de su definición en vivo y solo cambia la regla (regla 2):
   - `current_operator_is_gen_or_digen_leader(org)` se reemplaza en cada uso por el permiso preciso: calendario usa `calendar.manage_all`, evaluación usa `evaluations.review`, y las lecturas de objetivos, indicadores y planes usan `management.read_all`.
   - `current_operator_is_digen_director(org)` pasa a ser `has_permission(org,'instructions.issue')`.
   - `can_issue_digen_instructions(org)` pasa a ser `has_permission(org,'instructions.issue') or can_manage_organization(org)`.
   - `pending_instruction_target_unit_ids_json`: destinos = todas las unidades activas.
   - `guard_pending_issue_scope`:
     - `issued_by_unit_id` = la unidad primaria de quien emite (membresía activa con `is_primary`), o `null` si no tiene;
     - columna nueva `unit_pending_issue.issued_by_name text`: el disparador guarda una copia de `operator_access.display_name` de quien emite. La pantalla muestra «Unidad · Persona» sin leer `private`, y el nombre se conserva aunque la persona cambie de cargo o salga. La instrucción existente se completa con el nombre de quien la creó (`created_by`);
     - ya no excluye unidades por código;
     - quien emite no puede asignarse una instrucción a su propia unidad.
   - `can_self_evaluate_unit`: si `evaluation_reviewers_can_self_evaluate` es falso, excluye a quien tenga `evaluations.review`.
   - `evaluation_access_overview` suma `is_evaluation_reviewer` y `reviewers_can_self_evaluate`.
6. **Carga inicial:**
   - asigna a las 2 personas de CNBV que hoy supervisan los permisos que ya ejercen: `calendar.manage_all`, `evaluations.review` y `management.read_all` a las 2, e `instructions.issue` a quien dirige DIGEN (7 filas);
   - deja `evaluation_reviewers_can_self_evaluate = false` en CNBV (decisión 8) y `true` en las demás organizaciones;
   - después de aplicar, ninguna bandera de `calendar_access_overview`, `evaluation_access_overview` ni `pending_issue_access_overview` cambia para ninguna persona, salvo que las 2 personas de CNBV dejan de poder llenar su autoevaluación.
7. **Limpieza (etapa final):**
   - renombrar las funciones `*_digen_*` y `*gen_or_digen*`;
   - borrar `private.current_operator_is_digen`;
   - migrar `origin = 'digen_instruction'` a `institutional_instruction`, con el `CHECK`, las políticas y el frontend en el mismo cambio (decisión 4).

### Interfaz

- **«Usuarios y accesos»:** en el detalle de cada persona, una sección «Permisos de supervisión» con una casilla por permiso, su nombre y una descripción corta en ES/EN. Cada guardado avisa con un toast.
- **Mantenedores:** el ajuste «Las personas que revisan evaluaciones también pueden llenar la de su unidad».
- **Textos neutros en ES/EN:**
  - «Enviar a las personas evaluadoras»;
  - «Consulta reservada a las personas evaluadoras y a la administración»;
  - «Instrucción institucional»;
  - «La unidad que emitió la instrucción ya puede ver el avance».
- Las banderas que lee el frontend no cambian de nombre. Igual se revisa cada texto que las lee, según la regla «UI that reads permission flags».

## Etapas y PR

| Etapa | Contenido | Riesgo |
|---|---|---|
| 1 | Tabla, función de permisos, RPC de admin y carga inicial. Las reglas viejas siguen sin cambios. Migración `20261023200000_supervision_permissions_foundation.sql`, prueba `031`. **Aplicada en `edifydb` (2026-10-23).** | Bajo: nada lee los permisos todavía |
| 2 | Reemplazo de las reglas de Calendario y Evaluación, y ajuste por tenant. Migración `20261023210000_supervision_permissions_calendar_evaluation.sql`, prueba `032`. **Pendiente de aplicar.** | Medio: cambia la RLS |
| 3 | Reemplazo de las reglas de Asuntos pendientes: destinos, `issued_by_unit_id`, columna `issued_by_name` y la pantalla «Unidad · Persona» | Medio |
| 4 | Interfaz: «Usuarios y accesos», ajuste en Mantenedores y textos neutros | Bajo |
| 5 | Limpieza: renombres, `origin` → `institutional_instruction`, actualización de `AGENTS.md` («Access model») | Bajo |

Cada etapa es un PR con:

- pgTAP de comportamiento: datos de prueba, `set local role authenticated` y JWT simulado. Nunca coincidencia de texto.
- La migración ejecutada en local, la prueba revertida en `edifydb`, la aplicación con autorización, los advisors y la documentación al día.

## Pruebas (rojo → verde)

1. **Regresión CNBV.** Antes de la etapa 1 se guarda una «foto» de las banderas de los 3 resúmenes de acceso de cada persona de CNBV. Cada etapa debe reproducirla igual. Corre como prueba revertida en `edifydb` y con datos equivalentes en local.
2. **Tenant genérico:** una organización de prueba sin `GEN` ni `DIGEN`.
   - Sin permisos: nadie supervisa.
   - Con `calendar.manage_all`: edita y valida en todas las unidades.
   - Con `instructions.issue`: emite instrucciones a todas sus unidades activas.
   - Con `evaluations.review`: lee solo las evaluaciones enviadas.
3. **Ajuste por tenant:** con `evaluation_reviewers_can_self_evaluate = false`, quien tiene `evaluations.review` y dirige una unidad no puede crear ni editar su autoevaluación. Con `true`, sí puede.
4. **Aislamiento:** un permiso en la organización A no da nada en la organización B. Un operador inactivo no tiene permisos. `anon` no ejecuta las funciones nuevas (guarda de 030).
5. **Admin:** conserva todo lo de #136 (pruebas 025/026). Solo el admin de la misma organización asigna permisos.
6. **Frontend:** `node --test` para las etiquetas de permisos ES/EN y los textos neutros.

## Riesgos y reversión

- **Riesgo principal:** que una persona de CNBV pierda o gane acceso. Lo cubren la prueba de la «foto» y las etapas separadas.
- **Diferencia con hoy:** cualquier rol de la unidad `GEN` (incluidos `operator` y `reviewer`) cuenta hoy como líder. Hoy solo hay `director` y `manager`, así que la carga inicial cubre a todas las personas reales. Si después se agrega a alguien a GEN, ya no obtiene el permiso automáticamente: hay que asignárselo.
- **Reversión:** cada etapa es una migración correctiva que restaura las definiciones anteriores. La tabla de permisos puede quedarse sin uso.

## Decisiones resueltas (2026-10-23)

Las 5 decisiones abiertas de la primera versión del plan quedaron resueltas por el product owner. Ver los puntos 4 a 8 de «Decisiones del product owner».
