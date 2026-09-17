import { chartCopy } from '../chartCopy.js'
import { formatNumber } from '../indicatorFormat.js'
import { meterSegments } from './meterGeometry.js'

// The same measure the card printed as a bar before, with the target overrun
// stated in words instead of a bar that silently stops at 100%.
export default function ProgressMeter({ completion, language }) {
  const t = chartCopy[language] || chartCopy.es
  const { achieved, exceeded } = meterSegments(completion)

  return (
    <div className={`indicator-chart-meter${exceeded ? ' exceeded' : ''}`}>
      <div className="indicator-chart-meter-track" aria-hidden="true">
        <span style={{ width: `${achieved}%` }} />
      </div>
      <p>
        <b>{t.execution}: {formatNumber(completion, language)}%</b>
        {exceeded && <span>{t.targetPassed}</span>}
      </p>
    </div>
  )
}
