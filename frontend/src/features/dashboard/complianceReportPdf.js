import {
  buildReportTableOfContents,
  donationStatusLabels,
  donationTypeLabels,
  donationValue,
  expenseStatusLabels,
  formatBreakdown,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  outputStatusLabels,
} from './reportFormatting.js'

const BRAND_PURPLE = '#5b3a8e'
const BRAND_PURPLE_DARK = '#351653'
const BRAND_ORANGE = '#e08a2c'
const BRAND_YELLOW = '#ffd166'
const BRAND_VIOLET = '#8d62bc'
const MUTED_INK = '#6b6470'
const LINE_COLOR = '#e4dce9'
const PAPER_TINT = '#faf7fd'
const GAUGE_TRACK = '#eee8f3'
const CARD_BORDER_LAYOUT = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => LINE_COLOR,
  vLineColor: () => LINE_COLOR,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
}

const EDIFICA_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <g transform="skewY(-8)">
    <rect x="4" y="17" width="7" height="9" rx="1.4" fill="${BRAND_YELLOW}"/>
    <rect x="13" y="12" width="7" height="14" rx="1.4" fill="${BRAND_ORANGE}"/>
    <rect x="22" y="6" width="7" height="20" rx="1.4" fill="${BRAND_PURPLE}"/>
  </g>
