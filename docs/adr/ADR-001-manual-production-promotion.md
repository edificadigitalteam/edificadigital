# ADR-001: Manual Promotion for the Custom Domain Only

**Status:** Accepted
**Date:** [date]
**Deciders:** Isaac Delgado, Yang (yangetze)

## Context

Prompt 2 (Vercel Setup) connects the `frontend` app to Vercel with Git integration on the `main` branch. Vercel's default behavior is: every push to `main` auto-builds and auto-promotes to Production, which updates **every** domain currently attached as a Production domain — the default `edificadigital.vercel.app` and any custom domain alike, with no built-in distinction between them.

The production custom domain is `somosedificadigital.com`.

## Decision

- The default Vercel domain (`edificadigital.vercel.app` / `edificadigital-yangetzes-projects.vercel.app`) **keeps normal auto-deploy behavior** — every push to `main` publishes there automatically. No special configuration needed; this is Vercel's default.
- **`somosedificadigital.com`** is never attached as an auto-tracking Production domain. It only changes when someone deliberately runs the **"Promote to Custom Domain"** GitHub Action (`.github/workflows/promote-custom-domain.yml`), triggered manually from the Actions tab (`workflow_dispatch`, no automatic trigger). The workflow runs:
  ```
  vercel alias set edificadigital.vercel.app somosedificadigital.com
  ```
  which points the custom domain at whatever is currently live on the default domain, at the time you choose to run it.
- Requires a `VERCEL_TOKEN` repository secret (Vercel dashboard → Settings → Tokens → Create Token → add as a GitHub Actions secret).

## Consequences

- `edificadigital.vercel.app` is always a live, current reflection of `main` — useful for the team to check builds without any manual step.
- `somosedificadigital.com` only changes when someone deliberately runs the workflow — no risk of an unreviewed merge going live on the real domain.
- One-click promotion via GitHub Actions — no local Vercel CLI setup needed to promote.

## Bug found and fixed: domain was silently auto-tracking `main`

Shortly after setup, `somosedificadigital.com` was found live with content from a direct push to `main` that nobody had run the promotion workflow for. Root cause: once a domain is attached to a Vercel project without an explicit `gitBranch` binding, Vercel auto-aliases it to Production on every new Production deployment — regardless of how the domain was first pointed there. Running `vercel alias set` once does not "pin" the domain; it's a snapshot that Vercel's Git integration silently overwrites on the next push to `main`.

**Fix:** the workflow now also `PATCH`es both `somosedificadigital.com` and `www.somosedificadigital.com` to bind `gitBranch` to a dummy branch name (`manual-domain-promotion-only`) before every alias operation. This permanently unhooks the domains from auto-tracking Production; the only thing that ever moves them afterward is this workflow's explicit `vercel alias set` call. This step re-runs (and re-applies) every time the workflow fires, so the binding self-heals even if something in the Vercel dashboard ever resets it.

**Important:** Vercel validates that `gitBranch` must reference a branch that actually exists in the connected GitHub repo — a purely fictional name fails with `git_branch_not_found` (HTTP 400). The fix required creating an actual, empty `manual-domain-promotion-only` branch in the repo (from `main`, never pushed to again) purely so this binding has something real to point at. Verified end-to-end: ran the workflow, confirmed both the `gitBranch` PATCH and the alias set succeeded, and `somosedificadigital.com` resolved to the expected deployment afterward.

## Related

- `PROMPT_2_Vercel_Setup.md` (Phase 0 setup)
- `docs/ARCHITECTURE.md` — Deployment section
- `.github/workflows/promote-custom-domain.yml`
