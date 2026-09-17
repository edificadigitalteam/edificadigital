# Sprint S5 — Member Directory (Miembros) and Tenant-Configurable Catalogs (Mantenedores)

**Branch:** `feat/member-directory-and-mantenedores`

**Status:** Implemented — migration applied to `edifydb` on 2026-09-17
(`20260917170637`), 54/54 pgTAP assertions passing, advisors clean of new
findings. Browser verification of the two new screens is still outstanding.

## Context

Product owner request, worked through in conversation: organizations that
use Edifica Digital as a **convention/denomination tenant** (the deployed
`cnbv` tenant — Convención Nacional Bautista de Venezuela — is the concrete
case) have affiliated entities (member churches) and people tied to those
entities (pastors, presidents of auxiliary bodies) that today have no home
in the schema. The originating ask was "send anniversary greetings to
affiliated churches automatically," but investigation and discussion
established that greeting automation is a *consequence* of first having a
real member directory — this plan builds that foundation. Automated
greetings are explicitly deferred (see Non-goals).

Investigation of the current schema (`docs/DATABASE.md`, migrations) found:

- `public.actor` (donors/suppliers/managers/beneficiaries) has no
  `organization_id` — it is not tenant-scoped — and its roles
  (`donor`, `supplier`, `manager`, `beneficiary`) don't fit "member."
  Reusing or extending `actor` would leak membership data across tenants
  and conflate two different domains.
- `public.organization_unit` (from
  `20260815194500_organizational_management_foundation.sql`) looks
  superficially similar but models something different: **internal**
  structure of one organization (directorates, departments, auxiliary
  bodies — the seeded `cnbv` data even includes `UNJB`, `UFBMV`,
  `UNVBMV`, `UPBV`, i.e. exactly the youth/women's/men's/pastors' unions
  the product owner described) with a fixed, global `unit_type` check
  constraint, not a per-tenant-configurable catalog. It is not a
  membership registry and was explicitly ruled out as the base for this
  feature.
- There is no existing concept anywhere of one organization being a
  member/affiliate of another, of a person being linked to an
  organization by a role (pastor, president), or of a tenant-configurable
  catalog (every existing catalog — `media_type`, `unit_of_measure`,
  `organization_unit.unit_type` — is global and fixed by a check
  constraint).
- Reusable patterns that do exist and this plan follows: the
  `organization_unit` RLS shape (`private.can_access_organization` for
  select, `private.can_manage_organization` for write), direct
  `supabase.from(...)` table access from the frontend for straightforward
  CRUD (no RPC wrapper) as used for `organization_unit` itself, and the
  Resend/`pg_net`/Edge Function email pattern established in ADR-006 —
  the last one is only relevant to the deferred greeting-automation phase.

## Product decisions confirmed in conversation

1. **"Miembros" is a distinct domain from `organization_unit`.** It
   models people and organizations *affiliated with* a tenant (members of
   a convention, a congregation, etc.), not the tenant's own internal
   departments.
2. **A member is a person or an organization** (`member_type`: `person` |
   `organization`).
3. **Member categories and relationship roles are catalogs the tenant
   configures itself** ("Mantenedores"), not a fixed global list — this is
   a new pattern in the codebase (every catalog today is global/fixed).
   Each new organization is seeded with a minimal default set it can then
   edit:
   - Categories (`applies_to` inferred from the examples given): `Organización`
     (organization), `Iglesia` (organization), `Persona` (person).
   - Relationship roles: `Pastor Principal`, `Miembro`, `Presidente`.
4. **Person↔organization relationships are many-to-many**, through a
   catalog role (a pastor can be `Pastor Principal` of their church *and*
   `Presidente` of a regional youth/women's auxiliary body at the same
   time — two separate relationship rows).
5. **A person can be a member without their affiliated organization being
   a registered member**, and vice versa. The relationship is optional,
   never required for either side to exist.
