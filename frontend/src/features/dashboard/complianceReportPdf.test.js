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
})

test('builds an A4 document definition with a header carrying project name and page count', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())

  assert.equal(doc.pageSize, 'A4')
  assert.equal(typeof doc.header, 'function')

  const header = doc.header(2, 5)
  const headerText = JSON.stringify(header)
  assert.match(headerText, /Kits escolares Zona Norte/)
  assert.match(headerText, /Página 2 de 5/)
})

test('header includes the export date formatted for the report locale', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())
  const headerText = JSON.stringify(doc.header(1, 1))
  assert.match(headerText, /27 jul 2026|27\/07\/2026|jul\.? de 2026/)
})

test('content includes financial reconciliation and physical execution figures', () => {
  const doc = buildComplianceReportDocDefinition(baseReport())
  const contentText = JSON.stringify(doc.content)
  assert.match(contentText, /Kits armados/)
  assert.match(contentText, /Papelería Central/)
  assert.match(contentText, /64\s?%/)
})

test('throws when no project is provided, since a report requires a selected project', () => {
  assert.throws(() => buildComplianceReportDocDefinition({ ...baseReport(), project: null }))
})
