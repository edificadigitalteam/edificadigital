# S11.2 · Vista Presentación institucional tipo cuadro CNBV

**Fecha:** 2026-10-27  
**Estado:** En desarrollo, para revisión del Director General.

## Referencia aprobada para el diseño
Archivo compartido: `Proyecto de Calendario 2026 CNBV (3).pdf` (4 páginas), particularmente los encabezados mensuales azul marino y las columnas `fecha / actividad / responsables`. El archivo contiene lemas de 2026 sin equivalentes 2027 en la BD; conservar los títulos por mes, sin inventar lemas. La estructura anual completa es una tabla continua desplazable, con cada mes como sección propia.

## Comportamiento
- Se modifica **solo la pestaña Presentación** de Calendario. El calendario anual y el listado quedan intactos.
- Se muestra la gestión seleccionada, los doce meses consecutivos y todas las actividades visibles según alcance `Mi calendario` / `Consolidado institucional`.
- Cabecera institucional, barras por mes azul marino; tabla de 3 columnas (día o intervalo, nombre completo de la actividad, Dirección + persona responsable registrada). Si `responsible_name` está vacío, mostrar únicamente Dirección; nunca inventar nombres.
- Tipografía mayor que el listado, alto contraste, vista ampliable a pantalla completa, selector de mes que **desplaza** a esa sección sin ocultar los otros meses, scroll vertical. Móvil adaptativo.
- Fondo y distintivos con texto: ámbar = `pending` (pendiente de revisión), verde = `validated`, rojo = `observed`. Los colores no sustituyen al texto.
- Cada fila habilitada para editar directamente **título, fechas y responsable registrado**, con validaciones del período, guardado confirmado, cambios visibles en lista y calendario, permisos RLS existentes.
- Operadores con permiso de revisión pueden validar, observar o devolver una actividad al estado pendiente sin salir de la tabla. Los de solo lectura ven la tabla sin acciones.
- Actualización automática de actividades mientras está activa la presentación, más botón manual; reutiliza polling de 12 s existente.
- Evitar que al elegir presentación con permiso consolidado solo aparezca la unidad personal: abrir en `Consolidado institucional` si está autorizado, sin alterar accesos.
- No eliminar actividades ni modificar los datos de terceros mediante esta vista.

## Datos / seguridad
No requiere nuevas tablas, vistas, RPC ni migración. Utiliza `unit_work_activity`, campo opcional `responsible_name`, `review_status`, `review_calendar_activity` y `calendar_access_overview`. Las autorizaciones son las de base de datos y las de la pantalla existente.

## Validación
- Pruebas de calendario mensual y formato de intervalos; estados conocidos y desconocidos; filas reordenadas al cambiar fechas y responsables guardados.
- Frontend GitHub Actions: pruebas feature, lint, build y suite amplia informativa.
- Revisión manual requerida: nombres largos, meses vacíos, 83+ filas, móvil, proyector, fullscreen, accesibilidad, permisos de edición, edición concurrente y pestañas existentes.
- PR para aprobación humana. **No publicar automáticamente** hasta recibir aceptación del diseño y aprobación de integración.
