import test from 'node:test'
import assert from 'node:assert/strict'

import { buildComplianceReportDocDefinition } from './complianceReportPdf.js'

const baseReport = () => ({
  project: {
    name: 'Kits escolares Zona Norte',
    code: 'PRJ-001',
    funding_partner: 'Fundación Ejemplo',
    currency: 'USD',
    approved_budget: 10000,
    objective: 'Entregar kits escolares a niñas y niños de la zona norte.',
    expected_results: '500 kits entregados',
    reporting_requirements: 'Informe trimestral',
  },
  generatedAt: new Date('2026-07-27T15:00:00Z'),
  metrics: {
    investment: 4200,
    beneficiaries: 320,
    averageCompliance: 64,
    budgetCompliance: 42,
  },
  funding: {
    receivedProjectCurrency: 5000,
    executedAmount: 4200,
    availableBalance: 800,
    receivedByCurrency: { USD: 5000 },
    inKindReferenceByCurrency: {},
    linkedDonations: [],
  },
  outputs: [
    { id: 'o1', name: 'Kits armados', unit_label: 'kits', status: 'in_progress', target_quantity: 500, produced_quantity: 300, delivered_quantity: 280, beneficiary_count: 280 },
  ],
  expenses: [
    { id: 'e1', expense_date: '2026-06-01', supplier_name: 'Papelería Central', category: 'Materiales', description: 'Cuadernos y lápices', amount: 1200, currency: 'USD', status: 'reported' },
  ],
  hasEvidence: false,
  organizationName: 'Fundación Ejemplo A.C.',
})

test('builds an A4 document definition whose header carries the brand mark and tenant name on every page, including the cover', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())

  assert.equal(doc.pageSize, 'A4')
  assert.equal(typeof doc.header, 'function')
  const coverHeaderText = JSON.stringify(doc.header(1, 5))
  assert.match(coverHeaderText, /Edifica Digital/)
  assert.match(coverHeaderText, /Fundación Ejemplo A\.C\./)
  // the cover page's own big title covers the project name; the header shouldn't repeat it there
  assert.doesNotMatch(coverHeaderText, /Página \d/)
})

test('header on detail pages carries the brand mark, tenant name, project name, export date, and page count', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())
  const headerText = JSON.stringify(doc.header(2, 5))
  assert.match(headerText, /Edifica Digital/)
  assert.match(headerText, /Fundación Ejemplo A\.C\./)
  assert.match(headerText, /Kits escolares Zona Norte/)
  assert.match(headerText, /Página 2 de 5/)
  assert.match(headerText, /27 jul 2026|27\/07\/2026|jul\.? de 2026/)
})

test('the cover page opens the document, carries the compliance gauge, and forces a page break before the detail', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())
  const [firstNode] = doc.content
  assert.equal(firstNode.stack[0].id, 'report-cover')

  const contentText = JSON.stringify(doc.content)
  assert.match(contentText, /Kits escolares Zona Norte/)
  assert.match(contentText, /64%/) // gauge text carries the rounded compliance percentage
  assert.match(contentText, /"pageBreak":"after"/)
})

test('the cover table of contents links to each section, omitting evidence when there is none', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())
  const contentText = JSON.stringify(doc.content)
  assert.match(contentText, /"linkToDestination":"section-financial"/)
  assert.match(contentText, /"linkToDestination":"section-physical"/)
  assert.match(contentText, /"linkToDestination":"section-expenses"/)
  assert.doesNotMatch(contentText, /"linkToDestination":"section-evidence"/)

  const withEvidence = buildComplianceReportDocDefinition({ ...baseReport(), hasEvidence: true })
  assert.match(JSON.stringify(withEvidence.content), /"linkToDestination":"section-evidence"/)
})

test('each detail section is anchored by id, and the footer links back to the cover once per page', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())
  const contentText = JSON.stringify(doc.content)
  assert.match(contentText, /"id":"section-financial"/)
  assert.match(contentText, /"id":"section-physical"/)
  assert.match(contentText, /"id":"section-expenses"/)
  assert.doesNotMatch(contentText, /"linkToDestination":"report-cover"/)

  assert.equal(doc.footer(1, 5), null)
  const footerText = JSON.stringify(doc.footer(2, 5))
  assert.match(footerText, /"linkToDestination":"report-cover"/)
})

test('content includes financial reconciliation and physical execution figures', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())
  const contentText = JSON.stringify(doc.content)
  assert.match(contentText, /Kits armados/)
  assert.match(contentText, /Papelería Central/)
})

test('throws when no project is provided, since a report requires a selected project', () => {
  assert.throws(() => buildComplianceReportDocDefinition({ ...baseReport(), project: null }))
})
