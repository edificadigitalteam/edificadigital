# SPRINT: Landing Page Best Practices

**Code:** SPRINT-S1-v1_landing-page-best-practices
**Status:** Draft
**Owner:** Isaac Delgado, Yang (yangetze)
**Created:** 2026-07-26
**Last Updated:** 2026-07-26 (all open questions resolved except FAQ/llms.txt drafting ownership — see Open Questions)

## Overview

Audit of the public landing page (`frontend/src/features/platform/ProductLandingPage.jsx`, served at `/` via `frontend/src/App.jsx`) against standard SEO, social-preview, accessibility, legal, performance, and AI/answer-engine visibility (GEO/AEO) best practices. This plan captures the findings and scopes the fix as a self-contained frontend task — no app/dashboard routes are affected.

This supersedes **Part 1 (SEO)** of `ROADMAP-R-v1_seo-and-offline-modules.md`: the SSR/prerendering open question there is resolved below (deferred to Phase 2). Part 2 of that roadmap (offline-capable modules) is unrelated and stays as-is.

## Objectives

- [ ] Fix static `<meta>` title/description in `frontend/index.html` to match real landing copy
- [ ] Add Open Graph + Twitter Card tags and a social preview image
- [ ] Add `robots.txt`, `sitemap.xml`, canonical `<link>` (domain: `somosedificadigital.com`), `apple-touch-icon`/`favicon.ico` fallback
- [ ] Add JSON-LD `Organization` structured data (aligned with target keywords: "software para iglesias", "software para donaciones", "software de trazabilidad de donaciones")
- [ ] Accessibility: skip link, `prefers-reduced-motion` support, visible `:focus-visible` states, `aria-label` on icon-only controls
- [ ] Reduce Google Fonts payload (currently 5 weights across 2 families, external render-blocking request)
- [ ] Track CTA clicks (hero primary/secondary, plans, closing WhatsApp link) as custom Vercel Analytics events
- [ ] Decide SSR/prerendering timing (recommended: defer to Phase 2, see below)
- [ ] AI/answer-engine visibility (GEO/AEO): `llms.txt`, an FAQ section with quotable answers, and an explicit `robots.txt` policy for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot)

## Findings (source of this plan)

Reviewed: `frontend/src/features/platform/ProductLandingPage.jsx`, `frontend/src/features/platform/product-landing.css`, `frontend/index.html`, `frontend/public/`, `frontend/vercel.json`, `frontend/src/contact.js`.

| Area | Gap |
|---|---|
| SEO | `index.html` title/description don't match `ProductLandingPage.jsx` copy; both are only corrected client-side via `useEffect`. No canonical link, no `robots.txt`, no `sitemap.xml`, no JSON-LD. |
| Social preview | No Open Graph or Twitter Card tags at all; no social image. Preview bots (WhatsApp, LinkedIn, X, iMessage) don't execute JS. |
| Icons | Only `favicon.svg` exists; no `apple-touch-icon`, no `.ico` fallback, no web manifest. |
| Accessibility | No skip link before the header; no `prefers-reduced-motion` rule in `product-landing.css` (0 matches); no explicit `:focus`/`:focus-visible` styling; hamburger menu button and language-toggle button have no `aria-label`. |
| Legal | No Privacy Policy or Terms link anywhere on the landing or footer, despite the platform handling donor/beneficiary data. Confirmed: no such content exists yet — **deferred to its own plan**, out of scope here. |
| Performance | 5 font weights across 2 families loaded from `fonts.googleapis.com`, render-blocking. |
| Analytics | `@vercel/analytics` only tracks pageviews; no event tracking on CTAs, so landing conversion can't be measured. |
| Rendering | Pure client-rendered SPA (confirmed: `index.html` `<div id="root">` is empty, all content injected by `main.jsx`/React). Affects crawler reliability and perceived load speed — does not, by itself, block the Open Graph/meta fix above. |
| AI/answer-engine visibility | No `llms.txt`; no FAQ or self-contained factual statements written to be quoted verbatim; `robots.txt` doesn't exist yet, so there's no explicit allow/deny policy for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, etc.). |

