# SPRINT-S11-v1 · Supervisión por permisos asignados a personas

**Fecha:** 2026-10-23
**Issue:** #147
**Estado:** 📋 Plan. Las decisiones abiertas al final necesitan respuesta del product owner antes de las pruebas y las migraciones.

## Resultado

Las funciones de supervisión de Calendario, Evaluación y Asuntos pendientes dejan de depender de los códigos de unidad `GEN` y `DIGEN`, propios del primer cliente (CNBV). Las otorga un **permiso asignado a una persona** dentro de una organización, y lo gestiona el admin del tenant desde «Usuarios y accesos».

- **CNBV:** conserva exactamente el comportamiento de hoy. La migración asigna los permisos a las personas que hoy los ejercen.
- **Los demás tenants:** pueden usar estos módulos sin crear unidades con esos códigos.

## Decisiones del product owner (2026-10-23)

1. Los permisos se asignan **a personas**, no a unidades.
2. **Cada tenant decide** si quien revisa evaluaciones puede llenar la autoevaluación de su propia unidad.
3. El #138 queda en pausa. Su arreglo del menú ya está en `main` (#148).

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
- Personas que hoy ejercen la supervisión, todas activas:
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
| `management.read_all` (propuesta, decisión abierta 3) | Leer objetivos, indicadores y planes de todas las unidades. | Líderes de GEN y director de DIGEN |
| `instructions.issue` | Emitir, reescribir y borrar instrucciones institucionales a cualquier unidad activa. | Director de DIGEN |

- Las claves son valores estables en `snake_case` con punto. Los nombres y descripciones visibles van en ES/EN en el frontend.
- El admin del tenant (`private.can_manage_organization`) conserva todo lo que hoy tiene (#136). No necesita permisos asignados.
- Si la decisión abierta 3 descarta `management.read_all`, esas lecturas quedan atadas a `calendar.manage_all` **o** a `evaluations.review`, para que nadie pierda acceso.

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
     - `issued_by_unit_id` = la unidad primaria de quien emite, o `null` si no tiene;
     - ya no excluye unidades por código;
     - quien emite no puede asignarse una instrucción a su propia unidad.
   - `can_self_evaluate_unit`: si `evaluation_reviewers_can_self_evaluate` es falso, excluye a quien tenga `evaluations.review`.
   - `evaluation_access_overview` suma `is_evaluation_reviewer` y `reviewers_can_self_evaluate`.
6. **Carga inicial:** asigna a las 3 personas de CNBV los permisos que hoy ejercen. Después de aplicar, ninguna bandera de `calendar_access_overview`, `evaluation_access_overview` ni `pending_issue_access_overview` cambia para ninguna persona.
7. **Limpieza (etapa final):**
   - renombrar las funciones `*_digen_*` y `*gen_or_digen*`;
   - borrar `private.current_operator_is_digen`;
   - decidir el valor de `origin` (decisión abierta 1).

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
| 1 | Tabla, función de permisos, RPC de admin y carga inicial. Las reglas viejas siguen sin cambios. | Bajo: nada lee los permisos todavía |
| 2 | Reemplazo de las reglas de Calendario y Evaluación, y ajuste por tenant | Medio: cambia la RLS |
| 3 | Reemplazo de las reglas de Asuntos pendientes (destinos, `issued_by_unit_id`) | Medio |
| 4 | Interfaz: «Usuarios y accesos», ajuste en Mantenedores y textos neutros | Bajo |
| 5 | Limpieza: renombres, `origin`, actualización de `AGENTS.md` («Access model») | Bajo |

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

## Decisiones abiertas

1. **Valor de `origin`:** ¿se mantiene `digen_instruction` como valor interno, o se migra a `institutional_instruction`? Recomendación: migrarlo en la etapa 5, porque es un solo registro hoy.
2. **`issued_by_unit_id`:** ¿se guarda la unidad primaria de quien emite, o se deja vacío y se muestra la persona (`created_by`)? Recomendación: la unidad primaria si existe y, si no, vacío.
3. **Lecturas de objetivos, indicadores y planes:** ¿las da `calendar.manage_all`, `evaluations.review` o un permiso propio (`management.read_all`)? Recomendación: un permiso propio, `management.read_all`, asignado en la carga inicial a las mismas 3 personas.
4. **Nombre visible del rol:** ¿«Personas evaluadoras» y «Supervisión institucional» como textos fijos, o configurables por tenant como los nombres de módulo? Recomendación: textos fijos por ahora.
5. **CNBV y la autoevaluación:** el pedido del 22/10 era que GEN/DIGEN no llenen autoevaluaciones. ¿Se deja `evaluation_reviewers_can_self_evaluate = false` para CNBV en la carga inicial?
