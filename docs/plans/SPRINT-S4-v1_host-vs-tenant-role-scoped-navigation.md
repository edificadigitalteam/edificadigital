# Sprint S4 — Host vs. Tenant Role-Scoped Navigation

**Branch:** `feat/host-tenant-role-navigation`

**Status:** Done. Implemented in `frontend/src/features/dashboard/DashboardApp.jsx`
(role gating on the page-selection chain and the sidebar markup) plus new
`portalTranslations.js` entries for the new/renamed labels. One deviation
from the original outline, discovered during implementation: bare `/app`
did not render `DashboardHome` as the outline assumed — it rendered
`PlatformHome` (a separate module-picker screen). The host now skips
`PlatformHome` entirely (`platformHome = path === '/app' && !isSuperAdmin`)
and lands directly on `OrganizationAdminPanel`, which achieves the same
outcome the outline intended.

## Context

Product owner review of the dashboard sidebar surfaced this TODO item:

> Separar los módulos visibles según el rol: qué ve un superadmin, qué ve
> un admin de organización, y qué ve un operador. Relacionado con el fix
> de scoping por organización en "Personas habilitadas" (#41), que
> corrigió el acceso a datos pero no revisó de forma integral qué
> módulos/entradas de navegación debería ver cada rol.

Investigation of `frontend/src/features/dashboard/DashboardApp.jsx` found
the current split is a single binary `canAdmin` check (`admin` or
`super_admin`), not a three-tier model:

| Nav entry | Operator | Admin | Super admin |
|---|---|---|---|
| Donaciones, Voluntariado, Proyectos, Aliados y donantes | ✅ | ✅ | ✅ |
| Personas habilitadas | ❌ | ✅ (own org — RPC already scoped, see #41) | ✅ (all orgs) |
| Organizaciones y hosts | ❌ | ✅ (own org, read-only; "Hosts registrados" always empty for them) | ✅ (all orgs, editable) |
| Planes y facturación | ❌ | ✅ (own org, read-only) | ✅ (any org, editable) |

The product owner's mental model, confirmed in conversation: a **host**
(super_admin) administers the platform — tenants/organizations, plans,
and cross-tenant user provisioning — and has no reason to touch any single
tenant's operational content (donations, volunteers, projects, donors).
That content belongs entirely to the **tenant** plane (org admin +
operator). This matches standard multi-tenant SaaS practice (platform
console vs. workspace/tenant console).

Product owner decisions from this conversation:

1. **No differentiation between admin and operator on tenant content for
   now.** Both continue to see Donaciones, Voluntariado, Proyectos, and
   Aliados y donantes with the same access they have today. The only
   differential is host vs. tenant, not admin vs. operator within a
   tenant.
2. **Super_admin (host) should lose all tenant-content nav/home**, not
   just have it hidden — its landing page should be platform-oriented
   (organizations), not the Donaciones summary.
3. **Data cleanup was requested** ("eliminar la data que esté relacionado
   con los superadmin") — investigated against the live `edifydb`
   project (`rrqyihsjftlloizsccvi`) before writing this plan:
   - Both real super_admin accounts correctly have
     `organization_id = null` — nothing tenant-specific assigned to
     them.
   - Zero rows across `donation`, `project`, `volunteer`, and `actor`
     have a null `organization_id`.
   - **Conclusion: there is no orphaned data to clean up.** The
     product owner's concern is fully addressed by removing super_admin's
     UI access to tenant content (this plan) — no migration needed.
4. **Impersonation ("view as tenant operator") was raised as a good
   future idea, explicitly not for this branch.** Recorded as a new
   `docs/TODO.md` item, not designed or implemented here. See
   "Impersonation — deferred" below for the brief analysis given in
   conversation.

## Goals

- Host (super_admin) sees only a "Plataforma" nav section: Organizaciones
  y hosts, Personas habilitadas (all orgs), Planes y facturación (all
  orgs). No Donaciones/Voluntariado/Proyectos/Aliados y donantes nav, and
  no access to those pages via direct URL either (falls back to the host
  home, same pattern already used for `operatorsPage && canAdmin` today).
- Host's landing page (`/app`) becomes the Organizaciones overview
  (reuse `OrganizationAdminPanel`) instead of `DashboardHome`
  (Donaciones summary).
- Admin (org-scoped) and operator keep today's full tenant-content access
  (Donaciones, Voluntariado, Proyectos, Aliados y donantes) — unchanged
  behavior, per decision 1.
- Admin keeps a "Mi organización" nav section: Personas habilitadas (own
  org) and Planes y facturación (own org, read-only) — both already
  correctly scoped by existing RPCs, only the nav/gating changes.
- Admin loses the "Organizaciones y hosts" nav entry and direct-URL
  access to it (currently redundant/useless for them — read-only view of
  their own org plus an always-empty "Hosts registrados" list). Their org
  identity stays visible via the existing "ORGANIZACIÓN ACTIVA" sidebar
  card.
- Operator's nav is unaffected (still just tenant content, no admin
  section) — matches decision 1.

## Non-goals

- No database migration (confirmed unnecessary — see decision 3 above).
- No change to operator vs. admin permissions on tenant content (decision
  1) — that remains a possible future TODO if the product owner later
  wants that split.
- No impersonation feature — tracked as a separate future TODO only (see
  below).

## Implementation outline

All changes are in `frontend/src/features/dashboard/DashboardApp.jsx`
(sidebar markup + the `page` selection chain), no other files expected to
need functional changes.

1. **Role booleans.** Alongside the existing `canAdmin`, add
   `isSuperAdmin = access.role === 'super_admin'` (already used ad hoc in
   a couple of components — check for an existing shared helper before
   adding a new one) and `isTenant = !isSuperAdmin` (or just negate
   inline where needed).
2. **Page-selection gating changes:**
   - `organizationsPage`: gate to `isSuperAdmin` only (was `canAdmin`).
     Non-super-admin hitting `/app/admin/organizations` directly falls
     back to their normal home, same pattern as the existing
     `operatorsPage && canAdmin` fallback.
   - `donationsHome`, `projectsPage`, `compliancePage`, `volunteersPage`,
     `donorsPage`, `monetaryNewPage`, `inKindNewPage`: gate to
     `!isSuperAdmin`. A super_admin hitting any of these directly falls
     back to the host home (Organizaciones).
   - Bare `/app` (no other path matched): render `OrganizationAdminPanel`
     for `isSuperAdmin`, `DashboardHome` otherwise (today's default).
   - `operatorsPage`, `billingPage`: stay gated on `canAdmin` (both admin
     and super_admin keep access, per the "Mi organización" /
     "Plataforma" table above) — no change to this gate itself, only to
     what surrounds it in the sidebar.
3. **Sidebar markup restructuring:**
   - For `isSuperAdmin`: render only the "Plataforma" section
     (Organizaciones y hosts, Personas habilitadas, Planes y
     facturación). Omit the "DONACIONES" and "GESTIÓN" section headers
     and their nav links entirely.
   - For tenant roles (`!isSuperAdmin`): render "DONACIONES" +
     "GESTIÓN" as today, plus (for `canAdmin`, i.e. org admin only) a
     "MI ORGANIZACIÓN" section with Personas habilitadas and Planes y
     facturación — replacing today's "ADMINISTRACIÓN" section, which
     also included "Organizaciones y hosts" (now host-only).
   - Double check the `portal-brand-block`'s small text ("MÓDULO
     DONACIONES") — likely needs a host-aware label (e.g. "PLATAFORMA")
     when `isSuperAdmin`.
4. **`OrganizationAdminPanel` as host home** — confirm it renders
   sensibly as a landing page (header copy, `canEdit` already correctly
   scoped to `super_admin` internally) with no changes needed to the
   component itself; only routing changes which page renders it.

## Step-by-step Tasks

1. Implement the gating/sidebar changes above.
2. `pnpm lint` / `pnpm build`.
3. Manual browser verification (temporary local Supabase instance, real
   magic-link login) for all three roles:
   - Host (super_admin): confirm sidebar shows only Plataforma section,
     `/app` lands on Organizaciones, direct URL to
     `/app/donations`/`/app/donations/projects`/etc. falls back to the
     Organizaciones home instead of rendering tenant content.
   - Org admin: confirm sidebar shows Donaciones + Gestión + "Mi
     organización" (Personas habilitadas, Planes y facturación), no
     "Organizaciones y hosts" entry, and direct URL to
     `/app/admin/organizations` falls back to their normal home.
   - Operator: confirm nav is unchanged from today (tenant content only,
     no admin section).
4. Commit and PR; merge after product owner approval.

## Risks & Open Questions

- **Direct-URL fallback UX**: today, hitting a role-restricted URL
  silently falls back to the default home rather than showing an
  explicit "access restricted" message. This plan keeps that existing
  pattern for consistency rather than introducing a new UX pattern for
  just this change — flagging in case the product owner would rather see
  an explicit denial message instead, which would be a separate,
  slightly larger change.
- **No database changes** — confirmed via live query against `edifydb`
  before writing this plan (see decision 3).

## Impersonation — deferred (new TODO item, not part of this plan)

Raised by the product owner as a good idea for later: a "view as
operator" mode for a host to review a tenant's experience (support/QA
use case). Brief analysis given in conversation: this is a standard
pattern in admin panels ("login as" / "sudo mode") and worth doing
eventually, but it needs real guardrails — an audit log of who
impersonated whom and when, a time-limited impersonation session, a
persistent on-screen indicator that impersonation is active, and
blocking irreversible actions while impersonating. Not designed or
scoped further here; added to `docs/TODO.md` as a standalone future idea.

## Documentation

Update `docs/TODO.md` to mark the "Separar los módulos visibles según el
rol" item done once implemented, referencing this plan and the PR. Add
the impersonation idea as its own new TODO item. No architecture/database
docs need updates since there is no schema or RLS change.

---

**Version:** 1.0
**Last updated:** 2026-07-30
