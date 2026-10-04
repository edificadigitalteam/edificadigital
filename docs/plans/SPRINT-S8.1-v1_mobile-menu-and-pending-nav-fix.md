# SPRINT-S8.1 · Menú móvil estable y visibilidad de Asuntos pendientes

## Outcome

Corregir tres problemas reportados en Gestión Organizacional:

1. El botón de menú móvil debe mostrar siempre las tres líneas y permanecer accesible sin depender de entrar primero a Aportes.
2. El selector global ES/EN debe ocupar menos espacio en teléfonos y dejar libre la barra superior.
3. Asuntos pendientes debe aparecer de forma inmediata en Control y rendición, también cuando entra en juego el menú legado de compatibilidad.

## Root cause

- `ManagementStandaloneShell` ya contiene el drawer móvil correcto.
- `ManagementOperationalFixes` sigue inyectando accesos directos a Aportes, Finanzas y Usuarios dentro del mismo header móvil; esos accesos compiten por espacio con el botón hamburguesa y el selector global de idioma.
- El menú alterno de compatibilidad construido por `ManagementOperationalFixes` solo contiene Seguimiento e Informes dentro de Control y rendición, por lo que omite Asuntos pendientes hasta que el usuario llega a una pantalla que usa el menú canónico.
- `global-language-control` mantiene dimensiones de escritorio demasiado grandes para el header móvil.

## Changes

- El menú legado añade Asuntos pendientes entre Seguimiento e Informes en español e inglés.
- Los accesos rápidos Aportes/Finanzas/Usuarios dejan de inyectarse cuando el header ya contiene el botón canónico `.management-mobile-menu-button`.
- El botón hamburguesa gana contraste y barras ligeramente más visibles en móvil.
- El selector ES/EN se compacta en <=760 px.
- Sin cambios de base de datos ni permisos.

## Verification

- Test estático para confirmar que ambos menús contienen Asuntos pendientes.
- Test que impide inyectar shortcuts sobre el header móvil canónico.
- Test CSS para hamburguesa visible y selector de idioma compacto.
- Vercel preview antes de fusionar a main.
