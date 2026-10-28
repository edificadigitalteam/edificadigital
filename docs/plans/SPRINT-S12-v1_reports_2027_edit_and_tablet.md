# S12 · Informes de gestión 2027 y rendición GEN/DIGEN

**28 de octubre de 2026. Estado: desarrollo urgente y pruebas.**
Alcance: informes de corte, Plan Anual (accesos a Calendario), interfaz responsive tablet.

1. Borrador disponible desde la primera línea escrita, incluso antes de vincular un objetivo; envío final valida resultados y sus vínculos. Conservar borrador a través del guardado y de los cambios de cortes.
2. Destino prioritario de rendición: GEN/DIGEN. DIAF participa solo si se indica revisión financiera. El sistema actual tiene `submitted_to_unit_id` único y una RPC `save_unit_management_report_v4` que obliga DIAF; requiere migración de autorización y de enrutamiento, o mantener claramente esa operación pendiente mientras se corrige el frontend.
3. Plan Anual conserva nuevo objetivo. Actividades se registran solo en Calendario, vinculadas al objetivo; Plan Anual muestra las actividades ya registradas y enlace al Calendario.
4. Gestión 2027: Marzo (ene–mar), Julio (abr–jul), Noviembre (ago–nov), Anual (ene–dic), según el RPC anual ya implementado. Administrador puede crear/completar el ciclo sin alterar cortes anteriores; el anual debe estar disponible.
5. Tabla: max-width y min-width 0 para contenedores, selectores, tarjetas, cabecera y grids, entre 720 y 1100px y en tamaños móviles.
6. «Próximos pasos» se acompaña de explicación y ejemplo específico: acciones que ejecutará la Dirección en el siguiente período, con responsable/meta/fecha si aplica.
7. Vista de recepción: GEN/DIGEN pueden ver las Direcciones individualmente o un consolidado de todas, imprimir de forma legible y editar redacción con permisos reales (RPC y RLS). DIAF solo como recepción/revisión financiera cuando proceda.

**Punto crítico de infraestructura:** el conector Supabase de esta conversación responde `You do not have permission` al proyecto autorizado `edifydb` (`rrqyihsjftlloizsccvi`). No aplicar SQL a otros proyectos; no mezclar frontend que dependa de una migración no aplicada. Verificar migración por CI Database checks en stack local, pgTAP, y solicitar permiso de la cuenta al proyecto real para activar las funciones que cambian autorización/RPC. Los arreglos independientes de BD pueden desplegarse por separado si se aprueban y la CI está correcta. Mantener la impresión y edición de calendarios intactas.

Tests: Node para borrador incompleto y rutas, fechas 2027, fuentes, CSS responsive; SQL con permisos reales de GEN/DIGEN y filtros de visibilidad; lint, build, pruebas CI, revisión navegador si está disponible.