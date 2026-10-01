# SPRINT-S8 · Filtro de confirmación pendiente y reenvío del enlace de activación

## Outcome

En "Mi organización › Usuarios y accesos" (y en "Personas habilitadas" del host):

1. Filtrar el directorio por estado, en particular **Confirmación pendiente**, para ver quién todavía no activó su cuenta.
2. Reenviar el enlace de activación a esas personas. Antes solo el superadministrador veía el botón; un administrador de organización veía la etiqueta "Confirmación pendiente" sin forma de actuar.

## Scope questions (AGENTS.md)

- Plano: tenant (`admin` de la organización) y host (`super_admin`, sin cambios). No es un módulo nuevo; reutiliza el panel `OperatorAdminPanel.jsx`.
- Diferenciación de rol: solo `admin` y `super_admin` pueden reenviar. `operator` sigue sin acceso al panel ni a la RPC.
- Navegación y nombre de módulo: sin cambios.

## Product decisions (reversible)

- Un `admin` puede reenviar a cualquier persona sin confirmar **de su propia organización**, incluido otro `admin`. El reenvío solo rota el token y envía el correo a la dirección registrada; nunca cambia rol, organización ni estado activo.
- Estados del filtro: Todos, Confirmación pendiente (con contador), Correo confirmado, Activos, Suspendidos. Se combinan con la búsqueda y el filtro de organización; "Limpiar" restablece los tres.

## Database change

Migración `20261001120000_tenant_admin_resend_activation.sql` (sin cambios de tablas, RLS ni grants):

- `public.resend_operator_activation(uuid)`: acepta `admin` cuando `target.organization_id = organización del llamante`; rechaza con `42501` a operadores, llamantes sin acceso y destinos de otra organización. `super_admin` sin cambios.
- `public.admin_list_operator_access()`: `can_resend_invitation` = correo sin confirmar y (`super_admin` o `admin` de la misma organización). Misma firma.

## Frontend changes

- `frontend/src/features/dashboard/operatorAdmin.js`: `filterOperators`, `isPendingConfirmation`, `accessStatusOptions` (lógica pura, probada con `node:test`).
- `OperatorAdminPanel.jsx`: selector "Estado", contador de pendientes, botón "Reenviar enlace" con `title`, éxito/fallo mediante toast con mensajes amigables por código (`42501`, `22023`, `P0002`).
- `module-panel.css`: en ≤800 px el bloque de búsqueda dejaba ~220 px de alto por campo (`flex-basis` aplicado a la altura en columna); ahora cada campo ocupa su altura natural. Afecta positivamente a todos los paneles de módulo.

## Verification

- `supabase/tests/018_tenant_admin_resend_activation_test.sql` (9 aserciones): falla 4/9 contra las funciones anteriores y pasa 9/9 con la migración. Pruebas 006, 007, 010 y 011 siguen en verde.
- `frontend/src/features/dashboard/operatorAdmin.test.js` (8 pruebas).
- `pnpm lint`, `pnpm build`.
- Playwright con Supabase simulado: filtro "Confirmación pendiente (2)", reenvío con toast, "Limpiar", 1280 y 375 px.

## Status

Implementado en rama; la migración queda pendiente de aplicar en `edifydb` tras la revisión humana.
