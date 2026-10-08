# Database Reference

## Current state

The Edifica Digital operational database is deployed in Supabase project `edifydb` (`rrqyihsjftlloizsccvi`). The schema currently contains 18 public operational tables, 2 protected private beneficiary tables, one security-invoker balance view, protected catalog data, and a private attachment bucket.

All database identifiers and stored enum-like values use English `snake_case`. Spanish and English belong in interface content, catalog display names, exports, and reports.

## Applied migrations

| Order | Repository migration | Supabase migration | Purpose |
|---|---|---|---|
| 1 | `202607190000_foundation_schema.sql` | `foundation_schema` | Actors, donations, transformations, impact, catalogs, evidence, RLS, and Storage |
| 2 | `202607190001_in_kind_shipment.sql` | `in_kind_shipment_inventory` | Containers, declared goods, received lots, movements, and shipment evidence |
| 3 | `202607190002_optimize_rls_and_foreign_keys.sql` | `optimize_rls_and_foreign_keys` | Foreign-key indexes and scalar RLS predicates |
| 4 | `202607190003_harden_rls_predicates.sql` | `harden_rls_predicates` | Explicit authenticated-user predicates for every operational table |
| 5 | `20260719031418_authenticated_submission.sql` | `authenticated_submission` | Operator allow-list, audit fields, idempotent RPC, evidence access, and current RLS predicates |
| 6 | `20260719041213_monetary_beneficiary_foundation.sql` | `monetary_beneficiary_foundation` | Multi-currency receipt details, authenticated monetary submission, and protected beneficiary identity and participation |
| 7 | `20260719042848_optimize_monetary_beneficiary_foreign_keys.sql` | `optimize_monetary_beneficiary_foreign_keys` | Covering indexes for the new reconciliation and beneficiary audit foreign keys |

> Note: this table is known to be behind the deployed migration history (it stops
> before the organization/tenant, billing, and project-execution migrations already
> applied to `edifydb`). Flagged separately for a dedicated documentation pass; not
> backfilled here to keep this change scoped to organization-admin provisioning.

| — | `20260726000900_fix_impact_event_created_by.sql` | — | Corrective: adds `impact_event.created_by`, missing since the tenant-isolation migration backfills it but no prior migration created it |
| — | `20260726002500_fix_missing_impact_donation_table.sql` | — | Corrective: recreates `public.impact_donation` (deployed to `edifydb` outside a versioned migration) so migration history replays from scratch |
| — | `20260727010000_organization_admin_provisioning.sql` | — | `organization.contact_email` becomes required and unique; adds `operator_access` activation columns (`activation_token`, `activation_token_expires_at`, `email_confirmed_at`); `admin_save_organization` auto-provisions a pending `admin` operator for the new organization's contact email instead of self-assigning the calling super_admin; new `confirm_operator_activation(token)` RPC; `is_authorized_operator()` now also requires a confirmed email |
| — | `20260727020000_operator_invitation_management.sql` | — | Corrective: `admin_save_operator_access` insert path now also provisions an activation token (it previously left new operators permanently unconfirmable); `admin_list_operator_access` exposes `email_confirmed_at` and `can_resend_invitation`; new `resend_operator_activation(operator_id)` RPC (super_admin only) rotates the token for an unconfirmed operator — actual email delivery is a separate follow-up, pending a transactional email provider |
| — | `20260727030000_operator_invitation_email_delivery.sql` | — | Enables `pg_net`; new `private.notify_operator_invitation(operator_id)` calls the `send-operator-invitation` Edge Function (Resend) via `pg_net`, authenticated using `project_url`/`service_role_key` stored in Supabase Vault (never in source or migrations); wired into `admin_save_organization`, `admin_save_operator_access` (insert), and `resend_operator_activation`; best-effort — silently no-ops if Vault secrets are absent, so it never blocks operator/organization creation |
| — | `20260727031500_move_pg_net_to_extensions_schema.sql` | — | Corrective: `pg_net` does not support `ALTER EXTENSION ... SET SCHEMA`; reinstalled in the `extensions` schema (matching `pgcrypto`, `uuid-ossp`) to clear the "extension in public" security advisory. `net.http_post` lives in its own `net` schema regardless, so no application code changed |
| — | `20260727040000_organization_language_preference.sql` | — | `organization.language` (`'es'\|'en'`, default `'en'`) added; `admin_save_organization` validates/persists it; `admin_list_organizations` exposes it (required a `drop function` first — Postgres rejects adding an OUT column via `create or replace`); `notify_operator_invitation` forwards it to the Edge Function so invitation email is sent in a single language matching the organization, not bilingual |
| — | `20260727040500_fix_admin_list_organizations_grants.sql` | — | Corrective: the `drop function`/`create function` in the previous migration silently wiped `admin_list_organizations`'s grants, briefly re-exposing it to `anon`; reinstates `revoke ... from public, anon` / `grant ... to authenticated` |
| — | `20260902234500_optional_unit_leader_access.sql` | `20260917040334` (`optional_unit_leader_access`) | Updates `admin_save_organization_unit_v2` so a leader requires only a display name; email remains optional unless `leader.create_access` is true, and operator provisioning, invitation, and primary membership occur only when access is requested. Written on 2026-09-02 but left unapplied until 2026-09-17, so the Supabase history records it under that later timestamp rather than the file's own. Applied body is byte-identical to the repository file (md5 `daa73bf22a19afb66b68cae648d8c62f`). The only prior definition of the function came from `20260816041204`, so nothing newer was overwritten. Verified after applying: `create_access` handling present, function still `security definer`, `authenticated` retains execute, `anon` does not; security advisors report no new finding |

