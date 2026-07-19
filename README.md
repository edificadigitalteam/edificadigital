# somosedificadigital

Plataforma bilingüe de trazabilidad de donaciones: recibir, transformar y documentar impacto.

Bilingual donation-traceability platform for receiving resources, transforming them, and documenting impact.

## Current delivery

- Public Spanish/English landing page for the Edifica Digital proposal.
- Mobile-first Spanish/English intake for in-kind shipments at `/donations/in-kind/new`.
- Continuous Spanish/English monetary intake at `/donations/monetary/new` for cash, transfers, mobile payments, wallets, cryptoassets, and other receipt methods.
- Supabase foundation deployed in `edifydb` with 18 RLS-protected public operational tables and 2 RLS-protected private beneficiary tables.
- Container, declared-item, inventory-lot, movement, and evidence model.
- Multi-currency receipt model that preserves origin amount, origin currency, USD reporting base, applied rate, and rate evidence.
- Protected nominal beneficiary foundation with non-identifying public codes and aggregate-only public reporting.
- Private attachment Storage with authenticated access.
- Technical model for bilingual institutional and international reporting.
- Allow-listed magic-link access for the initial product owners.
- Atomic, idempotent Supabase persistence with private evidence uploads.

The in-kind interface validates data, preserves a local draft, uploads approved evidence, and persists the sender, donation, shipment, and declared items through one transactional RPC. The monetary interface follows the same authenticated and idempotent boundary in one continuous form and requires private payment or receipt evidence. Success references come from Supabase. Inventory lots and movements begin when a shipment is physically received and verified.

## Operational model

| Stage | Records | Evidence |
|---|---|---|
| Receive | Monetary and in-kind donations, shipments, declared goods, inventory lots | Payment, packing, carrier, customs, inspection, and receipt records |
| Transform | Prepared kit types and quantities | Procurement and preparation records |
| Impact | Distribution events, kit quantities, aggregate demographics | Delivery records and field evidence |

Cash received, in-kind reference value, approved budget, and operating expenses remain separate measures throughout the system. Nominal beneficiary identity stays in the private schema; public and international reports use aggregate impact data.

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

Use publishable Supabase client values in the frontend environment. Set `VITE_PUBLIC_CONTACT_URL` in the protected hosting environment when the closing action should open an official organization contact. Keep database and service-role secrets in protected server environments.

## Verification

From `frontend/`:

```bash
pnpm test
pnpm lint
pnpm build
```

Database migrations and pgTAP specifications live in `supabase/migrations/` and `supabase/tests/`.

The current frontend baseline contains 34 passing Vitest tests. Database behavior is verified with pgTAP contracts and rollback-safe live scenarios.

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

**Version:** MVP Phase 1.1
**Last updated:** 2026-07-19
