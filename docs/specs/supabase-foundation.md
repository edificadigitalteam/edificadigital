# Test Specification: Supabase Foundation

**Status:** Tests precede migration
**Related plan:** `../plans/SPRINT-S1-v1_supabase-foundation.md`

## Schema existence

- All twelve foundation tables exist in `public`.
- Every primary key uses UUID.
- Detail and attachment tables reference their parent records.
- Operational history uses restrictive foreign-key deletion where required.

## Actors

- Actor name is required.
- Email is optional.
- Present emails are unique case-insensitively.
- Actor roles use donor, supplier, manager, and beneficiary.
- Duplicate actor roles are rejected.

## Donations

- Donation type accepts monetary, in-kind, and mixed.
- Monetary detail requires a positive amount and ISO currency.
- In-kind detail requires description, positive quantity, and unit.
- Monetary-only and in-kind-only fields remain internally consistent.
- Donation evidence references the private attachment bucket.

## Transformation and impact

- Generated kit quantity is positive.
- Impact start date is on or before end date.
- Demographic totals are non-negative.
- Delivered quantity is positive.
- Impact records retain their linked transformation history.

## Catalogs and Storage

- Unit catalog includes unit, kilogram, liter, box, pallet, and bag.
- Media catalog includes payment, receipt, shipment, transformation, and delivery evidence.
- The `attachments` bucket exists and remains private.

## RLS

- RLS is enabled on all foundation tables.
- Authenticated users receive the approved MVP access policy.
- Anonymous API sessions remain outside operational records and private attachments.

## Deployment verification

- The pre-migration existence query returns zero expected foundation tables.
- The post-migration query returns twelve foundation tables.
- The shipment migration subsequently adds five tables and one view.
- Migration history records both migration names.
- Supabase security and performance advisors are reviewed after deployment.

## Advisor-driven optimization

- Every foreign key reported by the Supabase performance advisor receives a covering index.
- Policies targeted to the `authenticated` role use constant predicates for operational tables.
- The private attachment policy evaluates the bucket boundary without a per-row authentication function call.
- Security advisors remain clear after optimization.
- Fresh indexes may appear as unused until operational traffic begins; they remain because they cover foreign keys and planned queries.
