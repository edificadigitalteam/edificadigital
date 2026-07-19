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
    ├─── /donations/in-kind/new → Guided in-kind shipment intake
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

#### In-kind shipments and containers

The operational intake route guides the user through four short steps:

1. sender and origin;
2. transport and arrival;
3. declared goods; and
4. final review.

```text
Donation (in_kind)
  ↓
Shipment (route, container, ETA, customs state)
  ↓
ShipmentItem[] (food, clothing, hygiene, health, household, other)
  ↓
InventoryLot[] (received, accepted, damaged, expiry, dietary attributes)
  ↓
InventoryMovement[] (receipt, transformation, distribution, adjustment)
```

The first interface implementation retains a browser draft and prepares the Supabase payload. Operational synchronization follows the foundational donation-schema deployment and environment connection.

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
