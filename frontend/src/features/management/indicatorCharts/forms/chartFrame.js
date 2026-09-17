export const CHART_HEIGHT = 224
export const CHART_MARGIN = { top: 16, right: 18, bottom: 30, left: 54 }

export function innerSize(width) {
  return {
    innerWidth: Math.max(width - CHART_MARGIN.left - CHART_MARGIN.right, 10),
    innerHeight: Math.max(CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom, 10),
  }
}

// One axis, always. A second measure gets its own chart, never a second scale.
export function valueDomain(values) {
  const numbers = values.filter((value) => Number.isFinite(value))
  if (!numbers.length) return [0, 1]
  const max = Math.max(...numbers, 0)
  const min = Math.min(...numbers, 0)
  return [min, max === min ? max + 1 : max]
}

export function axisTickCount(width) {
  if (width < 260) return 2
  if (width < 420) return 4
  return 6
}

// Labels are thinned out rather than shrunk: an axis drops ticks before its
// text becomes unreadable at 320px.
export function spacedTickValues(values, innerWidth, labelWidth = 58) {
  const capacity = Math.max(Math.floor(innerWidth / labelWidth), 2)
  if (values.length <= capacity) return values
  const step = Math.ceil(values.length / capacity)
  return values.filter((_, index) => index % step === 0)
}
