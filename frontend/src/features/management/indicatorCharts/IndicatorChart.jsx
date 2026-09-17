import { Suspense, lazy } from 'react'

import ChartDataTable from './ChartDataTable.jsx'
import { buildSeries } from './chartSeries.js'
import { chartCopy } from './chartCopy.js'
import { resolveChart } from './recommendedChart.js'
import { metricDisplay } from './indicatorFormat.js'
import EmptyState from './forms/EmptyState.jsx'
import EntryTimeline from './forms/EntryTimeline.jsx'
import StatValue from './forms/StatValue.jsx'
import StatusPill from './forms/StatusPill.jsx'
import './indicator-charts.css'

// The charting library is reached only through this boundary, so it never
// lands in the public landing or donation bundles.
const TrendLine = lazy(() => import('./forms/TrendLine.jsx'))
const PeriodColumns = lazy(() => import('./forms/PeriodColumns.jsx'))

const headingKey = { trend: 'trend', columns: 'columns', timeline: 'timeline', stat: 'stat', status: 'status' }

export default function IndicatorChart({ indicator, rows, language = 'es' }) {
  const t = chartCopy[language] || chartCopy.es
  const series = buildSeries(indicator, rows)
  const chart = resolveChart(indicator, rows)
  const form = chart.detailForm

  const lastPoint = series.points[series.points.length - 1]
  const summary = t.summary(
    indicator.name,
    lastPoint ? (lastPoint.text || metricDisplay(lastPoint.value, indicator, language)) : '—',
    series.target == null ? null : metricDisplay(series.target, indicator, language),
  )

  const plot = {
    trend: <Suspense fallback={<p className="indicator-chart-loading">…</p>}><TrendLine indicator={indicator} series={series} language={language} options={chart.options} /></Suspense>,
    columns: <Suspense fallback={<p className="indicator-chart-loading">…</p>}><PeriodColumns indicator={indicator} series={series} language={language} options={chart.options} /></Suspense>,
    timeline: <EntryTimeline indicator={indicator} series={series} language={language} />,
    stat: <StatValue indicator={indicator} series={series} language={language} />,
    status: <StatusPill series={series} language={language} />,
    empty: <EmptyState language={language} />,
  }[form] || <EmptyState language={language} />

  return (
    <section className="indicator-chart" aria-label={summary}>
      <div className="indicator-chart-heading">
        <strong>{t[headingKey[form]] || t.heading}</strong>
      </div>

      <div className="indicator-chart-body" role="img" aria-label={summary}>{plot}</div>

      {chart.rule === 'latest-value' && form === 'columns' && <p className="indicator-chart-note">{t.tooFewForTrend}</p>}
      {series.excludedDrafts > 0 && <p className="indicator-chart-note">{t.drafts(series.excludedDrafts)}</p>}

      <ChartDataTable indicator={indicator} series={series} language={language} showCumulative={Boolean(chart.options.cumulativeLine)} />
    </section>
  )
}
