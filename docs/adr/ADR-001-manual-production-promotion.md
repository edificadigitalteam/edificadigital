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

## Related

- `PROMPT_2_Vercel_Setup.md` (Phase 0 setup)
- `docs/ARCHITECTURE.md` — Deployment section
- `.github/workflows/promote-custom-domain.yml`