6. **No privacy/`private` schema treatment needed** — unlike
   `private.beneficiary` (ADR-004), member records (including
   individuals — pastors, leaders) stay in `public`, same exposure level
   as `actor`.
7. **Mantenedores gets its own collapsible sidebar section**, placed next
   to today's "Usuarios y accesos". Confirmed on 2026-09-17: that
   neighbour now lives in the **Gestión Organizacional** shell
   (`ManagementStandaloneShell.jsx`, "Administración" group), not in
   `DashboardApp.jsx` — see "Navigation reality check" below. Collapsible
   sections don't exist in that sidebar today — this is new interaction,
   not a reuse of an existing pattern, and is in scope for this plan.
8. **"Miembros" is the term at every level — internal (table names,
   translation keys, code) and UI-facing.** An earlier draft of this plan
   used "Afiliados" as the internal/code term with "Miembros" only as the
   default visible label; the product owner has since decided to drop
   "Afiliados" entirely and use "Miembros" everywhere, with no trace of
   the older term. The reason still holds and is worth keeping on record:
   the app already ships an unrelated module called **"Aliados y
   donantes"** (`frontend/src/features/donors/`, the `actor`-based
   donor/supplier directory used in donation intake), and "Aliados"
   sitting next to "Afiliados" in the same sidebar risked real confusion
   for users with varied digital literacy (a core accessibility concern
   for this product, not a cosmetic one) — "Miembros" avoids that
   collision outright rather than just relabeling the visible surface.
9. **The UI-facing module label stays configurable per tenant**
   (e.g., a convention might label it "Iglesias miembro," a single
   congregation might label it "Miembros de la congregación") —
   "Miembros" is only the default, not a fixed label for every tenant.
   This module is also its own top-level tenant-content nav entry (not
   nested inside "Mi organización" or any other section).
10. **The organization's own `admin` edits that label** (self-service),
   confirmed on 2026-09-17. `public.organization` only accepts
   `super_admin` updates today, so the label is written through a
   dedicated `security definer` RPC guarded by
   `private.can_manage_organization`, which touches that one column and
   nothing else — widening the table's update policy would let a tenant
   admin change `code`, `subscription_status`, and the rest of the
   billing surface.

## Navigation reality check (2026-09-17)

This plan's first draft placed the new entries in the `DashboardApp.jsx`
sidebar, alongside "Donaciones, Voluntariado, Proyectos, Aliados y
donantes." That sidebar has since been reorganized: `DashboardApp.jsx`
now carries only EDIFICA / OPERACIÓN ("Gestión organizacional") / MI
ORGANIZACIÓN ("Usuarios y accesos", "Plan y facturación"), and all tenant
operational content lives under `/app/management/*` inside
`ManagementStandaloneShell.jsx`, whose nav is already grouped
("Planificación", "Recursos y operación", "Control y rendición",
"Administración").

Confirmed placement:

- **Miembros** → `/app/management/members`, a nav entry in the
  "Recursos y operación" group, next to "Aliados y donantes" and
  "Voluntariado" — still a top-level tenant-content entry, never nested
  inside another module and never merged with "Aliados y donantes."
- **Mantenedores** → a new **collapsible** nav group in the same sidebar,
  next to "Usuarios y accesos" in the "Administración" area, holding
  "Categorías de miembros" (`/app/management/settings/member-categories`)
  and "Roles de relación" (`/app/management/settings/relationship-roles`).

## Goals (this plan's scope)

- Database: four new tables plus a default-seed mechanism, giving every
  tenant an isolated, configurable member directory.
- Mantenedores UI: a collapsible sidebar section where an operator/admin
  manages the two catalogs (categories, relationship roles) — list,
  create, edit, deactivate (never hard-delete a catalog value already
  referenced by a member or relationship).
- Miembros UI: a module panel (list + create/edit) for members, plus
  relationship management (linking a person-member to an
  organization-member with a role) and the tenant's configurable module
  label.
