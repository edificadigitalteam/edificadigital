import { chartCopy } from './chartCopy.js'
import { formatDate, metricDisplay } from './indicatorFormat.js'

// Every chart ships its own data table. It is the screen-reader path, the
// relief for the one palette slot below 3:1 against the surface, and the
// honest answer for anyone who reads numbers faster than shapes.
export default function ChartDataTable({ indicator, series, language, showCumulative = false }) {
  const t = chartCopy[language] || chartCopy.es
  if (!series.points.length) return null
  const statusLabel = { draft: t.draft, submitted: t.submitted, verified: t.verified }

  return (
    <details className="indicator-chart-data">
      <summary title={t.viewData}>{t.viewData}</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">{t.period}</th>
            <th scope="col">{t.value}</th>
            {showCumulative && <th scope="col">{t.cumulative}</th>}
            <th scope="col">{t.statusColumn}</th>
            <th scope="col">{t.responsible}</th>
          </tr>
        </thead>
        <tbody>
          {series.points.map((point) => (
            <tr key={point.id}>
              <th scope="row">{formatDate(point.date, language)}</th>
              <td>{point.text || metricDisplay(point.value, indicator, language)}</td>
              {showCumulative && <td>{metricDisplay(point.cumulative, indicator, language)}</td>}
              <td>{statusLabel[point.status] || point.status}</td>
              <td>{point.responsible || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
