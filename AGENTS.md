# Agents and Team

This is the **primary, binding guide** for human contributors and AI coding agents (Claude, Codex, and any other agent) working in the Edifica Digital repository. `CLAUDE.md` only points here. When this file and another document differ, verify deployed behavior and update both in the same scoped change.

## Mission

Deliver a bilingual, auditable donation-traceability and institutional-management platform with clear workflows for people with varied cognitive and digital literacy. Work through plans, executable tests, focused implementation, verification, and accurate documentation.

The primary identity is `somosedificadigital`. Preserve the existing design system and the product decisions recorded in the repository.

## Team

| Role | Responsibility | Mode |
|---|---|---|
| Product owners | Product ownership, strategy, scope, and approvals | Human |
| Human developers | Implementation review, security review, and release approval | Human |
| AI coding agents | Planning, tests, implementation, database migrations, documentation, and verification within explicit task scope | AI |

Product owners decide business direction. Human review remains required before merge to `main`.

### Operating contract for AI agents

An AI agent may:

- inspect the repository and connected systems within the user's stated scope;
- design schemas and application flows;
- write and refactor production code;
- create and apply tested Supabase migrations after explicit user authorization that names the target project;
- run tests, lint, builds, database validation, and advisors;
- update documentation and ADRs;
- prepare commits and pull requests on a feature branch.

An AI agent must:

- keep product ownership with the designated human product owners;
- ask for direction when a missing choice materially changes business behavior or external scope;
- preserve unrelated work in a dirty worktree;
- keep secrets out of logs, source control, client code, and documentation;
- avoid direct commits to `main`;
- leave every external change traceable through migrations, commits, and documentation;
- merge only after a human approval, given either as an approving review on GitHub or as an explicit instruction in the agent conversation (see "Merging and branch deletion").

## Mandatory delivery workflow

Every implementation follows this order:

```text
plan → database notice → failing tests → implementation → refactor → verification → documentation → pull request → merge → branch deletion
```

1. **Plan.** State the requested outcome, assumptions, affected files, database impact, risks, and verification method. A feature or schema change needs a concise plan in `docs/plans/`.
2. **Flag database changes.** Identify every table, column, constraint, index, trigger, function, view, RLS policy, grant, Storage rule, seed, or migration before implementation.
3. **Red.** Add or update executable tests that fail for the missing behavior: observable behavior, edge cases, bilingual parity, accessibility-critical states, and database constraints. For SQL, add pgTAP assertions for tables, columns, constraints, RLS, policies, grants, indexes, functions, views, Storage configuration, and relevant rejection cases — and **run them**, see "Database rules".
4. **Green.** Implement the smallest complete change that passes the tests. Keep data access separate from presentation and translation dictionaries centralized.
5. **Refactor.** Improve structure while tests remain green.
6. **Verify.** Run the narrowest relevant checks first, then the broader suite (`pnpm test`, `pnpm lint`, `pnpm build` in `frontend/`), plus accessibility, schema checks, and Supabase security and performance advisors.
7. **Document.** Update architecture, database reference, plan status, specs, and ADRs when the implemented truth changes — in the same change, not later.
8. **Review.** Publish a pull request and obtain a human approval (GitHub review or explicit chat instruction).
9. **Merge and clean up.** Merge, then delete the branch (see "Git and release").

For urgent work, compress feedback loops while preserving the order above.

### Interface verification

