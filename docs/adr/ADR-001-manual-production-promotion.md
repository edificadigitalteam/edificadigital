# ADR-001: Manual Promotion for the Custom Domain Only

**Status:** Accepted
**Date:** [date]
**Deciders:** Isaac Delgado, Yang (yangetze)

## Context

Prompt 2 (Vercel Setup) connects the `frontend` app to Vercel with Git integration on the `main` branch. Vercel's default behavior is: every push to `main` auto-builds and auto-promotes to Production, which updates **every** domain currently attached as a Production domain — the default `edificadigital.vercel.app` and any custom domain alike, with no built-in distinction between them.

## Decision

- The default Vercel domain (`edificadigital.vercel.app` / `edificadigital-yangetzes-projects.vercel.app`) **keeps normal auto-deploy behavior** — every push to `main` publishes there automatically. No special configuration needed; this is Vercel's default.
- The **custom domain** (once added) is never attached as an auto-tracking Production domain. It is only pointed at a deployment manually and explicitly, via:
  ```
  vercel alias set <deployment-url> yourdomain.com
  ```
  When adding the domain in the dashboard, skip/avoid any prompt that links it to auto-track Production or a Git branch — add it for DNS/TLS only, then alias it manually when ready to go live there.

## Consequences

- `edificadigital.vercel.app` is always a live, current reflection of `main` — useful for the team to check builds without any manual step.
- The custom (real, public-facing) domain only changes when someone deliberately runs `vercel alias set` — no risk of an unreviewed merge going live on the real domain.
- Requires the Vercel CLI locally (`npm i -g vercel`, `vercel login`) to run the alias command; there's no dashboard-only equivalent as reliable as the CLI for this.

## Related

- `PROMPT_2_Vercel_Setup.md` (Phase 0 setup)
- `docs/ARCHITECTURE.md` — Deployment section
