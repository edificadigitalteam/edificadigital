import { chartCopy } from '../chartCopy.js'
import { chartTheme } from '../chartTheme.js'
import { formatNumber } from '../indicatorFormat.js'
import { GAUGE_RADIUS, GAUGE_SIZE, GAUGE_STROKE, gaugeArc } from './meterGeometry.js'

// The ring is aria-hidden: the same percentage is printed beside it as text,
// so a screen reader announces it once, not twice.
export default function Gauge({ completion, language }) {
  const t = chartCopy[language] || chartCopy.es
  const { circumference, dash } = gaugeArc(completion)
  const center = GAUGE_SIZE / 2

  return (
    <div className="indicator-chart-gauge">
      <svg viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`} aria-hidden="true" focusable="false">
        <circle cx={center} cy={center} r={GAUGE_RADIUS} fill="none" stroke={chartTheme.track} strokeWidth={GAUGE_STROKE} />
        <circle
          cx={center}
          cy={center}
          r={GAUGE_RADIUS}
          fill="none"
          stroke={chartTheme.categorical[0]}
          strokeWidth={GAUGE_STROKE}
          strokeDasharray={`${dash.toFixed(2)} ${circumference.toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <p>
        <strong>{formatNumber(completion, language)}%</strong>
        <span>{t.execution}</span>
      </p>
    </div>
  )
}
