# somosedificadigital

Plataforma bilingüe de trazabilidad de donaciones: recibir, transformar y documentar impacto.

Bilingual donation-traceability platform for receiving resources, transforming them, and documenting impact.

## Current delivery

- Public Spanish/English landing page for the Edifica Digital proposal.
- Mobile-first Spanish/English intake for in-kind shipments at `/donations/in-kind/new`.
- Supabase foundation deployed in `edifydb` with 17 RLS-protected operational tables.
- Container, declared-item, inventory-lot, movement, and evidence model.
- Private attachment Storage with authenticated access.
- Technical model for bilingual institutional and international reporting.

The in-kind interface currently validates data, prepares a structured payload, and preserves a local draft. Authenticated Supabase persistence is the next application milestone.

## Operational model

| Stage | Records | Evidence |
|---|---|---|
| Receive | Monetary and in-kind donations, shipments, declared goods, inventory lots | Payment, packing, carrier, customs, inspection, and receipt records |
| Transform | Prepared kit types and quantities | Procurement and preparation records |
| Impact | Distribution events, kit quantities, aggregate demographics | Delivery records and field evidence |

Cash received, in-kind reference value, approved budget, and operating expenses remain separate measures throughout the system.

## Technology

- React and Vite
- Supabase Postgres, Auth, and Storage
- Vercel production hosting
- Vitest and pgTAP specifications
- Manrope for interface text and Source Serif 4 for editorial headings

## Local development

```bash
git clone https://github.com/edificadigitalteam/edificadigital.git
cd edificadigital/frontend
pnpm install
cp ../.env.example .env.local
pnpm dev
```

Open `http://localhost:5173`.

Use publishable Supabase client values in the frontend environment. Keep database and service-role secrets in protected server environments.

## Verification

From `frontend/`:

```bash
pnpm test
pnpm lint
pnpm build
```

Database migrations and pgTAP specifications live in `supabase/migrations/` and `supabase/tests/`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database reference](docs/DATABASE.md)
- [Design system](docs/DESIGN.md)
- [Plans](docs/plans/INDEX.md)
- [Agent rules](agents.md)
- [AI coding guide](claude.md)

## Delivery rules

Every change follows plan → tests → implementation → refactor → verification → documentation → pull request. Database changes are declared before implementation and applied through immutable migrations.

Merging `main` publishes `edificadigital.vercel.app` and `somosedificadigital.com`.

---

**Version:** MVP Phase 1
**Last updated:** 2026-07-19
