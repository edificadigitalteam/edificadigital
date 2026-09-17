-- Sprint S6 — two optional dates on a member.
--
-- `celebration_date` is one column with one meaning, "the date this member
-- celebrates": the founding date of a member organization, the birthday of a
-- member person. Only the visible label changes with `member_type`; the
-- interface decides that, not the schema.
--
-- `membership_since` records since when the member is part of the tenant. It
-- belongs to the member rather than to a person↔organization relationship:
-- the directory records entry into the organization, not since when a person
-- holds each particular role.
--
-- Both are complete dates or absent. Partial dates — a year alone, or a day
-- and month with no year — were considered and dropped, so there is no
-- precision column and no placeholder representation.
--
-- No RLS change: the table's organization-scoped policies already cover every
-- column. No backfill: both columns are optional and start null everywhere.
--
-- No check constraint guards "not in the future", and that is deliberate. A
-- check expression must be immutable, so it cannot read `current_date`; the
-- alternatives are a trigger or application validation. A future date here is
-- a data-entry mistake rather than a broken invariant — a tenant registering
-- an affiliation that takes effect next month is doing something reasonable —
-- so the rule lives in the member form, and the database stays permissive.
-- This is the opposite call from the S5 category trigger, where a member
-- pointing at another tenant's catalog is corrupt data whoever wrote it.

alter table public.organization_member
  add column if not exists celebration_date date;

alter table public.organization_member
  add column if not exists membership_since date;

comment on column public.organization_member.celebration_date is
  'Optional complete date this member celebrates: founding date for member_type = organization, birthday for member_type = person. Never partial; null when unknown.';

comment on column public.organization_member.membership_since is
  'Optional complete date from which this member is part of the tenant. Never partial; null when unknown.';
