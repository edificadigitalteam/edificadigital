// Chart tokens for the indicator visualizations.
//
// These are literal hex values rather than CSS custom properties on purpose:
// the same components are rendered to a static SVG string for the pdfmake
// exports, and pdfmake does not resolve `var()`.
//
// The categorical slots are a validated palette, not the raw brand tokens.
// The brand trio (--purple #5b2e91, --orange #f28c28, --yellow #ffd166) fails
// the checks for chart use: purple and yellow fall outside the OKLab
// lightness band (0.414 and 0.880 against 0.43–0.77) and yellow sits at 1.4:1
// contrast on the paper surface. The slots below keep the same hue families
// and pass the lightness, chroma, CVD-separation and normal-vision checks.
// See docs/plans/SPRINT-S5-v1_indicator-visualization-system.md.

export const CHART_SURFACE = '#ffffff'

export const chartTheme = {
  categorical: ['#8257c5', '#e07b1f', '#2f9e8f'],
  otherSeries: '#6d6672',
  reference: '#756d79',
  ink: '#211927',
  mutedInk: '#5f5866',
  grid: '#e7e1ec',
  track: '#eee8f3',
  surface: CHART_SURFACE,
  markWidth: 2,
  markRadius: 4,
  pointRadius: 4,
  spacer: 2,
}

// Color follows the entity, never its rank, and hues are never generated:
// a fourth series folds into the neutral "other" slot instead.
export function seriesColor(index) {
  return chartTheme.categorical[index] ?? chartTheme.otherSeries
}
