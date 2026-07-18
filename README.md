# Donation Traceability System — MVP

**Transparent, multimedia-backed donation tracking: Receive → Transform → Impact**

## Quick Start

This is the MVP of a donation traceability platform. Every donation flows through three sequential pillars with supporting evidence (photos, invoices, sign-in sheets).

### The Three Pillars

| Pillar | What | Evidence |
|--------|------|----------|
| **Receive** | Donations (cash or in-kind) enter the system | Proof of payment, receipt |
| **Transform** | Resources are packaged into distributable kits | Fiscal invoice, assembly photos |
| **Impact** | Kits are delivered in field events | Delivery photos, signed sign-in sheets |

## Tech Stack

- **Frontend:** React + Vite (deployed on Vercel)
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Charts:** Recharts
- **PDF:** @react-pdf/renderer
- **Language:** English (MVP) — Spanish next

## MVP Scope

✅ **Included:**
- Actor management (Donor, Supplier, Manager)
- New Donation (multi-line: monetary + in-kind)
- New Transformation (kits with evidence)
- New Impact Event (demographics + kits dispatched)
- Dashboard (global view + campaign detail)
- Downloadable PDF report
- Magic link authentication

❌ **Out of scope (roadmap):**
- Exact financial traceability per campaign
- Multi-currency
- Granular permissions
- Public live link
- OCR automation

## Project Structure

```
donation-traceability-system/
├── docs/
│   ├── 1_Pillars_and_Philosophy.docx     (strategy + principles)
│   ├── 2_MVP_Specification.docx          (features + data model)
│   ├── 3_Stack_and_Roadmap.docx          (tech + roadmap)
│   ├── ARCHITECTURE.md                   (system design overview)
│   └── DATABASE.md                       (schema + relationships)
├── frontend/                             (React app — created by Vite)
│   ├── src/
│   ├── public/
│   └── package.json
├── .github/
│   └── workflows/                        (CI/CD — future)
├── .env.example                          (template)
├── .gitignore
├── README.md                             (this file)
└── CONTRIBUTING.md                       (contributor guide)
```

## Getting Started (Local Development)

```bash
# 1. Clone
git clone https://github.com/[org]/donation-traceability-system
cd donation-traceability-system/frontend

# 2. Install
pnpm install

# 3. Create .env.local (see .env.example)
# Add your Supabase credentials

# 4. Run
pnpm dev
```

Visit `http://localhost:5173`

## Documentation

- **1_Pillars_and_Philosophy.docx** — Core principles (Receive → Transform → Impact)
- **2_MVP_Specification.docx** — Features, data model, dashboard design
- **3_Stack_and_Roadmap.docx** — Tech choices, post-MVP roadmap
- **ARCHITECTURE.md** — System overview (this repo)
- **DATABASE.md** — Data model and relationships

## Contributing

See CONTRIBUTING.md

## License

MIT

---

**Prepared for:** Isaac Delgado, Yang (yangetze)
**Version:** MVP Phase 1
**Last updated:** [date]