### SSR / prerendering — recommendation

Full SSR (migrating to Next.js/Remix) is not warranted for one public marketing route while the rest of the app is authenticated and not meant to be indexed. Static, correct `<meta>`/Open Graph tags in `index.html` (no JS execution required) resolve the social-preview problem and give Google (which does execute JS) a reliable baseline. **Recommendation: ship the static-meta fix now, defer prerendering to a Phase 2 item**, revisited only if analytics later show poor organic indexing. **Approved by product owners — deferred.**

### AI/answer-engine visibility (GEO/AEO) — what this means and why it's the same rendering problem

"SEO para IAs" — más formalmente **GEO (Generative Engine Optimization)** o **AEO (Answer Engine Optimization)** — es optimizar el contenido para que asistentes de IA (ChatGPT, Claude, Perplexity, Gemini, Copilot) lo puedan leer, citar o usar como respuesta cuando alguien les pregunta sobre el tema. No es un campo separado del SEO tradicional; comparte la misma restricción técnica ya identificada arriba:

- Los crawlers que alimentan estos asistentes (`GPTBot`, `ClaudeBot`/`anthropic-ai`, `PerplexityBot`, `Google-Extended`, `CCBot` de Common Crawl) **generalmente no ejecutan JavaScript**, igual que los bots de vista previa social. Si el contenido solo existe después de que React lo renderiza, es invisible para ellos — el mismo problema que motiva el fix de meta/OG estáticos, no uno nuevo.
- Estos crawlers sí respetan `robots.txt`. **Decisión confirmada:** se permite el acceso a todo el contenido público (landing, `/donations/in-kind`, `/donations/monetary`); solo se bloquea `/app` y `/app/*` — el dashboard autenticado — igual que se bloquearía para cualquier otro crawler, no como una postura anti-IA.
- Un archivo **`llms.txt`** (estándar emergente, análogo a `robots.txt` pero pensado para dar a un LLM un resumen limpio en Markdown del sitio: qué es Edifica, sus módulos, planes y a quién sirve) en la raíz del sitio facilita que estos asistentes tengan un resumen correcto y citable, sin depender de que rendericen el HTML final.
- El contenido mismo se beneficia de frases autocontenidas y citables ("Edifica es un software modular para iglesias y organizaciones cristianas que centraliza donaciones, administración eclesial y productos digitales") y de una sección de **preguntas frecuentes** con pares pregunta/respuesta directos — ayuda tanto a snippets destacados de Google como a que un asistente de IA cite la respuesta correcta en vez de inventar una.

**Recomendación:** incluir esto en el mismo alcance que el fix de SEO/OG estático (mismo mecanismo, mismo archivo `robots.txt`), no como un proyecto aparte. Es contenido y configuración, no requiere SSR.

## Database Impact

None. This is a frontend/static-asset-only change — no Supabase schema, RLS, or migration involved.

## Affected Files

- `frontend/index.html` — static meta, Open Graph/Twitter Card, canonical, icons, JSON-LD
- `frontend/public/robots.txt` (new)
- `frontend/public/sitemap.xml` (new)
- `frontend/public/og-image.png` or `.jpg` (new — designed from existing brand marks/colors in `product-landing.css`)
- `frontend/public/apple-touch-icon.png`, `favicon.ico` (new)
- `frontend/src/features/platform/ProductLandingPage.jsx` — skip link, `aria-label`s, CTA event tracking
- `frontend/src/features/platform/product-landing.css` — `prefers-reduced-motion`, `:focus-visible` states, skip-link styling
- `frontend/index.html` — font `<link>` weight reduction
- `frontend/public/llms.txt` (new) — bilingual plain-text/Markdown summary of Edifica for AI assistants
- `frontend/public/robots.txt` — allow all crawlers (including `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`) on public content; `Disallow: /app` and `/app/*` only, matching the authenticated-dashboard boundary already used in `frontend/src/main.jsx`
- `frontend/src/features/platform/ProductLandingPage.jsx` — FAQ section with self-contained, quotable Q&A copy (bilingual)

