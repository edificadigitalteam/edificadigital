# ADR-005: SEO and AI-Discoverability Baseline for Public Pages

**Status:** Implemented and deployed
**Date:** 2026-07-26

## Context

Edifica Digital's public surface (`/`, and the public donation-intake routes under `/donations/*`) is a client-rendered SPA (Vite + React, no server-side rendering). Search engines, social link-preview bots (WhatsApp, LinkedIn, X, iMessage), and the crawlers that feed AI assistants (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, and similar) mostly do not execute JavaScript. Before this decision, `frontend/index.html` shipped a mismatched, JS-only-corrected title and description, no Open Graph/Twitter Card tags, no canonical link, no structured data, no `robots.txt`/`sitemap.xml`, and no favicon wiring at all — meaning link previews and non-JS crawlers saw incorrect or empty content regardless of what the React app rendered after load.

A full audit and implementation (`docs/plans/SPRINT-S1-v1_landing-page-best-practices.md`) fixed the landing page. This ADR records the durable decisions from that work as a standing baseline for **any current or future public-facing page** in this repository, not a one-time fix — SEO and AI-discoverability are treated as an ongoing requirement, the same way accessibility and bilingual parity already are in `AGENTS.md`.

## Decision

1. **Static-first metadata.** Every public route's baseline `<title>`, meta description, canonical link, Open Graph/Twitter Card tags, and JSON-LD structured data must exist in static HTML — not only injected via a client-side `useEffect`. Client-side language toggling may still update these for in-browser UX, but the static baseline (Spanish, the default language) must already be correct so it survives for crawlers that never execute JS. This avoids re-litigating the SSR/prerendering question per page: static metadata solves the crawler problem without a rendering-architecture change.
2. **SSR/prerendering stays deferred.** A full server-rendering migration (Next.js/Remix, or prerendering) is not adopted. It would be justified only if analytics later show poor organic indexing despite a correct static-metadata baseline — not by default.
3. **Canonical production domain.** All canonical links, `sitemap.xml` entries, and structured-data `url` fields use `https://somosedificadigital.com/`, never the Vercel preview/production alias (`edificadigital.vercel.app`).
4. **`robots.txt` treats AI crawlers like any other crawler.** A single `User-agent: *` block allows all public content and disallows only the authenticated application boundary (`/app`, `/app/*`), with a `Sitemap:` pointer. There is no AI-specific carve-out or block list — the product decision is to let AI assistants read and cite the public site on the same terms as search engines, and to keep the disallow boundary aligned with what's actually private (the authenticated app), not with the crawler's identity.
5. **`public/llms.txt` is a maintained, first-class artifact.** A bilingual (ES/EN) plain-Markdown summary of the product (modules, plans, contact) lives at `frontend/public/llms.txt`, with the same standing as `robots.txt`/`sitemap.xml`: it must be kept factually in sync with the public copy whenever that copy changes, not left to go stale.
6. **Structured data must match visible content exactly.** `Organization` JSON-LD is required on the public site. Any FAQ-style content ships both as visible, accessible markup (e.g. `<details>/<summary>`) and a matching `FAQPage` JSON-LD block with the same question/answer pairs — never structured data claiming more than what a visitor actually sees.
7. **Confirmed target keywords (current):** "software para iglesias", "software para donaciones", "software de trazabilidad de donaciones". These inform meta descriptions and JSON-LD copy without keyword-stuffing; revisit if product positioning changes.
8. **Legal pages stay a separate, tracked gap.** Privacy Policy/Terms of Service do not exist yet. A footer link ships only once real legal content is published under its own plan — never a link to a page that doesn't exist.
9. **Icons are a discoverability requirement, not decoration.** Every public page needs a working `<link rel="icon">` (SVG + `.ico` fallback) and `apple-touch-icon` — `index.html` previously had none at all, which is treated as a shipped-bug class, not an optional nice-to-have.

## Consequences

- New public pages/routes must ship the static-metadata baseline (title, description, canonical, OG/Twitter, JSON-LD) as part of their initial implementation, not as a follow-up task — this is now part of the standard definition of done for public-facing work, alongside bilingual parity and accessibility.
- `robots.txt`, `sitemap.xml`, and `llms.txt` need a review whenever a public route is added, removed, or moved (e.g. adding a new public route means adding it to `sitemap.xml` and confirming it isn't accidentally caught by the `/app` disallow rule).
- FAQ-style or answer-oriented public copy always ships with matching structured data — adding a question to a visible FAQ without updating its JSON-LD counterpart (or vice versa) is a regression.
- Keyword and positioning changes require updating meta copy and JSON-LD together, not one without the other.
- SSR/prerendering remains an open door, not a commitment — it should be reconsidered with real indexing data, not spec'd preemptively.

## Deployment record

Implemented across `docs/plans/SPRINT-S1-v1_landing-page-best-practices.md` (PR #29 for the plan, PR #30 for implementation): static meta/Open Graph/icons/JSON-LD `Organization`, accessibility (skip link, `:focus-visible`, `prefers-reduced-motion`), `robots.txt`/`sitemap.xml`/`llms.txt`/FAQ with `FAQPage` JSON-LD, and CTA analytics events plus a landing-scoped font-weight trim. No database changes were involved — this is a frontend/static-asset and governance-documentation decision.
