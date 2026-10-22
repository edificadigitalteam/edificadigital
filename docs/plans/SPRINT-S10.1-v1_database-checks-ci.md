# SPRINT-S10.1 · Database checks in CI

## Outcome

Every pull request that touches `supabase/**` replays all migrations on an empty local Supabase stack and runs the pgTAP suite. A migration that fails to replay, or a failing pgTAP assertion, turns the pull request red before review.

## Why

The S10 migration (`20261021142000_private_executive_evaluations_digen_calendar.sql`, #127/#128) reached review with invalid `as $ … $` delimiters and pgTAP files that had never been executed. Nothing in CI ran `supabase/tests/*.sql`.

## Change

- New workflow `.github/workflows/database-checks.yml`, triggered on `pull_request` with paths `supabase/**` and on `workflow_dispatch`.
- Steps: `supabase/setup-cli` (pinned) → `supabase start` (applies `supabase/migrations/` from scratch using `supabase/config.toml`) → `supabase test db` → `supabase stop`.
- Only the local stack inside the runner is used. No secrets, project ref, or production credentials.
- `AGENTS.md` "Database rules" and `docs/DATABASE.md` describe the job.

## Database impact

None to the deployed schema.

The first CI run failed on `20260917031741_add_digen_and_management_report_oversight.sql`, which raised `CNBV organization not found` on an empty database. A later migration cannot repair a file that aborts the replay, so the product owner approved a one-line guard edit (`raise notice …; return;`), matching `20261001214651_cnbv_general_level_unit.sql`. `edifydb` already recorded this migration and never re-runs it. See "Replay-guard exception" in `docs/DATABASE.md`.

## Verification

- The job runs green on this pull request.
- A deliberately broken migration (temporary commit, then reverted) makes it fail.
