# Sprint S3 — Create/Edit Record Mechanism Standard

**Branch:** to be created per phase (this plan spans multiple PRs, following
the session's established one-fix-per-PR pattern).

**Status:** Done. All 5 phases merged (#46, #47, #48, #51, #52). A follow-up
fix (#53) corrected two issues found after Phase 5 shipped: the breadcrumb
in Aliados y donantes/Voluntariado was rendering inside the form card
instead of outside it (now `.module-form-portal`, see `docs/DESIGN.md`'s
"Full-page requirement — a 'Módulo / Acción' breadcrumb"), and the donation
intake screens carried a leftover standalone-page background/`min-height:
100vh` that produced a blank gap above the breadcrumb once nested inside
the dashboard shell (see "Full-page requirement — no duplicate page-level
chrome").

## Context

Product owner review of `docs/DESIGN.md`'s "Module Panel Layout Standard"
(#40) found it only standardized the list/search layout, not *which*
mechanism (inline, full page, modal) a module should use for creating or
editing a record. Collaboratively defined and confirmed the following
decision order, now documented in `docs/DESIGN.md` under "Create/Edit
Record Mechanism Standard":

1. Editing an existing record from a long/filterable list where leaving the
   page would lose scroll/filter context → **modal**, regardless of field
   count (already the case for `DonationDetailModal`/`DonationEditModal`).
2. A sub-record nested inside a workspace that is already a full page
   (e.g. a project's Cumplimiento workspace) whose form exceeds the inline
   threshold → **modal scoped to that workspace**, not a second full-page
   navigation.
3. Otherwise: ≤5 fields, 1 section → **inline**; 6+ fields or 2+ sections →
   **full page**. Full-page screens must render inside the dashboard shell
   (sidebar navigation visible) — never an isolated screen with only a
   "volver al panel" link.

Reference classification confirmed with product owner (also in
`docs/DESIGN.md`):

| Module | Fields/sections | Mechanism | Current state |
|---|---|---|---|
| Personas habilitadas | 5, 1 section | Inline | Already correct |
| Host (within Organizaciones) | 4, 1 section | Inline | Already correct |
| Aliados y donantes | 6, 1 section | Full page | Currently inline — needs reclassification |
| Organizaciones | 11, 1 section | Full page | Currently inline — needs reclassification |
| Voluntariado | 14 | Full page | Currently inline — needs reclassification |
| Proyectos | 16, 3 sections | Full page | Already renders as an isolated form section inside the panel, but the list/search blocks stay visible underneath at the same time — needs the list hidden while the form is open to be genuinely full page |
| Beneficiarios de proyecto | 12 | Modal when individual registration enabled; N/A in aggregate mode | Currently inline, always rendered (no "+ Nuevo" trigger at all — a pre-existing deviation from the Module Panel Layout Standard too) |
| Cumplimiento — Avances y entregas | 9 | Modal within the workspace | Currently an inline tab-switched card |
| Cumplimiento — Inversión ejecutada | 7 | Modal within the workspace | Currently an inline tab-switched card |
| Donaciones (detail/edit) | — | Modal | Already correct (the original reference implementation) |
| Donación monetaria / en especie (intake) | 20+, 4 sections | Full page | Already a full page, but renders in a completely separate route tree (`main.jsx`'s `<App/>`, not `DashboardApp`) with no sidebar — the dashboard menu is invisible, only a "Volver al panel" link |

## Key implementation finding (changes scope favorably)

`ProjectsPanel.jsx` already demonstrates the cheapest way to implement
"full page" for a module that is NOT the donation intake flows: its
create/edit form renders as a `project-form-portal` section conditionally
(`{formOpen && ...}`), inside the same component, which is itself already
rendered inside `DashboardApp`'s `<main>` — so the sidebar is automatically
present with zero routing change. Its one gap: the search bar and list
sections render *unconditionally*, so today the form and the list are both
visible stacked on top of each other while creating/editing, instead of the
list being replaced by the form. That's the only fix Proyectos itself
needs.

This means reclassifying **Aliados y donantes, Organizaciones, and
Voluntariado** to full page is *not* a routing change — it's the same
pattern: wrap each panel's search+list blocks in `{!formOpen && (...)}` so
the form takes over the view when open, matching Proyectos once its own gap
is fixed. No new routes, no shell changes, no loss of sidebar — because
these panels were already rendering inside the shell all along.

The one phase that *does* need a real architectural change is the donation
intake flows, because `UnifiedMonetaryDonationFlow.jsx` and
`SimplifiedInKindDonationFlow.jsx` are mounted through `main.jsx`'s
`isOperationalForm` branch (`<App/>`), a separate render tree from
`DashboardApp` entirely — not merely "form vs. list" within the same
component.

## Phases (each its own PR, in this order)

### Phase 1 — Proyectos: hide list while the form is open

- `ProjectsPanel.jsx`: wrap the `module-search-bar` section and the
  `project-list-card` section in `{!formOpen && (...)}`, mirroring the
  existing `{formOpen && canManage && (...)}` block for the form. No new
  state, no CSS changes expected.
- Verification: open the create form, confirm the search bar and table are
  gone and only the form + breadcrumb show; "Cancelar" and successful save
  both return to the list.

### Phase 2 — Aliados y donantes, Organizaciones, Voluntariado: inline → full page

Same mechanical change per module, applied to `DonorDirectoryPanel.jsx`,
`OrganizationAdminPanel.jsx` (both the organization form and the host
form), and `VolunteerPanel.jsx`:

- Wrap each module's `module-search-bar` and list-card sections in
  `{!formOpen && (...)}` (or the module's equivalent state name).
- These modules' current inline forms use a flat field grid
  (`operations-form`/`edifica-admin-form`), not Proyectos' numbered
  multi-section layout — that's fine to keep as-is (the standard's
  "full page" requirement is about the mechanism — taking over the view,
  not about mandating numbered sections — Organizaciones and Voluntariado
  don't have Proyectos' natural 3-way grouping).
- `OrganizationAdminPanel.jsx` has two independent forms (organization,
  host) each with their own `formOpen`/`hostFormOpen` state — both need the
  same treatment; when either form is open, hide both list+search
  sections (showing two lists side by side while one is mid-edit is
  confusing) — open question to confirm with product owner: hide only the
  list belonging to the open form, or both. Default assumption for this
  plan: hide both, since screen space should belong entirely to the active
  form once it's "full page."
- Verification: same as Phase 1, per module.

### Phase 3 — Cumplimiento sub-forms: inline tabs → modal within the workspace

- Extract a small shared modal shell from the existing
  `.edifica-modal-backdrop`/`.edifica-modal` CSS (currently duplicated
  conceptually between `DonationDetailModal.jsx` and
  `DonationEditModal.jsx`) into one reusable component, e.g.
  `frontend/src/features/dashboard/Modal.jsx` (backdrop + close button +
  focus handling), so this is the second and third real usage of a modal
  and should not be a third copy-pasted implementation. Both
  `DonationDetailModal`/`DonationEditModal` should be migrated to use it
  too, so there is exactly one modal implementation in the codebase.
- Modal accessibility audit (do now, since it's finally being reused, not
  once but three times): confirm focus moves into the modal on open, Escape
  closes it, focus returns to the triggering element on close, and the
  background is `aria-hidden`/inert while open. The current
  `DonationDetailModal`/`DonationEditModal` implementation has not been
  audited for this — verify and fix as part of extracting the shared
  component, since after this phase three call sites will depend on it.
- `ProjectCompliancePanel.jsx`: convert the "Avances y entregas" and
  "Inversión ejecutada" tab-switched inline forms to open the shared modal
  instead, triggered from a "+ Nuevo avance"/"+ Nueva inversión" button in
  each section's list heading (per the Module Panel Layout Standard's list
  block pattern, reused here even though Cumplimiento itself isn't a
  list-style module panel).
- Verification: open each modal, confirm Escape/backdrop-click closes it,
  focus returns correctly, save/cancel behavior unchanged.

### Phase 4 — Beneficiarios de proyecto: inline (always-visible form) → modal, conditional

- `ProjectBeneficiariesPanel.jsx` currently renders its form permanently
  (no trigger button at all) — first add the standard list heading "+
  Nuevo beneficiario" trigger (closing the pre-existing Module Panel Layout
  Standard gap noted in the reference table), then convert that trigger to
  open the shared modal from Phase 3, only when
  `selectedProject.beneficiary_detail_enabled` is true. In aggregate mode
  (flag disabled), this module shows only the aggregate summary — no
  per-record list, no create action at all, per the standard's own
  carve-out.
- Verification: toggle individual registration on/off for a test project,
  confirm the modal only becomes available when enabled.

### Phase 5 — Donation intake flows: render inside the dashboard shell

Highest-risk phase — an actual architecture change, not a conditional
render tweak.

- `main.jsx` currently routes `/donations/monetary/new` and
  `/donations/in-kind/new` (matched by `isOperationalForm`) to `<App/>`,
  which renders `UnifiedMonetaryDonationFlow`/`SimplifiedInKindDonationFlow`
  standalone — no `DashboardApp`, no sidebar.
- Plan: add these two paths to `DashboardApp.jsx`'s own path-matching
  (alongside `projectsPage`, `volunteersPage`, etc.) and render the flow
  components as `page` inside the shell's `<main>`, same as every other
  module. Remove `UnifiedMonetaryDonationFlow.jsx`'s and
  `SimplifiedInKindDonationFlow.jsx`'s own `<header className="intake-
  header">` (Brand/back-link/draft-saved indicator/sign-out/language
  toggle) since the shell's sidebar already provides equivalent
  navigation, org context, and sign-out — the flow's own language toggle
  is also redundant with `GlobalLanguageController`, which is mounted
  globally in `main.jsx` regardless of route.
- Open questions to confirm before implementing this phase specifically:
  - `main.jsx`'s `OperationalNavigationGuard` and `isOperationalForm`
    branch currently do extra work assuming these forms are outside
    `/app` (rewriting back-links, redirecting `/`/`/app` clicks to
    `/app/donations`). Once these routes render through `DashboardApp`,
    most of that guard becomes dead code for these two paths — needs a
    careful pass to confirm nothing else still depends on
    `isOperationalForm` being true for `/donations/monetary/new` and
    `/donations/in-kind/new` specifically (e.g. anything keyed only on
    that flag, not on the path itself).
  - Confirm whether these two routes should still be reachable
    standalone (no dashboard shell) for some other use case (e.g. a
    future public-facing or embeddable donation form) before fully
    removing that code path, or whether folding them into `DashboardApp`
    is safe to do outright. Current understanding from `useOperatorAccess`
    gating: these forms already require an authorized operator session
    (magic-link login), so they are not public-facing today — but confirm
    this is not a deliberate design choice for an anticipated future
    public form before deleting the standalone path.
  - The draft-saved indicator (`✓ Borrador guardado`) and its
    `localStorage` persistence logic stay unchanged — this phase only
    touches chrome/routing, not the form's own state management.
- Verification: navigate via the sidebar's "Donación monetaria"/"Donación
  en especies" links, confirm the sidebar stays visible throughout the
  flow, confirm draft persistence and submission still work end-to-end
  (reuse the existing browser-based verification approach from prior
  sessions — real magic-link login against a temporary local Supabase
  instance).

## Step-by-step Tasks (per phase)

Each phase follows: implement → `pnpm lint`/`pnpm build` → manual browser
verification (temporary local Supabase instance, real login) → its own
commit and PR → merge before starting the next phase, so risk stays
isolated per phase (Phase 5 in particular should not block or be blocked by
Phases 1–4).

## Risks & Open Questions

- **Phase 2's Organizaciones two-form interaction** (hide one list or
  both while either form is open) — flagged above, default assumption is
  "hide both," needs product owner confirmation before implementing.
- **Phase 3's modal accessibility audit** may surface issues in the
  *existing* `DonationDetailModal`/`DonationEditModal` that predate this
  plan — if found, fix them as part of extracting the shared component
  rather than deferring, since three call sites will depend on it being
  correct.
- **Phase 5 is the only phase with real architectural risk** — confirm the
  two open questions above before starting it; consider doing it last so
  the lower-risk phases ship first and this phase gets full attention on
  its own.
- No database changes in any phase — this is entirely frontend structure
  and CSS; no migration, no pgTAP needed.

## Documentation

`docs/DESIGN.md`'s "Create/Edit Record Mechanism Standard" section and its
reference classification table (already written) are the source of truth
this plan implements. Update the table's "current state" notes to "done"
per phase as each PR merges, and update this plan's Status/Phase notes
accordingly.
