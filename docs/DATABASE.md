# Database Schema Reference

## Tables Overview

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `actor` | People and organizations | name, email, is_organization, is_anonymous |
| `actor_role` | N:N relationships | actor_id, role (Donor\|Supplier\|Manager\|Beneficiary) |
| `donation` | Master: intake of resources | actor_id, recorded_at |
| `donation_detail` | Lines: monetary or in-kind | type, amount, quantity, unit_of_measure_id |
| `donation_attachment` | Evidence: proof of payment, receipts | donation_id, media_type_id, storage_url |
| `kit_transformation` | Master: kits created | kit_name, quantity_generated |
| `kit_transformation_attachment` | Evidence: invoices, photos | kit_transformation_id, storage_url |
| `impact_event` | Master: campaign/delivery event | responsible_actor_id, start_date, end_date, status, demographics |
| `impact_detail` | Lines: kit dispatch | impact_event_id, kit_transformation_id, quantity_delivered |
| `impact_event_attachment` | Evidence: delivery photos, sign-in sheets | impact_event_id, storage_url |
| `media_type` | Catalog: photo/document classification | name (Proof of Payment, Fiscal Invoice, ...) |
| `unit_of_measure` | Catalog: units | name (Unit, Kg, Pallet, ...) |

## Entity Relationships

```
actor ──── actor_role ────┐
                          └──→ (Donor, Supplier, Manager, Beneficiary)

actor (Donor) ──→ donation ──→ donation_detail
                            └──→ donation_attachment

kit_transformation ──→ kit_transformation_attachment

actor (Manager) ──→ impact_event ──→ impact_detail ──→ kit_transformation
                  └──→ impact_event_attachment
```

## Detailed Schema

### actor
```sql
id UUID PK
name TEXT NOT NULL
email TEXT UNIQUE NOT NULL
is_organization BOOLEAN DEFAULT FALSE
is_anonymous BOOLEAN DEFAULT FALSE
active BOOLEAN DEFAULT TRUE
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Master record for all people and organizations
**Use cases:** Search by email to find or create Actor for Donation

---

### actor_role
```sql
id UUID PK
actor_id UUID FK → actor(id)
role ENUM (Donor | Supplier | Beneficiary | Manager)
assigned_at TIMESTAMP DEFAULT NOW()
UNIQUE(actor_id, role)
```

**Purpose:** Define what roles an Actor can have
**Use cases:** One person can be both Donor and Manager simultaneously

---

### donation
```sql
id UUID PK
actor_id UUID FK → actor(id)
recorded_at TIMESTAMP DEFAULT NOW()
created_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Master record for a donation intake event
**Use cases:** "User recorded a donation from John Doe on June 1"

---

### donation_detail
```sql
id UUID PK
donation_id UUID FK → donation(id)
type ENUM (Monetary | InKind)
amount DECIMAL(12,2)           ← Only if type = Monetary (USD)
item_description TEXT          ← Only if type = InKind
quantity DECIMAL(12,2)         ← Only if type = InKind
unit_of_measure_id UUID FK → unit_of_measure(id)  ← Only if InKind
created_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Grid lines within a Donation (multiple lines in one intake event)
**Example:**
- Line 1: Monetary, amount=500, currency=USD
- Line 2: InKind, item_description="Pallets of water", quantity=5, unit="pallet"

**Validation:** If type=Monetary, amount must be set; if InKind, quantity + unit must be set

---

### donation_attachment
```sql
id UUID PK
donation_id UUID FK → donation(id)
media_type_id UUID FK → media_type(id)
storage_url TEXT NOT NULL      ← Supabase Storage URL
created_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Evidence files (receipts, proof of payment) for a Donation
**Storage:** Supabase Storage bucket `attachments`
**Access:** RLS policies ensure only authenticated users can view/upload

---

### kit_transformation
```sql
id UUID PK
date TIMESTAMP DEFAULT NOW()
kit_name TEXT NOT NULL         ← e.g., "Basic Food Kit"
quantity_generated INTEGER NOT NULL (> 0)
created_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** One record per kit type created
**Note:** If creating 100 food kits AND 50 hygiene kits same day → 2 separate records
**Rationale:** Keeps evidence (invoice, photos) unambiguous per kit type

---

### kit_transformation_attachment
```sql
id UUID PK
kit_transformation_id UUID FK → kit_transformation(id)
media_type_id UUID FK → media_type(id)
storage_url TEXT NOT NULL
created_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Evidence (fiscal invoice, assembly photos) for a KitTransformation

---

### impact_event
```sql
id UUID PK
responsible_actor_id UUID FK → actor(id)  ← Manager/Responsible
start_date DATE NOT NULL
end_date DATE NOT NULL
target_population TEXT NOT NULL            ← e.g., "Caraballeda Community"
status ENUM (InProgress | Closed) DEFAULT 'InProgress'
total_families INTEGER DEFAULT 0           ← Aggregate demographics
men INTEGER DEFAULT 0
women INTEGER DEFAULT 0
boys INTEGER DEFAULT 0
girls INTEGER DEFAULT 0
elderly INTEGER DEFAULT 0
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Master record for a campaign/delivery event
**Note:** `responsible_actor_id` must reference an Actor with Manager role
**Demographics:** Totals extracted from physical sign-in sheets (aggregate, not nominal)

---

### impact_detail
```sql
id UUID PK
impact_event_id UUID FK → impact_event(id)
kit_transformation_id UUID FK → kit_transformation(id)
quantity_delivered INTEGER NOT NULL (> 0)
created_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Grid: which kits were dispatched to this event, and how many
**Example:** "Dispatched 60 of the 100 Food Kits to ImpactEvent X"
**Inventory:** quantity_delivered deducts from kit_transformation.quantity_generated

