# ROADMAP: SEO & Offline-Capable Modules

**Code:** ROADMAP-R-v1
**Status:** Draft
**Owner:** Isaac Delgado, Yang (yangetze)
**Created:** [date]
**Last Updated:** [date]

## Overview

Two feature requests to scope before implementation, per the plan-first rule in `agents.md`. This document is the plan — no code changes yet. Each part below needs the open questions answered before it's picked up as a Sprint task.

## Objectives

- [ ] Decide SEO approach (client-side meta only vs. prerendering) and implement
- [ ] Decide offline architecture for the first target module (Impact campaign registration)
- [ ] Identify which other modules should get offline support later

---

## Part 1: SEO

### Scope

- Meta tags: title, description per language (partially done — `App.jsx` already swaps `document.title` and the description meta tag on language toggle)
- Open Graph / Twitter Card tags for link previews (needs a social preview image — none exists yet)
- `public/robots.txt` and `public/sitemap.xml`
- Canonical URL + `hreflang` (es/en) since content is bilingual via `content.js`
- Structured data (JSON-LD, Organization/WebSite schema) — nice to have, not required for MVP
- Semantic HTML audit (heading hierarchy, meaningful `alt` text)

### The real question: this is a client-rendered SPA

The site is Vite + React with no server-side rendering. Search engine/social crawlers that don't execute JavaScript will only see whatever's in the static `index.html` — not the content injected by React or the language-swap logic in `App.jsx`. Two options:

1. **MVP-acceptable:** Put good static `<meta>` tags (Spanish, since that's the default) directly in `index.html` as a crawler-safe baseline, keep the JS-driven swap for the in-browser language toggle UX. Fast to ship, works for major crawlers (Google executes JS), weaker for crawlers/scrapers that don't.
2. **More robust:** Add prerendering or static export for the marketing page (e.g. `vite-plugin-ssr`, or prerendering just `index.html` per language at build time). More setup work, better guarantee for all crawlers and social link previews.

### Open Questions (need a decision before implementing)

- [ ] Option 1 or 2 above?
- [ ] Confirm canonical production domain for canonical URLs: `somosedificadigital.com`?
- [ ] Any target keywords, or reference/competitor sites to align copy with?
- [ ] Who's providing the social preview image (Open Graph), or should one be designed?

### Database Implication

None — this is frontend/static-asset only.

---

## Part 2: Offline-Capable Modules

### Target module (first one)

Impact campaign registration — logging people/attendance in the field, where connectivity is often unreliable. Per `DATABASE.md`, this maps to `impact_event` (master) + `impact_detail` (kit dispatch lines) + `impact_event_attachment` (delivery photos, sign-in sheets).

### Requirements

- Forms usable with no network connection
- Data entered offline queues locally and syncs automatically once connectivity returns
- Clear status shown to the user: "saved offline, will sync" vs. "synced"
- No data loss on page reload while offline

### Architecture Sketch (needs review before implementation)

- **App shell caching:** Service Worker (e.g. `vite-plugin-pwa` / Workbox) so the page itself loads offline, not just API calls
- **Local write queue:** IndexedDB (not `localStorage` — needs structured records, not just strings) storing pending submissions until they successfully reach Supabase
- **Sync trigger:** Background Sync API where supported, with a manual "retry on reconnect" (`navigator.onLine` + `online` event listener) fallback, since Background Sync isn't supported in all browsers (notably Safari/iOS)
- **Conflict handling:** Needs a decision — "last write wins" is likely acceptable for MVP since this is field data entry, not collaborative real-time editing

### ⚠️ Database Implication (flagging per mandatory rule)

Offline sync needs the client to generate stable record identity *before* it ever reaches the server, and a way to avoid duplicate submissions on retry:

- Likely need **client-generated UUIDs** (not DB-generated `gen_random_uuid()`) for `impact_event` / `impact_detail` / attachment rows created offline, so the same record has the same ID whether created online or synced later
- Consider whether a `sync_status` / `synced_at` column is needed server-side, or whether this can stay entirely client-side (IndexedDB) with the server never needing to know a record arrived late
- Photos captured offline need local blob storage (IndexedDB or Cache API) until upload to Supabase Storage succeeds — Supabase has no native offline upload queue, so this queue is fully custom
- **This must be decided during the Sprint 1 schema design (`docs/DATABASE.md`), not retrofitted after the schema ships.**

### Open Questions

- [ ] Which modules beyond Impact registration need offline support? (Donation intake? Kit transformation?) Or is Impact registration the only one for now?
- [ ] Expected offline duration/data volume per field session (affects IndexedDB storage planning — quotas are browser-dependent)
- [ ] Is a fully installable PWA wanted, or just resilient offline data entry within a browser tab?
- [ ] Photo compression strategy for offline-captured images (storage + eventual upload bandwidth)

---

## Next

1. Isaac/Yang answer the open questions above for both parts
2. Once answered: SEO is likely a self-contained half-day task (Sprint 1 or a quick side task). Offline architecture is a multi-day effort that needs its own design spike and should factor into the Sprint 1 Day 1 schema design (client-generated UUIDs) even if the full offline UI comes later.
3. Follow the mandatory workflow once scoped: plan → tests (TDD) → code, per module.
