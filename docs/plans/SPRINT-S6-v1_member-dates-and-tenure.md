# Sprint S6 — Member Dates and Tenure

**Branch:** `claude/cool-babbage-2np7d0`

**Status:** Draft — plan only, no implementation yet. The four product
decisions below are already confirmed; this document needs a read-through
before Red/Green/Refactor begins.

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
3. **Partial dates are supported.** Knowing the day and month of a birthday
   but not the year is common, and so is knowing only the founding year of
   a church. Refusing those would leave the fields empty in practice, which
   defeats the feature. Both dates carry a precision alongside them.
4. **The celebration date of a person stays in `public`**, alongside the
   name and email, consistent with decision 6 of the S5 plan. See "Privacy
   note" below — this one needs recording in the ADR, because
   `CLAUDE.md` names dates of birth as protected data and a reader who
   finds one in `public` should find the reasoning next to it, not a
   silence that looks like an oversight.

## Goals

- Two optional dates per member, each with its precision, in the database.
- A member form that collects them with labels matching the member type,
  and that accepts a partial date without tricks.
- Elapsed time shown wherever each date is shown, when the year is known.
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

Four new nullable columns on `public.organization_member`. No new table, no
RLS change — the table's existing organization-scoped policies already
cover every column — and no backfill, since everything is optional and new.

| Column | Notes |
|---|---|
| `celebration_date` | `date`, nullable. Founding date or birthday, depending on `member_type` |
| `celebration_date_precision` | `text`, nullable. `full` \| `month_day` \| `year`. Null exactly when `celebration_date` is null |
| `membership_since` | `date`, nullable. Since when the member is part of the tenant |
| `membership_since_precision` | `text`, nullable. Same domain and same null rule |

Constraints:

- `check (celebration_date_precision in ('full','month_day','year'))`
- `check ((celebration_date is null) = (celebration_date_precision is null))`,
  and the same pair for `membership_since`. A date without its precision is
  unreadable, and a precision without a date is noise.

### Storing a partial date

The stored value is always a real `date`; the precision column says which
of its parts are meaningful:

- `full` — the whole date is real.
- `month_day` — month and day are real, the year is a placeholder.
- `year` — the year is real, month and day are placeholders.

A `before insert or update` trigger normalizes the placeholder parts, so a
partial date has exactly one representation and no caller can leave
meaningful-looking garbage in the unused half: precision `month_day` forces
the year to a fixed constant, precision `year` forces the date to January 1.

**The alternative considered and rejected:** three nullable integer columns
per date (`..._year`, `..._month`, `..._day`), where precision is implied
by which are null. That is more honest — no placeholders at all — but it is
six columns for two dates, it gives up `date` arithmetic in SQL, and the
greeting module's eventual "whose month and day are today" query is
cleaner against a real `date`. The placeholder approach is a reversible
implementation choice: moving to components later is a mechanical
migration. Flagging it here rather than asking, since either shape delivers
the same behavior.

### Migration path to the deferred table

Should the greeting module later need arbitrary dates per member, the
deferred `organization_member_date` table gains one row per non-null column
here (`kind = 'celebration' | 'membership'`, carrying the same precision),
and these four columns are dropped in the same migration. Nothing else
in the directory reads them, so the change stays local.

## Frontend design

### The member form

- The celebration field's label follows `member_type` and switches live
  when the type changes: **"Fecha de fundación"** for an organization,
  **"Fecha de cumpleaños"** for a person. The affiliation field is
  **"Miembro desde"** for both.
- Each date is collected as **three separate fields — día, mes, año —**
  rather than a native date picker. A picker cannot express "day and month
  but no year", and three labelled fields are the more legible control for
  people with varied digital literacy, which is the standing requirement
  for this product. The precision is derived from what was filled in:
  all three → `full`, day and month → `month_day`, year alone → `year`.
- Validation states the exact action needed, as everywhere else: a day
  without a month, or a day and month that do not exist (31 of February),
  is rejected inline next to the field. Both dates stay fully optional.
- A future date is rejected for both: neither a founding, a birth, nor an
  affiliation happens tomorrow.

### Showing elapsed time

Elapsed time appears next to each date wherever the date appears, and only
when the year is known — with precision `month_day` there is nothing to
count from, and the interface says nothing rather than guessing.

- Rendered from a pure, tested function in `members.js`, taking the date,
  its precision and today's date. No new dependency.
- Reads as whole years once there is at least one ("26 años"), and as
  months below that ("8 meses"). With precision `year`, it is computed
  from January 1 and marked as approximate, so a figure that could be off
  by up to a year never presents itself as exact.
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
2. **Red** — pgTAP for the four columns, their check constraints, the
   null-pairing rule, and the normalization trigger (including the
   rejection cases). Unit tests for the precision-derivation and
   elapsed-time functions, covering the partial-date and future-date paths
   and a leap-year birthday.
3. **Green** — one migration; `members.js` gains the pure functions.
4. **Frontend** — the three-field date control, the type-dependent label,
   the list column, the elapsed-time display, and the dictionary entries.
5. **Verify** — `npm test`, `npm run lint`, `npm run build`; pgTAP against
   the deployed project; Supabase advisors after the migration;
   `playwright-cli` at the standard breakpoints with the screenshot the
   list-column decision above depends on.
6. **Document** — `docs/DATABASE.md` for the new columns and the
   normalization rule, ADR-004 for the privacy distinction, this plan's
   status, and `docs/plans/INDEX.md`.
7. **Review** — PR with verification results and screenshots; human
   approval before merge.

## Risks and open questions

- **The placeholder-year representation** is the main thing to get right in
  review. It is invisible to anyone reading through the application, but
  anyone querying the table directly will see a real-looking year on a
  `month_day` row. The normalization trigger and a column comment are what
  keep that honest; if reviewers would rather not have placeholders in the
  data at all, the component-columns alternative above is the swap.
- **Leap-year birthdays.** A 29 February date is valid and must survive
  storage and display. Whether a greeting fires on the 28th or the 1st in
  a non-leap year is the greeting module's problem, not this plan's, but
  the date itself has to be storable — so it gets a test here.
- **"Miembro desde" for a person who predates the record.** Nothing stops
  a tenant entering 1970. Intentional: the field records history, not the
  row's creation.
- **The single list column** may prove too cramped once real names and
  dates are in it — see the screenshot gate above.

## Next

With real dates in the directory, the anniversary-greeting plan becomes
writable: it reads `celebration_date` where precision is not `year`,
decides the channel and whether a human reviews before sending, and brings
its own scheduler decision (`pg_cron` is still not enabled anywhere in this
codebase) plus a send log for idempotency.

---

**Version:** 1.0
**Last updated:** 2026-09-17