## Open Questions (need a decision before implementing)

- [x] Meta description copy — confirmed: `Edifica Digital | Software para iglesias`
- [x] Open Graph social preview image — confirmed: design it from the existing brand marks/colors already in `product-landing.css` (brand mark, purple/orange/yellow tones), no external asset needed
- [x] Privacy Policy / Terms — confirmed: does not exist yet. Deferred out of this plan entirely (see "Deferred" below); the footer legal link ships once that separate plan produces real content
- [x] Canonical production domain — confirmed: `somosedificadigital.com`
- [x] Target keywords — confirmed: "software para iglesias", "software para donaciones", "software de trazabilidad de donaciones" (suggested to align with the traceability/transparency positioning already in `CLAUDE.md`'s mission and the current meta description)
- [x] SSR/prerendering deferral to Phase 2 — approved
- [x] AI-training/answer crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`) in `robots.txt` — confirmed: **allow** on all public content (landing, `/donations/in-kind`, `/donations/monetary`). **Disallow only `/app` and `/app/*`** (the authenticated dashboard, per `frontend/src/main.jsx`'s `isDashboard` check) — same boundary as anything else that shouldn't be crawled, not a blanket AI opt-out.
- [ ] Who drafts the FAQ questions/answers and the `llms.txt` summary — product owners or can this plan propose a first draft from existing landing copy for review?

## Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Font-weight reduction changes visual weight in headings/buttons | Verify against current design system visually before/after; keep at least the weights actually used in `product-landing.css` |
| A brand-derived OG image reads as an afterthought rather than deliberate art | Use the actual brand mark, palette, and kicker typography already defined in `product-landing.css` rather than a generic template, so it's visually consistent with the site |

## Verification

- `pnpm test`, `pnpm lint`, `pnpm build` (per `CLAUDE.md`)
- Manual: keyboard-only pass through header nav, skip link, language toggle, CTA buttons
- Manual: toggle OS-level reduced-motion and confirm animations are suppressed
- Manual: validate Open Graph tags with a link-preview debugger (paste the production URL) for both `es` default and after language toggle
- Manual: `robots.txt`/`sitemap.xml` reachable at production URLs; canonical matches deployed domain
- Confirm `document.title`/meta description still update correctly on client-side language toggle (existing behavior must not regress)

## Checklist

- [ ] Static meta/OG/canonical/icons in `index.html`
- [ ] `robots.txt` + `sitemap.xml`
- [ ] JSON-LD `Organization`
- [ ] Skip link + `prefers-reduced-motion` + `:focus-visible`
- [ ] `aria-label`s on menu/language buttons
- [ ] Font weight reduction
- [ ] CTA event tracking
- [ ] `llms.txt` (bilingual summary)
- [ ] `robots.txt` written: allow all public content, `Disallow: /app` and `/app/*` only
- [ ] FAQ section with bilingual, self-contained Q&A copy
- [ ] `pnpm test && pnpm lint && pnpm build` green
- [ ] Docs updated (`ROADMAP-R-v1` marked superseded for Part 1)
- [ ] PR opened with before/after screenshots

## Deferred (out of scope for this plan)

- **Privacy Policy / Terms of Service.** Confirmed with product owners: no such content exists yet. Drafting and publishing legal pages, plus the footer link to them, is its own plan — do not block this plan on it, and do not add a footer link pointing to a page that doesn't exist yet.

## Next

Only one Open Question remains: who drafts the FAQ questions/answers and the `llms.txt` summary. Once that's decided, this plan's Status moves to "In Progress" and implementation proceeds in the order: static meta/OG/icons (domain `somosedificadigital.com`, brand-derived social image, keywords worked into copy/JSON-LD) → accessibility → AI/answer-engine visibility (`llms.txt`, FAQ, `robots.txt`) → analytics events → font cleanup. A separate plan will cover Privacy Policy / Terms when that content is ready. SSR/prerendering stays deferred per the approved recommendation.
