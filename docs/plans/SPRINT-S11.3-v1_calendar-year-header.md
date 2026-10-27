# S11.3 · Encabezado anual editable en todas las vistas del Calendario

**Fecha:** 2026-10-27. **Tipo:** mejora aislada con publicación solicitada por el responsable del producto.

## Objetivo
Al seleccionar Gestión 2026, 2027 u otra, mostrar cuatro datos específicos de ese período: «Proyecto de Calendario» y año, «Plan quinquenal», «Pilar anual» y «Texto Bíblico»; editables con los permisos ya existentes de administración de períodos. Mostrar tanto en Calendario anual como Listado y Presentación, incluida pantalla completa, donde las letras serán grandes. Solo se rellena el año automáticamente; los otros contenidos se cargan por responsables, sin inventarlos.

## Persistencia y datos
La conexión de este agente al proyecto Supabase `edifydb` (`rrqyihsjftlloizsccvi`) responde «You do not have permission». Para publicar sin desplegar esquemas sin verificar, **no se introduce una migración**: se reutiliza `management_period.notes` (campo de texto ya existente), con un bloque JSON delimitado y versionado al final para los cuatro valores. Se conserva literalmente el resto de las notas del período. El editor de Períodos y objetivos oculta esta estructura y la conserva durante sus propios guardados. Ninguna otra tabla, función o política cambia.

Seguridad: el `UPDATE` se realiza sobre `management_period` restringiendo por `organization_id` e `id`. Se reutiliza la política RLS existente `private.can_manage_organization` (solo tenant-admin); el resto de los usuarios consulta el encabezado. GEN y DIGEN sin privilegio de gestión podrán leerlo, mientras la administración de períodos podrá editarlo.

## Diseño y alcance
Encabezado institucional armonizado en tres vistas, títulos legibles, cuatro etiquetas, edición en formulario compacto. Presentación conserva el encabezado aun en pantalla completa. Color `pending`: fondo azul gris muy claro, borde azul gris y texto azul oscuro; `validated` verde y `observed` rojo como antes.

## Verificación
Tests Node para serialización, conservación de notas, independencia de años, validación y diseño; GitHub Actions frontend tests + lint + build. Comprobar que el cambio visual está presente en la página antes de merge. Validación manual de roles, refresco, fullscreen y gestiones 2026/2027 recomendada con sesiones reales.
