# Database Reference

## Current state

The Edifica Digital operational database is deployed in Supabase project `edifydb` (`rrqyihsjftlloizsccvi`). Checked live on 2026-10-27 (84 entries in migration history, latest `20261027170000`), the schema contains 58 `public` tables, every one with RLS enabled, and the security-invoker view `inventory_lot_balance`. The `private` schema, which the API does not expose, holds `beneficiary` and `beneficiary_event` (forced RLS), `operator_access`, and `record_change_log`. Storage has two private buckets: `attachments` (20 MB) and `project-evidence` (50 MB).

All database identifiers and stored enum-like values use English `snake_case`. Spanish and English belong in interface content, catalog display names, exports, and reports.

## Applied migrations

One row per entry in the `edifydb` migration history (`supabase_migrations.schema_migrations`), in version order, checked with `list_migrations` on 2026-10-27: 84 entries, latest `20261027170000`. Every file in `supabase/migrations/` maps to exactly one entry.

- **Repository file vs. recorded version.** Before 2026-10-22, many files were named with a different timestamp from the one Supabase recorded (for example `20260727030000_operator_invitation_email_delivery.sql` is recorded as `20260727180037`). Those files stay as they are, because applied migrations are immutable; since then every new file is renamed to its recorded version (AGENTS.md → "Applying a migration", step 4).
- **Name differences.** `in_kind_shipment_inventory` is the file `202607190001_in_kind_shipment.sql`, and `reinstall_pg_net_in_extensions_schema` is `20260727031500_move_pg_net_to_extensions_schema.sql`.
- **Entries without a file.** `install_pgtap_for_database_tests` and `rename_pgtap_install_migration_label` exist only in history.