---

### impact_event_attachment
```sql
id UUID PK
impact_event_id UUID FK → impact_event(id)
media_type_id UUID FK → media_type(id)
storage_url TEXT NOT NULL
created_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Evidence (delivery photos, signed sign-in sheets) for an ImpactEvent

---

### media_type (Catalog)
```sql
id UUID PK
name TEXT UNIQUE NOT NULL
description TEXT
created_at TIMESTAMP DEFAULT NOW()
```

**Predefined values:**
- "Proof of Payment" — Bank transfer, cash receipt
- "Fiscal Invoice" — Official invoice for goods/services
- "Transformation Evidence" — Photos of kit assembly
- "Delivery Evidence" — Photos/PDFs of delivery events

**Use:** Classification in attachment tables; filterable in UI ("show invoices")

---

### unit_of_measure (Catalog)
```sql
id UUID PK
name TEXT UNIQUE NOT NULL
abbreviation TEXT
created_at TIMESTAMP DEFAULT NOW()
```

**Predefined values:**
- Unit (u)
- Kilogram (kg)
- Pallet (pallet)
- Box (box)
- Liter (L)

**Use:** Quantification in DonationDetail when type=InKind

---

## Key Constraints & Relationships

### Referential Integrity
- `donation_detail.donation_id` → `donation.id` (CASCADE delete: removing a Donation removes all its details)
- `donation_attachment.donation_id` → `donation.id` (CASCADE delete)
- `kit_transformation_attachment.kit_transformation_id` → `kit_transformation.id` (CASCADE delete)
- `impact_detail.impact_event_id` → `impact_event.id` (CASCADE delete)
- `impact_detail.kit_transformation_id` → `kit_transformation.id` (RESTRICT delete: can't delete a kit that's already been dispatched)
- `impact_event_attachment.impact_event_id` → `impact_event.id` (CASCADE delete)
- `actor.id` ← `donation.actor_id`, `impact_event.responsible_actor_id` (RESTRICT delete: can't delete an actor with transactions)

### Unique Constraints
- `actor.email` — one email per actor (used for lookup)
- `actor_role` (actor_id, role) — an actor can have one of each role, but not duplicates of the same role
- `media_type.name`, `unit_of_measure.name` — unique catalog entries

### Validation (App-Level)
- `donation_detail.type = Monetary` ⟹ `amount` required, `quantity/unit_of_measure_id` must be NULL
- `donation_detail.type = InKind` ⟹ `quantity` and `unit_of_measure_id` required, `amount` must be NULL
- `impact_event.start_date <= end_date`
- `kit_transformation.quantity_generated > 0`
- `impact_detail.quantity_delivered <= kit_transformation.quantity_generated` (can't dispatch more than generated, but multi-event dispatch is possible)

## Row Level Security (RLS)

**MVP approach:** Authenticated users have full access; no column-level restrictions.

**Policies (per table):**
- SELECT: `auth.role() = 'authenticated'`
- INSERT/UPDATE/DELETE: `auth.role() = 'authenticated'`

**Future (post-MVP):** Add actor-specific row restrictions (e.g., only Managers can edit their own ImpactEvents).

## Storage (Supabase Storage)

**Bucket:** `attachments` (private, access via RLS)

**Path structure (recommended):**
```
attachments/
├── donation/[donation_id]/[file-name]
├── kit_transformation/[kit_id]/[file-name]
└── impact_event/[event_id]/[file-name]
```

**File types:** JPEG, PNG, PDF (others can be allowed as needed)
**Size limit:** Individual files up to 5 GB; total bucket limit 1 GB (free tier)

---

## Queries (Common Use Cases)

### List all Donations for a specific Actor
```sql
SELECT d.* FROM donation d
WHERE d.actor_id = $1
ORDER BY d.recorded_at DESC;
```

### Get a Donation with all its details and attachments
```sql
SELECT d.*,
       json_agg(json_build_object('id', dd.id, 'type', dd.type, 'amount', dd.amount, ...)) as details,
       json_agg(json_build_object('id', da.id, 'url', da.storage_url, ...)) as attachments
FROM donation d
LEFT JOIN donation_detail dd ON dd.donation_id = d.id
LEFT JOIN donation_attachment da ON da.donation_id = d.id
WHERE d.id = $1
GROUP BY d.id;
```

### Get an ImpactEvent with kit dispatch and demographics
```sql
SELECT ie.*,
       json_agg(json_build_object('kit_name', kt.kit_name, 'quantity_delivered', id.quantity_delivered, ...)) as kits_dispatched
FROM impact_event ie
LEFT JOIN impact_detail id ON id.impact_event_id = ie.id
LEFT JOIN kit_transformation kt ON kt.id = id.kit_transformation_id
WHERE ie.id = $1
GROUP BY ie.id;
```

### Total people impacted (dashboard metric)
```sql
SELECT SUM(
  ie.total_families + ie.men + ie.women + ie.boys + ie.girls + ie.elderly
) as total_people_impacted
FROM impact_event ie
WHERE ie.status = 'Closed';
```

---

**Version:** MVP
**Last updated:** [date]
**Related:** See 2_MVP_Specification.docx for detailed field descriptions
