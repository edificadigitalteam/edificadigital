# SPRINT: Landing Page Best Practices

**Code:** SPRINT-S1-v1_landing-page-best-practices
**Status:** In Progress
**Owner:** Isaac Delgado, Yang (yangetze)
**Created:** 2026-07-26
**Last Updated:** 2026-07-26 (Block 3 implemented: robots.txt, sitemap.xml, llms.txt, FAQ — see Verification)

## Overview

Audit of the public landing page (`frontend/src/features/platform/ProductLandingPage.jsx`, served at `/` via `frontend/src/App.jsx`) against standard SEO, social-preview, accessibility, legal, performance, and AI/answer-engine visibility (GEO/AEO) best practices. This plan captures the findings and scopes the fix as a self-contained frontend task — no app/dashboard routes are affected.

This supersedes **Part 1 (SEO)** of `ROADMAP-R-v1_seo-and-offline-modules.md`: the SSR/prerendering open question there is resolved below (deferred to Phase 2). Part 2 of that roadmap (offline-capable modules) is unrelated and stays as-is.

## Objectives

- [x] Fix static `<meta>` title/description in `frontend/index.html` to match real landing copy
- [x] Add Open Graph + Twitter Card tags and a social preview image
- [x] Add canonical `<link>` (domain: `somosedificadigital.com`), `apple-touch-icon`/`favicon.ico` fallback — `robots.txt`/`sitemap.xml` moved to the AI/answer-engine block below (robots.txt references the sitemap, so they ship together)
- [x] Add JSON-LD `Organization` structured data (aligned with target keywords: "software para iglesias", "software para donaciones", "software de trazabilidad de donaciones")
- [x] Accessibility: skip link, `prefers-reduced-motion` support, visible `:focus-visible` states, `aria-label` on icon-only controls
- [ ] Reduce Google Fonts payload (currently 5 weights across 2 families, external render-blocking request — also found: `Manrope` is loaded in `index.html` but never used; the site actually renders with `Inter`, loaded separately via a `@import` inside `product-landing.css`)
- [ ] Track CTA clicks (hero primary/secondary, plans, closing WhatsApp link) as custom Vercel Analytics events
- [x] Decide SSR/prerendering timing — approved: deferred (see below)
- [x] AI/answer-engine visibility (GEO/AEO): `llms.txt`, an FAQ section with quotable answers, `sitemap.xml`, and an explicit `robots.txt` policy for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot)

## Findings (source of this plan)

Reviewed: `frontend/src/features/platform/ProductLandingPage.jsx`, `frontend/src/features/platform/product-landing.css`, `frontend/index.html`, `frontend/public/`, `frontend/vercel.json`, `frontend/src/contact.js`.

