# ADR-001: Manual Production Promotion on Vercel

**Status:** Accepted
**Date:** [date]
**Deciders:** Isaac Delgado, Yang (yangetze)

## Context

Prompt 2 (Vercel Setup) connects the `frontend` app to Vercel with Git integration on the `main` branch. Vercel's default behavior is to auto-promote every push to the production branch straight to the production domain (and any custom domain attached to it).

## Decision

Pushes to `main` (and PR branches) still auto-build, producing a preview deployment URL for review. **No build is automatically promoted to the production domain.** Going live is a manual, explicit action:

- Dashboard: open the desired deployment → **Promote to Production**
- CLI: `vercel promote <deployment-url> --prod`

This applies even after a custom domain is attached — the domain always points at whatever was last manually promoted, never at the newest build automatically.

## Where this is configured

Vercel Project Settings → Git (or Settings → Environments → Production, depending on dashboard version): disable automatic production promotion for the `main` branch while leaving preview builds enabled.

## Consequences

- Every merge to `main` is safe to build without risk of an unreviewed change going live.
- Someone must remember to manually promote when a release is actually ready — add "Promote to Production" as an explicit step in the release checklist.
- Preview URLs remain the fast feedback loop for reviewing PRs before merge.

## Related

- `PROMPT_2_Vercel_Setup.md` (Phase 0 setup)
- `docs/ARCHITECTURE.md` — Deployment section
