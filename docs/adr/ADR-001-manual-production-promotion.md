# ADR-001: Custom Domain Promotion — Status and History

**Status:** Superseded (manual-only approach abandoned; see below)
**Date:** [date]
**Deciders:** Isaac Delgado, Yang (yangetze)

## Current Behavior (as of this revision)

Both `edificadigital.vercel.app` (default domain) and `somosedificadigital.com` / `www.somosedificadigital.com` (production custom domain) **auto-track Production** — every push to `main` publishes to all of them automatically. This is Vercel's default behavior, restored deliberately after the manual-only approach below caused a live outage.

The `.github/workflows/promote-custom-domain.yml` workflow still exists but currently only re-asserts this state (clears any `gitBranch` binding, re-aliases to the current production deployment) rather than providing true manual-only promotion.

## Original Goal (abandoned)

The original intent was: default domain auto-publishes, but the real production domain (`somosedificadigital.com`) only updates when someone deliberately runs a promotion workflow — so an unreviewed merge could never go live on the public-facing domain automatically.

## What Was Tried and Why It Failed

1. **`vercel alias set` only, no domain-level lock.** Result: the custom domain silently auto-tracked every new Production deployment anyway — Vercel re-aliases any domain without an explicit `gitBranch` binding on every Production deploy, regardless of prior manual aliasing. A direct push to `main` went live on the real domain without anyone running the promotion workflow.

2. **Bind `gitBranch` to a dummy branch name that doesn't exist.** Result: `git_branch_not_found` (HTTP 400) — Vercel validates the branch must actually exist in the connected repo.

3. **Bind `gitBranch` to a real but empty branch (`manual-domain-promotion-only`, created from `main`, never pushed to).** This appeared to work immediately after running the workflow (verified via API). However, after the *next* Production deployment happened on `main` (unrelated to this domain), `somosedificadigital.com` and its `www` variant **disappeared from the project's domain list entirely** — orphaned, not pinned. External visitors hit a Vercel-branded error page instead of the site. This was a live incident, not just a policy violation.

**Conclusion:** binding a custom domain's `gitBranch` to a branch with zero deployments does not "freeze" the domain at its last manually-aliased deployment the way we assumed. Vercel's domain-to-environment matching appears to detach the domain instead once any Production deployment happens outside that branch. Achieving true manual-only promotion for a domain that shares a project with an auto-deploying default domain likely requires either:
- Vercel's Pro-tier "Deployment Protection: require approval before deployment," or
- A properly configured Custom Environment (with its own branch and actual deployments matched to it) rather than a `vercel alias set` CLI override, or
- Not sharing the project's default Production tracking at all (e.g. a separate project).

None of these were implemented — this needs real research (ideally testing against a low-stakes domain first) before being reattempted.

## Consequences of Reverting to Auto-Tracking

- Reliable: matches Vercel's normal, well-tested behavior — no more surprise orphaning.
- Every push to `main` (including direct pushes, not just reviewed PRs) goes live on `somosedificadigital.com` immediately. This is a real tradeoff: the branch protection rules in `agents.md` (no direct commits to `main`, PR review required) are now the *only* thing standing between a bad change and the live production domain.
- The `manual-domain-promotion-only` branch is no longer load-bearing but is harmless to leave in the repo.

## Related

- `PROMPT_2_Vercel_Setup.md` (Phase 0 setup)
- `docs/ARCHITECTURE.md` — Deployment section
- `.github/workflows/promote-custom-domain.yml`
