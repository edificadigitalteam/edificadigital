import { chartCopy } from '../chartCopy.js'

export default function EmptyState({ language }) {
  const t = chartCopy[language] || chartCopy.es
  return <p className="indicator-chart-empty">{t.empty}</p>
}
