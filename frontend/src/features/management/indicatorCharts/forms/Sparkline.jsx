import { chartTheme } from '../chartTheme.js'
import { chartCopy } from '../chartCopy.js'
import { formatDate, metricDisplay } from '../indicatorFormat.js'

const WIDTH = 132
const HEIGHT = 40
const PADDING = 4

// Plain SVG on purpose: a card grid can hold many indicators, and a sparkline
// is one polyline. The charting library stays in the detail drawer.
export default function Sparkline({ indicator, series, language }) {
  const t = chartCopy[language] || chartCopy.es
  const points = series.points.filter((point) => point.value != null)
  if (points.length < 2) return null

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max === min ? 1 : max - min
  const step = (WIDTH - PADDING * 2) / (points.length - 1)
  const coordinates = points.map((point, index) => [
    PADDING + index * step,
    HEIGHT - PADDING - ((point.value - min) / span) * (HEIGHT - PADDING * 2),
  ])
  const last = coordinates[coordinates.length - 1]
  const first = points[0]
  const latest = points[points.length - 1]

  const label = `${t.trend}: ${metricDisplay(first.value, indicator, language)} (${formatDate(first.date, language)}) → ${metricDisplay(latest.value, indicator, language)} (${formatDate(latest.date, language)}).`

  return (
    <svg className="indicator-chart-sparkline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} focusable="false">
      <polyline
        points={coordinates.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={chartTheme.categorical[0]}
        strokeWidth={chartTheme.markWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={chartTheme.categorical[0]} stroke={chartTheme.surface} strokeWidth={chartTheme.spacer} />
    </svg>
  )
}
