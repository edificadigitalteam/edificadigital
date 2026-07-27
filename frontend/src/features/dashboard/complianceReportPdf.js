import {
  donationStatusLabels,
  donationTypeLabels,
  donationValue,
  expenseStatusLabels,
  formatBreakdown,
  formatDate,
  formatMoney,
  formatNumber,
  outputStatusLabels,
} from './reportFormatting.js'

const BRAND_PURPLE = '#5b3a8e'
const MUTED_INK = '#6b6470'

function headerBlock(projectName, generatedAt) {
  return (currentPage, pageCount) => ({
    margin: [40, 20, 40, 0],
    stack: [
      {
        columns: [
          { text: projectName, style: 'headerTitle' },
          { text: `Página ${currentPage} de ${pageCount}`, style: 'headerMeta', alignment: 'right' },
        ],
      },
      {
        columns: [
          { text: 'Informe de cumplimiento', style: 'headerSubtitle' },
          { text: `Generado el ${formatDate(generatedAt)}`, style: 'headerMeta', alignment: 'right' },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 1, lineColor: BRAND_PURPLE }] },
    ],
  })
}

function donationsTable(linkedDonations) {
  if (!linkedDonations.length) return { text: 'Todavía faltan donaciones asociadas a este proyecto.', style: 'empty' }
  return {
    table: {
      headerRows: 1,
      widths: ['auto', 'auto', '*', 'auto', 'auto'],
      body: [
        ['Fecha', 'Referencia', 'Aliado o donante', 'Tipo y estado', 'Valor recibido'].map((text) => ({ text, style: 'tableHeader' })),
        ...linkedDonations.map((donation) => {
          const value = donationValue(donation)
          return [
            formatDate(donation.received_at || donation.created_at),
            donation.reference_code || '—',
            donation.donor_name,
            `${donationTypeLabels[donation.donation_type] ?? donation.donation_type} · ${donationStatusLabels[donation.status] ?? donation.status}`,
            [value.primary, value.secondary].filter(Boolean).join('\n'),
          ]
        }),
      ],
    },
    layout: 'lightHorizontalLines',
  }
}

function outputsTable(outputs) {
  if (!outputs.length) return { text: 'Todavía faltan avances y entregas por registrar.', style: 'empty' }
  return {
    table: {
      headerRows: 1,
      widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
      body: [
        ['Actividad / producto', 'Meta', 'Armado', 'Entregado', 'Cumplimiento %', 'Beneficiarios'].map((text) => ({ text, style: 'tableHeader' })),
        ...outputs.map((output) => [
          `${output.name}\n${output.unit?.abbreviation || output.unit_label || ''} · ${outputStatusLabels[output.status] ?? output.status}`,
          formatNumber(output.target_quantity),
          formatNumber(output.produced_quantity),
          formatNumber(output.delivered_quantity),
          `${Math.min(999, Math.round((Number(output.delivered_quantity || 0) / (Number(output.target_quantity) || 1)) * 100))}%`,
          formatNumber(output.beneficiary_count),
        ]),
      ],
    },
    layout: 'lightHorizontalLines',
  }
}

function expensesTable(expenses) {
  if (!expenses.length) return { text: 'Todavía faltan inversiones o gastos por registrar.', style: 'empty' }
  return {
    table: {
      headerRows: 1,
      widths: ['auto', '*', 'auto', 'auto', 'auto'],
      body: [
        ['Fecha', 'Proveedor / concepto', 'Factura', 'Estado', 'Monto'].map((text) => ({ text, style: 'tableHeader' })),
        ...expenses.map((expense) => [
          expense.expense_date,
          `${expense.supplier_name}\n${expense.category} · ${expense.description}`,
          expense.invoice_number || '—',
          expenseStatusLabels[expense.status] ?? expense.status,
          formatMoney(expense.amount, expense.currency),
        ]),
      ],
    },
    layout: 'lightHorizontalLines',
  }
}

export function buildComplianceReportDocDefinition({ project, generatedAt, metrics, funding, outputs = [], expenses = [] }) {
  if (!project) throw new Error('A project is required to build the compliance report PDF.')

  const currency = project.currency
  const linkedDonations = Array.isArray(funding?.linkedDonations) ? funding.linkedDonations : []

  return {
    pageSize: 'A4',
    pageMargins: [40, 90, 40, 40],
    header: headerBlock(project.name, generatedAt ?? new Date()),
    content: [
      { text: `${project.code} · ${project.funding_partner || ''}`, style: 'projectMeta' },
      {
        columns: [
          { text: `Objetivo: ${project.objective || '—'}`, style: 'projectDataItem' },
          { text: `Resultados esperados: ${project.expected_results || 'Pendiente de definir'}`, style: 'projectDataItem' },
        ],
      },
      { text: `Exigencias de reporte: ${project.reporting_requirements || 'Según convenio del proyecto'}`, style: 'projectDataItem', margin: [0, 0, 0, 12] },

      { text: 'Cotejo financiero — otorgado, recibido y ejecutado', style: 'sectionHeading' },
      {
        columns: [
          { text: `Aprobado u otorgado\n${formatMoney(project.approved_budget, currency)}`, style: 'metric' },
          { text: `Recibido\n${formatMoney(funding?.receivedProjectCurrency, currency)}`, style: 'metric' },
          { text: `Ejecutado\n${formatMoney(funding?.executedAmount ?? metrics?.investment, currency)}`, style: 'metric' },
          { text: `Saldo\n${formatMoney(funding?.availableBalance, currency)}`, style: 'metric' },
        ],
        margin: [0, 6, 0, 6],
      },
      funding?.receivedByCurrency ? { text: formatBreakdown(funding.receivedByCurrency), style: 'empty', margin: [0, 0, 0, 6] } : null,
      donationsTable(linkedDonations),

      { text: 'Ejecución física — metas y avances', style: 'sectionHeading', margin: [0, 16, 0, 6] },
      outputsTable(outputs),

      { text: 'Ejecución financiera — inversión y comprobantes', style: 'sectionHeading', margin: [0, 16, 0, 6] },
      expensesTable(expenses),

      { text: `Cumplimiento físico promedio: ${metrics?.averageCompliance ?? 0}%  ·  Cumplimiento presupuestal: ${metrics?.budgetCompliance ?? 0}%  ·  Personas beneficiadas: ${formatNumber(metrics?.beneficiaries)}`, style: 'summaryLine', margin: [0, 16, 0, 0] },
    ].filter(Boolean),
    styles: {
      headerTitle: { fontSize: 13, bold: true, color: BRAND_PURPLE },
      headerSubtitle: { fontSize: 8, color: MUTED_INK },
      headerMeta: { fontSize: 8, color: MUTED_INK },
      projectMeta: { fontSize: 9, color: MUTED_INK, margin: [0, 0, 0, 8] },
      projectDataItem: { fontSize: 9, margin: [0, 0, 0, 4] },
      sectionHeading: { fontSize: 11, bold: true, color: BRAND_PURPLE },
      tableHeader: { bold: true, fontSize: 8, color: MUTED_INK },
      metric: { fontSize: 9 },
      empty: { fontSize: 8, italics: true, color: MUTED_INK },
      summaryLine: { fontSize: 9, bold: true },
    },
    defaultStyle: { fontSize: 9 },
  }
}