- No differentiation between `admin` and `operator` on this content,
  consistent with every other tenant-content module today (per
  `SPRINT-S4-v1_host-vs-tenant-role-scoped-navigation.md` decision 1) —
  revisit only if the product owner asks for it explicitly.

## Non-goals (deferred)

- **Automated anniversary greetings.** This is the follow-up feature the
  directory exists to enable, but it needs its own decisions (channel,
  human-review-before-send vs. fully automatic, which date(s) trigger a
  greeting, message template) and its own migration (`pg_cron` is not
  enabled anywhere in this codebase today — introducing a scheduled job
  is new infrastructure, not a reuse of the existing on-action
  `pg_net`/Edge Function/Resend pattern used for invitations). Tracked as
  a follow-up plan once this directory ships and has real data in it.
  The schema below is shaped so that follow-up plan can add an
  `organization_member_date` table (one row per date-to-celebrate — a
  church's founding date, its affiliation date, a person's birthday —
  each independently recurring) without touching anything built here.
- **Linking a member to `actor`** (e.g., a pastor who is also a personal
  donor). A real but separate idea; not designed or scoped here.
- **Organization-to-organization tenancy** (a member church becoming its
  own Edifica Digital tenant under a parent convention). Explicitly out
  of scope — this plan is a same-tenant directory, not a change to the
  multi-tenant/hosting model.
- **Role differentiation between `admin` and `operator`** on this
  content.

## Database design

All four tables are tenant-scoped (`organization_id`, cascading delete)
and follow the `organization_unit` RLS shape: `select` gated by
`private.can_access_organization(organization_id)`, `insert`/`update`/
`delete` gated by `private.can_manage_organization(organization_id)`. No
RPC wrapper is needed for Phase 1 — these are straightforward CRUD tables
without cross-schema side effects (unlike the unit-leader case, which
provisions `private.operator_access`), so the frontend talks to them
directly via `supabase.from(...)`, the same pattern already used for
`organization_unit` reads today.

### `organization_member_category`

Tenant-configurable catalog of member types (e.g., `Organización`,
`Iglesia`, `Persona`).

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `organization_id` | FK → `organization`, cascade delete |
| `code` | stable identifier, unique per organization |
| `name_es`, `name_en` | bilingual display labels |
| `applies_to` | `person` \| `organization` \| `both` — constrains which `member_type` may use this category |
| `sort_order` | integer |
| `active` | boolean, default `true` — deactivate, never delete a referenced value |
| audit columns | `created_by`, `updated_by`, `created_at`, `updated_at` (matches `organization_unit`) |

Unique `(organization_id, code)`; check `applies_to in ('person','organization','both')`.

### `organization_member_relationship_role`

Tenant-configurable catalog of relationship roles (e.g., `Pastor
Principal`, `Miembro`, `Presidente`). Same shape as the category table
above (`id`, `organization_id`, `code`, `name_es`, `name_en`, `sort_order`,
`active`, audit columns), minus `applies_to` — a role always describes a
person's relationship to an organization, so it doesn't need the
person/organization split the category catalog does.

### `organization_member`

The member record itself — a person or an organization affiliated with
the tenant.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `organization_id` | FK → `organization`, cascade delete (the tenant, e.g. the convention) |
| `member_type` | `person` \| `organization` |
| `member_category_id` | FK → `organization_member_category`; app/DB validates `member_category.applies_to` matches `member_type` (`both` always allowed) |
| `name` | required |
| `email`, `phone` | optional, mirrors `actor`'s optional-contact philosophy |
| `status` | `active` \| `inactive` — a member who leaves the convention is deactivated, not deleted, preserving history |
| audit columns | as above |

Check `member_type in ('person','organization')`; `length(trim(name)) > 0`.

### `organization_member_relationship`

