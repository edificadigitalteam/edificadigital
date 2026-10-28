# Plans Index

All project plans are stored in `/docs/plans/` with a consistent naming convention for easy discovery and tracking.

## Naming Convention

```
[TYPE]-[PHASE/SPRINT]-[VERSION]_[DESCRIPTION].md
```

### Components

- **TYPE:** PHASE | SPRINT | ROADMAP | ADR
- **PHASE/SPRINT:** P0 (Phase 0), P1, S1 (Sprint 1), R (Roadmap)
- **VERSION:** v1, v2, etc. (revision number)
- **DESCRIPTION:** Short, kebab-case description

### Examples

- `PHASE-P0-v1_github-supabase-vercel-setup.md` — Phase 0 setup guide
- `SPRINT-S1-v1_day-by-day-plan.md` — Sprint 1 detailed plan
- `ROADMAP-R-v1_post-mvp-extensions.md` — Post-MVP roadmap
- `ADR-001-v1_why-we-chose-supabase.md` — Architecture Decision Record

---

## Current Plans

| Code | File | Status | Description |
|------|------|--------|---|
| P0 | Phase 0 setup docs (in `/docs`) | ✅ Complete | GitHub, Vercel, Supabase initial config |
| S1-D1 | [SPRINT-S1-v1_supabase-foundation.md](SPRINT-S1-v1_supabase-foundation.md) | ✅ Complete | Foundation and Supabase schema |
| S1-D2 | [SPRINT-S1-v1_monetary-beneficiary-foundation.md](SPRINT-S1-v1_monetary-beneficiary-foundation.md) | 🧪 In Review | Monetary receipt intake and protected beneficiary foundation implemented |
| S1-INKIND | [SPRINT-S1-v1_in-kind-shipment-intake.md](SPRINT-S1-v1_in-kind-shipment-intake.md) | ✅ Complete | Bilingual in-kind intake, database, evidence, and persistence implemented |
| S1-DB | [SPRINT-S1-v1_supabase-foundation.md](SPRINT-S1-v1_supabase-foundation.md) | ✅ Complete | Supabase foundation and operational database deployment |
| S1-SYNC | [SPRINT-S1-v1_supabase-submission.md](SPRINT-S1-v1_supabase-submission.md) | ✅ Complete | Authenticated in-kind persistence merged to `main` in PR #16 |
| S1-D3 | (TBD) | 📋 Planned | Day 3: Pillar Transform (New Kit) |
| S1-D4 | (TBD) | 📋 Planned | Day 4: Pillar Impact (New Event) |
| S1-D5 | (TBD) | 📋 Planned | Day 5: Dashboard (2 views) |
| R | `plans/ROADMAP-R-v1_seo-and-offline-modules.md` | 📋 Draft | Part 1 (SEO) superseded by S1-LANDING below; Part 2 (offline field modules) still needs decisions |
| S1-D6 | (TBD) | 📋 Planned | Day 6: PDF + QA + Polish |
| S1-OBS | [SPRINT-S1-v1_vercel-observability.md](SPRINT-S1-v1_vercel-observability.md) | ✅ Complete | Client error tracking reported into Vercel Runtime Logs |
| S1-LANDING | [SPRINT-S1-v1_landing-page-best-practices.md](SPRINT-S1-v1_landing-page-best-practices.md) | 🧪 In Review | Public landing page: SEO, Open Graph, accessibility, AI/answer-engine visibility (GEO/AEO), font/analytics cleanup — implemented across PRs #30, awaiting human review |
| S5-CHARTS | [SPRINT-S5-v1_indicator-visualization-system.md](SPRINT-S5-v1_indicator-visualization-system.md) | ✍️ In Progress | Indicator visualization system: visx charts chosen automatically per indicator, with an optional stored override |
| S5-MEMBERS | [SPRINT-S5-v1_member-directory-and-mantenedores.md](SPRINT-S5-v1_member-directory-and-mantenedores.md) | ✅ Implemented | Member directory "Miembros" (persons and organizations, many-to-many relationships) plus tenant-configurable catalogs ("Mantenedores"); foundation for a later anniversary-greeting automation phase |
| S6-DATES | [SPRINT-S6-v1_member-dates-and-tenure.md](SPRINT-S6-v1_member-dates-and-tenure.md) | ✅ Implemented | Two optional complete dates on a member — celebration (founding or birthday) and affiliation — with elapsed time shown beside each |