| # | Repository file | Recorded version (`name`) | Purpose |
|---|---|---|---|
| 1 | `202607190000_foundation_schema.sql` | `20260719023955` (`foundation_schema`) | Actors, donations, transformations, impact, catalogs, evidence, RLS, and Storage |
| 2 | `202607190001_in_kind_shipment.sql` | `20260719024051` (`in_kind_shipment_inventory`) | Containers, declared goods, received lots, movements, and shipment evidence |
| 3 | `202607190002_optimize_rls_and_foreign_keys.sql` | `20260719024250` (`optimize_rls_and_foreign_keys`) | Foreign-key indexes and scalar RLS predicates |
| 4 | `202607190003_harden_rls_predicates.sql` | `20260719024455` (`harden_rls_predicates`) | Explicit authenticated-user predicates for every operational table |
| 5 | `20260719031418_authenticated_submission.sql` | `20260719032341` (`authenticated_submission`) | Operator allow-list, audit fields, idempotent RPC, evidence access, and current RLS predicates |
| 6 | `20260719041213_monetary_beneficiary_foundation.sql` | `20260719042721` (`monetary_beneficiary_foundation`) | Multi-currency receipt details, authenticated monetary submission, and protected beneficiary identity and participation |
| 7 | `20260719042848_optimize_monetary_beneficiary_foreign_keys.sql` | `20260719042930` (`optimize_monetary_beneficiary_foreign_keys`) | Covering indexes for the new reconciliation and beneficiary audit foreign keys |
| 8 | `20260720012316_beneficiary_impact_interfaces.sql` | `20260720012316` (`beneficiary_impact_interfaces`) | Synced into the repository on 2026-09-17 from the applied Supabase history, where it had no repository counterpart. Adds the impact-event interface columns (reference code, submission key, event name, location, delivered summary, evidence acknowledgement), the `impact_donation` link table with its RLS policy and grants, the private delivery-evidence columns on `impact_event_attachment`, the five delivery media types, the `attachments` bucket limits, and `submit_impact_evidence(jsonb)`. Body copied verbatim (md5 `837efc6416f522d042c7adf23f6ccbc1`) |
| 9 | `202607210001_operator_roles_and_profile.sql` | `20260721144625` (`operator_roles_and_profile`) | Administrative operator roles: `private.is_authorized_admin()` and the first `public.current_operator_profile()` contract. Personal operator records stay provisioned directly in the protected database |
| 10 | `20260725220750_fix_operator_profile_and_admin_management.sql` | `20260725220750` (`fix_operator_profile_and_admin_management`) | Normalizes the `current_operator_profile` contract and adds the protected administrator RPCs `admin_list_operator_access` and `admin_save_operator_access` |
| 11 | `20260725220918_fix_admin_role_resolution.sql` | `20260725220918` (`fix_admin_role_resolution`) | Deployed follow-up that fixed a PL/pgSQL variable-name collision. The repository file is intentionally empty: the corrected definitions are consolidated in the preceding migration so fresh environments get the final contract in one pass |
| 12 | `20260725233000_operations_projects_volunteers.sql` | `20260725224009` (`operations_projects_volunteers`) | Operational expansion: `organization`, `project` and `volunteer` tables, organization assignment for donations, `private.is_super_admin` / `current_operator_organization_id`, `admin_save_organization` / `admin_list_organizations`, and the editable-record RPC `update_donation_record` |
| 13 | `20260725233500_project_compliance_foundation.sql` | `20260725224143` (`project_compliance_foundation`) | Project compliance foundation: `project_expense` and `project_document`, and first-organization assignment in `admin_save_organization` |
| 14 | `20260725234500_audit_editing_and_photo_evidence.sql` | `20260725225655` (`audit_editing_and_photo_evidence`) | Edit accountability: `updated_by` on donations, projects and volunteers, the `private.record_change_log` audit table with its triggers, and the `donation_change_history` RPC |
| 15 | `20260725235500_fix_donation_edit_rpc.sql` | `20260725230206` (`fix_donation_edit_rpc`) | Corrective: fixes ambiguous identifiers in `update_donation_record` |
| 16 | `20260726001000_tenant_isolation_and_project_execution.sql` | `20260725234735` (`tenant_isolation_and_project_execution`) | Multi-tenant isolation: `organization_host` with `resolve_tenant_host` / host admin RPCs, the `private.can_access_*` tenant helpers, tenant ownership backfill, tenant-bound policies replacing broad authenticated ones (including Storage), and `project_output` for tangible project execution |
| 17 | `20260726002000_preserve_record_creators.sql` | `20260725235702` (`preserve_record_creators`) | Keeps `created_by` unchanged when operational records are edited (`private.preserve_created_by`) |
| 18 | `20260726003000_complete_tenant_isolation_and_indexes.sql` | `20260726000218` (`complete_tenant_isolation_and_indexes`) | Completes tenant isolation on inventory, delivery and impact tables, makes reference catalogs operator-readable and super_admin-managed, consolidates overlapping policies per command, and indexes tenant and reporting foreign keys |
| 19 | `20260726004000_project_execution_evidence.sql` | `20260726002329` (`project_execution_evidence`) | Multimedia evidence for project execution records: `project_output_evidence` with its validation trigger |
| 20 | `20260726005000_project_metrics_beneficiaries_and_units.sql` | `20260726010611` (`project_metrics_beneficiaries_and_units`) | Project execution summaries (`project_compliance_summary`, `current_operations_summary`), optional nominal project beneficiaries (`list_project_beneficiaries`, `save_project_beneficiary`) and catalog-backed units for compliance records |
| 21 | `20260726006000_fix_project_beneficiary_rpc.sql` | `20260726012238` (`fix_project_beneficiary_rpc`) | Corrective: replaces `list_project_beneficiaries` with its fixed column contract |
| 22 | `20260726010000_donor_directory_funding_reconciliation_and_billing.sql` | `20260726015900` (`donor_directory_funding_reconciliation_and_billing`) | Donor directory (`list_donor_directory`, `save_donor_directory`, seeded from existing partner names), project funding reconciliation, the SaaS billing model (`subscription_plan`, `organization_subscription`, `subscription_payment`, seat-limit trigger and admin billing RPCs), and the `_v2` donation submission RPCs |
| 23 | `20260726000900_fix_impact_event_created_by.sql` | `20260727162526` (`fix_impact_event_created_by`) | Corrective: adds `impact_event.created_by`, missing since the tenant-isolation migration backfills it but no prior migration created it |
| 24 | `20260726002500_fix_missing_impact_donation_table.sql` | `20260727162538` (`fix_missing_impact_donation_table`) | Corrective: recreates `public.impact_donation` (deployed to `edifydb` outside a versioned migration) so migration history replays from scratch |
| 25 | `20260727010000_organization_admin_provisioning.sql` | `20260727162602` (`organization_admin_provisioning`) | `organization.contact_email` becomes required and unique; adds `operator_access` activation columns (`activation_token`, `activation_token_expires_at`, `email_confirmed_at`); `admin_save_organization` auto-provisions a pending `admin` operator for the new organization's contact email instead of self-assigning the calling super_admin; new `confirm_operator_activation(token)` RPC; `is_authorized_operator()` now also requires a confirmed email |
| 26 | `20260727020000_operator_invitation_management.sql` | `20260727170259` (`operator_invitation_management`) | Corrective: `admin_save_operator_access` insert path now also provisions an activation token (it previously left new operators permanently unconfirmable); `admin_list_operator_access` exposes `email_confirmed_at` and `can_resend_invitation`; new `resend_operator_activation(operator_id)` RPC (super_admin only) rotates the token for an unconfirmed operator — actual email delivery is a separate follow-up, pending a transactional email provider |
| 27 | `20260727030000_operator_invitation_email_delivery.sql` | `20260727180037` (`operator_invitation_email_delivery`) | Enables `pg_net`; new `private.notify_operator_invitation(operator_id)` calls the `send-operator-invitation` Edge Function (Resend) via `pg_net`, authenticated using `project_url`/`service_role_key` stored in Supabase Vault (never in source or migrations); wired into `admin_save_organization`, `admin_save_operator_access` (insert), and `resend_operator_activation`; best-effort — silently no-ops if Vault secrets are absent, so it never blocks operator/organization creation |
| 28 | `20260727031500_move_pg_net_to_extensions_schema.sql` | `20260727180314` (`reinstall_pg_net_in_extensions_schema`) | Corrective: `pg_net` does not support `ALTER EXTENSION ... SET SCHEMA`; reinstalled in the `extensions` schema (matching `pgcrypto`, `uuid-ossp`) to clear the "extension in public" security advisory. `net.http_post` lives in its own `net` schema regardless, so no application code changed |
| 29 | `20260727040000_organization_language_preference.sql` | `20260727183218` (`organization_language_preference`) | `organization.language` (`'es'\|'en'`, default `'en'`) added; `admin_save_organization` validates/persists it; `admin_list_organizations` exposes it (required a `drop function` first — Postgres rejects adding an OUT column via `create or replace`); `notify_operator_invitation` forwards it to the Edge Function so invitation email is sent in a single language matching the organization, not bilingual |
| 30 | `20260727040500_fix_admin_list_organizations_grants.sql` | `20260727183605` (`fix_admin_list_organizations_grants`) | Corrective: the `drop function`/`create function` in the previous migration silently wiped `admin_list_organizations`'s grants, briefly re-exposing it to `anon`; reinstates `revoke ... from public, anon` / `grant ... to authenticated` |
| 31 | `20260729010000_operator_profile_confirmation_consistency.sql` | `20260729144800` (`operator_profile_confirmation_consistency`) | Corrective: `current_operator_profile()` now requires `email_confirmed_at`, matching `private.is_authorized_operator()`, so the frontend and the RPC gate agree on who is authorized |
| 32 | `20260729020000_login_confirmation_gate.sql` | `20260729150305` (`login_confirmation_gate`) | Adds `request_login_access`, which blocks the magic-link login for an operator whose email is not confirmed yet, reusing the activation-token and invitation email path |
| 33 | `20260730010000_operator_list_organization_scoping.sql` | `20260729175220` (`operator_list_organization_scoping`) | Security fix: `admin_list_operator_access()` returned every organization's operators to any `admin`; it now scopes `admin` callers to their own organization and keeps the full list for `super_admin` |
| 34 | `20260815194500_organizational_management_foundation.sql` | `20260815234013` (`organizational_management_foundation`) | Organizational Management foundation: `organization_unit`, `organization_unit_member`, `management_period`, `institutional_objective`, `objective_unit_assignment`, `management_indicator`, `indicator_progress` and unit management reports, with `private.can_manage_organization` / `can_manage_unit` / `current_operator_access_id`, plus the CNBV demo seed |
| 35 | `20260815201500_organizational_management_integrity_guards.sql` | `20260815235321` (`organizational_management_integrity_guards`) | Tenant-consistency validation triggers for units, objectives, indicators, progress, reports and project links, and stricter report-approval rules (`guard_unit_report_status`) |
| 36 | `20260816020000_indicator_progress_responsibility.sql` | `20260816015841` (`indicator_progress_responsibility`) | Adds an explicit responsible person (`responsible_name`) to indicator progress entries; existing rows are marked as historical |
| 37 | `20260816030000_project_supporting_documents_and_media.sql` | `20260816020934` (`project_supporting_documents_and_media`) | Project beneficiary documents and media evidence (`project_beneficiary_document`, `project_media_evidence`) with file validation, and wider allowed MIME types on the attachments bucket (video, spreadsheets, CSV) |
| 38 | `20260816041000_unit_teams_and_beneficiary_requirements.sql` | `20260816041204` (`unit_teams_and_beneficiary_requirements`) | Unit teams in `admin_save_organization_unit_v2` (members with roles and access provisioning), `project_output.output_type` (delivery, beneficiary documentation, reporting requirement) and wider evidence MIME types |
| 39 | `20260816042500_explicit_subscription_seat_limits_only.sql` | `20260816041731` (`explicit_subscription_seat_limits_only`) | Corrective: the seat-limit trigger applies only when the organization has an explicit commercial subscription with a seat limit |
| 40 | `20260902230000_diaf_finance_and_structured_unit_reports.sql` | `20260902224841` (`diaf_finance_and_structured_unit_reports`) | DIAF institutional finance (`finance_fund`, `finance_submission`, attachments, movements, transfers and their RPCs) and structured management report items (`save_unit_management_report_v2`). Applied to `edifydb` before the repository file was committed |
| 41 | `20260902230500_fix_report_item_scope_v2.sql` | `20260902225642` (`fix_report_item_scope_v2`) | Corrective: fixes report item scoping in `save_unit_management_report_v2` |
| 42 | `20260902231000_harden_finance_rpc_execute_privileges.sql` | `20260902230046` (`harden_finance_rpc_execute_privileges`) | Revokes `public`/`anon` execute on the finance RPCs and `save_unit_management_report_v2`, granting `authenticated` only |
| 43 | `20260902231500_index_diaf_finance_audit_foreign_keys.sql` | `20260902230140` (`index_diaf_finance_audit_foreign_keys`) | Covering indexes for the DIAF finance and report audit foreign keys |
| 44 | `20260903013000_finance_resource_requests.sql` | `20260903011300` (`finance_resource_requests`) | Finance resource requests (`finance_resource_request`) with save, review and release RPCs |
| 45 | `20260903023000_unify_indicator_reporting_and_diaf_review.sql` | `20260903020919` (`unify_indicator_reporting_and_diaf_review`) | Links report items to indicators, adds report destination and reviewer/approver columns, `private.can_review_management_reports` and `save_unit_management_report_v3` for DIAF review |
| 46 | `20260903023100_allow_diaf_report_approval_and_backfill_destination.sql` | `20260903021720` (`allow_diaf_report_approval_and_backfill_destination`) | Lets DIAF reviewers approve reports in `guard_unit_report_status` and backfills the destination unit of submitted reports |
| 47 | `20260917013756_annual_work_plans_report_windows_and_objective_metrics.sql` | `20260917013756` (`annual_work_plans_report_windows_and_objective_metrics`) | Annual work plans (`unit_work_plan`), the activity calendar (`unit_work_activity`), report windows (`management_report_window`) and objective-linked report items, with `private.can_manage_work_plan` and a newer report RPC |
| 48 | `20260917020029_indicator_kind_for_annual_work_plans.sql` | `20260917020029` (`indicator_kind_for_annual_work_plans`) | Adds `management_indicator.indicator_kind` (`result`, `output`, `process`, `impact`) with its check and index |
| 49 | `20260917020112_create_annual_management_cycle_rpc.sql` | `20260917020112` (`create_annual_management_cycle_rpc`) | Adds `create_annual_management_cycle(organization, year)`, which creates the year's management period, its report windows and each unit's work plan in one call |
| 50 | `20260917021540_save_unit_work_objective_rpc.sql` | `20260917021540` (`save_unit_work_objective_rpc`) | Adds `save_unit_work_objective` to create or update an annual-plan objective |
| 51 | `20260917024315_fix_save_unit_work_objective_ambiguity.sql` | `20260917024315` (`fix_save_unit_work_objective_ambiguity`) | Corrective: fixes an ambiguous column reference in `save_unit_work_objective` |
| 52 | `20260917031741_add_digen_and_management_report_oversight.sql` | `20260917031741` (`add_digen_and_management_report_oversight`) | Authored in PR #105 and merged to `main` on 2026-09-17, shortly after this branch had reconstructed the same file from the applied Supabase history; the authored version is the one kept. Seeds the DIGEN directorate for the `cnbv` organization and reparents the other directorates under it, adds `private.can_view_all_management_reports`, replaces `public.management_report_access_overview`, and widens the select policies on `unit_management_report` and `unit_management_report_item` so DIGEN and report reviewers see the consolidated reports. The file differs from the applied statement only by two comment lines. Replaying it against a database without the `cnbv` organization fails by design, since its opening block raises `CNBV organization not found` |
| 53 | `20260917034500_indicator_preferred_chart.sql` | `20260917034824` (`indicator_preferred_chart`) | `management_indicator.preferred_chart` added: an optional visualization override, nullable with no default, guarded by a check over the seven chart forms. Null means the chart is chosen from `metric_type`, `aggregation_method` and the presence of a target, so every pre-existing indicator keeps its current behavior. No RLS change (the table's organization-scoped policies already cover it) and no index (the column is never filtered or joined on). Verified on `edifydb`: column nullable with no default, constraint present, 6 existing indicators all null; security and performance advisors report no new findings |
| 54 | `20260902234500_optional_unit_leader_access.sql` | `20260917040334` (`optional_unit_leader_access`) | Updates `admin_save_organization_unit_v2` so a leader requires only a display name; email remains optional unless `leader.create_access` is true, and operator provisioning, invitation, and primary membership occur only when access is requested. Written on 2026-09-02 but left unapplied until 2026-09-17, so the Supabase history records it under that later timestamp rather than the file's own. Applied body is byte-identical to the repository file (md5 `daa73bf22a19afb66b68cae648d8c62f`). The only prior definition of the function came from `20260816041204`, so nothing newer was overwritten. Verified after applying: `create_access` handling present, function still `security definer`, `authenticated` retains execute, `anon` does not; security advisors report no new finding |
| 55 | `20260917120000_member_directory_and_tenant_catalogs.sql` | `20260917170637` (`member_directory_and_tenant_catalogs`) | Member directory (Miembros) and the first tenant-configurable catalogs (Mantenedores). Adds `organization_member_category`, `organization_member_relationship_role`, `organization_member`, and `organization_member_relationship`, all tenant scoped with the `organization_unit` RLS shape, indexes on every domain foreign key (`organization_id`, `member_category_id`, `member_id`, `related_member_id`, `relationship_role_id`), and `authenticated`-only grants. Two triggers carry the rules a check constraint cannot express: a member's category must belong to the same organization and apply to its member type, and a relationship always runs from a person member to an organization member inside one tenant. Every organization — new ones through an `after insert` trigger, existing ones through a one-time backfill — starts with three categories (Organización, Iglesia, Persona) and three relationship roles (Pastor Principal, Miembro, Presidente) it can then rename, reorder, or deactivate. Also adds `organization.members_module_label`, the per-tenant module label, written by the organization's own admin through `admin_set_members_module_label(uuid, text)` because `public.organization` itself accepts super_admin updates only. Applied to `edifydb` on 2026-09-17; all four existing tenants (`cnbv`, `oalfa`, `org-123`, `org3test`) were backfilled with three categories and three roles each. Verified with the 54 pgTAP assertions in `supabase/tests/014_member_directory_and_tenant_catalogs_test.sql`, all passing. Advisors after applying: no new security finding, and on the performance side only INFO-level notices — eight `unindexed_foreign_keys` on the `created_by`/`updated_by` audit columns (the same pattern the rest of the schema carries, e.g. `indicator_progress_created_by_fkey`) and five `unused_index` notices that reflect the tables being empty |
| 56 | — | `20260917170721` (`install_pgtap_for_database_tests`) | pgTAP installed in the `extensions` schema so database tests can run against the deployed project. Kept deliberately, at the product owner's request, for future test runs; a third entry, `20260917171626` (`rename_pgtap_install_migration_label`), only corrects this one's recorded name. It adds no application object and produced no advisor finding. Note: pgTAP needs a writable transaction, which the read-only SQL path does not provide, so a run goes through the migration path and ends with a deliberate `raise exception` carrying the TAP output — that aborts the transaction, so fixture rows never commit and the run leaves no migration-history entry |
| 57 | — | `20260917171626` (`rename_pgtap_install_migration_label`) | History-only entry that corrected the recorded name of the pgTAP install. It has no repository file and adds no object |
| 58 | `20260917190000_member_celebration_and_membership_dates.sql` | `20260917185229` (`member_celebration_and_membership_dates`) | Two optional dates on a member. `organization_member.celebration_date` is one column with one meaning, "the date this member celebrates": a founding date when `member_type` is `organization`, a birthday when it is `person` — only the visible label changes, the schema does not branch. `organization_member.membership_since` records since when the member is part of the tenant, and belongs to the member rather than to a person↔organization relationship. Both `date`, nullable, complete dates or absent: partial dates were considered and dropped, so there is no precision column. No RLS change (the table's organization-scoped policies already cover every column) and no backfill. **No check constraint guards "not in the future"**, deliberately: a check expression must be immutable so it cannot read `current_date`, and a future date is a data-entry mistake rather than corrupt data — a tenant registering an affiliation that takes effect next month is reasonable — so that rule lives in the member form (`members.js`), not the database. This is the opposite call from the S5 category trigger, where a member pointing at another tenant's catalog is corrupt whoever wrote it. For a person the celebration date is a complete date of birth in `public`; see the scope-boundary section added to `docs/adr/ADR-004-protected-beneficiary-identity.md`. Applied to `edifydb` on 2026-09-17 with zero existing member rows. Verified with the 13 pgTAP assertions in `supabase/tests/015_member_dates_test.sql`, all passing. Advisors after applying are identical to the previous baseline: no new security finding, and on performance the same 53 INFO `unindexed_foreign_keys` and 3 WARN `auth_rls_initplan` as before — two plain columns add no index or policy finding |
| 59 | `20260928114500_institutional_calendar_privacy_and_review.sql` | `20260928155304` (`institutional_calendar_privacy_and_review`) | Institutional preliminary calendar on top of `unit_work_activity`. Adds the tenant-renamable calendar label, period-scoped joint-review authorization, activity modality and DIGEN review metadata, dedicated calendar authorization helpers, authenticated RPCs, and replaces the activity RLS policies so ordinary units read/write only their own work-plan activities while DIGEN can read the institutional consolidated calendar. Joint review temporarily widens SELECT only; it never grants cross-unit UPDATE/DELETE. |
| 60 | `20260928120000_calendar_audit_fk_indexes.sql` | `20260928160022` (`calendar_audit_fk_indexes`) | Adds covering partial indexes for `management_period.calendar_joint_review_enabled_by` and `unit_work_activity.reviewed_by`, the two audit foreign keys introduced by the calendar migration. |
| 61 | `20260928160000_unit_calendar_privacy_and_module_label.sql` | `20260928195822` (`unit_calendar_privacy_and_module_label`) | Records the later calendar privacy hardening that was applied to `edifydb` during production integration. It is retained verbatim for migration-history reproducibility; its SELECT policy temporarily superseded joint-review visibility. |
| 62 | `20260928200500_restore_calendar_joint_review_flow.sql` | `20260928200320` (`restore_calendar_joint_review_flow`) | Corrective migration applied immediately after integration: restores the approved `can_view_calendar_plan` / `can_manage_calendar_plan` RLS model, the 60-character module-label constraint, and removes the three superseded helper functions introduced by the hardening migration. Final behavior is own-unit editing, DIGEN consolidated oversight, and DIGEN-authorized temporary joint review. |
| 63 | `20260928210302_calendar_optional_objective.sql` | `20260928210302` (`calendar_optional_objective`) | Calendar activities may exist before a unit defines annual-plan objectives: the objective link becomes optional and is cleared when the objective is deleted |
| 64 | `20261001155518_pending_issues_tracking.sql` | `20261001155518` (`pending_issues_tracking`) | Adds `public.unit_pending_issue` (organization, management period, unit, title, description, `status`, `urgency`, optional `due_date`, automatic `completed_at`), the `private.can_access_pending_issue_unit` helper, the `guard_pending_issue_scope` trigger, unit-scoped RLS, and `public.pending_issue_access_overview(uuid)`. Tested by `supabase/tests/018_pending_issues_test.sql` |
| 65 | `20261001155746_pending_issues_rpc_security_invoker.sql` | `20261001155746` (`pending_issues_rpc_security_invoker`) | Runs `pending_issue_access_overview` with caller privileges (`security invoker`) instead of adding a public `SECURITY DEFINER` endpoint |
| 66 | `20261001155943_index_pending_issue_foreign_keys.sql` | `20261001155943` (`index_pending_issue_foreign_keys`) | Covering indexes for the `unit_pending_issue` period and unit foreign keys |
| 67 | `20261001120000_tenant_admin_resend_activation.sql` | `20261001160000` (`tenant_admin_resend_activation`) | `resend_operator_activation(uuid)` now accepts tenant `admin` callers for unconfirmed people in their own organization (super_admin keeps cross-tenant resend; operators and cross-organization targets are rejected with `42501`); `admin_list_operator_access()` returns `can_resend_invitation = true` for exactly those rows. Same signatures, grants unchanged. Tested by `supabase/tests/018_tenant_admin_resend_activation_test.sql` |
| 68 | `20261001214651_cnbv_general_level_unit.sql` | `20261001214651` (`cnbv_general_level_unit`) | Data-only, CNBV only. With the `GEN` unit created from the structure screen by the product owner, places every other active top-level CNBV unit (DIGEN, FBCC, STBV, UNJB, UFBMV, UNVBMV, UPBV) under `GEN` and renumbers `organization_unit.sort_order` in tree preorder (GEN 10 … UPBV 140) so flat unit lists match the organization chart. No schema, policy, function, or grant change; unit visibility is unchanged. Skips when `cnbv` is absent and fails when `GEN` is missing or duplicated. Tested by `supabase/tests/019_cnbv_general_level_unit_test.sql` (red 5/5 before, green 5/5 after); rehearsed in a rolled-back transaction before applying |
| 69 | `20261002193537_unit_hierarchy_visibility.sql` | `20261002193537` (`unit_hierarchy_visibility`) | Unit visibility follows the organization chart: a person sees their own units and every unit below them (`private.current_visible_unit_ids()`); tenant `admin` keeps organization-wide visibility; DIAF keeps its finance and management-report review exception (including reading indicators, plans and objectives). Alters the SELECT policies of `management_indicator`, `indicator_progress`, `unit_work_plan`, `objective_unit_assignment`, `institutional_objective`, `unit_management_report(_item)` and `unit_pending_issue`; moves `can_view_calendar_plan`, `can_access_finance_unit`, `can_view_all_management_reports`, `current_operator_is_digen`, the calendar review trigger, `review_calendar_activity`, `set_calendar_joint_review` and the three `*_access_overview` RPCs from the DIGEN-by-code rule to the hierarchy. Calendar review belongs to the units above the activity's unit; the joint calendar review is controlled by whoever sees every unit through membership. Adds `organization_unit_parent_unit_id_idx`. Write policies unchanged. Tested by `supabase/tests/020_unit_hierarchy_visibility_test.sql` (25/25 after applying) |
| 70 | `20261007182032_digen_pending_instructions.sql` | `20261007182032` (`digen_pending_instructions`) | DIGEN instructions in Pending issues: adds `unit_pending_issue.origin` (`unit` or `digen_instruction`) and `issued_by_unit_id` (indexed), `private.current_operator_is_digen_director(uuid)`, and `private.pending_instruction_target_unit_ids_json(uuid)` (every active unit except GEN and DIGEN). Only the active DIGEN director issues, rewrites, or deletes an instruction; the assigned unit can change only its status; a unit issue cannot become an instruction. Tested by `supabase/tests/021_digen_pending_instruction_test.sql` |
| 71 | `20261007182445_digen_pending_instruction_visibility_scope.sql` | `20261007182445` (`digen_pending_instruction_visibility_scope`) | Replaces `unit_pending_issue_select`: ordinary issues keep hierarchy-scoped visibility, the tenant `admin` reads every issue, and the DIGEN director reads every DIGEN instruction |
| 72 | `20261008145936_admin_unit_edit_access.sql` | `20261008145936` (`admin_unit_edit_access`) | Tenant `admin` (and `super_admin`) writes to every unit of its organization without unit membership: `private.can_manage_calendar_plan` and `private.can_access_pending_issue_unit` now also accept `private.can_manage_organization(organization_id)`. Calendar activity INSERT/UPDATE/DELETE and pending issue INSERT/UPDATE/DELETE policies inherit this through the helpers; admins can also update the status of a DIGEN instruction assigned to any unit. Issuing or rewriting DIGEN instructions stays with the DIGEN Director General (`guard_pending_issue_scope` unchanged), and calendar review stays with supervising units. Tested by `supabase/tests/022_admin_unit_edit_access_test.sql` (4/4 after applying); verified on `edifydb` with an admin without unit membership: true for every plan/unit of its organization, false for other organizations; `anon` cannot execute either helper. Advisors report no new findings. |
| 73 | `20261021142000_private_executive_evaluations_digen_calendar.sql` | `20261021142000` (`private_executive_evaluations_digen_calendar`) | SPRINT S10. Adds `public.executive_self_evaluation` (private director self-evaluations: SWOT up to 3 per category, 18 competencies, up to 7 achievements; `draft` → `submitted`, submitted rows immutable via `private.guard_executive_evaluation`), RLS with `executive_evaluation_read/insert/update_draft` (directors read and edit their own drafts; tenant `admin` and GEN/DIGEN leaders read submitted rows only), `organization.evaluation_module_label`, and `private.current_operator_is_gen_or_digen_leader(uuid)`. GEN/DIGEN leaders gain cross-unit read, edit and review in the institutional calendar (`can_manage_calendar_plan`, `can_view_calendar_plan`, `calendar_access_overview.can_edit_consolidated`, `guard_calendar_activity_review`, `review_calendar_activity`, `set_calendar_joint_review`, and the `unit_work_plan` / `institutional_objective` / `management_indicator` select policies); deleting activities stays with active unit members. Verified on `edifydb` with `supabase/scripts/verify_s10_evaluations_calendar_rollback.sql` (23/23 in a rolled-back transaction) before applying through the SQL Editor with an explicit history row; `anon` cannot read the table or execute the RPCs. |
| 74 | `20261022122717_executive_evaluation_evaluator_index.sql` | `20261022122717` (`executive_evaluation_evaluator_index`) | Covering index `executive_evaluation_evaluator_idx` for the `executive_self_evaluation.evaluator_user_id` foreign key, flagged by the performance advisor after S10. Tested by `supabase/tests/024_executive_evaluation_evaluator_index_test.sql` (failed before, 2/2 after applying); the advisor's unindexed-foreign-key count dropped from 52 to 51. |
| 75 | `20261022135016_calendar_admin_review_flags.sql` | `20261022135016` (`calendar_admin_review_flags`) | SPRINT S10.1 (#136). Replaces `public.calendar_access_overview(uuid, uuid)` so its flags match the review RPCs: `can_review` and `can_manage_joint_review` no longer come from the tenant `admin` role, and the new `can_review_consolidated` key is true for GEN/DIGEN leaders only. `can_edit_consolidated` and every other key are unchanged; the admin keeps cross-unit editing. Signature, `security definer`, `search_path` and grants are unchanged. Tested by `supabase/tests/025_calendar_admin_review_flags_test.sql` (6 of 24 failed with the previous definition, 24/24 after) on a local stack with every repository migration applied. Before applying, the migration plus the 24 assertions ran on `edifydb` in a rolled-back transaction (24/24). Applied on 2026-10-22 through `apply_migration`. Advisors were unchanged before and after (security 3/50/1, performance 51/3/124) |
| 76 | `20261022142118_tenant_admin_full_management_access.sql` | `20261022142118` (`tenant_admin_full_management_access`) | SPRINT S10.2 (#136, product owner decision 2026-10-22): the tenant `admin` (`private.can_manage_organization`) acts without restrictions. Calendar: `review_calendar_activity`, `set_calendar_joint_review` and `guard_calendar_activity_review` accept it; `unit_work_activity_delete` lets it delete in every unit; `calendar_access_overview` reports `can_review*` for it and adds `can_delete_consolidated`. Pending issues: new `private.can_issue_digen_instructions(uuid)` (DIGEN director or tenant admin) replaces the DIGEN-director check in `guard_pending_issue_scope`, `pending_instruction_target_unit_ids_json`, `pending_issue_access_overview` (still security invoker) and the four `unit_pending_issue` policies. Evaluation: `executive_evaluation_read` lets it read drafts; `evaluation_access_overview` adds `can_read_draft_evaluations` and includes it in `can_review_all_evaluations`. Every earlier permission is kept. Tested by `supabase/tests/026_tenant_admin_full_management_access_test.sql` (12 of 24 failed before, 24/24 after) and the updated 021, 022, 023 and 025 (415/415 locally). On `edifydb`, before applying, two rolled-back dry runs passed: the migration with 025 (24/24), and with 026 minus its 5 deletion checks (19/19). Statements with `DELETE` hit the connector's 60 s confirmation timeout; the deletion checks passed locally, and the live delete policies were verified. Applied on 2026-10-22 via `apply_migration`. Advisors had no new findings (security 3/50/1; performance 51/3/123) |
| 77 | `20261023161252_explicit_data_api_grants.sql` | `20261023161252` (`explicit_data_api_grants`) | SPRINT S8.2 (#123): explicit Data API grants ahead of Supabase's 2026-10-30 change, so a database rebuilt from migrations matches `edifydb`. `finance_fund`, `finance_submission`, `finance_transaction` and `finance_submission_attachment` get `select` only for `authenticated` (writes go through `SECURITY DEFINER` RPCs); `unit_management_report_item`, `unit_work_plan`, `unit_work_activity` and `management_report_window` get `select, insert, update, delete` for `authenticated`; all eight revoke everything from `public` and `anon`; `service_role` gets `select, insert, update, delete` on every `public` table and view. In `edifydb` it only dropped automatic privileges the app does not use (`anon` access, `TRUNCATE`/`REFERENCES`/`TRIGGER`, direct writes to `finance_*`). Tested by `supabase/tests/027_explicit_data_api_grants_test.sql` (12 of 20 failed before with the 2026-10-30 change simulated, 20/20 after; 435/435 locally). On `edifydb`, a rolled-back dry run of the migration with 027 passed 20/20 before applying on 2026-10-23 via `apply_migration`. Advisors had no new findings (security 3/50/1; performance 51/3/122) |
| 78 | `20261023163219_revoke_anon_table_privileges.sql` | `20261023163219` (`revoke_anon_table_privileges`) | SPRINT S8.3 (#141): revokes every privilege `anon` still held on 14 `public` tables (`finance_resource_request`, `indicator_progress`, `institutional_objective`, `management_indicator`, `management_period`, `objective_unit_assignment`, `organization_subscription`, `organization_unit`, `organization_unit_member`, `project_objective`, `project_organization_unit`, `subscription_payment`, `subscription_plan`, `unit_management_report`), including writes and `TRUNCATE` on 13 of them; RLS had blocked the rows. Resets `authenticated` to what each creating migration declared: `select, insert, update, delete` on the 10 management tables, `select` on the subscription tables and `finance_resource_request`; this dropped the unused `TRUNCATE`/`REFERENCES`/`TRIGGER` and direct writes on the select-only tables. `service_role` unchanged. Tested by `supabase/tests/028_revoke_anon_table_privileges_test.sql` (29/29 failed before, 29/29 after; 464/464 locally, also with the 2026-10-30 change simulated). On `edifydb`, a rolled-back dry run passed 29/29 before applying on 2026-10-23 via `apply_migration`; afterwards `anon` holds no privilege on any `public` table. Advisors had no new findings (security 3/50/1; performance 51/3/122) |
| 79 | `20261023164700_revoke_authenticated_maintenance_privileges.sql` | `20261023164700` (`revoke_authenticated_maintenance_privileges`) | SPRINT S8.4 (#143): revokes `TRUNCATE`, `REFERENCES` and `TRIGGER` from `authenticated` on every `public` table and view; `edifydb` still carried them on 35 tables and `inventory_lot_balance`. Also resets four objects to the privileges their creating migration declared, which match their RLS policies: no `delete` on `executive_self_evaluation`, no `update` on `project_media_evidence` and `project_beneficiary_document`, `select` only on `inventory_lot_balance`. Tested by `supabase/tests/029_revoke_authenticated_maintenance_privileges_test.sql` (37/37 failed before, 37/37 after; 501/501 locally, also with the 2026-10-30 change simulated). On `edifydb`, a rolled-back dry run passed 37/37 before applying on 2026-10-23 via `apply_migration`. Advisors had no new findings (security 3/50/1; performance 51/3/122) |
| 80 | `20261023165913_default_privileges_without_anon.sql` | `20261023165913` (`default_privileges_without_anon`) | SPRINT S8.5 (#144): the default privileges of `postgres` in `public` stop granting anything to `anon` on new tables and sequences (and drop the explicit `anon` entry for functions), and stop granting `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` to `authenticated` on new tables. Revokes `MAINTAIN` (Postgres 17) from `authenticated` on every `public` table and view, which `20261023164700` missed, and `execute` from `public` and `anon` on the trigger functions `set_updated_at()` and `ensure_in_kind_shipment_donation()`; `anon` now executes only `confirm_operator_activation`, `request_login_access` and `resolve_tenant_host`. Postgres grants `EXECUTE` to `PUBLIC` globally, so new functions still revoke it in their migration (rule 14). Tested by `supabase/tests/030_default_privileges_without_anon_test.sql` (8 of 11 failed before) and the `MAINTAIN` check added to 029 (512/512 locally, also with the 2026-10-30 change simulated). On `edifydb`, a rolled-back dry run with 029 and 030 passed 48/48 before applying on 2026-10-23 via `apply_migration`. Advisors had no new findings (security 3/50/1; performance 51/3/122) |
| 81 | `20261023200000_supervision_permissions_foundation.sql` | `20261023200000` (`supervision_permissions_foundation`) | SPRINT S11 stage 1 (#147): supervision permissions assigned to people. Adds `private.supervision_permissions()` (catalog: `calendar.manage_all`, `evaluations.review`, `instructions.issue`, `management.read_all`), `private.operator_permission` (one row per organization, person and permission; RLS on with no policies and no grants, by design, like `private.operator_access`; audited by `private.audit_record_change`; foreign keys indexed), `private.current_operator_has_permission(org, permission)`, the tenant-admin RPCs `public.admin_list_operator_permissions` / `public.admin_set_operator_permissions`, and `private.backfill_supervision_permissions()`, which mirrors the legacy GEN/DIGEN helpers. No policy or function reads the permissions yet. Tested by `supabase/tests/031_supervision_permissions_foundation_test.sql` (29/29; 541/541 locally, also with the 2026-10-30 change simulated). The connector's `apply_migration` timed out twice at 60 s (nothing applied); applied on 2026-10-23 through the SQL Editor in one transaction with an explicit history row, after the same script ran locally. Initial load: 7 rows for 2 people of CNBV. Snapshot before and after applying: for the 18 active operators the new permissions match the legacy helpers, 0 mismatches. Advisors: performance 51/3/122 unchanged; security adds the two admin RPCs to `authenticated_security_definer_function_executable` (52) and `rls_enabled_no_policy` (INFO) for `private.operator_permission`, both intended |
| 82 | `20261023203607_supervision_permissions_calendar_evaluation.sql` | `20261023203607` (`supervision_permissions_calendar_evaluation`) | SPRINT S11 stage 2 (#147): Calendar and Evaluation read the supervision permissions instead of the GEN/DIGEN unit codes. Re-runs the initial load, adds `public.organization.evaluation_reviewers_can_self_evaluate` (default `true`; `false` for organizations with an active GEN or DIGEN unit) and the tenant-admin RPC `public.admin_set_evaluation_reviewers_can_self_evaluate`. `calendar.manage_all` replaces `current_operator_is_gen_or_digen_leader` in `can_manage_calendar_plan`, `can_view_calendar_plan`, `guard_calendar_activity_review`, `calendar_access_overview`, `review_calendar_activity` and `set_calendar_joint_review`; `evaluations.review` replaces it in `executive_evaluation_read` and `evaluation_access_overview`; `can_self_evaluate_unit` honors the tenant setting; `management.read_all` or `calendar.manage_all` replace it in the select policies of `institutional_objective`, `management_indicator` and `unit_work_plan`. Pending issues are unchanged (stage 3). Tested by `supabase/tests/032_supervision_permissions_calendar_evaluation_test.sql` (33/33; 574/574 locally, also with the 2026-10-30 change simulated). Rolled-back snapshot on `edifydb`: 18 operators, one expected difference (the DIGEN/GEN director is no longer offered self-evaluation; no evaluations exist for them). Applied on 2026-10-23 with `apply_migration`; live check: CNBV setting `false`, others `true`, 7 permissions, no function or policy calls `current_operator_is_gen_or_digen_leader`, `anon` cannot execute the new RPC. Advisors: performance 51/3/121; security adds the new admin RPC to `authenticated_security_definer_function_executable` (53), intended |
| 83 | `20261024013537_supervision_permissions_pending_issues.sql` | `20261024013537` (`supervision_permissions_pending_issues`) | SPRINT S11 stage 3 (#147): institutional instructions in Pending issues follow `instructions.issue`. Re-runs the initial load; `private.can_issue_digen_instructions` and `private.current_operator_is_digen_director` (names kept until stage 5) read the permission, and the tenant admin keeps issuing without it. New helpers `private.current_operator_member_unit_ids`, `private.current_operator_issuing_unit_id` (the issuer's most specific primary unit) and `private.current_operator_display_name` (all `revoke … from public, anon`). `pending_instruction_target_unit_ids_json` offers every active unit the issuer does not belong to. `guard_pending_issue_scope` records `issued_by_unit_id` and the new column `unit_pending_issue.issued_by_name` (snapshot of the issuer's name, 1–200 chars, never overwritten), and rejects instructions to the issuer's own units. Backfills `issued_by_name` for the existing instruction. Policies unchanged. Tested by `supabase/tests/033_supervision_permissions_pending_issues_test.sql` (27/27; 601/601 locally, also with the 2026-10-30 change simulated). Rolled-back snapshot on `edifydb`: 18 operators; only the 4 tenant admins' instruction targets change (every active unit except their own). Applied on 2026-10-24 with `apply_migration`; live check: the existing instruction reads DIGEN · Elier Romero, scope guard enabled, 7 permissions, `anon` cannot execute the 3 new helpers. Advisors unchanged (performance 51/3/121, security 53) |
| 84 | `20261027170000_association_calendar_notices.sql` | `20261027170000` (`association_calendar_notices`) | SPRINT S11.4 (#157): adds `public.association_calendar_notice` (organization, management period, required `association_name`, title, optional description, start/end dates, `created_by`/`updated_by` audit, indexed FKs) for informational association activities that do not belong to any unit or work plan. `private.guard_association_calendar_notice` keeps organization and dates inside the management period. RLS: every authorized operator of the organization reads; insert/update/delete only through `private.can_manage_association_calendar` (tenant admin or `calendar.manage_all`). `authenticated` SELECT/INSERT/UPDATE/DELETE subject to RLS, `service_role` full, `anon` none; no new public RPCs. Tested by `supabase/tests/034_association_calendar_notices_test.sql` (CI). Rolled-back dry run on `edifydb` passed (table, 4 policies, 5 indexes, 2 triggers, no `anon` privilege). Applied on 2026-10-27 with `apply_migration`; the recorded version was set to the file version. Advisors: no new security findings; performance only reports the 4 new indexes as unused |

DDL changes must be added as new migration files and applied through Supabase migration history. Existing applied migrations remain immutable.

## Operational model

### Members and tenant catalogs

| Table | Purpose | Important decisions |
|---|---|---|
| `organization_member_category` | Tenant-configurable member categories | `code` unique per organization; bilingual `name_es`/`name_en`; `applies_to` is `person`, `organization`, or `both`; `active` instead of deletion |
| `organization_member_relationship_role` | Tenant-configurable relationship roles | Same shape minus `applies_to` — a role always describes a person's relationship to an organization |
| `organization_member` | People and organizations affiliated with the tenant | `member_type` is `person` or `organization`; `name` required; `email` and `phone` optional; `status` is `active` or `inactive`, so a member who leaves keeps their history. `celebration_date` (founding date or birthday, per `member_type`) and `membership_since` are optional complete dates — never partial, and "not in the future" is enforced in the form, not by a constraint |
| `organization_member_relationship` | Person-to-organization links carrying a role | Many-to-many: one person can hold several roles in several organizations at once. Unique on (`member_id`, `related_member_id`, `relationship_role_id`) |

These are a different domain from `organization_unit`, which models the tenant's
own internal structure, and from `actor`, which is the donation-intake registry
and carries no `organization_id`. A member and its affiliated organization each
exist on their own; the relationship row is what links them, and its absence is
how "not linked" is stored.

Member data stays in `public`, at the same exposure level as `actor`. The
private-schema treatment that `private.beneficiary` requires (ADR-004) does not
apply here.

These are also the schema's first per-tenant catalogs. Every other catalog
(`media_type`, `unit_of_measure`, `organization_unit.unit_type`) is global and
fixed by a check constraint. A catalog value that a member or relationship
already references is deactivated, never deleted — the foreign keys are
`on delete restrict` so the database rejects the attempt.

### Catalogs and actors

| Table | Purpose | Important decisions |
|---|---|---|
| `actor` | People and organizations that participate in operations | `name` required; `email`, `phone`, and `country` optional; organization and anonymity flags supported |
| `actor_role` | Many-to-many actor roles | Values: `donor`, `supplier`, `manager`, `beneficiary` |
| `media_type` | Bilingual evidence catalog | Stable `code`, `name_es`, `name_en` |
| `unit_of_measure` | Bilingual unit catalog | Stable `code`, bilingual names, abbreviation |

Actor email uniqueness is case-insensitive and applies only when an email exists. This permits organizations and senders whose first record arrives with limited contact data.

### Receive: monetary and in-kind donations

| Table | Purpose |
|---|---|
| `donation` | Donation header linked to one donor actor |
| `donation_detail` | Monetary or in-kind lines |
| `monetary_donation_detail` | Payment method, USD reporting base, conversion evidence, transaction references, and reconciliation audit for one monetary line |
| `donation_attachment` | Payment, receipt, and supporting evidence |

`donation.donation_type` accepts `monetary`, `in_kind`, or `mixed`. Its lifecycle accepts `draft`, `announced`, `received`, `verified`, and `closed`.

Each detail line has exactly one form:

- `monetary`: positive `amount` plus a three-letter uppercase `currency`.
- `in_kind`: description, positive `quantity`, and `unit_of_measure_id`.

An in-kind line can also carry item metadata, dietary attributes, allergens, expiry data, and an optional reference valuation. `reference_value` records an informative valuation and remains separate from cash received.

Each operational monetary receipt has four explicit reporting values:

| Value | Storage | Meaning |
|---|---|---|
| Origin amount | `donation_detail.amount` | Quantity of money received |
| Origin currency | `donation_detail.currency` | Three-letter uppercase receipt currency |
| USD base amount | `monetary_donation_detail.usd_base_amount` | Confirmed institutional reporting value |
| Applied rate | `monetary_donation_detail.exchange_rate_to_usd` | USD per one origin-currency unit |

Supported receipt methods are `cash`, `bank_transfer`, `mobile_payment`, `digital_wallet`, `crypto`, and `other`. A USD receipt requires a rate of 1 and equal origin/base amounts. A foreign-currency receipt requires a positive rate plus its source and date. Every application submission includes at least one private payment proof or receipt record. Non-cash methods require a transaction reference; bank transfer and mobile payment also require sending and receiving institution labels.

### Shipments, containers, and inventory

| Table or view | Purpose |
|---|---|
| `shipment` | Logistics record for one in-kind donation |
| `shipment_item` | One declared product line in a shipment |
| `inventory_lot` | Physical receipt, inspection, accepted quantity, damage, expiry, and warehouse |
| `inventory_movement` | Append-only stock movement ledger |
| `shipment_attachment` | Packing, carrier, customs, inspection, receipt, and photographic evidence |
| `inventory_lot_balance` | Security-invoker balance derived from movements |

A container follows this sequence:

1. Register an actor with the `donor` role.
2. Create an `in_kind` donation.
3. Add the shipment route, container or tracking reference, departure, and estimated arrival.
4. Add declared goods as separate `shipment_item` rows.
5. On arrival, create one or more `inventory_lot` rows from each declared item.
6. Add a positive `receipt` movement for accepted inventory.
7. Record later reservations, transformations, distributions, transfers, and damage as movements.

The database rejects shipments linked to monetary or mixed donations. Declared, received, accepted, damaged, and available quantities remain distinct.

Food items support `expiry_date`, `dietary_attributes`, and `allergens`. A value such as `gluten_free` belongs in `dietary_attributes`.

### Transform and impact

| Table | Purpose |
|---|---|
| `kit_transformation` | One prepared kit type and quantity per transformation record |
| `kit_transformation_attachment` | Transformation evidence |
| `impact_event` | Distribution event, dates, manager, target population, and aggregate demographics |
| `impact_detail` | Quantity from a transformation delivered at an impact event |
| `impact_event_attachment` | Delivery and participation evidence |

Public impact data stays aggregate. Nominal beneficiary records use a separate protected boundary:

| Private table | Purpose |
|---|---|
| `private.beneficiary` | Minimum identity, date of birth or age band, contact availability, residence area, privacy acknowledgement, archive state, and non-identifying public code |
| `private.beneficiary_event` | Participation in an impact event, attendance state, represented household size, service codes, and audit values |

Both private tables use creator-scoped submission keys for retry safety. `public.register_beneficiary(payload jsonb)` is the authenticated application entrypoint. It requires a privacy acknowledgement and returns a `BEN-…` code. Public and international reports use aggregate `impact_event` data and exclude names, birth dates, phone numbers, email addresses, and exact beneficiary records.

## Budget and reporting boundary

The approved budget and donations are related reporting domains with different accounting meaning:

- Donations record resources received.
- In-kind reference value records an evidence-backed estimate of donated goods.
- Shipment, customs, transport, handling, and warehousing costs are project expenses.
- Budget lines record approved spending authority and later execution.

Reports for international organizations must present cash received, in-kind reference value, approved budget, and operating expenses as separate totals. The budget schema remains a planned module and must receive its own tested migration before budget data is loaded. Donation or shipment tables must never be used as a substitute for budget lines.

## Security model

- RLS is enabled on all 57 `public` tables and on both private beneficiary tables, where it is forced.
- Every operational policy requires an authenticated identity whose email appears as active **and email-confirmed** in `private.operator_access`.
- Operator identities are provisioned directly in the protected Supabase environment; personal addresses stay outside Git history. The exception is an organization's own admin: creating an organization (`public.admin_save_organization`, super_admin only) auto-provisions an `operator_access` row for that organization's `contact_email` with `role = 'admin'`, `active = true`, and `email_confirmed_at = null` until the operator redeems a one-time activation token via `public.confirm_operator_activation(token)` (a `security definer` RPC granted to `anon`, since the operator has no session yet at that point).
- `private.is_authorized_operator()` is a protected security-definer function in a non-exposed schema and begins with an authenticated-user check, and now also requires `email_confirmed_at is not null`.
- Roles in `private.operator_access.role`: `operator`, `admin` (organization admin, tied to `organization_id`), `super_admin` (platform host, no `organization_id`, exempt from per-organization seat limits).
- `public.organization.contact_email` is required and globally unique — it is the organization's access identifier.
- Activation/invitation emails are sent by the `send-operator-invitation` Edge Function (Resend, sender `no-responder@mail.somosedificadigital.com`), invoked server-to-server via `pg_net` from `private.notify_operator_invitation()`. The Edge Function's URL and an authenticating key are read from Supabase Vault secrets `project_url`/`service_role_key`, configured directly in the Dashboard — never committed to source or seen by migrations. Delivery is best-effort and never blocks organization/operator creation. See `docs/adr/ADR-006-multitenant-infrastructure-decisions.md` for the standing decisions behind this (email provider, secret storage, notification pattern).
- `public.organization.language` (`'es' | 'en'`, default `'en'`) drives which single language that organization's invitation emails are sent in.
- `public.current_operator_access()` lets the authenticated application verify access without exposing the allow-list.
- `anon` has no privilege on any `public` table or view (since `20261023163219`, #141).
- Data API access is granted explicitly per table in the migration that creates it: `authenticated` per RLS needs, `service_role` full DML, `anon` revoked (AGENTS.md database rule 14). From 2026-10-30 Supabase stops granting new `public` tables automatically; `20261023161252` made the earlier implicit grants explicit. `supabase/tests/027_explicit_data_api_grants_test.sql` guards every `public` table and view, `028_revoke_anon_table_privileges_test.sql` fails when any of them grants a privilege to `anon`, `029_revoke_authenticated_maintenance_privileges_test.sql` fails when any of them grants `TRUNCATE`, `REFERENCES`, `TRIGGER` or `MAINTAIN` to `authenticated`, and `030_default_privileges_without_anon_test.sql` fails when the default privileges of `postgres` in `public` include `anon` or when `anon` can execute anything beyond `confirm_operator_activation`, `request_login_access` and `resolve_tenant_host`.
- `inventory_lot_balance` uses `security_invoker` and inherits access from its source tables.
- The `attachments` bucket is private, limited to 20 MB per object, and accepts JPEG, PNG, WebP, and PDF files.
- Storage access requires an authenticated session and the `attachments` bucket identifier.
- Nominal beneficiary tables revoke access from `public` and `anon`; active operator authorization applies to every permitted operation.
- Inside a tenant, access is further scoped by organizational unit membership, the unit hierarchy, and the GEN/DIGEN supervisor roles. See "Unit hierarchy visibility", "Institutional supervisors: GEN and DIGEN", and the module sections below.

Client code may use the Supabase project URL and publishable client key. Service-role credentials and database secrets belong only in protected server environments.

### CNBV organization chart levels

Since `20261001214651`, CNBV has one active top-level unit, `GEN` (Dirección General). DIGEN, FBCC, STBV, UNJB, UFBMV, UNVBMV, and UPBV depend on `GEN`; DIAF, DEDEC, DIME, DISES, DICOM, and DIPROM keep depending on DIGEN. `sort_order` follows the tree in preorder with gaps of 10, so ordering any flat unit list by `sort_order` reproduces the chart order. Since `20261002193537`, unit visibility follows this tree: GEN sees every unit, DIGEN sees itself and its six directorates, and every other unit sees only itself. See "Unit hierarchy visibility" below.

### Unit hierarchy visibility

- `private.current_visible_unit_ids()` returns the caller's own units plus every unit below the ones where the caller is `director`, `manager`, `operator` or `reviewer`. A plain `member` sees only their own unit.
- `private.current_supervised_unit_ids()` returns only the units strictly below those units. Calendar review (`review_calendar_activity` and the review guard trigger) requires the activity's unit to be supervised.
- Tenant `admin` and `super_admin` see every unit through `private.can_manage_organization`.
- DIAF (`private.can_manage_finance` / `can_review_management_reports`) keeps reading finance, management reports, indicators, indicator progress, work plans and objectives of every unit.
- Pending issues and calendar activities have no DIAF exception.
- Seeing a unit never grants editing it: INSERT/UPDATE/DELETE policies stay own-unit, with two explicit exceptions. Since `20261008145936`, the tenant `admin` writes to every unit's calendar and pending issues. Since `20261021142000`, GEN and DIGEN leaders edit every unit's calendar.
- `set_calendar_joint_review` requires `private.current_operator_oversees_organization` (membership covers every active unit) or, since `20261021142000`, a GEN/DIGEN leader.
- Access overview RPCs keep their previous keys and add `visible_unit_ids`, `supervised_unit_ids`, `can_review` and `can_manage_joint_review`. `digen_unit_id` now holds the caller's highest own unit.

### Institutional supervisors: GEN and DIGEN

`private.current_operator_is_gen_or_digen_leader(uuid)` (since `20261021142000`) returns true for an active `director`, `manager`, `operator`, or `reviewer` of the active `GEN` unit, and for the active DIGEN director (`private.current_operator_is_digen_director`). Both checks use active memberships in the exact organization. These leaders:

- read every submitted executive self-evaluation;
- read, edit, and validate every unit's calendar activities, and turn the shared calendar view on or off;
- delete calendar activities only in units where they hold an active membership.

Issuing DIGEN instructions in Pending issues is reserved to the DIGEN director and, since `20261022142118`, the tenant `admin` (`private.can_issue_digen_instructions`).

### Organizational unit leader access

`public.admin_save_organization_unit_v2(payload jsonb)` treats the visible leader and application access as separate concerns. `leader.display_name` is always required. `leader.email` can be omitted when the person is recorded only as the visible leader. `leader.create_access = true` requires a valid email and provisions or reactivates `private.operator_access`, sends an invitation when needed, and creates the primary `organization_unit_member` relationship. With `create_access = false`, the RPC stores the visible name and optional contact email on `organization_unit` without creating or linking an operator account. Existing clients that omit `create_access` retain the previous behavior because the RPC defaults it to `true`.

## Verification baseline

The deployment was verified on 2026-07-19 with:

- schema assertions for all tables, constraints, policies, catalogs, and Storage;
- a transactional Germany-to-Venezuela container scenario with canned food, clothing, and gluten-free goods;
- inventory receipt and a calculated balance of 250 units;
- rejection of a shipment linked to a monetary donation;
- rejection of an authenticated submission from an identity outside the private operator allow-list;
- one USD cash receipt with identity conversion and private receipt evidence;
- one VES bank transfer preserving 3,650 VES, a 10 USD base value, the applied rate, source, date, institutions, and transaction reference;
- idempotent monetary and beneficiary retries that returned one record per submission key;
- rejection of unauthorized monetary and beneficiary registration calls;
- beneficiary privacy acknowledgement, non-identifying code generation, and private-schema isolation;
- rollback of all verification records, leaving operational tables empty;
- Supabase database security advisor result with no schema or RLS findings;
- one project-level Auth warning for leaked-password protection being disabled; the current application uses passwordless Magic Link access;
- performance advisor review, with only expected unused-index informational notices on new or empty tables.

The repository pgTAP specifications are in `supabase/tests/`. Run them against an isolated database or inside a rollback-safe transaction.

### Continuous integration: `Database checks`

`.github/workflows/database-checks.yml` runs on every pull request that touches `supabase/**` (and on manual `workflow_dispatch`). The job:

1. installs a pinned Supabase CLI with `supabase/setup-cli`;
2. runs `supabase start`, which creates an empty Postgres from `supabase/config.toml` and replays every file in `supabase/migrations/` in order — a migration that fails to replay fails the job;
3. runs `supabase test db`, which executes every `supabase/tests/*.sql` pgTAP file against that fresh database;
4. stops the stack (and prints the database container log when a step failed).

The job uses only the throwaway local stack inside the runner. It reads no repository secret, project reference, access token, service-role key, or database password, and it never connects to `edifydb`. Reproduce it locally with the same two commands (`supabase start`, then `supabase test db`). A red `Database checks` run blocks review of the pull request; fix the migration or the test, or add a corrective migration when the failing file is already applied.

**Replay-guard exception (2026-10-22).** The first CI run showed that `20260917031741_add_digen_and_management_report_oversight.sql` could not replay on an empty database: its CNBV data block ran `raise exception 'CNBV organization not found'`. A later corrective migration cannot fix a file that aborts the replay, so, with the product owner's approval, that one line was changed to `raise notice …; return;`. This is the same guard `20261001214651_cnbv_general_level_unit.sql` already uses. On an empty database only the CNBV data block is skipped; the file's DDL still runs. `edifydb` is unaffected: the migration is already recorded there and is never re-executed. This is the only applied file edited for replay. Every other fix still goes in a later migration.

## Authenticated submission

`donation.submission_key` and `donation.created_by` provide retry identity and submission audit data. The unique `(created_by, submission_key)` index prevents repeated client attempts from creating duplicate donations.

`public.submit_in_kind_shipment(payload jsonb)` is a security-invoker RPC available only to `authenticated`. It verifies the active operator and creates or reuses:

1. sender actor and donor role;
2. in-kind donation and audit values;
3. shipment route and lifecycle;
4. donation details and linked declared shipment items; and
5. metadata for successfully uploaded private evidence.

The application uploads evidence before the RPC using deterministic paths scoped by user and submission key. A retry uses the same object paths and the same submission key.

Inventory lots and movements stay outside this announcement RPC. They require physical receipt data such as warehouse, received quantity, accepted quantity, damage, condition, and verification status.

`public.submit_monetary_donation(payload jsonb)` follows the same security-invoker and idempotency model. It creates or reuses:

1. donor actor and donor role;
2. monetary donation and origin amount/currency detail;
3. multi-currency, payment-method, transaction, and reconciliation extension; and
4. metadata for successfully uploaded private payment or receipt evidence.

`public.register_beneficiary(payload jsonb)` is available only to authenticated active operators. It writes minimum nominal identity into `private.beneficiary`, optionally links an existing `impact_event` through `private.beneficiary_event`, and returns the non-identifying public code. The beneficiary application form follows in a later interface milestone; the deployed data and security boundary is ready for that integration.

---

**Version:** 2.1
**Last updated:** 2026-07-19


### Institutional preliminary calendar

The Calendar module reuses the Annual Work Plan domain instead of introducing a second scheduling table. A calendar row is a `unit_work_activity` linked to exactly one `unit_work_plan`; the objective and indicator links are optional so units can schedule operational activities before their Annual Work Plan objectives are fully defined. When an objective is deleted, the calendar activity is preserved and its objective link is cleared.

Calendar access is deliberately narrower than general tenant access:

- An active unit member with role `director`, `manager`, `operator`, or `reviewer` can read, create, update, and delete activities for that unit's work plan.
- Since `20261002193537`, a person reads the activities of their own units and of every unit below them, and reviews (`pending`, `validated`, `observed`) only the units below them. Tenant admins read every activity. (Before that migration, any DIGEN member read and reviewed every unit.)
- Since `20261008145936`, the tenant `admin` also creates and updates activities in every unit of its organization (`private.can_manage_calendar_plan`).
- Since `20261021142000`, GEN and DIGEN leaders read, create, update, and review activities in every unit (`can_view_calendar_plan`, `can_manage_calendar_plan`, `review_calendar_activity`, and the review guard trigger). `calendar_access_overview` reports editing as `can_edit_consolidated` (also true for the tenant `admin`) and review as `can_review_consolidated` (since `20261022135016`; true for GEN/DIGEN leaders and, since `20261022142118`, the tenant `admin`).
- Since `20261022142118`, the tenant `admin` also reviews activities and switches the shared view in every unit (`review_calendar_activity`, `set_calendar_joint_review` and the review guard accept `private.can_manage_organization`). Between `20261022135016` and `20261022142118` it could edit but not review.
- Deleting an activity (`unit_work_activity_delete`) requires an active `director`, `manager`, `operator`, or `reviewer` membership in the activity's own unit, or, since `20261022142118`, the tenant `admin` role (`calendar_access_overview.can_delete_consolidated`). GEN/DIGEN leaders edit every unit but delete only in their own units.
- Whoever sees every active unit through membership (GEN in CNBV), and since `20261021142000` any GEN/DIGEN leader, and since `20261022142118` the tenant `admin`, may enable `management_period.calendar_joint_review_enabled` for one management period. While enabled, active unit members may read the consolidated calendar for that period; their write access stays unchanged.
- A substantive edit by the owning unit clears a prior review and returns the activity to `pending`.
- The browser never relies on hiding another unit's rows. `unit_work_activity` RLS enforces the same boundary for direct API access.
- Calendar creation supports bulk entry: shared responsible/modality/status/objective context is applied to multiple activity rows in one insert request.
- The production “Vaciar calendario” action deletes rows only from the selected work plan, and the delete policy above prevents clearing a unit's calendar without an active membership in that unit.


### Pending issues by organizational unit

The **Asuntos pendientes** module stores unit-level commitments in `public.unit_pending_issue`. Each row belongs to one tenant organization, one management period, and one `organization_unit`.

Tracking is intentionally separated into two dimensions:

- `status`: `pending`, `in_progress`, or `completed` (red/yellow/green in the interface, always paired with text/icon labels).
- `urgency`: `low`, `medium`, `high`, or `critical`.
- `due_date` is optional and supports prioritization without being required for every matter.
- `completed_at` is maintained automatically when status enters or leaves `completed`.

Access is enforced in PostgreSQL rather than by browser filtering:

- Active unit members with role `director`, `manager`, `operator`, or `reviewer` can select and mutate issues for units where they hold an explicit membership.
- Since `20261002193537`, members can additionally read the issues of every unit below their own units, and tenant admins read every issue. (Before that migration, active DIGEN members read every unit's issues.)
- Consolidated visibility does not grant write access to other units.
- Since `20261008145936`, the tenant `admin` creates, updates, and deletes issues in every unit of its organization without a unit membership (`private.can_access_pending_issue_unit`).
- Since `20261007182032`, an issue has an `origin`: `unit` or `digen_instruction`. Only the active DIGEN director, and since `20261022142118` the tenant `admin`, issues an instruction (to any active unit except GEN and DIGEN; `issued_by_unit_id` stays the DIGEN unit), and only they rewrite or delete it. Members of the assigned unit change only its status. Since `20261007182445`, the DIGEN director reads every instruction.
- `public.pending_issue_access_overview(uuid)` exposes the caller's own unit ids, visible unit ids, highest own unit id (`digen_unit_id`, kept for compatibility), and whether consolidated access applies.

### Executive self-evaluations

Since `20261021142000`, `public.executive_self_evaluation` stores director self-evaluations for the Evaluación module (Control y rendición). Each row belongs to one organization, management period, unit, and author (`evaluator_user_id`, indexed since `20261022122717`), and is unique per author, period, and unit. It holds general data, up to 3 SWOT entries per category, 18 competency ratings, and up to 7 achievements.

- `status` is `draft` or `submitted`. `private.guard_executive_evaluation` validates the content, sets `submitted_at`, and rejects any change to a submitted row, so a submission is final.
- Insert and draft updates (`executive_evaluation_insert`, `executive_evaluation_update_draft`) require the author to be an active `director` of the unit (`private.can_self_evaluate_unit`).
- Read (`executive_evaluation_read`): authors read their own rows, drafts included. GEN/DIGEN leaders read submitted rows only. Since `20261022142118` the tenant `admin` reads every row of its organization, drafts included (`evaluation_access_overview.can_read_draft_evaluations`); it still cannot insert or update another person's evaluation.
- No delete privilege is granted. `anon` has no access to the table or the RPCs.
- `public.evaluation_access_overview(uuid)` returns the caller's evaluation permissions, and `public.admin_set_evaluation_module_label(uuid, text)` lets the organization admin rename the module (`organization.evaluation_module_label`).
