# SPRINT: Vercel Frontend Observability

**Code:** S1-OBS
**Status:** In Progress
**Owner:** AI coding agent (Claude)
**Created:** 2026-07-19
**Last Updated:** 2026-07-19

## Overview

`docs/TODO.md` requested application logging/monitoring on Vercel (runtime logs, error tracking) for the deployed frontend. The project is a static React + Vite SPA on Vercel with no existing serverless functions, so uncaught client errors are currently invisible outside a user's own browser console. This plan adds a minimal, zero-dependency path for client errors to reach Vercel's built-in Runtime Logs, which are already queryable from the dashboard, the `vercel logs` CLI, and the Vercel MCP `get_runtime_logs` / `get_runtime_errors` tools.

No database change is involved. No third-party logging service is introduced.

## Objectives

- [x] Give uncaught JS errors, unhandled promise rejections, and React render errors a path into Vercel's Runtime Logs.
- [x] Avoid a blank white screen on a render crash by rendering a minimal bilingual fallback.
- [x] Surface failed in-kind donation submissions (already caught in the UI) in the same log stream, since operational failures on an auditable donation flow are the highest-value signal.
- [x] Keep the log payload free of donor PII and free of secrets, and cap payload size to avoid log flooding or abuse.

## Approach

- Add a Vercel Serverless Function at `frontend/api/log.js`. Vercel auto-detects any file under `/api` as a Node.js function regardless of the framework (Vite has no server of its own), so no build config change is needed.
- The function accepts `POST` only, sanitizes the body with a pure helper (`frontend/api/sanitize.js`: strips newlines, truncates every field, whitelists `level`), and writes one structured JSON line via `console.error`/`console.warn`. Those lines land in Vercel's Runtime Logs automatically — no log drain or paid add-on required.
- Add `frontend/src/lib/logger.js` with a pure `buildErrorPayload` (testable without a DOM) and a browser-only `reportClientError` that POSTs to `/api/log` with `keepalive: true`, swallowing network failures so logging can never break the UI. In-memory de-duplication caps repeated identical errors per page load.
- `installGlobalErrorLogging()` wires `window.addEventListener('error', …)` and `('unhandledrejection', …)`, called once from `main.jsx`.
- Add `frontend/src/lib/ErrorBoundary.jsx`, a React error boundary wrapping `<App />` in `main.jsx`, reporting the error and rendering a short bilingual "reload" fallback instead of a blank page.
- In `InKindDonationFlow.jsx`, the existing `submit()` catch block (which already maps `SubmissionError.stage` to a user-facing message) also calls `reportClientError` with the stage and error message only — never the donor draft.

## Deliverables

- `frontend/api/log.js`, `frontend/api/sanitize.js` (+ tests)
- `frontend/src/lib/logger.js`, `frontend/src/lib/ErrorBoundary.jsx` (+ tests)
- `frontend/src/main.jsx` wiring
- `frontend/src/features/in-kind/InKindDonationFlow.jsx` submission-failure logging
- `docs/ARCHITECTURE.md` observability note
- `docs/TODO.md` item checked off

## Risks & Mitigation

| Risk | Mitigation |
|------|---|
| Client could flood `/api/log` with repeated errors | In-memory de-dupe by `level:message` per page load, plus per-field truncation server-side |
| Donor PII or Supabase error internals leaking into logs | Only `message`/`stack`/`context` strings are sent; submission logging passes the stage name and `error.message`, never the draft or Supabase row payloads |
| Log injection via newline-containing error messages | Sanitizer strips `\r`/`\n` before logging |
| Adding a serverless function changes the deploy model (previously static-only) | Function is stateless, dependency-free, and additive; existing static rewrite in `vercel.json` is untouched |

## Checklist

- [x] Plan documented
- [x] Tests written (`api/sanitize.test.js`, `api/log.test.js`, `src/lib/logger.test.js`)
- [x] Implementation complete
- [x] `pnpm test`, `pnpm lint`, `pnpm build` pass
- [x] Docs updated (`ARCHITECTURE.md`, `TODO.md`, this plan)
- [x] Pull request opened

## Next

Investigate the second TODO item: exportable/persistent Supabase logging (Auth, API, Postgres) beyond the default dashboard viewer.
