# SPRINT: Landing Page Best Practices

**Code:** SPRINT-S1-v1_landing-page-best-practices
**Status:** Draft
**Owner:** Isaac Delgado, Yang (yangetze)
**Created:** 2026-07-26
**Last Updated:** 2026-07-26 (added AI/answer-engine visibility scope)

## Overview

Audit of the public landing page (`frontend/src/features/platform/ProductLandingPage.jsx`, served at `/` via `frontend/src/App.jsx`) against standard SEO, social-preview, accessibility, legal, performance, and AI/answer-engine visibility (GEO/AEO) best practices. This plan captures the findings and scopes the fix as a self-contained frontend task — no app/dashboard routes are affected.

This supersedes **Part 1 (SEO)** of `ROADMAP-R-v1_seo-and-offline-modules.md`: the SSR/prerendering open question there is resolved below (deferred to Phase 2). Part 2 of that roadmap (offline-capable modules) is unrelated and stays as-is.

## Objectives

- [ ] Fix static `<meta>` title/description in `frontend/index.html` to match real landing copy
- [ ] Add Open Graph + Twitter Card tags and a social preview image
- [ ] Add `robots.txt`, `sitemap.xml`, canonical `<link>`, `apple-touch-icon`/`favicon.ico` fallback
- [ ] Add JSON-LD `Organization` structured data
- [ ] Accessibility: skip link, `prefers-reduced-motion` support, visible `:focus-visible` states, `aria-label` on icon-only controls
- [ ] Add a Privacy Policy / Terms link in the footer (content dependency — see Open Questions)
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
| Legal | No Privacy Policy or Terms link anywhere on the landing or footer, despite the platform handling donor/beneficiary data. |
| Performance | 5 font weights across 2 families loaded from `fonts.googleapis.com`, render-blocking. |
| Analytics | `@vercel/analytics` only tracks pageviews; no event tracking on CTAs, so landing conversion can't be measured. |
| Rendering | Pure client-rendered SPA (confirmed: `index.html` `<div id="root">` is empty, all content injected by `main.jsx`/React). Affects crawler reliability and perceived load speed — does not, by itself, block the Open Graph/meta fix above. |
| AI/answer-engine visibility | No `llms.txt`; no FAQ or self-contained factual statements written to be quoted verbatim; `robots.txt` doesn't exist yet, so there's no explicit allow/deny policy for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, etc.). |

### SSR / prerendering — recommendation

Full SSR (migrating to Next.js/Remix) is not warranted for one public marketing route while the rest of the app is authenticated and not meant to be indexed. Static, correct `<meta>`/Open Graph tags in `index.html` (no JS execution required) resolve the social-preview problem and give Google (which does execute JS) a reliable baseline. **Recommendation: ship the static-meta fix now, defer prerendering to a Phase 2 item**, revisited only if analytics later show poor organic indexing.

### AI/answer-engine visibility (GEO/AEO) — what this means and why it's the same rendering problem

"SEO para IAs" — más formalmente **GEO (Generative Engine Optimization)** o **AEO (Answer Engine Optimization)** — es optimizar el contenido para que asistentes de IA (ChatGPT, Claude, Perplexity, Gemini, Copilot) lo puedan leer, citar o usar como respuesta cuando alguien les pregunta sobre el tema. No es un campo separado del SEO tradicional; comparte la misma restricción técnica ya identificada arriba:

- Los crawlers que alimentan estos asistentes (`GPTBot`, `ClaudeBot`/`anthropic-ai`, `PerplexityBot`, `Google-Extended`, `CCBot` de Common Crawl) **generalmente no ejecutan JavaScript**, igual que los bots de vista previa social. Si el contenido solo existe después de que React lo renderiza, es invisible para ellos — el mismo problema que motiva el fix de meta/OG estáticos, no uno nuevo.
- Estos crawlers sí respetan `robots.txt`, así que el archivo que ya está planeado (objetivo de SEO) debe incluir una decisión explícita: ¿se permite que estos bots indexen/citen el contenido, o se bloquean? Hoy no hay ninguna directiva — es una decisión pendiente, no un default neutral.
- Un archivo **`llms.txt`** (estándar emergente, análogo a `robots.txt` pero pensado para dar a un LLM un resumen limpio en Markdown del sitio: qué es Edifica, sus módulos, planes y a quién sirve) en la raíz del sitio facilita que estos asistentes tengan un resumen correcto y citable, sin depender de que rendericen el HTML final.
- El contenido mismo se beneficia de frases autocontenidas y citables ("Edifica es un software modular para iglesias y organizaciones cristianas que centraliza donaciones, administración eclesial y productos digitales") y de una sección de **preguntas frecuentes** con pares pregunta/respuesta directos — ayuda tanto a snippets destacados de Google como a que un asistente de IA cite la respuesta correcta en vez de inventar una.

