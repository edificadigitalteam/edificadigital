import { chartCopy } from './chartCopy.js'
import { allowedOverrides, automaticChart } from './recommendedChart.js'

// The override lives here, in the detail drawer, and never in the create form:
// choosing a chart type is a technical question the indicator's own data
// already answers. Only the forms this indicator's data supports are offered,
// and an indicator with no results yet offers nothing at all.
export default function ChartFormSelector({ indicator, rows, language, onChange, saving = false }) {
  const t = chartCopy[language] || chartCopy.es
  const options = allowedOverrides(indicator, rows)
  if (!options.length) return null

  const automatic = automaticChart(indicator, rows)
  const value = options.includes(indicator.preferred_chart) ? indicator.preferred_chart : ''

  return (
    <label className="indicator-chart-form-selector">
      <span>{t.displayAs}</span>
      <select
        value={value}
        disabled={saving}
        title={t.displayAsHelp}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{t.automatic(t.formNames[automatic.form] || '')}</option>
        {options.map((form) => <option key={form} value={form}>{t.formNames[form]}</option>)}
      </select>
      <small>{t.displayAsHelp}</small>
    </label>
  )
}
