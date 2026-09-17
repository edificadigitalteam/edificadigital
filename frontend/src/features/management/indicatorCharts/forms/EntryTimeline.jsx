import { chartCopy } from '../chartCopy.js'
import { formatDate, metricDisplay } from '../indicatorFormat.js'

// A text indicator has no magnitude to plot. It gets its entries in order.
export default function EntryTimeline({ indicator, series, language }) {
  const t = chartCopy[language] || chartCopy.es
  const points = [...series.points].reverse()
  if (!points.length) return null

  return (
    <ol className="indicator-chart-timeline">
      {points.map((point) => (
        <li key={point.id}>
          <span>{formatDate(point.date, language)}</span>
          <p>{point.text || metricDisplay(point.value, indicator, language)}</p>
          {point.responsible && <small>{t.responsible}: {point.responsible}</small>}
        </li>
      ))}
    </ol>
  )
}
