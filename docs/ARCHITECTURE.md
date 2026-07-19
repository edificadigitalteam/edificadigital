# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DONATION TRACEABILITY SYSTEM              │
│                          (Donation Transparency)             │
└─────────────────────────────────────────────────────────────┘

FRONTEND (React + Vite on Vercel)
    ↓
    ├─── /receive     → New Donation form
    ├─── /transform   → New Transformation (kits)
    ├─── /impact      → New Impact Event
    ├─── /dashboard   → Global + Campaign views
    └─── /login       → Magic link auth

                  ↓ (Supabase Client)

BACKEND (Supabase)
    ├─── Auth (Magic Link)
    ├─── Postgres (12 tables)
    ├─── Row Level Security (authenticated users)
    └─── Storage (attachments bucket, S3-compatible)
```

## Data Flow by Pillar

### Pillar A: RECEIVE
User creates a Donation with 1+ lines (Monetary or InKind) + attachments.

```
Actor (Donor)
  ↓
Donation (master)
  ├─ DonationDetail[] (grid: amount/item + quantity)
  └─ DonationAttachment[] (proof of payment, receipts)
```

Resources enter the "general pool" (no per-campaign attribution in MVP).

### Pillar B: TRANSFORM
User creates a KitTransformation for one kit type + quantity + attachments.

```
KitTransformation (1 kit type per record)
  ├─ kit_name, quantity_generated
  └─ KitTransformationAttachment[] (fiscal invoice, assembly photos)
```

If creating multiple kit types same day → multiple KitTransformation records.

### Pillar C: IMPACT
User creates an ImpactEvent, dispatches kits, logs demographics.

```
ImpactEvent (campaign)
  ├─ responsible_actor_id (Actor with Manager role)
  ├─ dates, target_population, status (InProgress/Closed)
  ├─ Demographics (families, men, women, boys, girls, elderly)
  ├─ ImpactDetail[] (kit dispatch: which kit, how many)
  └─ ImpactEventAttachment[] (delivery photos, sign-in sheets)
```

## Database Schema (Simplified)

```
┌─ ACTORS ─────────────────────────┐
│ actor                             │  ← Master of all people/orgs
│ actor_role (Donor|Supplier|       │  ← N:N relationships
│            Manager|Beneficiary)   │
└───────────────────────────────────┘

┌─ RECEIVE ─────────────────────────────┐
│ donation                               │  ← Master
│ donation_detail (Monetary|InKind)     │  ← Grid: lines
│ donation_attachment                   │  ← Evidence
└────────────────────────────────────────┘

┌─ TRANSFORM ───────────────────────────┐
│ kit_transformation                     │  ← 1 kit type per record
│ kit_transformation_attachment          │  ← Evidence
└────────────────────────────────────────┘

┌─ IMPACT ──────────────────────────────┐
│ impact_event                           │  ← Campaign (master)
│ impact_detail (kit dispatch)           │  ← Grid: which kits, qty
│ impact_event_attachment                │  ← Evidence
└────────────────────────────────────────┘

┌─ CATALOGS ────────────────────────────┐
│ media_type                             │
│ unit_of_measure                        │
└────────────────────────────────────────┘
```

## Authentication & Authorization

**Auth:** Supabase Magic Link (email-only, no passwords)

**Authorization (MVP):**
- Authenticated users → full access to all data
- No role-based access control yet (roadmap)
- Row Level Security (RLS) policies enforce authenticated-only access

## Dashboard Views

### Global Resource View
- System-wide metrics (total received, total transformed, total impacted)
- Chart: received vs. transformed over time
- List of all Impact Events (campaigns)
- Quick links to Receive/Transform/Impact forms

### Campaign View (single ImpactEvent)
- Hero metrics for that event (people/families/kits)
- Transparency gallery (3 pillars with photos + access to documents)
- Demographic breakdown (donut chart)
- Kit dispatch bars (coverage per type)
- Status indicator (InProgress/Closed)

**Note:** Financial totals (USD) appear only in Global view. Campaign view focuses on impact delivered, not money spent (intentional design — see Document 1, section 6).

## External Services

| Service | Purpose | Pricing |
|---------|---------|---------|
| Supabase | DB + Auth + Storage | Free: 1 GB storage, 5 GB/month egress, auto-pause 7 days |
| Vercel | Frontend hosting | Free: unlimited deployments, 1 domain |
| GitHub | Version control + org | Free: private repos |

## Deployment

```
GitHub Repo (main branch)
    ↓ (auto-webhook)
