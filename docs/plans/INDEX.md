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
| S1-D2 | (TBD) | 📋 Planned | Day 2: Pillar Receive (New Donation) |
| S1-INKIND | [SPRINT-S1-v1_in-kind-shipment-intake.md](SPRINT-S1-v1_in-kind-shipment-intake.md) | ✅ Complete | Bilingual in-kind intake, database, evidence, and persistence implemented |
| S1-DB | [SPRINT-S1-v1_supabase-foundation.md](SPRINT-S1-v1_supabase-foundation.md) | ✅ Complete | Supabase foundation and operational database deployment |
| S1-SYNC | [SPRINT-S1-v1_supabase-submission.md](SPRINT-S1-v1_supabase-submission.md) | ✅ Review | Authenticated persistence complete; production magic-link interaction requires human verification |
| S1-D3 | (TBD) | 📋 Planned | Day 3: Pillar Transform (New Kit) |
| S1-D4 | (TBD) | 📋 Planned | Day 4: Pillar Impact (New Event) |
| S1-D5 | (TBD) | 📋 Planned | Day 5: Dashboard (2 views) |
| R | `plans/ROADMAP-R-v1_seo-and-offline-modules.md` | 📋 Draft | SEO + offline-capable field modules (needs decisions before implementation) |
| S1-D6 | (TBD) | 📋 Planned | Day 6: PDF + QA + Polish |

### Legend

- 📋 **Draft** — Being written
- ✍️ **In Progress** — Actively being executed
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