**Recomendación:** incluir esto en el mismo alcance que el fix de SEO/OG estático (mismo mecanismo, mismo archivo `robots.txt`), no como un proyecto aparte. Es contenido y configuración, no requiere SSR.

## Database Impact

None. This is a frontend/static-asset-only change — no Supabase schema, RLS, or migration involved.

## Affected Files

- `frontend/index.html` — static meta, Open Graph/Twitter Card, canonical, icons, JSON-LD
- `frontend/public/robots.txt` (new)
- `frontend/public/sitemap.xml` (new)
- `frontend/public/og-image.png` or `.jpg` (new — needs design input, see Open Questions)
- `frontend/public/apple-touch-icon.png`, `favicon.ico` (new)
- `frontend/src/features/platform/ProductLandingPage.jsx` — skip link, `aria-label`s, footer legal link, CTA event tracking
- `frontend/src/features/platform/product-landing.css` — `prefers-reduced-motion`, `:focus-visible` states, skip-link styling
- `frontend/index.html` — font `<link>` weight reduction
- New privacy/terms route or static page (content pending product-owner input)
- `frontend/public/llms.txt` (new) — bilingual plain-text/Markdown summary of Edifica for AI assistants
- `frontend/public/robots.txt` — explicit allow/deny rules for AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`), not just traditional search engines
- `frontend/src/features/platform/ProductLandingPage.jsx` — FAQ section with self-contained, quotable Q&A copy (bilingual)

## Open Questions (need a decision before implementing)

- [x] Meta description copy — confirmed: `Edifica Digital | Software para iglesias`
- [ ] Who provides the Open Graph social preview image (1200×630), or should one be designed from the existing brand marks in the CSS?
- [ ] Does a Privacy Policy / Terms page already exist anywhere (legal, another doc), or does this plan need to draft one? Content ownership stays with product owners per `AGENTS.md`.
- [ ] Confirm canonical production domain for the `<link rel="canonical">` and `sitemap.xml`: `somosedificadigital.com`?
- [ ] Any target keywords or reference sites to align meta copy/JSON-LD with?
- [ ] Approve deferring SSR/prerendering to Phase 2 (recommended above)?
- [ ] Allow or block AI-training/answer crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`) in `robots.txt`? This is a business call, not a technical default — allowing them increases the chance Edifica gets cited by AI assistants; blocking them opts out of AI training/citation entirely.
- [ ] Who drafts the FAQ questions/answers and the `llms.txt` summary — product owners or can this plan propose a first draft from existing landing copy for review?

## Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Font-weight reduction changes visual weight in headings/buttons | Verify against current design system visually before/after; keep at least the weights actually used in `product-landing.css` |
| Privacy/Terms page content doesn't exist yet, blocking the footer link | Ship footer link once content is provided; do not fabricate legal text — flag as a dependency, not a blocker for the rest of this plan |
| Social preview image missing at ship time | Land Open Graph markup with a placeholder-free fallback (site logo) until final artwork is ready, swap later without a code change if stored as a static asset |

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
- [ ] Footer legal link (pending content)
- [ ] Font weight reduction
- [ ] CTA event tracking
- [ ] `llms.txt` (bilingual summary)
- [ ] `robots.txt` AI-crawler policy decided and written
- [ ] FAQ section with bilingual, self-contained Q&A copy
- [ ] `pnpm test && pnpm lint && pnpm build` green
- [ ] Docs updated (`ROADMAP-R-v1` marked superseded for Part 1)
- [ ] PR opened with before/after screenshots

## Next

Once product owners answer the Open Questions above (image, legal content, domain), implementation proceeds in the order: static meta/OG/icons → accessibility → analytics events → font cleanup → legal link (as soon as content lands). SSR/prerendering stays out of scope unless explicitly requested later.