| — | `20260917034500_indicator_preferred_chart.sql` | `20260917034500` (`indicator_preferred_chart`) | `management_indicator.preferred_chart` added: an optional visualization override, nullable with no default, guarded by a check over the seven chart forms. Null means the chart is chosen from `metric_type`, `aggregation_method` and the presence of a target, so every pre-existing indicator keeps its current behavior. No RLS change (the table's organization-scoped policies already cover it) and no index (the column is never filtered or joined on). Verified on `edifydb`: column nullable with no default, constraint present, 6 existing indicators all null; security and performance advisors report no new findings |

| — | `20260720012316_beneficiary_impact_interfaces.sql` | `20260720012316` (`beneficiary_impact_interfaces`) | Synced into the repository on 2026-09-17 from the applied Supabase history, where it had no repository counterpart. Adds the impact-event interface columns (reference code, submission key, event name, location, delivered summary, evidence acknowledgement), the `impact_donation` link table with its RLS policy and grants, the private delivery-evidence columns on `impact_event_attachment`, the five delivery media types, the `attachments` bucket limits, and `submit_impact_evidence(jsonb)`. Body copied verbatim (md5 `837efc6416f522d042c7adf23f6ccbc1`) |
| — | `20260917031741_add_digen_and_management_report_oversight.sql` | `20260917031741` (`add_digen_and_management_report_oversight`) | Authored in PR #105 and merged to `main` on 2026-09-17, shortly after this branch had reconstructed the same file from the applied Supabase history; the authored version is the one kept. Seeds the DIGEN directorate for the `cnbv` organization and reparents the other directorates under it, adds `private.can_view_all_management_reports`, replaces `public.management_report_access_overview`, and widens the select policies on `unit_management_report` and `unit_management_report_item` so DIGEN and report reviewers see the consolidated reports. The file differs from the applied statement only by two comment lines. Replaying it against a database without the `cnbv` organization fails by design, since its opening block raises `CNBV organization not found` |

| — | `20260917120000_member_directory_and_tenant_catalogs.sql` | `20260917170637` (`member_directory_and_tenant_catalogs`) | Member directory (Miembros) and the first tenant-configurable catalogs (Mantenedores). Adds `organization_member_category`, `organization_member_relationship_role`, `organization_member`, and `organization_member_relationship`, all tenant scoped with the `organization_unit` RLS shape, indexes on every domain foreign key (`organization_id`, `member_category_id`, `member_id`, `related_member_id`, `relationship_role_id`), and `authenticated`-only grants. Two triggers carry the rules a check constraint cannot express: a member's category must belong to the same organization and apply to its member type, and a relationship always runs from a person member to an organization member inside one tenant. Every organization — new ones through an `after insert` trigger, existing ones through a one-time backfill — starts with three categories (Organización, Iglesia, Persona) and three relationship roles (Pastor Principal, Miembro, Presidente) it can then rename, reorder, or deactivate. Also adds `organization.members_module_label`, the per-tenant module label, written by the organization's own admin through `admin_set_members_module_label(uuid, text)` because `public.organization` itself accepts super_admin updates only. Applied to `edifydb` on 2026-09-17; all four existing tenants (`cnbv`, `oalfa`, `org-123`, `org3test`) were backfilled with three categories and three roles each. Verified with the 54 pgTAP assertions in `supabase/tests/014_member_directory_and_tenant_catalogs_test.sql`, all passing. Advisors after applying: no new security finding, and on the performance side only INFO-level notices — eight `unindexed_foreign_keys` on the `created_by`/`updated_by` audit columns (the same pattern the rest of the schema carries, e.g. `indicator_progress_created_by_fkey`) and five `unused_index` notices that reflect the tables being empty |
| — | — | `20260917170721` (`install_pgtap_for_database_tests`) | pgTAP installed in the `extensions` schema so database tests can run against the deployed project. Kept deliberately, at the product owner's request, for future test runs; a third entry, `20260917171626` (`rename_pgtap_install_migration_label`), only corrects this one's recorded name. It adds no application object and produced no advisor finding. Note: pgTAP needs a writable transaction, which the read-only SQL path does not provide, so a run goes through the migration path and ends with a deliberate `raise exception` carrying the TAP output — that aborts the transaction, so fixture rows never commit and the run leaves no migration-history entry |

| — | `20260928114500_institutional_calendar_privacy_and_review.sql` | `institutional_calendar_privacy_and_review` | Institutional preliminary calendar on top of `unit_work_activity`. Adds the tenant-renamable calendar label, period-scoped joint-review authorization, activity modality and DIGEN review metadata, dedicated calendar authorization helpers, authenticated RPCs, and replaces the activity RLS policies so ordinary units read/write only their own work-plan activities while DIGEN can read the institutional consolidated calendar. Joint review temporarily widens SELECT only; it never grants cross-unit UPDATE/DELETE. |
| — | `20260928120000_calendar_audit_fk_indexes.sql` | `calendar_audit_fk_indexes` | Adds covering partial indexes for `management_period.calendar_joint_review_enabled_by` and `unit_work_activity.reviewed_by`, the two audit foreign keys introduced by the calendar migration. |
| — | `20260928160000_unit_calendar_privacy_and_module_label.sql` | `unit_calendar_privacy_and_module_label` | Records the later calendar privacy hardening that was applied to `edifydb` during production integration. It is retained verbatim for migration-history reproducibility; its SELECT policy temporarily superseded joint-review visibility. |
| — | `20260928200500_restore_calendar_joint_review_flow.sql` | `restore_calendar_joint_review_flow` | Corrective migration applied immediately after integration: restores the approved `can_view_calendar_plan` / `can_manage_calendar_plan` RLS model, the 60-character module-label constraint, and removes the three superseded helper functions introduced by the hardening migration. Final behavior is own-unit editing, DIGEN consolidated oversight, and DIGEN-authorized temporary joint review. |
| — | `20261001120000_tenant_admin_resend_activation.sql` | `20261001160000` (`tenant_admin_resend_activation`) | `resend_operator_activation(uuid)` now accepts tenant `admin` callers for unconfirmed people in their own organization (super_admin keeps cross-tenant resend; operators and cross-organization targets are rejected with `42501`); `admin_list_operator_access()` returns `can_resend_invitation = true` for exactly those rows. Same signatures, grants unchanged. Tested by `supabase/tests/018_tenant_admin_resend_activation_test.sql` |
| — | `20261001214651_cnbv_general_level_unit.sql` | `20261001214651` (`cnbv_general_level_unit`) | Data-only, CNBV only. With the `GEN` unit created from the structure screen by the product owner, places every other active top-level CNBV unit (DIGEN, FBCC, STBV, UNJB, UFBMV, UNVBMV, UPBV) under `GEN` and renumbers `organization_unit.sort_order` in tree preorder (GEN 10 … UPBV 140) so flat unit lists match the organization chart. No schema, policy, function, or grant change; unit visibility is unchanged. Skips when `cnbv` is absent and fails when `GEN` is missing or duplicated. Tested by `supabase/tests/019_cnbv_general_level_unit_test.sql` (red 5/5 before, green 5/5 after); rehearsed in a rolled-back transaction before applying |
| — | `20261002193537_unit_hierarchy_visibility.sql` | `20261002193537` (`unit_hierarchy_visibility`) | Unit visibility follows the organization chart: a person sees their own units and every unit below them (`private.current_visible_unit_ids()`); tenant `admin` keeps organization-wide visibility; DIAF keeps its finance and management-report review exception (including reading indicators, plans and objectives). Alters the SELECT policies of `management_indicator`, `indicator_progress`, `unit_work_plan`, `objective_unit_assignment`, `institutional_objective`, `unit_management_report(_item)` and `unit_pending_issue`; moves `can_view_calendar_plan`, `can_access_finance_unit`, `can_view_all_management_reports`, `current_operator_is_digen`, the calendar review trigger, `review_calendar_activity`, `set_calendar_joint_review` and the three `*_access_overview` RPCs from the DIGEN-by-code rule to the hierarchy. Calendar review belongs to the units above the activity's unit; the joint calendar review is controlled by whoever sees every unit through membership. Adds `organization_unit_parent_unit_id_idx`. Write policies unchanged. Tested by `supabase/tests/020_unit_hierarchy_visibility_test.sql` (25/25 after applying) |

| — | `20260917190000_member_celebration_and_membership_dates.sql` | `20260917185229` (`member_celebration_and_membership_dates`) | Two optional dates on a member. `organization_member.celebration_date` is one column with one meaning, "the date this member celebrates": a founding date when `member_type` is `organization`, a birthday when it is `person` — only the visible label changes, the schema does not branch. `organization_member.membership_since` records since when the member is part of the tenant, and belongs to the member rather than to a person↔organization relationship. Both `date`, nullable, complete dates or absent: partial dates were considered and dropped, so there is no precision column. No RLS change (the table's organization-scoped policies already cover every column) and no backfill. **No check constraint guards "not in the future"**, deliberately: a check expression must be immutable so it cannot read `current_date`, and a future date is a data-entry mistake rather than corrupt data — a tenant registering an affiliation that takes effect next month is reasonable — so that rule lives in the member form (`members.js`), not the database. This is the opposite call from the S5 category trigger, where a member pointing at another tenant's catalog is corrupt whoever wrote it. For a person the celebration date is a complete date of birth in `public`; see the scope-boundary section added to `docs/adr/ADR-004-protected-beneficiary-identity.md`. Applied to `edifydb` on 2026-09-17 with zero existing member rows. Verified with the 13 pgTAP assertions in `supabase/tests/015_member_dates_test.sql`, all passing. Advisors after applying are identical to the previous baseline: no new security finding, and on performance the same 53 INFO `unindexed_foreign_keys` and 3 WARN `auth_rls_initplan` as before — two plain columns add no index or policy finding |
| — | `20261008145936_admin_unit_edit_access.sql` | `20261008145936` (`admin_unit_edit_access`) | Tenant `admin` (and `super_admin`) writes to every unit of its organization without unit membership: `private.can_manage_calendar_plan` and `private.can_access_pending_issue_unit` now also accept `private.can_manage_organization(organization_id)`. Calendar activity INSERT/UPDATE/DELETE and pending issue INSERT/UPDATE/DELETE policies inherit this through the helpers; admins can also update the status of a DIGEN instruction assigned to any unit. Issuing or rewriting DIGEN instructions stays with the DIGEN Director General (`guard_pending_issue_scope` unchanged), and calendar review stays with supervising units. Tested by `supabase/tests/022_admin_unit_edit_access_test.sql` (4/4 after applying); verified on `edifydb` with an admin without unit membership: true for every plan/unit of its organization, false for other organizations; `anon` cannot execute either helper. Advisors report no new findings. |

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

- RLS is enabled on all 18 public operational tables and both private beneficiary tables. RLS is forced on the private tables.
- Every operational policy requires an authenticated identity whose email appears as active **and email-confirmed** in `private.operator_access`.
- Operator identities are provisioned directly in the protected Supabase environment; personal addresses stay outside Git history. The exception is an organization's own admin: creating an organization (`public.admin_save_organization`, super_admin only) auto-provisions an `operator_access` row for that organization's `contact_email` with `role = 'admin'`, `active = true`, and `email_confirmed_at = null` until the operator redeems a one-time activation token via `public.confirm_operator_activation(token)` (a `security definer` RPC granted to `anon`, since the operator has no session yet at that point).
- `private.is_authorized_operator()` is a protected security-definer function in a non-exposed schema and begins with an authenticated-user check, and now also requires `email_confirmed_at is not null`.
- Roles in `private.operator_access.role`: `operator`, `admin` (organization admin, tied to `organization_id`), `super_admin` (platform host, no `organization_id`, exempt from per-organization seat limits).
- `public.organization.contact_email` is required and globally unique — it is the organization's access identifier.
- Activation/invitation emails are sent by the `send-operator-invitation` Edge Function (Resend, sender `no-responder@mail.somosedificadigital.com`), invoked server-to-server via `pg_net` from `private.notify_operator_invitation()`. The Edge Function's URL and an authenticating key are read from Supabase Vault secrets `project_url`/`service_role_key`, configured directly in the Dashboard — never committed to source or seen by migrations. Delivery is best-effort and never blocks organization/operator creation. See `docs/adr/ADR-006-multitenant-infrastructure-decisions.md` for the standing decisions behind this (email provider, secret storage, notification pattern).
- `public.organization.language` (`'es' | 'en'`, default `'en'`) drives which single language that organization's invitation emails are sent in.
- `public.current_operator_access()` lets the authenticated application verify access without exposing the allow-list.
- `anon` has no table privileges on operational data.
- `inventory_lot_balance` uses `security_invoker` and inherits access from its source tables.
- The `attachments` bucket is private, limited to 20 MB per object, and accepts JPEG, PNG, WebP, and PDF files.
- Storage access requires an authenticated session and the `attachments` bucket identifier.
- Nominal beneficiary tables revoke access from `public` and `anon`; active operator authorization applies to every permitted operation.
- The MVP grants authenticated team members operational access. Granular role permissions remain a later security milestone.

Client code may use the Supabase project URL and publishable client key. Service-role credentials and database secrets belong only in protected server environments.

### CNBV organization chart levels

Since `20261001214651`, CNBV has one active top-level unit, `GEN` (Dirección General). DIGEN, FBCC, STBV, UNJB, UFBMV, UNVBMV, and UPBV depend on `GEN`; DIAF, DEDEC, DIME, DISES, DICOM, and DIPROM keep depending on DIGEN. `sort_order` follows the tree in preorder with gaps of 10, so ordering any flat unit list by `sort_order` reproduces the chart order. Since `20261002193537`, unit visibility follows this tree: GEN sees every unit, DIGEN sees itself and its six directorates, and every other unit sees only itself. See "Unit hierarchy visibility" below.

### Unit hierarchy visibility

- `private.current_visible_unit_ids()` returns the caller's own units plus every unit below the ones where the caller is `director`, `manager`, `operator` or `reviewer`. A plain `member` sees only their own unit.
- `private.current_supervised_unit_ids()` returns only the units strictly below those units. Calendar review (`review_calendar_activity` and the review guard trigger) requires the activity's unit to be supervised.
- Tenant `admin` and `super_admin` see every unit through `private.can_manage_organization`.
- DIAF (`private.can_manage_finance` / `can_review_management_reports`) keeps reading finance, management reports, indicators, indicator progress, work plans and objectives of every unit.
- Pending issues and calendar activities have no DIAF exception.
- Seeing a unit never grants editing it: the INSERT/UPDATE/DELETE policies remain own-unit.
- `set_calendar_joint_review` requires `private.current_operator_oversees_organization` (membership covers every active unit).
- Access overview RPCs keep their previous keys and add `visible_unit_ids`, `supervised_unit_ids`, `can_review` and `can_manage_joint_review`. `digen_unit_id` now holds the caller's highest own unit.

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

- An active unit member with role `director`, `manager`, `operator`, or `reviewer` can read, create, update, and delete activities only for that unit's work plan.
- Since `20261002193537`, a person reads the activities of their own units and of every unit below them, and reviews (`pending`, `validated`, `observed`) only the units below them. Tenant admins read every activity. Ordinary edits remain limited to the person's own units. (Before that migration, any DIGEN member read and reviewed every unit.)
- Whoever sees every active unit through membership (GEN in CNBV) may enable `management_period.calendar_joint_review_enabled` for one management period. While enabled, active unit members may read the consolidated calendar for that period; write policies remain unit-scoped.
- A substantive edit by the owning unit clears a prior review and returns the activity to `pending`.
- The browser never relies on hiding another unit's rows. `unit_work_activity` RLS enforces the same boundary for direct API access.
- Calendar creation supports bulk entry: shared responsible/modality/status/objective context is applied to multiple activity rows in one insert request.
- The production “Vaciar calendario” action deletes rows only from the selected work plan, so a unit cannot clear another unit's calendar.


### Pending issues by organizational unit

The **Asuntos pendientes** module stores unit-level commitments in `public.unit_pending_issue`. Each row belongs to one tenant organization, one management period, and one `organization_unit`.

Tracking is intentionally separated into two dimensions:

- `status`: `pending`, `in_progress`, or `completed` (red/yellow/green in the interface, always paired with text/icon labels).
- `urgency`: `low`, `medium`, `high`, or `critical`.
- `due_date` is optional and supports prioritization without being required for every matter.
- `completed_at` is maintained automatically when status enters or leaves `completed`.

Access is enforced in PostgreSQL rather than by browser filtering:

- Active unit members with role `director`, `manager`, `operator`, or `reviewer` can select and mutate issues only for units where they hold an explicit membership.
- Since `20261002193537`, members can additionally read the issues of every unit below their own units, and tenant admins read every issue. (Before that migration, active DIGEN members read every unit's issues.)
- Consolidated visibility does not grant write access to other units.
- Organization administrators without an explicit unit membership do not gain cross-unit issue access through their admin role.
- `public.pending_issue_access_overview(uuid)` exposes the caller's own unit ids, visible unit ids, highest own unit id (`digen_unit_id`, kept for compatibility), and whether consolidated access applies.