Verify responsive layouts (320, 375, 414, 768 CSS px and a desktop width), keyboard flow, focus states, language switching, draft preservation, and reduced motion for every interface change. The `playwright-cli` skill is installed globally (`~/.claude/skills/playwright-cli`, not duplicated in this repo's `.claude/skills`) and is the tool for driving the browser during this verification.

### New module scope questions (required before starting a new module)

The app separates a **host** plane (super_admin — administers tenants, organizations, and plans) from a **tenant** plane (admin/operator — donations, volunteers, projects, aliados/donantes, management modules, and other operational content for one organization). This is implemented, not a convention: `DashboardApp.jsx` gates both the sidebar nav and the direct-URL routing per plane. See `docs/plans/SPRINT-S4-v1_host-vs-tenant-role-scoped-navigation.md` (#64).

Before starting any new module (new nav entry, panel, or top-level feature area), answer these in the Plan step and get product owner confirmation:

1. **Is this module tenant-scoped, host-scoped, or both?** A module serving both needs an explicit design for each plane — never "the same screen, just with more rows".
2. **If tenant-scoped, does it need role differentiation** between org admin and operator, or unit-level differentiation (director, GEN, DIGEN)?
3. **Which nav section does it belong to** — "Plataforma" (host-only), "Mi organización" (tenant admin-only), or the shared tenant-content sections?
4. **What is its default name, and is it registered as renameable?** Every module ships a default label and an entry in `frontend/src/features/settings/moduleLabels.js` (product owner, 2026-09-17).

Do not add a nav entry or route without these answers.

## Access model

### Host vs. tenant roles

- `private.operator_access.role` is `operator`, `admin`, or `super_admin`.
- `super_admin` is the **host** plane: organizations/tenants, cross-tenant user provisioning, and plans. Host accounts have `organization_id = null` and no access to a single tenant's operational content. The sidebar shows only "Plataforma" (Organizaciones y hosts, Personas habilitadas, Planes y facturación); tenant-content URLs fall back to Organizaciones y hosts; bare `/app` lands there instead of the `PlatformHome` module picker.
- `admin` and `operator` are the **tenant** plane, scoped to one organization. They see and manage the same tenant content. `admin` additionally manages its organization's users and views its plan/billing under "Mi organización", and — since `20261008145936` (#125) — writes to every unit of its organization in Calendar and Pending issues without unit membership.

### Organizational units, GEN, and DIGEN

- Units form a hierarchy. A person sees their own units and every unit below them (`private.current_visible_unit_ids()`).
- **DIGEN** (active DIGEN director) and **GEN** (active director, manager, operator, or reviewer of the `GEN` unit) are institutional supervisors (`private.current_operator_is_gen_or_digen_leader`). They read every submitted executive evaluation, edit and validate every unit's calendar, and control the shared calendar view.
- Executive self-evaluations (`public.executive_self_evaluation`): only active unit directors create and edit their own drafts; drafts are visible only to their author; GEN, DIGEN, and the tenant admin read submitted evaluations only; submitted evaluations are final.
- Issuing DIGEN instructions in Pending issues stays reserved to the DIGEN Director General.
- Roles come from active memberships in the exact organization. User-editable metadata never grants access.

## Current product decisions

### Identity and language

- The primary public identity is `somosedificadigital`.
- The landing page and operational application are bilingual in Spanish and English. Every report label and explanatory passage is available in both.
- The language switch remains visible, preserves the current route, step, and form values, and changes all visible interface content.
- Database artifacts use English `snake_case` and stable lower-case values.

### Interaction and writing

- Preserve the existing typography, palette, spacing, and component language unless the product owners approve a new direction.
- Use a restrained, professional, human visual composition. Decorative elements must support content or navigation. Avoid generic AI-page motifs, excessive gradients, ornamental grids, floating cards without purpose, and filler metrics.
- Design mobile-first with one primary action per step, persistent visible labels, required fields identified in words, short instructions, concrete field names, safe defaults, visible progress, and touch targets of at least 44 × 44 CSS px.
- Provide keyboard access, visible focus, screen-reader support, sufficient contrast, and reduced-motion support.
- Show a final review before an irreversible submission. Preserve drafts and provide explicit retry states around network operations.
- Validation messages state the exact action needed to continue.
- Treat visual alignment and responsive verification as release requirements. Controls sharing a row use a common grid and alignment baseline; helper or validation text reserves its own space without displacing sibling controls.
- Keep every action label fully legible at every supported width. Button groups reflow or stack before labels overlap, clip, or break; never shrink text or touch targets below the baseline.
- Every detail view shows all information needed to understand and operate the record. Move long content into an accessible drawer, dialog, or dedicated region; never clip or truncate required context.
- Copy uses direct statements and avoids antitheses, comparisons, and personification of non-human subjects. Replace the word "no" with a direct construction when clarity and accuracy remain intact. Use respectful plain language.

### Interface standards

- **Toasts.** Any user-triggered action that calls Supabase (RPC, insert, upload) reports success or failure through the shared toast system (`frontend/src/features/notifications/`). Field-level validation stays inline. See `docs/plans/SPRINT-S2-v1_donor-picker-auth-consistency-and-toast-notifications.md` for the friendly Postgres-error mapping.
- **Module panel layout.** Every `/app/...` module panel uses header (kicker + title + description), a search/filter block with "Limpiar", and a list block whose heading row carries the primary "+ Nuevo/Crear ___" action. Reference: `ProjectsPanel.jsx`; see "Module Panel Layout Standard" in `docs/DESIGN.md`.
- **Button tooltips.** Every actionable button has a native `title` with a short description — mandatory for icon-only buttons. See "Button Tooltip Standard" in `docs/DESIGN.md`.
- **Module naming.** Every module the tenant can reach has a tenant-configurable name, edited from the "Nombres de los módulos" maintainer in Mantenedores — never from inside the module. See "Module Naming Standard" in `docs/DESIGN.md`.
- **Create/edit mechanism.** Choose inline, full page, or modal per the decision order in "Create/Edit Record Mechanism Standard" in `docs/DESIGN.md`. Full-page screens render inside the dashboard shell with the sidebar visible.
- **UI that reads permission flags.** When a database permission changes meaning (for example `can_edit_consolidated` starting to include the tenant admin), review every UI branch and copy string that reads that flag in the same change.

### SEO and AI discoverability

Full decision record: `docs/adr/ADR-005-seo-and-ai-discoverability.md`.

- Discoverability is an ongoing requirement for every public-facing page, on the same footing as accessibility and bilingual parity.
- The public site (`/`, `/donations/*`) is a client-rendered SPA. Every public route ships a static `<title>`, meta description, canonical link, Open Graph/Twitter Card tags, and JSON-LD in `index.html`, so crawlers that never execute JavaScript see correct content.
- The canonical production domain for SEO artifacts is `somosedificadigital.com`, never the Vercel alias.
- `robots.txt` allows all crawlers, including AI crawlers, and blocks only `/app` and `/app/*`.
- `frontend/public/llms.txt` is a maintained bilingual summary, kept in sync with the public copy.
- FAQ-style public copy ships with a matching `FAQPage` JSON-LD block. Structured data must exactly match visible content.
- Confirmed target keywords: "software para iglesias", "software para donaciones", "software de trazabilidad de donaciones". Update meta copy and JSON-LD together if positioning changes.
- Icons (`favicon.svg`, `favicon.ico`, `apple-touch-icon`) are a requirement; verify they resolve.
- SSR or prerendering stays deferred; reconsider only with real indexing data.

### Donations, shipments, and budgets

- Donations may be `monetary`, `in_kind`, or `mixed`. Actor roles are `donor`, `supplier`, `manager`, and `beneficiary`. Actor name is required; email, phone, and country are optional.
- A monetary detail requires a positive origin amount and uppercase ISO currency. Receipts preserve origin amount, origin currency, USD base amount, applied USD-per-origin-unit rate, rate source/date for foreign currency, receipt method, transaction details, and private evidence. USD uses a rate of 1.
- Supported receipt methods: cash, bank transfer, mobile payment, digital wallet, cryptoasset, and other documented methods.
- An in-kind detail requires a description, positive quantity, and unit. A reference valuation is optional and separate from cash received.
- A container is one `in_kind` donation, one shipment, many declared items, received inventory lots, and append-only movements. Food supports expiry, allergens, and dietary attributes such as `gluten_free`. Declared, received, accepted, damaged, and available quantities remain distinct.
- Transport, customs, handling, warehousing, and similar costs are expenses rather than donations.
- Approved budgets, received donations, in-kind reference values, and expenses remain separate reporting domains. International reports preserve currencies, valuation basis, sources, dates, evidence, inventory flow, and aggregate impact.

### Protected beneficiary data

- Nominal identity belongs in `private.beneficiary`; participation in `private.beneficiary_event`. Records require privacy acknowledgement and return a non-identifying `BEN-…` code.
- Names, dates of birth, phone numbers, email addresses, and nominal participation stay outside public reporting endpoints. Public and international reports use aggregate data.
- Archive operational beneficiary history instead of deleting it.

### Compliance report export

- "Exportar PDF" (`ProjectCompliancePanel.jsx` + `frontend/src/features/dashboard/complianceReportPdf.js`) is the single export path; there is no print button.
- The PDF is generated client-side with `pdfmake` from the data already on screen and opens in a new tab via `.open()` as a preview.
- Page 1 is an executive cover (gauge, colored metric cards, objective, table of contents); detailed sections follow. Every page carries a brand header (Edifica Digital mark left, tenant name right), with project name, date, and page count added from page 2 on. Navigation uses pdfmake `id`/`linkToDestination`.
- See `docs/plans/SPRINT-S2-v1_printed-reports-improvements.md`.

## Database rules (Supabase)

### Authorized project and baseline

The only authorized project is `edifydb`, reference `rrqyihsjftlloizsccvi`. Other visible Supabase projects are outside scope unless the user explicitly identifies them.

Deployed baseline, checked on 2026-10-22 (latest migration `20261022122717`, 74 entries in migration history):

- 57 tables in `public`, every one with RLS enabled, and the security-invoker view `inventory_lot_balance`;
- `private` schema (not exposed through the API) with `beneficiary` and `beneficiary_event` (forced RLS), `operator_access`, and `record_change_log`;
- anonymous table privileges revoked; `SECURITY DEFINER` RPCs validate access inside the function;
- private Storage buckets `attachments` (20 MB, approved image/PDF types) and `project-evidence` (50 MB);
- pgTAP installed in the `extensions` schema for database tests.

`docs/DATABASE.md` is the detailed reference and the migration ledger.

### Rules

1. **Confirm the target first.** Check project name, reference, and that the connector can actually read it (`list_migrations`). If the connector only sees other projects or organizations, stop and report it; never apply to a look-alike project.
2. **Inspect before writing.** Read the current schema, migration history, and the live definition (`pg_get_functiondef`, `pg_policies`) of every function or policy you will replace. `create or replace` and `alter policy` overwrite earlier grants silently: compare against the live version and against the latest migration that touched the object, and keep every permission that is not explicitly being removed.
3. **One timestamped migration per DDL change.** Applied migrations are immutable; corrective work gets a later migration. Never run untracked ad hoc DDL.
4. **Tests that run.** pgTAP files start with `select plan(n);` (or `no_plan()`), end with `finish()` and `rollback`, and are executed before the PR is marked ready — a test file that has never run does not count as coverage. Assert preserved permissions (regression), not only the new ones.
5. **Execute the migration before review.** Run it on a local stack (`supabase start`, see rule 12) or, when that is impossible, as a rolled-back dry run against `edifydb`. Syntax errors, missing helper functions, or wrong policy names must surface before a reviewer sees the PR.
6. **Index every new foreign key** in the same migration.
7. **Apply through migration history**, after explicit authorization, following "Applying a migration" below.
8. **Exercise writes inside a transaction and roll them back** when validating production structure. Label any verification data that must persist.
9. **Run security and performance advisors** after every schema or policy change and resolve new findings or record why they stay.
10. **Keep secrets out.** Service-role keys, database passwords, and secrets stay outside source control and client bundles; the client uses publishable credentials only.
11. **Document in the same change.** Update `docs/DATABASE.md`, architecture, plan status, the PR description, and affected ADRs when the migration is applied.
12. **Prefer local.** For any real round trip (new migration, RPC behavior change, end-to-end flow that writes data), use a local Supabase stack via Docker (`supabase start`, which applies the repo's migrations). Point the frontend at it with a gitignored `.env.local` (`VITE_SUPABASE_URL=http://127.0.0.1:54321` and the local publishable key `supabase start` prints), use a seed or throwaway operator, then clean up and `supabase stop`. Fall back to `edifydb` only when the local stack cannot reproduce the check, and say so explicitly.

### Applying a migration

1. **Dry run.** Execute the migration plus its assertions inside `begin; … ` ending with a deliberate exception, so nothing persists. Collect results in a temp table and raise them in the error message — the pattern in `supabase/scripts/verify_s10_evaluations_calendar_rollback.sql`. Run any such script yourself before asking a person to run it.
2. **Apply.** Use `apply_migration` through the Supabase connector. The connector asks for confirmation and gives up after about 60 seconds; for long migrations that keep timing out, apply from the Supabase SQL Editor instead, wrapped in `begin; … commit;`, ending with `insert into supabase_migrations.schema_migrations (version, name) values ('<file version>', '<name>');` so history matches the file.
3. **After any timeout or cancellation, check state before retrying**: does the object exist, and what is the latest migration in `supabase_migrations.schema_migrations`? Never re-send blindly.
4. **Keep file name and history in sync.** `apply_migration` records the current timestamp as the version; rename the repository file to that version. Going forward, every repository migration file name equals its recorded version.
5. **Verify and record.** Check shape, RLS, policies, grants, and indexes on the live project; run advisors; update documentation and the PR.

### Lessons from the S10 migration (2026-10-21/22)

PRs #127/#128 shipped a migration that had never been executed. What happened and the rule that now prevents it:

| What happened | Rule |
|---|---|
| Two functions used `as $ … $` instead of `as $$ … $$`; the whole migration would have failed in production. | Database rule 5: execute every migration before review. |
| pgTAP tests only matched text in function definitions and had never run. | Database rule 4: tests must run; assert behavior and preserved permissions. |
| The migration silently removed the tenant admin's cross-unit calendar editing (#125) and let supervisors read drafts. | Database rule 2: diff against the live definition before `create or replace`. |
| The agent's Supabase connector pointed at another organization, so the PR was left "pending" with no way to verify. | Database rule 1: confirm the connector reaches `edifydb` before starting. |
| The verification script lacked `select plan(23);` and failed when the product owner ran it. | "Applying a migration", step 1: run scripts yourself first. |
| Connector confirmations timed out at 60 s three times; each time the state had to be re-checked. | "Applying a migration", steps 2–3. |
| The advisor flagged an unindexed foreign key after applying. | Database rule 6. |
| Plan, `docs/DATABASE.md`, and PR description still said "pending" after the migration was live. | Database rule 11. |
| The admin saw the GEN/DIGEN banner because the permission flag changed meaning. | "UI that reads permission flags" in Interface standards. |

## Current integration boundary

- The in-kind workflow initializes the Supabase client, establishes an allow-listed magic-link session, uploads private evidence, and calls `submit_in_kind_shipment` for atomic, idempotent persistence. It clears the local draft only after Supabase returns the persisted reference.
- The monetary workflow uses one continuous bilingual form, requires payment or receipt evidence, uploads to deterministic private paths, and calls `submit_monetary_donation`.
- `register_beneficiary` and the private tables are deployed; their dedicated interface follows a focused accessibility and privacy review.
- The next operational workflow begins at physical receipt: warehouse, received, accepted, damaged, condition, verification, expiry, and responsible actor before creating inventory lots and movements, preserving the announcement record and declared quantities as the baseline.
- The budget module still requires a dedicated tested migration before approved budget rows are loaded.

## Git and release

### Branches

- `main` contains production-ready code. Never commit directly to `main`.
- Create every work branch from an up-to-date `main`, with `feature/`, `bugfix/`, `docs/`, or another descriptive prefix.
- Never mix unrelated user changes into an agent commit.

### Commits

Use `[TYPE] Brief description`. Accepted types include `[PLAN]`, `[TEST]`, `[FEAT]`, `[FIX]`, `[SECURITY]`, `[PERF]`, `[REFACTOR]`, `[DB]`, `[DOCS]`, and `[CHORE]`. Keep plan, red tests, implementation, and later corrections in reviewable commits when the workflow permits.

### Pull requests

Every pull request includes:

- linked plan or issue;
- test evidence and the observed red-to-green sequence;
- an explicit database-change notice that says whether each migration is **applied** or **pending** on `edifydb` — kept current until merge;
- security and accessibility implications;
- verification commands and results;
- screenshots for visible interface changes;
- documentation updates;
- rollback or recovery considerations for external changes.

### Merging and branch deletion

- Merge only when CI is green on the current head, there is no conflict, and a human has approved. Either form of approval counts:
  - an approving review on GitHub; or
  - an explicit instruction from a product owner or human developer in the agent conversation that names the PR (for example "fusiona el #129"). Before merging, the agent records it as a PR comment: who approved, that it was by chat, the date, and the approved head commit. Approval covers that commit only; a later push needs a new approval.
- `main` uses **Squash and merge**. A PR stacked on another PR's branch may use a merge commit.
- **Delete the branch as the final step of every merge — mandatory.** Whoever merges deletes the head branch on GitHub ("Delete branch" button, or `git push origin --delete <branch>`) and locally (`git branch -D <branch>`). Before deleting, check that no open PR uses it as its base; if one does, retarget that PR first.
- A merged PR is finished. Follow-up work starts from an up-to-date `main` on a new branch and a new PR.

### Deployment

Merges to `main` publish automatically to `edificadigital.vercel.app` and `somosedificadigital.com`. Pull-request review is the production release gate. See `docs/adr/ADR-001-manual-production-promotion.md` before changing this model.

## Review checklist

### Behavior

- [ ] Requirements and edge cases have executable tests.
- [ ] Spanish and English remain complete and equivalent.
- [ ] Drafts and entered values survive language changes and backward navigation.
- [ ] Errors tell the user what action enables progress; Supabase actions report through toasts.

### Data and security

- [ ] Database changes were planned, tested, **executed before review**, migrated, and documented.
- [ ] Replaced functions and policies were compared with their live definitions; earlier permissions are preserved or their removal is explicit.
- [ ] RLS, grants, Storage rules, foreign-key indexes, and secrets were reviewed; advisors show no unexplained new findings.
- [ ] The PR states whether each migration is applied or pending.
- [ ] Monetary, in-kind, budget, and expense figures retain their distinct meaning.
- [ ] Verification data was rolled back or intentionally labeled.

### Quality and release

- [ ] Relevant tests, lint, and production build pass.
- [ ] Accessibility and responsive states were checked.
- [ ] Existing design language is preserved.
- [ ] Public-facing changes preserve the SEO baseline (see `docs/adr/ADR-005-seo-and-ai-discoverability.md`).
- [ ] The PR is focused, has a human approval (GitHub review or chat instruction recorded as a PR comment), and its branch is deleted after merge.

## Canonical references

- `docs/ARCHITECTURE.md` — runtime and domain boundaries
- `docs/DATABASE.md` — deployed schema, security baseline, and migration ledger
- `docs/DESIGN.md` — design system and interface standards
- `docs/adr/` — decision records (ADR-001 release model, ADR-003 shipments, ADR-004 beneficiary data, ADR-005 SEO, ADR-006 multitenancy)
- `docs/plans/` — implementation order and delivery status
- `docs/specs/` — executable behavior descriptions

---

**Version:** 3.0
**Last updated:** 2026-10-22
**Maintained by:** Product owners and project contributors
