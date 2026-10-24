# SPRINT S11.1: SEO canonical and indexing fixes

**Code:** SPRINT-S11.1-v1
**Status:** 🧪 In Review
**Owner:** Yang (yangetze)
**Created:** 2026-10-24

## Overview

Audit of the public SEO baseline from ADR-005 against the current code. The landing copy, routing, and domains changed after S1-LANDING shipped, and the static SEO artifacts did not follow. This plan fixes the drift and the canonical/indexing problems it causes. Frontend and Vercel configuration only.

## Findings

| # | Problem | Effect on search engines |
|---|---|---|
| 1 | `www.somosedificadigital.com` serves the same deployment as the apex (both aliased by `promote-custom-domain.yml`), with no redirect. | Two hosts with identical content; relies only on the canonical tag. |
| 2 | `edificadigital.vercel.app` serves production with no `noindex`. | A third duplicate host. |
| 3 | `vercel.json` rewrites every path (`/(.*)`) to `index.html`, whose canonical always points to `/`. | Every unknown URL returns 200 with the landing (soft 404), reported as "duplicate, Google chose a different canonical". |
| 4 | `sitemap.xml` lists `/donations/in-kind` and `/donations/monetary`, which now only exist as JavaScript redirects into `/app`, and their canonical points to `/`. | Sitemap URLs that redirect and declare another canonical: "Page with redirect" / "Alternate page with proper canonical tag". |
| 5 | `robots.txt` disallows `/app`, while the landing links to `/app` (login). | "Indexed, though blocked by robots.txt"; crawlers can never read a noindex for those URLs. |
| 6 | `FAQPage` JSON-LD has 6 old questions; the visible FAQ has 8 different ones. | Structured data that differs from visible content (ADR-005 §6) is ineligible for rich results. |
| 7 | Static meta description and `Organization.description` differ from the description React sets. | Crawlers and the rendered page disagree. |
| 8 | `llms.txt` still describes "Donaciones y proyectos" as a separate module. | AI assistants cite outdated positioning. |
| 9 | Six SEO tests were stale and failing. | No regression protection. |

`hreflang` stays out: Spanish and English share one URL through the language toggle, and `hreflang` needs a distinct URL per language.

## Changes

- `frontend/vercel.json`: 308 `www` → apex; server-side 308 for `/donations/monetary/*` and `/donations/in-kind/*` to their `/app` destinations; `X-Robots-Tag: noindex, nofollow` on `/app`, `/app/*`, `/activar`; `X-Robots-Tag: noindex` on the `edificadigital.vercel.app` host; rewrites limited to the real SPA routes (`/app`, `/app/*`, `/activar`).
- `frontend/public/404.html`: bilingual, `noindex` 404 page served by Vercel for unknown URLs.
- `frontend/public/robots.txt`: allow all, no `Disallow`, sitemap pointer.
- `frontend/public/sitemap.xml`: only `/`.
- `frontend/index.html`: description and `Organization.description` equal the Spanish `metaDescription`; keywords include the three confirmed ones; `FAQPage` regenerated from the 8 visible Spanish FAQ entries.
- `frontend/public/llms.txt`: synced with the current landing copy.
- Tests: `frontend/seo-routing.test.js` (new), `frontend/index.test.js`, `frontend/public.test.js`, `ProductLandingPage.faq.test.js` (now compares JSON-LD to the visible FAQ word for word).

## Database implication

None.

## Verification

- Red: 7 SEO tests failing before the change. Green: all SEO tests pass; `pnpm test` keeps only 2 unrelated pre-existing failures (mobile header); `pnpm lint` has no errors; `pnpm build` copies `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt` into `dist/`.
- On the PR preview: `/app` and `/activar` return `X-Robots-Tag`; an unknown path returns 404; `/donations/monetary` returns 308.
- After merge and promotion (manual, product owner): in Google Search Console, resubmit `sitemap.xml`, request validation for the canonical/redirect/blocked-by-robots reports, and run the Rich Results test on `/`.

## Notes

- Sign-in links already sent to `www` redirect to the apex with their query and hash intact.
