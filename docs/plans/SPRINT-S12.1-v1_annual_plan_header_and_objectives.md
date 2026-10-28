# S12.1 — Plan Anual: encabezado legible y edición de objetivos sin valores nulos

**28/10/2026 · Corrección urgente solicitada por el responsable del producto.**

## Defectos reproducibles
1. En pantallas de escritorio de ancho intermedio (captura 1470 px), el encabezado pone el bloque del título al 100% mientras cuatro botones compiten en la misma fila. Su ancho termina extremadamente reducido; el texto se apila verticalmente y la altura se extiende casi toda la pantalla.
2. Objetivos existentes tienen `description = null` cuando no se proporcionó. El editor mezcla datos crudos con su estado de formulario; al guardar ejecuta `objectiveForm.description.trim()`, que lanza `Cannot read properties of null (reading 'trim')`.
3. La rutina de guardar objetivo borra asignaciones previas con `objective_unit_assignment.delete().eq('objective_id', data.id)`, lo que puede eliminar asignaciones de apoyo a otras unidades. No debe alterar relaciones que no está editando.
4. Los controles de cortes de 2027 y creación de actividades deben seguir operativos sin invadir el encabezado ni generar colisiones de diseño.

## Diseño y datos
- Encabezado con título en su propia fila y controles horizontales fluidos con `flex-wrap`, anchos intrínsecos y sin estirar alturas. En móvil, rejilla de una columna bajo 480 px y dos entre 480–720 px, textos legibles y sin desbordamientos. No modificar globalmente cabeceras de otros módulos.
- Normalizar datos del objetivo al entrar al formulario; strings siempre definidos, incluyendo código, título, descripción, nivel, estado y peso. Recortar datos de texto a la hora de guardar, tolerar null en cualquier actualización. Mostrar error claro si falta título.
- Preservar relaciones de objetivos existentes: insertar solo la relación `responsible` de la unidad seleccionada cuando no existe; conservar las demás. No borrar asignaciones de direcciones que no son parte del formulario.
- Evitar cambios de esquema o permisos. `edifydb` sigue requiriendo validación futura si se necesitara SQL; esta corrección solo toca código cliente.

## Pruebas
Tests Node de normalización null/undefined, controles CSS header desktop/tablet/móvil, defensa de asignaciones, lint, build y suite de regresión. Prueba visual de 1470, 1024, 768, 375 px cuando haya navegador autenticado; no fingir prueba E2E sin sesión.
