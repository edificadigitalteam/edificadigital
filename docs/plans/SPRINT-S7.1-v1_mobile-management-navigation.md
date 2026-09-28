# SPRINT-S7.1 · Navegación móvil de Gestión y Calendario

## Outcome

Optimizar Gestión Organizacional para uso diario desde teléfono, con prioridad en DIGEN. La experiencia de escritorio se conserva y la navegación móvil expone la misma arquitectura de información del sidebar principal.

## Scope decisions

- Plane: tenant.
- Roles: la mejora aplica a admin y operator; DIGEN conserva sus permisos actuales y obtiene una navegación móvil clara hacia todas las áreas.
- Navigation: el header móvil abre un drawer lateral con los mismos grupos del escritorio: Inicio, Planificación, Recursos y operación, Control y rendición y Administración cuando corresponda.
- Active state: la ruta actual queda identificada dentro del drawer.
- Mobile ergonomics: objetivos táctiles de al menos 44 px, scroll interno del menú, cierre por backdrop y tecla Escape, y bloqueo del scroll de fondo mientras el drawer está abierto.
- Calendar: acciones, filtros, tabs, tarjetas y vista de listado se reorganizan para 320, 375, 414 y 768 CSS px.
- Desktop: se preserva la composición actual sobre 920 px.

## Database changes

Ninguno.

## Frontend changes

1. Reemplazar los shortcuts móviles del shell por un botón de menú claro.
2. Agregar drawer móvil accesible reutilizando la navegación canónica.
3. Incluir organización activa, regreso a módulos, mantenedores y cierre de sesión dentro del drawer.
4. Convertir la vista de listado del calendario en tarjetas legibles en móvil, evitando depender de una tabla horizontal de 780 px.
5. Asegurar que acciones de calendario y controles DIGEN se apilen con ancho completo en pantallas estrechas.
6. Añadir pruebas estáticas del contrato responsive del shell y calendario.

## Risks

- Duplicar la definición de navegación entre desktop y mobile puede provocar divergencia; ambos deben renderizarse desde las mismas estructuras.
- El drawer debe quedar por encima del contenido y controles globales sin bloquear el cierre.
- El cambio de presentación del listado debe conservar todas las columnas semánticas disponibles en escritorio.
- Los botones de revisión DIGEN deben mantener objetivos táctiles cómodos.

## Verification

- Pruebas Node del contrato de navegación móvil y CSS responsive.
- Lint del frontend.
- Build de producción.
- Vercel preview.
- Verificación visual a 320, 375, 414, 768 y escritorio.
