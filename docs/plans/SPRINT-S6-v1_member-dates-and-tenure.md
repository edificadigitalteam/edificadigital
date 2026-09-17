# Sprint S6 — Member Dates and Tenure

**Branch:** `claude/cool-babbage-2np7d0`

**Status:** Implemented — migration applied to `edifydb` on 2026-09-17
(`20260917185229`), 13/13 pgTAP assertions passing, advisors identical to the
previous baseline. The privacy distinction is recorded as a scope-boundary
section in `docs/adr/ADR-004-protected-beneficiary-identity.md`. The one item
still outstanding is the screenshot gate on the single list column (see
"Where it goes on the screen"), which needs a browser this environment cannot
reach.

## Context

`SPRINT-S5-v1_member-directory-and-mantenedores.md` shipped the member
directory (#106) and its bilingual parity (#107). It deliberately carried
no dates: the greeting-automation phase was deferred, and with it an
`organization_member_date` table.

The product owner now asks for two optional dates on a member:

1. **A celebration date** — the founding date of a member organization, or
   the birthday of a member person. One column, one meaning ("the date this
   member celebrates"); only the visible label changes with `member_type`.
2. **An affiliation date** — since when this member has been part of the
   tenant.

And, somewhere in the interface, **how long** each of those has been
running: the age of the celebration date and the tenure as a member.

## Product decisions confirmed in conversation

1. **Two columns on `organization_member`, not the deferred
   `organization_member_date` table.** These are one value each per member,
   not a list. The deferred table stays deferred; if the greeting module
   later needs arbitrary extra dates, it is added then and these two
   columns become its backfill. See "Migration path to the deferred table"
   below, written now so that later change is not a rediscovery.
2. **The affiliation date belongs to the member**, meaning "since when this
   member is part of your organization" — not to the person↔organization
   relationship. A pastor therefore has his own entry date into the tenant;
   the directory does not record since when he holds each particular role.
   That per-role history is a real idea, and explicitly out of scope here.
3. **Complete dates only.** Partial dates were considered and dropped by
   the product owner on 2026-09-17: storing just a year, or a day and month
   with no year, is explicitly out. Both fields stay entirely optional — a
   member with no known dates is normal — but a date that is recorded is
   recorded in full. This removes the precision columns, the placeholder
   representation and its normalizing trigger that an earlier revision of
   this plan carried, and it lets the form use the same native date input
   the rest of the dashboard already uses.
4. **The celebration date of a person stays in `public`**, alongside the
   name and email, consistent with decision 6 of the S5 plan. See "Privacy
   note" below — this one needs recording in the ADR, because
   `CLAUDE.md` names dates of birth as protected data and a reader who
   finds one in `public` should find the reasoning next to it, not a
   silence that looks like an oversight.

## Goals

- Two optional `date` columns per member.
- A member form that collects them with labels matching the member type.
- Elapsed time shown wherever each date is shown.
- Bilingual parity for all new copy, per the standard S6's predecessor
  established.

## Non-goals

- **Greeting automation.** Still deferred, still its own plan: channel,
  scheduler, template, send log, review-before-send. These columns are
  what that plan will read, not a step toward building it here.
- **Per-relationship dates** (since when a person holds a given role in a
  given organization) — decision 2.
- **Sorting or filtering the directory by upcoming anniversary.** Useful,
  and the natural home is the greeting module's own queue rather than the
  directory list.
- **Age or tenure in reports or exports.** Display only, for now.

## Privacy note (needs recording in the ADR)

A person's birthday is a date of birth. `CLAUDE.md` and
`docs/adr/ADR-004-protected-beneficiary-identity.md` name dates of birth
among the fields that belong in the `private` schema and stay out of public
reporting. That rule was written for **beneficiaries** — people a project
serves, often vulnerable, whose participation must not be identifiable.

A member is a different subject: an institutional contact, a pastor or an
auxiliary president, recorded so the organization can reach and greet them.
Decision 6 of the S5 plan already placed members in `public` at the same
exposure level as `actor`, and RLS scopes every row to its tenant.

The decision is to keep it that way, and part of this sprint's work is to
write that distinction into ADR-004 (or a short ADR of its own) so the
boundary reads as a deliberate line rather than an exception someone
forgot. Two things the implementation must hold to, so the line stays
where it is:

- The celebration date never reaches a public or international reporting
  endpoint. Those use aggregate impact data; nothing here changes that.
- If a member ever gains a link to `actor` or to a beneficiary record (both
  already listed as out of scope in S5), this decision is re-opened, not
  inherited.

## Database design

Two new nullable columns on `public.organization_member`. No new table, no
RLS change — the table's existing organization-scoped policies already
cover every column — and no backfill, since everything is optional and new.

| Column | Notes |
|---|---|
| `celebration_date` | `date`, nullable. Founding date or birthday, depending on `member_type` |
| `membership_since` | `date`, nullable. Since when the member is part of the tenant |

No check constraints, and this is worth stating rather than passing over:
the one rule worth enforcing is "not in the future", and a `check`
constraint cannot express it, because Postgres requires check expressions
to be immutable and `current_date` is not. The options are a trigger or
application validation.

**This plan uses application validation only.** A future date is a
data-entry mistake, not a broken invariant: a tenant pre-registering an
affiliation that takes effect next month is doing something reasonable, and
a trigger would refuse it. That is the opposite of the reasoning behind the
S5 category trigger, where a member pointing at another tenant's catalog
was corrupt data no matter who wrote it. Worth a reviewer disagreeing with
if they read it differently.

### Migration path to the deferred table

Should the greeting module later need arbitrary dates per member, the
deferred `organization_member_date` table gains one row per non-null column
here (`kind = 'celebration' | 'membership'`), and these two columns are
dropped in the same migration. Nothing else in the directory reads them, so
the change stays local.

## Frontend design

### The member form

- The celebration field's label follows `member_type` and switches live
  when the type changes: **"Fecha de fundación"** for an organization,
  **"Fecha de cumpleaños"** for a person. The affiliation field is
  **"Miembro desde"** for both.
- Each date is a native `<input type="date">`, the same control
  `ProjectsPanel.jsx` already uses for a project's start and end dates.
  Complete dates only (decision 3) is exactly what makes this possible.
- Both fields stay optional, with no validation beyond the browser's own
  date parsing and the future-date check below. An empty field means "not
  known", which is the common case and must stay effortless.
- A future date is rejected inline, next to the field, with the action to
  take spelled out — a founding or a birth in the future is a typo. The
  affiliation date gets the same treatment for consistency; see the
  database section for why this lives in the form rather than a trigger.

### Showing elapsed time

Elapsed time appears next to each date wherever the date appears. With
complete dates it is always computable, so there is no "unknown" state to
design around.

- Rendered from a pure, tested function in `members.js`, taking the date
  and today's date. No new dependency.
- Reads as whole years once there is at least one ("26 años"), and as
  months below that ("8 meses"). Under a month it says nothing rather than
  counting days, which would be noise on a founding or affiliation date.
- Wording differs per date so each reads naturally: the celebration date
  of a person shows an age, of an organization a time since founding, and
  the affiliation date shows tenure.

### Where it goes on the screen

- **The edit screen** shows both dates in full with their elapsed time.
  This is the primary surface; the form is already a full page with room.
- **The list** gains **one** column, not two. The member table already
  carries six columns, and the repository's own rule is that every label
  stays legible down to 320 CSS pixels; two more would break that. The new
  column stacks both values compactly using the `<strong>` + `<span>`
  pattern the table already uses, each line labelled so the reader knows
  which date is which.

That single-column choice is the part of this plan most likely to be wrong
on contact with real data, and it is a presentation decision, not a data
one. It gets a screenshot at 320/375/414/768 and desktop before the
frontend step is called done.

### Bilingual parity

Every new phrase — both labels, the three sub-field labels, the validation
messages, and each elapsed-time wording — is added to
`managementTranslations.js` in the same change, per the "Bilingual Parity
Standard" in `docs/DESIGN.md`. The elapsed-time strings are produced by a
function, so they are covered by translation **patterns** (`26 años` →
`26 years`), and `membersTranslations.test.js` is extended to assert those
patterns resolve, not only the fixed strings.

## Step-by-step tasks

1. **Plan review** — read this document; the four decisions are already
   settled, so this is a check on the design, not a re-litigation.
2. **Red** — pgTAP for the two columns: present, `date`, nullable, no
   default, and accepted by an insert that omits them entirely. Unit tests
   for the elapsed-time function (whole years, the under-a-year month case,
   the under-a-month silence, a 29 February date, and a date exactly on
   today's month and day) and for the future-date validation.
3. **Green** — one migration; `members.js` gains the pure functions.
4. **Frontend** — the three-field date control, the type-dependent label,
   the list column, the elapsed-time display, and the dictionary entries.
5. **Verify** — `npm test`, `npm run lint`, `npm run build`; pgTAP against
   the deployed project; Supabase advisors after the migration;
   `playwright-cli` at the standard breakpoints with the screenshot the
   list-column decision above depends on.
6. **Document** — `docs/DATABASE.md` for the new columns, including that
   the future-date rule lives in the form and why; ADR-004 for the privacy
   distinction; this plan's status; and `docs/plans/INDEX.md`.
7. **Review** — PR with verification results and screenshots; human
   approval before merge.

## Risks and open questions

- **Complete dates will cost some data.** A tenant who knows a pastor's
  birthday as "12 de marzo" but not the year now leaves the field empty.
  That is the accepted trade for a simpler model, and it is recoverable:
  should it bite in practice, precision can be added later without
  touching what is stored today. Recording it so the trade is a decision
  on the record rather than a surprise.
- **Leap-year birthdays.** A 29 February date is valid and must survive
  storage and display. Whether a greeting fires on the 28th or the 1st in
  a non-leap year is the greeting module's problem, not this plan's, but
  the date itself has to be storable — so it gets a test here.
- **A complete date of birth in `public`** makes the privacy note above
  load-bearing rather than incidental: what is stored is the full date, not
  a month and day. The decision stands (decision 4), and writing it into
  the ADR is part of the work, not a follow-up.
- **"Miembro desde" for a person who predates the record.** Nothing stops
  a tenant entering 1970. Intentional: the field records history, not the
  row's creation.
- **The single list column** may prove too cramped once real names and
  dates are in it — see the screenshot gate above.

## Next

With real dates in the directory, the anniversary-greeting plan becomes
writable: it reads `celebration_date`, matches on month and day,
decides the channel and whether a human reviews before sending, and brings
its own scheduler decision (`pg_cron` is still not enabled anywhere in this
codebase) plus a send log for idempotency.

---

**Version:** 1.1
**Last updated:** 2026-09-17
