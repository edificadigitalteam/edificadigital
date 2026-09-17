import { chartCopy } from '../chartCopy.js'
import { formatDate } from '../indicatorFormat.js'

const checkPath = 'M5 12.5 9.5 17 19 7'
const pendingPath = 'M12 7v6m0 4h.01'

// Status is never carried by color alone: the icon and the word come with it.
export default function StatusPill({ series, language }) {
  const t = chartCopy[language] || chartCopy.es
  const point = series.points[series.points.length - 1]
  if (!point) return null
  const achieved = Number(point.value) === 1

  return (
    <div className={`indicator-chart-status ${achieved ? 'achieved' : 'pending'}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={achieved ? checkPath : pendingPath} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <strong>{achieved ? t.achieved : t.notAchieved}</strong>
      <span>{formatDate(point.date, language)}</span>
    </div>
  )
}
