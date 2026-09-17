import { chartCopy } from '../chartCopy.js'
import { formatDate, metricDisplay } from '../indicatorFormat.js'

// One result is a number, never a trend line.
export default function StatValue({ indicator, series, language }) {
  const t = chartCopy[language] || chartCopy.es
  const point = series.points[series.points.length - 1]
  if (!point) return null
  return (
    <div className="indicator-chart-stat">
      <strong>{point.text || metricDisplay(point.value, indicator, language)}</strong>
      <span>{t.lastValue} · {formatDate(point.date, language)}</span>
      {series.target != null && <span>{t.target}: {metricDisplay(series.target, indicator, language)}</span>}
    </div>
  )
}
