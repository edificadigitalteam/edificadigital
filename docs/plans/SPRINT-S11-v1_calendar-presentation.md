# SPRINT S11 · Presentación mensual del Calendario institucional

**Fecha:** 2026-10-27  
**Estado:** Desarrollo en rama para revisión.

## Necesidad
En la vista de Calendario, mantener las opciones actuales de alcance (Mi calendario / Consolidado institucional) y de formato (Calendario anual / Listado), y añadir una tercera vista **Presentación**. La utilizarán en una reunión presencial con público, incluidos adultos mayores y participantes con dificultades visuales.

## Alcance del diseño y producto
- **Mismo módulo tenant** y misma ruta `/app/management/calendar`; no se crea otro módulo, permiso ni mantenedor. Permanece el nombre configurado del Calendario.
- Navegación de doce meses, uno a la vez, con flechas anterior/siguiente, selector de mes, año/gestión y total de actividades del mes.
- Actividades por fecha en tarjetas grandes, claras y legibles a distancia, mostrando fecha, Dirección, nombre y estado. Contraste elevado, tipografía proyectable, espacio suficiente y botones amplios.
- Acción **Ampliar presentación** usando pantalla completa del navegador, con botón para salir. Accesible con teclado y en móvil.
- **Edición directa sobre la tarjeta** para usuarios ya autorizados: nombre, inicio y fin; guardar y cancelar sin abandonar el mes ni la presentación. Validación de fechas y controles de permisos reales RLS. Control de validación/observación se mantiene disponible para quien tenga permiso.
- Actualización automática del consolidado existente cada 12 s y botón manual, también en presentación. Los espectadores solo leen. Se preservan 2026/2027 y ES/EN.
- Los cambios de fecha pasan a su mes correspondiente después de guardar. No se modifica el comportamiento de Calendario anual ni Listado.

## Base de datos
**Sin cambios de esquema:** reutiliza `unit_work_activity`, `calendar_access_overview`, el esquema RLS existente y `review_calendar_activity`. **No hay migración** ni acceso a datos de otros proyectos.

## Riesgos y validación
1. Un administrador autorizado edita y guarda fechas/título durante la reunión sin perder la vista.
2. Un usuario de solo lectura recibe la presentación sin botones de edición.
3. Cambio de mes, año, alcance y cambio de mes después de guardar; textos largos y meses vacíos.
4. Visibilidad del botón de fullscreen, salida mediante Escape o botón, diseño de 320/375/414/768 CSS px y escritorio.
5. Verificar por CI pruebas de agrupación/orden/fechas, lint, build y pruebas de regresión. Comprobar vista en entorno previo al despliegue.
6. Revisar PR por humano antes de mezclar con `main`; tras aprobar, desplegar y probar en producción.

## Archivos previstos
`frontend/src/features/calendar/ManagementCalendarPage.jsx`,
`CalendarPresentationView.jsx`, `presentation.js`, `presentation.test.js`,
`management-calendar.css`, `docs/plans/INDEX.md`, este plan.