| S10-EVAL | [SPRINT-S10-v1_private-evaluations-and-digen-calendar.md](SPRINT-S10-v1_private-evaluations-and-digen-calendar.md) | 🧪 In Review | Self-evaluations privately restricted to DIGEN and cross-unit calendar editing; database activation pending |
| S11-PERM | [SPRINT-S11-v1_permission-based-supervision.md](SPRINT-S11-v1_permission-based-supervision.md) | ✍️ In Progress | Supervision through permissions assigned to people instead of the GEN/DIGEN unit codes (#147) |
| S11-CAL-PRESENT | [SPRINT-S11-v1_calendar-presentation.md](SPRINT-S11-v1_calendar-presentation.md) | ✅ Implemented | Original one-month presentation replaced by CNBV year-table improvement in S11.2 |
| S12.2-DICOM-SCOPE | [SPRINT-S12.2-v1_dicom_scope_cuts_next_help.md](SPRINT-S12.2-v1_dicom_scope_cuts_next_help.md) | 🧪 In Review | Real signed-in-unit selector, INSERT plan RLS path, all four 2027 cuts and compact next-step help |
| S12.1-ANNUAL-PLAN | [SPRINT-S12.1-v1_annual_plan_header_and_objectives.md](SPRINT-S12.1-v1_annual_plan_header_and_objectives.md) | 🧪 In Review | Fix Plan Anual header action overflow and nullable objectives; preserve other-unit assignments |
| S12-REPORTS-TABLET | [SPRINT-S12-v1_reports_2027_edit_and_tablet.md](SPRINT-S12-v1_reports_2027_edit_and_tablet.md) | 🧪 In Review | Urgent draft enabling, 2027 report windows, single calendar entry point, tablet fit and printable report views; routing/editor DB change tracked separately |
| S11.4-ASSOCIATIONS | [SPRINT-S11.4-v1_association_informational_calendar.md](SPRINT-S11.4-v1_association_informational_calendar.md) | ✅ Done | Association informational activities; admin or calendar.manage_all write, everyone in tenant reads; migration applied on edifydb 2026-10-27 (#157) |
| S11.3-CAL-HEAD | [SPRINT-S11.3-v1_calendar-year-header.md](SPRINT-S11.3-v1_calendar-year-header.md) | 🧪 In Review | Editable year-specific masthead in all calendar formats, preserving period notes and pending-state blue-gray color |\n| S11.2-CAL-TABLE | [SPRINT-S11.2-v1_pdf-calendar-table-live-review.md](SPRINT-S11.2-v1_pdf-calendar-table-live-review.md) | 🧪 In Review | Continuous navy-header PDF-style calendar, date/activity/responsibles, inline edits and color review status |
| S11.1-SEO | [SPRINT-S11.1-v1_seo-canonical-and-indexing-fixes.md](SPRINT-S11.1-v1_seo-canonical-and-indexing-fixes.md) | 🧪 In Review | SEO drift fixes: www→apex redirect, noindex on app and Vercel alias, real 404s, sitemap/robots cleanup, FAQPage JSON-LD synced with the visible FAQ |

### Legend

- 📋 **Draft** — Being written
- ✍️ **In Progress** — Actively being executed
- 🧪 **In Review** — Implemented and awaiting human pull-request review
- ✅ **Complete** — Done and reviewed
- 🔄 **Archived** — Old version (see newer)

---

## How to Use This Index

1. **Find a plan:** Look up the code (e.g., "S1-D2") to locate its file
2. **Check status:** Green checkmark = ready to execute
3. **Reference in PRs:** Link plans in PR descriptions, e.g., "This implements SPRINT-S1-v1"
4. **Update as you go:** When a plan changes, increment the version (v1 → v2)
5. **Archive old:** Move outdated plans to `/docs/plans/archive/`

---

## Plan Template

Each new plan should include:

```markdown
# [TYPE]: [DESCRIPTION]

**Code:** [TYPE]-[PHASE/SPRINT]-[VERSION]
**Status:** Draft | In Progress | Complete
**Owner:** [Name]
**Created:** [Date]
**Last Updated:** [Date]

## Overview

[1-2 paragraph summary of what this plan covers]

## Objectives

- [ ] Objective 1
- [ ] Objective 2
- [ ] Objective 3

## Detailed Steps

[Step-by-step breakdown]

## Deliverables

- File/artifact 1
- File/artifact 2

## Risks & Mitigation

| Risk | Mitigation |
|------|---|
| Risk 1 | How we handle it |

## Checklist

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Next

What plan comes next after this one?
```

---

**Version:** 2.0
**Last Updated:** 2026-07-19
**Maintained by:** Product owners and project contributors
