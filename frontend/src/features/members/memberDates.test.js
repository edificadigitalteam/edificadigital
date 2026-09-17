import test from 'node:test'
import assert from 'node:assert/strict'
import {
  celebrationDateLabel,
  celebrationShortLabel,
  elapsedCaption,
  elapsedLabel,
  elapsedSince,
  formatMemberDate,
  isFutureMemberDate,
  parseMemberDate,
  validateMember,
} from './members.js'

// A fixed "today" so these never depend on the day they run.
const TODAY = new Date(2026, 8, 17) // 17 September 2026

test('a complete date parses, and an impossible one is rejected rather than rolled over', () => {
  const parsed = parseMemberDate('1998-03-12')
  assert.equal(parsed.getFullYear(), 1998)
  assert.equal(parsed.getMonth(), 2)
  assert.equal(parsed.getDate(), 12)

  // new Date(2026, 1, 30) silently becomes 2 March; the round-trip check
  // catches that instead of storing a different date than the one given.
  assert.equal(parseMemberDate('2026-02-30'), null)
  assert.equal(parseMemberDate('2026-13-01'), null)
  assert.equal(parseMemberDate('12/03/1998'), null)
  assert.equal(parseMemberDate(''), null)
  assert.equal(parseMemberDate(null), null)
})

test('a 29 February date is a real date and parses', () => {
  const parsed = parseMemberDate('2024-02-29')
  assert.equal(parsed.getMonth(), 1)
  assert.equal(parsed.getDate(), 29)
  assert.equal(parseMemberDate('2025-02-29'), null)
})

test('a timestamp from Postgres is accepted by taking its date part', () => {
  assert.equal(parseMemberDate('1998-03-12T00:00:00+00:00').getDate(), 12)
})

test('elapsed time counts whole years once the anniversary has arrived', () => {
  assert.deepEqual(elapsedSince('1998-03-12', TODAY), { years: 28, months: 6, totalMonths: 342 })
  assert.equal(elapsedLabel('1998-03-12', TODAY), '28 años')

  // The day before the anniversary is still the previous year.
  assert.equal(elapsedLabel('2000-09-16', TODAY), '26 años')
  assert.equal(elapsedLabel('2000-09-17', TODAY), '26 años')
  assert.equal(elapsedLabel('2000-09-18', TODAY), '25 años')
})

test('elapsed time reads in months below a year and says nothing below a month', () => {
  assert.equal(elapsedLabel('2026-01-17', TODAY), '8 meses')
  assert.equal(elapsedLabel('2026-08-17', TODAY), '1 mes')
  assert.equal(elapsedLabel('2026-09-01', TODAY), '')
  assert.equal(elapsedLabel('2026-09-17', TODAY), '')
})

test('elapsed time uses the singular for exactly one year', () => {
  assert.equal(elapsedLabel('2025-09-17', TODAY), '1 año')
  assert.equal(elapsedLabel('2024-09-17', TODAY), '2 años')
})

test('a 29 February date reaches one year on 1 March of a common year', () => {
  assert.equal(elapsedLabel('2024-02-29', new Date(2025, 1, 28)), '11 meses')
  assert.equal(elapsedLabel('2024-02-29', new Date(2025, 2, 1)), '1 año')
})

test('a future date has no elapsed time and is reported as future', () => {
  assert.equal(elapsedSince('2030-01-01', TODAY), null)
  assert.equal(elapsedLabel('2030-01-01', TODAY), '')
  assert.equal(isFutureMemberDate('2030-01-01', TODAY), true)
  assert.equal(isFutureMemberDate('2026-09-17', TODAY), false)
  assert.equal(isFutureMemberDate('2026-09-18', TODAY), true)
  // An absent or unparseable date is not "future" — that is a separate message.
  assert.equal(isFutureMemberDate('', TODAY), false)
  assert.equal(isFutureMemberDate('2026-02-30', TODAY), false)
})

test('the celebration label follows the member type, long and short', () => {
  assert.equal(celebrationDateLabel('organization'), 'Fecha de fundación')
  assert.equal(celebrationDateLabel('person'), 'Fecha de cumpleaños')
  assert.equal(celebrationShortLabel('organization'), 'Fundación')
  assert.equal(celebrationShortLabel('person'), 'Cumpleaños')
})

test('the elapsed figure is captioned per date so each reads naturally', () => {
  assert.equal(elapsedCaption('celebration', 'person'), 'Edad')
  assert.equal(elapsedCaption('celebration', 'organization'), 'Tiempo desde la fundación')
  assert.equal(elapsedCaption('membership', 'person'), 'Antigüedad')
  assert.equal(elapsedCaption('membership', 'organization'), 'Antigüedad')
})

test('a date renders for reading, and an absent one renders as nothing', () => {
  assert.match(formatMemberDate('1998-03-12'), /1998/)
  assert.equal(formatMemberDate(''), '')
  assert.equal(formatMemberDate('2026-02-30'), '')
})

test('both dates stay optional: a member with neither is valid', () => {
  const member = { name: 'Ana Pérez', member_type: 'person' }
  assert.equal(validateMember(member, [], TODAY), '')
  assert.equal(validateMember({ ...member, celebration_date: '', membership_since: '' }, [], TODAY), '')
})

test('a future celebration date is rejected with wording matching the member type', () => {
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', celebration_date: '2030-01-01' }, [], TODAY),
    'La fecha de cumpleaños no puede ser futura. Corrígela o deja el campo vacío.',
  )
  assert.equal(
    validateMember({ name: 'Iglesia El Centro', member_type: 'organization', celebration_date: '2030-01-01' }, [], TODAY),
    'La fecha de fundación no puede ser futura. Corrígela o deja el campo vacío.',
  )
})

test('a future affiliation date is rejected', () => {
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', membership_since: '2030-01-01' }, [], TODAY),
    'La fecha de "Miembro desde" no puede ser futura. Corrígela o deja el campo vacío.',
  )
})

test('an impossible date is rejected separately from a future one', () => {
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', celebration_date: '2026-02-30' }, [], TODAY),
    'Revisa la fecha de cumpleaños: escribe una fecha real o deja el campo vacío.',
  )
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', membership_since: '2026-02-30' }, [], TODAY),
    'Revisa la fecha de "Miembro desde": escribe una fecha real o deja el campo vacío.',
  )
})

test('a past date on today itself is accepted', () => {
  assert.equal(
    validateMember({ name: 'Ana Pérez', member_type: 'person', celebration_date: '2026-09-17', membership_since: '2026-09-17' }, [], TODAY),
    '',
  )
})
