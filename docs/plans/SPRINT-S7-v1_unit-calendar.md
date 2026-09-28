# SPRINT-S7 — Calendario institucional por Dirección

## Objetivo
Integrar el calendario anual aprobado como un módulo tenant-scoped de Planificación, reutilizando `unit_work_activity`.

## Reglas
- Cada Dirección/agencia ve y modifica únicamente sus propias actividades.
- DIGEN ve el consolidado institucional y administra sus propias actividades.
- El calendario reutiliza Plan Anual, objetivos e indicadores; no crea un dominio paralelo.
- El botón “Vaciar calendario” borra únicamente las actividades del año y unidad administrada por el usuario, con confirmación.
- El módulo se registra como renombrable.

## Base de datos
- Nueva preferencia `organization.calendar_module_label`.
- Nuevas funciones privadas de autorización de calendario.
- RLS de `unit_work_activity` endurecida por unidad, con lectura consolidada para DIGEN.
- RPC estrecho para renombrar el módulo.

## Verificación
- pgTAP de políticas y privilegios.
- Prueba transaccional de aislamiento entre dos unidades y lectura DIGEN.
- Build de frontend y preview de Vercel.
- Advisors de seguridad y rendimiento.
