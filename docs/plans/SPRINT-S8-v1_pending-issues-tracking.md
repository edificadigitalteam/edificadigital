# SPRINT-S8-v1 · Asuntos pendientes por Dirección

## Outcome

Agregar un módulo de **Asuntos pendientes** a Gestión Organizacional para que cada Dirección/agencia gestione sus propios asuntos y DIGEN supervise un consolidado institucional.

## Product rules

- Cada asunto pertenece a una organización, un período de gestión y una Dirección/agencia.
- Miembros activos de una Dirección con rol `director`, `manager`, `operator` o `reviewer` pueden ver y gestionar únicamente los asuntos de sus propias unidades.
- DIGEN puede ver todos los asuntos de la organización en modo consolidado, pero su edición ordinaria permanece limitada a los asuntos de DIGEN.
- El consolidado de DIGEN permite filtrar por Dirección.
- Estados de seguimiento:
  - `pending` → Pendiente → rojo.
  - `in_progress` → En proceso → amarillo.
  - `completed` → Realizado → verde.
- El color nunca es la única señal: cada estado muestra texto y un marcador visual.
- Urgencia independiente del estado: `low`, `medium`, `high`, `critical`.
- Fecha límite opcional para ayudar a priorizar.
- Los asuntos realizados se conservan como historial del período.

## UX

Ruta: `/app/management/pending-issues`.

Menú: **Control y rendición → Asuntos pendientes**.

Estructura visual:
1. Encabezado del módulo.
2. Contexto: período + Dirección / modo consolidado DIGEN.
3. Resumen: Pendientes, En proceso, Realizados, Alta/Crítica.
4. Filtros por texto, estado, urgencia y Dirección cuando aplica.
5. Lista/tarjetas con acción de edición.
6. Formulario inline de 5 campos: asunto, descripción, estado, urgencia, fecha límite.

Mobile:
- 320, 375, 414 y 768 px.
- Menú existente incluye la nueva entrada automáticamente en el drawer.
- Filtros y métricas apilados.
- Tarjetas en una columna.
- Acciones con objetivo táctil mínimo de 44 px.

## Database

Nueva tabla `public.unit_pending_issue`.

Funciones privadas:
- `private.can_access_pending_issue_unit(uuid)`: membresía explícita a la unidad.
- reutiliza `private.current_operator_is_digen(uuid)` para lectura consolidada.

RPC:
- `public.pending_issue_access_overview(uuid)`: devuelve unidades propias, unidad DIGEN e indicador `is_digen`.

RLS:
- SELECT: propia unidad o DIGEN consolidado.
- INSERT/UPDATE/DELETE: únicamente propia unidad.
- `anon` sin acceso.

## Verification

- pgTAP para tabla, checks, RLS, RPC y ausencia de acceso anónimo.
- Tests de helpers: etiquetas, orden de prioridad, visibilidad y métricas.
- Test estático de ruta + navegación + responsive.
- Vercel build/deployment preview.
- Verificación live de migración y advisors de Supabase.
- Revisión de que `main` no se haya movido antes del merge.
