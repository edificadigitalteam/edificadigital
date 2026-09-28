# SPRINT-S7 · Calendario institucional preliminar

## Outcome

Integrar el calendario preliminar aprobado como módulo tenant-scoped de Gestión Organizacional, reutilizando `unit_work_activity` y el Plan Anual.

## Scope decisions

- Plane: tenant only.
- Placement: Planificación → Calendario.
- Default module name: Calendario; tenant-renamable through Mantenedores.
- Standard unit member: reads and edits only activities belonging to units where they hold an active calendar-capable membership.
- DIGEN member: reads the institutional consolidated calendar and reviews activities; edits only DIGEN's own activities.
- Joint review: DIGEN can temporarily enable a read-only consolidated view for all unit members in one management period.
- Production reset: “Vaciar calendario” only removes activities from the current unit/work plan after explicit confirmation.

## Database changes

1. `organization.calendar_module_label text` with 60-character limit.
2. `management_period.calendar_joint_review_enabled boolean`, plus audit fields for who enabled it and when.
3. `unit_work_activity` gains:
   - `modality` (`in_person | virtual | hybrid`)
   - `review_status` (`pending | validated | observed`)
   - `review_note`
   - `reviewed_by`
   - `reviewed_at`
4. Private helpers for calendar membership, DIGEN oversight and joint-review visibility.
5. Replace `unit_work_activity` RLS policies so organization-wide select access is removed.
6. Authenticated-only RPCs:
   - `calendar_access_overview`
   - `review_calendar_activity`
   - `set_calendar_joint_review`
   - `admin_set_calendar_module_label`

## Frontend changes

- New `/app/management/calendar` page matching the approved Somos Edifica visual language.
- Calendar and list views.
- Activity form linked to annual objective and optional indicator.
- Preliminary status and DIGEN validation/observation controls.
- DIGEN consolidated view.
- Joint review view when DIGEN authorizes it.
- Safe per-unit/per-year reset.
- Navigation entry and renameable-module registration.
- ES/EN parity.

## Risks

- RLS regression could expose one unit's activities to another.
- DIGEN review must not grant edit rights over other units.
- Joint review must be period-scoped and read-only for ordinary units.
- Existing Plan Anual activity forms must continue to work under tightened policies.
- Bulk reset must never delete another unit's activities.

## Verification

- pgTAP schema/security assertions.
- Pure frontend tests for visibility and display logic.
- Transactional live verification with rollback if local Supabase is unavailable.
- Security and performance advisors.
- Frontend test, lint and production build.
- Vercel preview before merge.