Many-to-many link between a person-member and an organization-member,
carrying a role.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `organization_id` | FK → `organization`, cascade delete (redundant with both member FKs' org, but matches the direct-RLS-predicate pattern used everywhere else — see `harden_rls_predicates` migration) |
| `member_id` | FK → `organization_member` — the person side |
| `related_member_id` | FK → `organization_member` — the organization side |
| `relationship_role_id` | FK → `organization_member_relationship_role` |
| `active` | boolean, default `true` |
| audit columns | as above |

Unique `(member_id, related_member_id, relationship_role_id)` to prevent
duplicate rows for the same link. A check (or trigger, since it needs a
cross-row lookup) enforcing `member_id`'s `member_type = 'person'` and
`related_member_id`'s `member_type = 'organization'` — matching decision
5's "not required for either side to exist," this table simply has no
row when there's nothing to link, rather than a nullable side.

### Default-seed mechanism

Per decision 3, every new organization starts with the minimal category
and role sets listed above. Proposed mechanism: an `after insert` trigger
on `public.organization` that inserts the seed rows into
`organization_member_category` and `organization_member_relationship_role`
for the new org — mirrors intent but not literal mechanism of the one-off
`cnbv` seed insert in `organizational_management_foundation.sql` (that one
was a manual backfill for an existing tenant at migration time; new
tenants going forward need this to happen automatically on creation,
which today's codebase has no existing example of for `organization_unit`
— worth flagging as new territory, not a copy of a proven trigger).
Existing organizations (including `cnbv`) get the same seed rows via a
one-time backfill `insert ... select` in the same migration, `on conflict
do nothing`.

### Module label configuration

Add `organization.members_module_label` (text, nullable — null falls
back to a default translated label, **"Miembros"** — see decision 9).
Simplest possible shape for "configurable per tenant": one free-text
override field. Per decision 10 it is edited by the organization's own
`admin` through
`admin_set_members_module_label(target_organization_id, label)`, a
`security definer` RPC guarded by `private.can_manage_organization`. A
blank submission clears the override and restores the default label.

## Frontend design

- **Mantenedores**: new collapsible sidebar group in
  `ManagementStandaloneShell.jsx`, positioned next to "Usuarios y
  accesos" in the "Administración" area. New
  interaction to build: an expand/collapse toggle on the section header,
  no existing precedent in this sidebar to copy — keep it simple
  (local component state, no persistence requirement unless the product
  owner asks). Two entries inside it: "Categorías de miembros" and
  "Roles de relación," each a small module panel (list + inline
  create/edit — both catalogs are ≤5 fields, 1 section, so **inline** per
  the Create/Edit Record Mechanism Standard).
- **Miembros (nav label "Miembros" by default)**: new, standalone
  top-level tenant-content nav entry at `/app/management/members`, in the
  "Recursos y operación" group alongside "Aportes y recursos", "Aliados y
  donantes" and "Voluntariado" — never nested under any of them and never
  merged with "Aliados y donantes" (see decision 8).
  Module label from `organization.members_module_label`, default
  "Miembros," following the Module Panel Layout Standard (header,
  search/filter with "Limpiar," list with "+ Nuevo/Crear ___"). Fields
  for the member form: `name`,
  `member_type`, `member_category`, `email`, `phone`, `status` — 6
  fields, and the record also needs relationship management (linking to
  organization-members) as a second concern — per the mechanism standard
  this crosses into **full page** (6+ fields or 2+ sections), with
  relationships managed as a sub-section of that same screen, not a
  separate modal (no long/filterable list context to preserve here, so
  rule 1 of the standard doesn't force a modal).
- Every actionable button (including the Mantenedores collapse toggle)
  gets a `title` attribute per the Button Tooltip Standard.

## Security model

- RLS enabled on all four tables, forced nowhere (no `private` schema
  involvement per decision 6).
- `select`: `private.can_access_organization(organization_id)`.
- `insert`/`update`/`delete`: `private.can_manage_organization(organization_id)`.
- Revoke `anon` on all four tables; grant `authenticated` the CRUD it
  needs, matching `organization_unit`'s grant shape.
- Foreign-key indexes on every FK column (`organization_id`,
  `member_category_id`, `member_id`, `related_member_id`,
  `relationship_role_id`), consistent with the project's own foreign-key
  index rule (see the `optimize_rls_and_foreign_keys` /
  `optimize_monetary_beneficiary_foreign_keys` migrations).

## Step-by-step tasks

1. **Plan review** — product owner confirms this document (data model,
   nav placement, label-configuration approach) before any code.
2. **Red** — pgTAP specs in `supabase/tests/` for: table/column/constraint
   shape, RLS presence and predicate correctness (authorized vs.
   unauthorized organization access), the seed trigger firing on org
   creation, unique constraints, `applies_to` validation, and rejection
   cases (wrong `member_type` for a category, cross-tenant reference
   attempts).
3. **Green** — one new timestamped migration implementing the four
   tables, RLS, grants, indexes, the seed trigger, the `cnbv` backfill,
   and `organization.members_module_label`.
4. **Frontend** — Mantenedores section (categories + roles panels) and
   Miembros module (list, full-page create/edit, relationship
   management), i18n entries in the relevant translation dictionary,
   module label read from `organization.members_module_label`.
5. **Refactor** — once green, revisit shared code between the two
   Mantenedores catalog panels (likely near-identical) for a single
   reusable component rather than duplicating the panel twice.
6. **Verify** — `pnpm test`, `pnpm lint`, `pnpm build`; local Supabase
   (`supabase start`) round trip for create/edit/deactivate on both
   catalogs and the member directory, plus RLS rejection checks;
   `playwright-cli` pass for the new screens at the standard breakpoints
   (320/375/414/768 + desktop), keyboard flow, and focus states; Supabase
   security/performance advisors after migration.
7. **Document** — update `docs/DATABASE.md` (new tables, catalog pattern,
   seed mechanism), `docs/DESIGN.md` if the collapsible-section pattern
   or the full-page classification needs recording, and this plan's
   Status header once merged.
8. **Review** — PR with verification results and screenshots (new UI),
   human approval before merge.

## Risks & Open Questions

- ~~**Module label configuration surface**~~ — **resolved 2026-09-17**:
  the organization's own `admin` edits it, self-service, through
  `admin_set_members_module_label`. See decision 10.
- **Backward validation of `applies_to`**: enforce category/`member_type`
  match with a DB check constraint (needs a trigger, since it requires a
  lookup into `organization_member_category`) or leave it to application
  validation only, matching how `unit_type` is enforced today (a plain
  check constraint, not cross-table)? Recommend a trigger, since this is
  the kind of data-integrity rule that should hold even if the frontend
  has a bug — flagging the extra complexity for product owner awareness,
  not asking permission (this is a reversible implementation choice).
- **Collapsible sidebar section** is new interaction with no existing
  precedent — small risk of it looking inconsistent with the rest of the
  sidebar; worth a design check-in (screenshot) before considering the
  frontend step done, not just a lint/build pass.
- **No RPC layer for Phase 1** — if Mantenedores or Miembros later need
  cross-schema side effects (e.g., a category deactivation cascading
  somewhere), this may need to grow an RPC the way
  `admin_save_organization_unit_v2` did. Not needed today; noted so a
  future contributor doesn't assume direct-table access is a permanent
  constraint.

## Next

Once this directory ships with real data (at least the `cnbv` backfill,
ideally a live tenant using it), the natural follow-up is the anniversary
greeting automation plan: `organization_member_date`, the
`pg_cron`-or-external-scheduler decision, a bilingual message template,
a send log for idempotency and auditability, and — per the product
owner's own reasoning in this conversation — likely a review queue before
send rather than a blind automatic dispatch, at least for the first
version.

---

**Version:** 1.3
**Last updated:** 2026-09-17
