import { Suspense, lazy } from 'react'

import ChartDataTable from './ChartDataTable.jsx'
import ChartFormSelector from './ChartFormSelector.jsx'
import { buildSeries } from './chartSeries.js'
import { chartCopy } from './chartCopy.js'
import { cardForm, resolveChart } from './recommendedChart.js'
import { metricDisplay } from './indicatorFormat.js'
import EmptyState from './forms/EmptyState.jsx'
import EntryTimeline from './forms/EntryTimeline.jsx'
import Gauge from './forms/Gauge.jsx'
import ProgressMeter from './forms/ProgressMeter.jsx'
import Sparkline from './forms/Sparkline.jsx'
import StatValue from './forms/StatValue.jsx'
import StatusPill from './forms/StatusPill.jsx'
import './indicator-charts.css'

// The charting library is reached only through this boundary, so it never
// lands in the public landing or donation bundles.
const TrendLine = lazy(() => import('./forms/TrendLine.jsx'))
const PeriodColumns = lazy(() => import('./forms/PeriodColumns.jsx'))

function cardMark({ chart, indicator, series, language, completion }) {
  return {
    gauge: <Gauge completion={completion} language={language} />,
    progress: <ProgressMeter completion={completion} language={language} />,
    sparkline: <Sparkline indicator={indicator} series={series} language={language} />,
    status: <StatusPill series={series} language={language} />,
  }[cardForm(chart.form)] || null
}

const headingKey = { trend: 'trend', columns: 'columns', timeline: 'timeline', stat: 'stat', status: 'status' }

// `variant="card"` is the compact meter beside the numbers the card already
// prints; `variant="detail"` is the full history chart in the drawer.
export default function IndicatorChart({ indicator, rows, language = 'es', variant = 'detail', completion = 0, onPreferredChartChange, savingPreferredChart = false }) {
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

  if (variant === 'card') {
    const mark = cardMark({ chart, indicator, series, language, completion })
    return mark ? <div className="indicator-chart-card">{mark}</div> : null
  }

  const boardMark = onPreferredChartChange ? cardMark({ chart, indicator, series, language, completion }) : null

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

      {onPreferredChartChange && (
        <>
          <ChartFormSelector indicator={indicator} rows={rows} language={language} saving={savingPreferredChart} onChange={onPreferredChartChange} />
          {boardMark && (
            <div className="indicator-chart-preview">
              <span>{t.boardPreview}</span>
              <div className="indicator-chart-card">{boardMark}</div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