Vercel (builds frontend)
    ↓
Auto-promotes → edificadigital.vercel.app AND somosedificadigital.com
    ↓
React app talks to Supabase client via API keys
```

**Both domains auto-publish on every push to `main`** (standard Vercel behavior). A manual-only promotion policy for the custom domain was attempted and reverted after it caused a live outage — see `docs/adr/ADR-001-manual-production-promotion.md` for the full history. PR review on `main` is currently the only gate before a change reaches the public domain.

Environment variables flow:
- `.env.local` (dev)
- Vercel project settings (production)
- Both use: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## File Organization (Frontend)

```
frontend/
├── src/
│   ├── components/
│   │   ├── DonationForm.jsx
│   │   ├── TransformationForm.jsx
│   │   ├── ImpactEventForm.jsx
│   │   ├── Dashboard.jsx
│   │   └── common/
│   ├── hooks/
│   │   ├── useSupabase.js      (client init)
│   │   ├── useDonation.js      (CRUD hooks)
│   │   ├── useTransformation.js
│   │   ├── useImpactEvent.js
│   │   └── useAuth.js
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── ReceivePage.jsx
│   │   ├── TransformPage.jsx
│   │   ├── ImpactPage.jsx
│   │   ├── DashboardPage.jsx
│   │   └── NotFound.jsx
│   ├── lib/
│   │   ├── supabase.js         (client config)
│   │   ├── constants.js
│   │   └── utils.js
│   ├── styles/
│   │   ├── globals.css
│   │   └── tailwind.config.js
│   └── App.jsx
├── public/
└── vite.config.js
```

## Key Design Decisions

1. **One KitTransformation per kit type** → clearer evidence per kit
2. **No exact financial traceability per campaign (MVP)** → simpler architecture, deferred to roadmap
3. **Aggregate demographics, not nominal** → privacy-preserving, faster data entry
4. **Magic link auth only** → lower friction, no password management
5. **RLS for authenticated users** → simple, effective for small team
6. **PDF download, not public link** → controlled snapshot, not live exposure

## Roadmap Extensions

See Document 3 (3_Stack_and_Roadmap.docx) for:
- Exact financial traceability (bipartite matching)
- Multi-currency
- OCR automation
- Granular permissions
- Public read-only report link

---

**Version:** MVP
**Last updated:** [date]


## Proposed Budget-to-Impact Architecture

> **Status:** Proposed in ADR-002. This section documents the target architecture; the current MVP schema remains unchanged until approval and TDD migration work.

### Resumen ES

El presupuesto aprobado pertenece a la planificación. Las donaciones representan recursos recibidos. Las compras y gastos representan ejecución real. La transformación registra kits preparados. El impacto registra entregas y población atendida.

### Target Flow

```text
PROJECT PLANNING
Project -> Approved Budget -> Budget Lines -> Funding Commitments

RECEIVE
Donation -> Donation Details -> Project/Budget Allocation

EXECUTE
Budget Line -> Procurement/Expense -> Invoice and Payment Evidence

TRANSFORM
Kit Definition + Components -> Kit Transformation -> Assembly Evidence

IMPACT
Impact Event -> Kit Delivery -> Demographics and Delivery Evidence

REPORT
Budget vs Actual + Funding + Receive + Transform + Impact -> ES/EN Report Snapshot
```

### Separation of Records

| Record | Meaning | Creation trigger |
|---|---|---|
| `project_budget` | Approved plan | Formal budget approval |
| `budget_funding` | Committed funding source | Signed commitment or approved allocation |
| `donation` | Resources actually received | Confirmed receipt |
| `procurement_expense` | Actual purchase or payment | Approved invoice/payment |
| `kit_transformation` | Kits actually assembled | Completed preparation record |
| `impact_event` | Actual field activity | Delivery activity |
| `report_snapshot` | Institutional report version | Reporting cutoff and publication |

### FORM 205 Load Gate

The first FORM 205 budget may be staged after normalization. Final approval requires:

1. Project Manager duration confirmation.
2. Food basket coverage confirmation.
3. Organization contribution amount.
4. BWAid request amount.
5. M&E classification.

### International Reporting

Report snapshots support `es` and `en` language codes, a shared data cutoff, immutable published files, and evidence references. Reports can include approved, committed, received, spent, transformed, and impacted totals.
