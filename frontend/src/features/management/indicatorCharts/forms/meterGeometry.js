// Geometry for the card meters.
//
// Kept apart from the components so the arithmetic is testable and so the
// same numbers can drive the pdfmake export later, exactly as
// complianceReportPdf.js already draws its gauge.

export const GAUGE_RADIUS = 46
export const GAUGE_SIZE = 120
export const GAUGE_STROKE = 13

// The drawing is clamped; the figure printed beside it is not, so an
// indicator that passed its target still reports the true percentage.
export function clampCompletion(completion) {
  const value = Number(completion)
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 100)
}

export function gaugeArc(completion, radius = GAUGE_RADIUS) {
  const circumference = 2 * Math.PI * radius
  return { circumference, dash: (clampCompletion(completion) / 100) * circumference }
}

export function meterSegments(completion) {
  const value = Number(completion)
  return {
    achieved: clampCompletion(completion),
    exceeded: Number.isFinite(value) && value > 100,
  }
}