</svg>`

function brandBar(organizationName) {
  return {
    columns: [
      {
        width: 'auto',
        columns: [
          { width: 12, svg: EDIFICA_MARK_SVG },
          { width: 'auto', text: 'Edifica Digital', style: 'brandName', margin: [4, 1, 0, 0] },
        ],
      },
      { width: '*', text: organizationName || '', style: 'brandOrg', alignment: 'right' },
    ],
  }
}

function headerBlock(projectName, generatedAt, organizationName) {
  return (currentPage, pageCount) => {
    if (currentPage === 1) {
      return { margin: [40, 18, 40, 0], stack: [brandBar(organizationName)] }
    }
    return {
      margin: [40, 14, 40, 0],
      stack: [
        brandBar(organizationName),
        {
          columns: [
            { text: projectName, style: 'headerTitle' },
            { text: `Página ${currentPage} de ${pageCount}`, style: 'headerMeta', alignment: 'right' },
          ],
          margin: [0, 6, 0, 0],
        },
        {
          columns: [
            { text: 'Informe de cumplimiento', style: 'headerSubtitle' },
            { text: `Generado el ${formatDateTime(generatedAt)}`, style: 'headerMeta', alignment: 'right' },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 1, lineColor: BRAND_PURPLE }] },
      ],
    }
  }
}

function buildGaugeSvg(percent) {
  const safe = Math.min(Math.max(Math.round(percent || 0), 0), 100)
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const dash = (safe / 100) * circumference
  return `<svg width="150" height="150" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${GAUGE_TRACK}" stroke-width="14" />
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${BRAND_PURPLE}" stroke-width="14"
      stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}" stroke-linecap="round"
      transform="rotate(-90 60 60)" />
    <text x="60" y="57" font-size="22" font-family="Helvetica" font-weight="bold" fill="${BRAND_PURPLE_DARK}" text-anchor="middle">${safe}%</text>
    <text x="60" y="74" font-size="7.5" font-family="Helvetica" fill="${MUTED_INK}" text-anchor="middle">cumplimiento</text>
  </svg>`
}

function metricCard(label, value, accent, width = 160) {
  return {
    width,
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { canvas: [{ type: 'rect', x: 0, y: 0, w: width, h: 3, color: accent }] },
          { text: label, style: 'coverMetricLabel', margin: [10, 8, 10, 2] },
          { text: value, style: 'coverMetricValue', margin: [10, 0, 10, 10] },
        ],
      }]],
    },
    layout: CARD_BORDER_LAYOUT,
  }
}

function footerBlock() {
  return (currentPage) => {
    if (currentPage === 1) return null
    return {
      margin: [40, 8, 40, 0],
      text: 'Volver al índice',
      linkToDestination: 'report-cover',
      style: 'backLink',
      alignment: 'right',
    }
  }
}

function buildCover({ project, metrics, funding, tableOfContents }) {
  const currency = project.currency
  return [
    {
      stack: [
        { id: 'report-cover', text: 'INFORME DE CUMPLIMIENTO', style: 'coverKicker' },
        { text: project.name, style: 'coverTitle' },
        { text: `${project.code} · ${project.funding_partner || ''}`, style: 'coverMeta' },
      ],
      alignment: 'center',
      margin: [0, 10, 0, 20],
    },
    {
      columns: [
        { width: '*', text: '' },
        { width: 150, svg: buildGaugeSvg(metrics?.averageCompliance) },
        { width: '*', text: '' },
      ],
      margin: [0, 0, 0, 16],
    },
    {
      columns: [
        { width: '*', text: '' },
        metricCard('APROBADO U OTORGADO', formatMoney(project.approved_budget, currency), BRAND_PURPLE),
        { width: 10, text: '' },
        metricCard('RECIBIDO', formatMoney(funding?.receivedProjectCurrency, currency), BRAND_ORANGE),
        { width: '*', text: '' },
      ],
      margin: [0, 0, 0, 8],
    },
    {
      columns: [
        { width: '*', text: '' },
        metricCard('EJECUTADO', formatMoney(funding?.executedAmount ?? metrics?.investment, currency), BRAND_YELLOW),
        { width: 10, text: '' },
        metricCard('PERSONAS BENEFICIADAS', formatNumber(metrics?.beneficiaries), BRAND_VIOLET),
        { width: '*', text: '' },
      ],
      margin: [0, 0, 0, 20],
    },
    { text: project.objective || '', style: 'coverObjective', margin: [40, 0, 40, 24] },
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 340,
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { text: 'ÍNDICE', style: 'coverIndexHeading' },
                {
                  ol: tableOfContents.map((entry) => ({ text: entry.label, linkToDestination: entry.id })),
                  style: 'coverIndexList',
                },
              ],
              margin: [16, 12, 16, 12],
            }]],
          },
          layout: {
            hLineWidth: () => 1.2,
            vLineWidth: () => 1.2,
            hLineColor: () => BRAND_PURPLE,
            vLineColor: () => BRAND_PURPLE,
            fillColor: () => PAPER_TINT,
          },
        },
        { width: '*', text: '' },
      ],
    },
    { text: '', pageBreak: 'after' },
  ]
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

function evidenceSummary(outputs, evidenceByOutput) {
  const rows = outputs
    .map((output) => [output.name, (evidenceByOutput.get(output.id) ?? []).length])
    .filter(([, count]) => count > 0)
  if (!rows.length) return null
  return {
    table: {
      headerRows: 1,
      widths: ['*', 'auto'],
      body: [
        ['Actividad / producto', 'Evidencias'].map((text) => ({ text, style: 'tableHeader' })),
        ...rows.map(([name, count]) => [name, String(count)]),
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

export function buildComplianceReportDocDefinition({ project, generatedAt, metrics, funding, outputs = [], expenses = [], evidenceByOutput = new Map(), hasEvidence = false, organizationName = '' }) {
  if (!project) throw new Error('A project is required to build the compliance report PDF.')

  const currency = project.currency
  const linkedDonations = Array.isArray(funding?.linkedDonations) ? funding.linkedDonations : []
  const evidenceRows = evidenceSummary(outputs, evidenceByOutput)
  const tableOfContents = buildReportTableOfContents({ hasEvidence: hasEvidence || Boolean(evidenceRows) })

  return {
    pageSize: 'A4',
    pageMargins: [40, 105, 40, 40],
    header: headerBlock(project.name, generatedAt ?? new Date(), organizationName),
    footer: footerBlock(),
    content: [
      ...buildCover({ project, metrics, funding, tableOfContents }),

      { text: `${project.code} · ${project.funding_partner || ''}`, style: 'projectMeta' },
      {
        columns: [
          { text: `Objetivo: ${project.objective || '—'}`, style: 'projectDataItem' },
          { text: `Resultados esperados: ${project.expected_results || 'Pendiente de definir'}`, style: 'projectDataItem' },
        ],
      },
      { text: `Exigencias de reporte: ${project.reporting_requirements || 'Según convenio del proyecto'}`, style: 'projectDataItem', margin: [0, 0, 0, 12] },

      { id: 'section-financial', text: 'Cotejo financiero — otorgado, recibido y ejecutado', style: 'sectionHeading' },
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

      { id: 'section-physical', text: 'Ejecución física — metas y avances', style: 'sectionHeading', margin: [0, 16, 0, 6] },
      outputsTable(outputs),

      evidenceRows ? { id: 'section-evidence', text: 'Soportes multimedia — evidencias de ejecución', style: 'sectionHeading', margin: [0, 16, 0, 6] } : null,
      evidenceRows,

      { id: 'section-expenses', text: 'Ejecución financiera — inversión y comprobantes', style: 'sectionHeading', margin: [0, 16, 0, 6] },
      expensesTable(expenses),

      { text: `Cumplimiento físico promedio: ${metrics?.averageCompliance ?? 0}%  ·  Cumplimiento presupuestal: ${metrics?.budgetCompliance ?? 0}%  ·  Personas beneficiadas: ${formatNumber(metrics?.beneficiaries)}`, style: 'summaryLine', margin: [0, 16, 0, 0] },
    ].filter(Boolean),
    styles: {
      coverKicker: { fontSize: 10, bold: true, color: '#e08a2c', characterSpacing: 1 },
      coverTitle: { fontSize: 24, bold: true, color: BRAND_PURPLE_DARK, margin: [0, 6, 0, 4] },
      coverMeta: { fontSize: 10, color: MUTED_INK },
      coverMetricLabel: { fontSize: 7.5, bold: true, color: MUTED_INK, alignment: 'center' },
      coverMetricValue: { fontSize: 12, bold: true, color: BRAND_PURPLE_DARK, alignment: 'center' },
      coverObjective: { fontSize: 9.5, italics: true, color: MUTED_INK, alignment: 'center' },
      coverIndexHeading: { fontSize: 9, bold: true, color: BRAND_PURPLE, characterSpacing: 1, margin: [0, 0, 0, 6] },
      coverIndexList: { fontSize: 11, color: BRAND_PURPLE_DARK },
      brandName: { fontSize: 10, bold: true, color: BRAND_PURPLE_DARK },
      brandOrg: { fontSize: 9, color: MUTED_INK },
      headerTitle: { fontSize: 13, bold: true, color: BRAND_PURPLE },
      headerSubtitle: { fontSize: 8, color: MUTED_INK },
      headerMeta: { fontSize: 8, color: MUTED_INK },
      projectMeta: { fontSize: 9, color: MUTED_INK, margin: [0, 0, 0, 8] },
      projectDataItem: { fontSize: 9, margin: [0, 0, 0, 4] },
      sectionHeading: { fontSize: 11, bold: true, color: BRAND_PURPLE },
      backLink: { fontSize: 8, bold: true, color: BRAND_PURPLE, margin: [0, 2, 0, 6] },
      tableHeader: { bold: true, fontSize: 8, color: MUTED_INK },
      metric: { fontSize: 9 },
      empty: { fontSize: 8, italics: true, color: MUTED_INK },
      summaryLine: { fontSize: 9, bold: true },
    },
    defaultStyle: { fontSize: 9 },
  }
}