| Area | Gap |
|---|---|
| SEO | ✅ Fixed. `index.html` title/description now match `ProductLandingPage.jsx` copy (and the JS copy was updated to match, so there's no flicker on mount). Canonical link and JSON-LD `Organization` added. `robots.txt`/`sitemap.xml` still pending — moved to the AI/answer-engine block. |
| Social preview | ✅ Fixed. Open Graph + Twitter Card tags added, with a brand-derived `og-image.png` (1200×630) rendered from the actual brand colors/mark in `product-landing.css`. |
| Icons | ✅ Fixed. `apple-touch-icon.png` (180×180) and `favicon.ico` (PNG-in-ICO container) added, both generated from the existing `favicon.svg` mark; `index.html` now links all three (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`) — previously there was no `<link rel="icon">` at all, so the tab icon wasn't wired up. |
| Accessibility | ✅ Fixed. Skip link added (first focusable element, jumps to `<main id="main-content">`), `@media (prefers-reduced-motion: reduce)` added (note: the stylesheet had no `transition`/`animation` at all before this, so this is future-proofing, not a fix to an existing motion problem), `:focus-visible` outline added for links/buttons, and `aria-label`s added to the hamburger menu button (previously had zero accessible name) and the language toggle. |
| Legal | No Privacy Policy or Terms link anywhere on the landing or footer, despite the platform handling donor/beneficiary data. Confirmed: no such content exists yet — **deferred to its own plan**, out of scope here. |
| Performance | 5 font weights across 2 families loaded from `fonts.googleapis.com`, render-blocking. |
| Analytics | `@vercel/analytics` only tracks pageviews; no event tracking on CTAs, so landing conversion can't be measured. |
| Rendering | Pure client-rendered SPA (confirmed: `index.html` `<div id="root">` is empty, all content injected by `main.jsx`/React). Affects crawler reliability and perceived load speed — does not, by itself, block the Open Graph/meta fix above. |
| AI/answer-engine visibility | ✅ Fixed. `llms.txt` published with the approved bilingual summary; `robots.txt` allows all crawlers and disallows only `/app`/`/app/*`, with a `Sitemap:` pointer; `sitemap.xml` lists the public routes; an 8-question bilingual FAQ section (`#faq`, `<details>/<summary>`) was added to the landing, matched by a static `FAQPage` JSON-LD block in `index.html`. |

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
- [x] FAQ/`llms.txt` copy — draft below in "Draft Content", built only from facts already stated in `ProductLandingPage.jsx`'s copy (no new claims). **Approved as-is by product owners.**

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

### Block 1 (meta/OG/icons) — verification results, 2026-07-26

- Added `frontend/index.test.js` first (Red), covering title/description, canonical, OG/Twitter tags, favicon/apple-touch-icon links, JSON-LD, and exact pixel dimensions of the new PNG assets (via raw PNG/ICO header parsing, no extra dependency). Confirmed failing before implementation.
- `npm test` (frontend/): 8/8 new tests pass. 13 pre-existing failures remain, unrelated to this change (monetary/in-kind submission tests — confirmed pre-existing by running the same suite via `git stash -u` before these changes).
- `npm run lint`: clean except pre-existing warnings in `portalTranslations.js` and `main.jsx` (unrelated to this change).
- `npm run build`: succeeds; `dist/index.html` and `dist/assets/` carry the new tags and copied `public/` assets correctly.
- `vite preview` + a headless-Chromium screenshot of the built site confirmed no visual regression on the hero/module sections.
- `og-image.png`, `apple-touch-icon.png`, and `favicon.ico` were generated locally (not hand-drawn) from the brand mark/colors already in `product-landing.css` and `favicon.svg`, rendered via the pre-installed headless Chromium (`headless_shell` binary — note: `chrome --headless=new` reserves browser-chrome height and under-renders a fixed pixel target by ~90px, so asset generation used the dedicated `headless_shell` binary instead), then `favicon.ico` was packaged as a PNG-in-ICO container (valid per the ICO spec, no extra tooling needed).
- Not yet verified live: real link-preview debugger against production, since the Vercel preview deploy is currently blocked by the account's daily deploy-rate limit (unrelated infra issue, reported separately).

### Block 2 (accessibility) — verification results, 2026-07-26

- Added `frontend/src/features/platform/ProductLandingPage.accessibility.test.js` first (Red): asserts the skip link is the first focusable element and targets `#main-content`, the hamburger and language-toggle buttons carry `aria-label`, and `product-landing.css` declares `prefers-reduced-motion` and `:focus-visible` rules. Confirmed failing before implementation (this project has no component-rendering test setup — no jsdom/testing-library anywhere in the codebase — so this follows the existing convention of source-level string/regex assertions rather than introducing new test tooling for one check).
- Implementation: skip link (`.skip-link`, visually hidden until `:focus`, jumps to `<main id="main-content" tabIndex={-1}>`), a shared `:focus-visible` outline for links/buttons in `.product-site`, an `aria-label` on the hamburger button that changes with state (`Abrir menú`/`Cerrar menú`, `Open menu`/`Close menu`), an `aria-label` on the language toggle naming the target language (`Switch to English` / `Cambiar a español`), and a `@media (prefers-reduced-motion: reduce)` block.
- Finding worth recording: `product-landing.css` had zero `transition`/`animation` declarations before this change — there was no existing motion to turn off. The reduced-motion rule is added as required future-proofing (per `CLAUDE.md`'s explicit interface guidance), not a fix to an active bug.
- `pnpm test` (frontend/, corrected to the project's actual package manager — see note below): 3/3 new tests pass, 60 total tests run, same 13 pre-existing unrelated failures.
- `pnpm lint` / `pnpm build`: clean, same pre-existing warnings as Block 1, build succeeds.
- Not yet verified live: real Tab-key keyboard walkthrough and OS-level reduced-motion toggle in an actual browser session — verified at the source/CSS level (the `:focus`/`:focus-visible`/`prefers-reduced-motion` mechanisms used are standard, well-understood CSS, not application logic), but a real keyboard pass on the deployed preview is still recommended once the Vercel rate limit clears.
- **Package manager correction:** this plan's Verification section and `CLAUDE.md` both specify `pnpm`. Block 1's implementation pass initially ran `npm install`/`npm test`, which generated a stray `package-lock.json` — caught before committing (this repo deliberately moved from npm to pnpm in a past PR, see `pnpm-lock.yaml`). The stray lockfile was deleted, `node_modules` reinstalled with `pnpm install`, and both blocks re-verified with `pnpm test`/`pnpm lint`/`pnpm build` before commit. No lockfile changes were committed.

### Block 3 (AI/answer-engine visibility) — verification results, 2026-07-26

- Added `frontend/public.test.js` and `frontend/src/features/platform/ProductLandingPage.faq.test.js` first (Red): asserts `robots.txt`'s allow/disallow/sitemap directives, `sitemap.xml`'s three `<loc>` entries, `llms.txt`'s content, the FAQ section's markup and exactly 8 bilingual Q&A entries sourced from the `copy` object, and a matching `FAQPage` JSON-LD block in `index.html`. Confirmed failing before implementation.
- `frontend/public/robots.txt`: single `User-agent: *` block — `Allow: /`, `Disallow: /app` + `/app/*`, `Sitemap:` pointer. No AI-bot-specific rules by design (per the confirmed decision: AI crawlers get the same treatment as any other crawler, not special-cased).
- `frontend/public/sitemap.xml`: lists `/`, `/donations/in-kind`, `/donations/monetary` under `somosedificadigital.com`. `/app` is intentionally excluded (matches `robots.txt`).
- `frontend/public/llms.txt`: the exact bilingual draft approved earlier in this plan, published verbatim.
- FAQ section: 8 bilingual questions (ES/EN, matching the approved draft) added to `ProductLandingPage.jsx` as `<details>/<summary>` accordions under `#faq`, with a corresponding nav link and new `.faq-list` CSS matching the existing design system (brand colors, existing spacing/radius scale). Rendered and screenshotted locally via a `pnpm build` + `vite preview` + headless-Chromium screenshot — confirmed it sits cleanly between Plans and the closing CTA with no layout regression.
- `index.html` also gained a static `FAQPage` JSON-LD block with the same 8 question/answer pairs shown on the page (structured data must match visible content).
- `pnpm test`: 65 total tests, 52 pass (all new ones), same 13 pre-existing unrelated failures. `pnpm lint`/`pnpm build`: clean, same pre-existing warnings, build succeeds; `dist/` carries `robots.txt`, `sitemap.xml`, and `llms.txt` correctly (Vite copies `public/` as-is).
- Not yet verified live: real crawler behavior against `robots.txt`/`sitemap.xml`/`llms.txt` and a Google Rich Results / FAQPage validator pass — both recommended once deployed to production.

## Checklist

- [x] Static meta/OG/canonical/icons in `index.html`
- [x] `robots.txt` + `sitemap.xml`
- [x] JSON-LD `Organization`
- [x] Skip link + `prefers-reduced-motion` + `:focus-visible`
- [x] `aria-label`s on menu/language buttons
- [ ] Font weight reduction
- [ ] CTA event tracking
- [x] `llms.txt` (bilingual summary)
- [x] `robots.txt` written: allow all public content, `Disallow: /app` and `/app/*` only
- [x] FAQ section with bilingual, self-contained Q&A copy
- [x] `pnpm test && pnpm lint && pnpm build` green
- [ ] Docs updated (`ROADMAP-R-v1` marked superseded for Part 1) — done for the plan itself; still need a final pass once all blocks ship
- [ ] PR opened with before/after screenshots — draft PR open (#30), screenshots pending a live preview verification pass

## Draft Content: FAQ and `llms.txt` (pending product-owner review)

Built only from facts already present in `ProductLandingPage.jsx`'s `copy` object — no new claims, no invented pricing or features. Module states (`Disponible`/`En desarrollo`/`Catálogo inicial`) are kept honest rather than smoothed over, since an AI assistant repeating an overstated claim as fact is worse than not being cited at all.

### FAQ — Spanish

1. **¿Qué es Edifica Digital?**
   Edifica es un software modular para iglesias y organizaciones cristianas que reúne gestión de donaciones, administración eclesial y productos digitales de formación en una sola plataforma.
2. **¿Para quién es Edifica?**
   Edifica está diseñado para iglesias y organizaciones cristianas que necesitan administrar donaciones, proyectos, beneficiarios y equipos de trabajo con orden e integridad, con los datos separados por organización.
3. **¿Qué módulos incluye la plataforma?**
   Edifica tiene tres líneas conectadas: Donaciones y proyectos (disponible), que registra fondos y bienes, aliados, proyectos y evidencias; Iglesia (en desarrollo), para membresía, calendario y discipulado; y Productos digitales (catálogo inicial), con cursos, plantillas y recursos prácticos.
4. **¿Qué hace el módulo de Donaciones y proyectos?**
   Registra donaciones monetarias y en especie, administra aliados y donantes, y da seguimiento a proyectos financiados y su ejecución.
5. **¿Los datos de mi organización están separados de los de otras organizaciones?**
   Sí. Cada organización tiene su propia cuenta institucional: es propietaria de su espacio, su suscripción y sus datos, con usuarios y equipos que trabajan mediante accesos individuales y permisos definidos.
6. **¿Qué planes de suscripción existen?**
   Edifica ofrece tres planes: Esencial (equipos pequeños que comienzan con un módulo principal), Organización (varios operadores y procesos activos, con módulos combinables) y Ecosistema (implementación amplia, con todos los módulos contratados y soporte prioritario).
7. **¿Edifica está disponible en español e inglés?**
   Sí, la plataforma está disponible en español e inglés con un cambio de idioma persistente.
8. **¿Cómo solicito una presentación de Edifica?**
   Se puede solicitar una presentación directamente desde el sitio, que conecta por WhatsApp con el equipo de Edifica.

### FAQ — English

1. **What is Edifica Digital?**
   Edifica is modular software for churches and Christian organizations that brings donation management, church administration, and digital training products together in one platform.
2. **Who is Edifica for?**
   Edifica is built for churches and Christian organizations that need to manage donations, projects, beneficiaries, and work teams with order and integrity, with each organization's data kept separate.
3. **What modules does the platform include?**
   Edifica has three connected lines: Donations and projects (available), which records funds and goods, partners, projects, and evidence; Church (in development), for membership, calendar, and discipleship; and Digital products (initial catalog), with courses, templates, and practical resources.
4. **What does the Donations and projects module do?**
   It records monetary and in-kind donations, manages partners and donors, and tracks funded projects and their execution.
5. **Is my organization's data separate from other organizations' data?**
   Yes. Each organization has its own institutional account: it owns its workspace, subscription, and data, with users and teams working through individual access and defined permissions.
6. **What subscription plans exist?**
   Edifica offers three plans: Essential (small teams starting with one primary module), Organization (several operators and active processes, with combinable modules), and Ecosystem (broad implementation, all contracted modules, and priority support).
7. **Is Edifica available in Spanish and English?**
   Yes, the platform is available in Spanish and English with a persistent language switch.
8. **How do I request a presentation of Edifica?**
   A presentation can be requested directly from the site, which connects via WhatsApp with the Edifica team.

### `llms.txt` (draft — `frontend/public/llms.txt`)

```markdown
# Edifica Digital

> Software modular para iglesias y organizaciones cristianas: donaciones, administración eclesial y productos digitales en una plataforma con datos separados por organización.
> Modular software for churches and Christian organizations: donations, church administration, and digital products in one platform with data kept separate per organization.

## Módulos / Modules
- Donaciones y proyectos / Donations and projects (Disponible / Available): fondos y bienes, aliados, proyectos financiados, evidencias / funds and goods, partners, funded projects, evidence.
- Iglesia / Church (En desarrollo / In development): membresía, calendario, discipulado, educación cristiana / membership, calendar, discipleship, Christian education.
- Productos digitales / Digital products (Catálogo inicial / Initial catalog): cursos, plantillas, bibliotecas descargables / courses, templates, downloadable libraries.

## Planes / Plans
- Esencial / Essential: equipos pequeños, un módulo principal / small teams, one primary module.
- Organización / Organization: múltiples usuarios, módulos combinables / multiple users, combinable modules.
- Ecosistema / Ecosystem: todos los módulos contratados, soporte prioritario / all contracted modules, priority support.

## Contacto / Contact
- Solicitar presentación vía WhatsApp desde el sitio / Request a presentation via WhatsApp from the site: https://somosedificadigital.com/#contacto
```

**Note:** This draft is intentionally conservative — it does not state pricing, user limits, or storage numbers, since none are published on the landing today. If product owners want those included, they need to confirm the actual figures first.

## Deferred (out of scope for this plan)

- **Privacy Policy / Terms of Service.** Confirmed with product owners: no such content exists yet. Drafting and publishing legal pages, plus the footer link to them, is its own plan — do not block this plan on it, and do not add a footer link pointing to a page that doesn't exist yet.

## Next

All Open Questions are resolved and the FAQ/`llms.txt` draft is approved as-is. Implementation begins on a new branch, in this order: static meta/OG/icons (domain `somosedificadigital.com`, brand-derived social image, keywords worked into copy/JSON-LD) → accessibility → AI/answer-engine visibility (`llms.txt`, FAQ, `robots.txt`) → analytics events → font cleanup. A separate plan will cover Privacy Policy / Terms when that content is ready. SSR/prerendering stays deferred per the approved recommendation.
