# Sprint S5 — Indicator Visualization System

**Branch:** `claude/magical-newton-awoytv`

**Status:** ✍️ In Progress — step 1 of the delivery order below is
implemented (the detail-drawer history charts). The remaining steps
(card meters, the stored override, the PDF path) are pending.

## Requested outcome

The Tracking module (`Seguimiento` → *Indicadores y resultados*) shows more
than one visual form per indicator. Each indicator is rendered with the
visualization that matches the data it actually holds, chosen automatically
from fields the indicator already declares, with an optional manual override
stored per indicator. The same visual model feeds the card, the detail
drawer, the management reports, and the PDF export.

## Context

### What exists today

- `frontend/src/features/management/ManagementTrackingPage.jsx:318` renders
  the only chart in the module: a CSS progress bar
  (`.indicator-progress`), and only when `target_value > 0`. An indicator
  with no target gets no visual at all.
- `aggregateIndicator()`
  (`frontend/src/features/management/ManagementTrackingPage.jsx:63`) already
  computes the consolidated value and the completion percentage per
  aggregation method. The chart layer consumes this function; it is not
  reimplemented.
- `public.management_indicator`
  (`supabase/migrations/20260815194500_organizational_management_foundation.sql:122`)
  declares `metric_type`, `aggregation_method`, `frequency`,
  `target_value`, `target_text`, `unit_label`, and `currency`. Every input
  the form heuristic needs is already stored.
- `public.indicator_progress`
  (same migration, line 151) holds the time series:
  `reporting_period_start`, `reporting_period_end`, `numeric_value`,
  `text_value`, `status` (`draft` rows are excluded from aggregates).
- `frontend/src/features/dashboard/complianceReportPdf.js:86`
  (`buildGaugeSvg`) already draws a radial gauge as an SVG string embedded
  in a pdfmake `svg` node. The PDF path for charts exists and works.
- No charting library is installed. `frontend/package.json` dependencies
  are `@supabase/supabase-js`, `@vercel/analytics`, `pdfmake`, `react`,
  `react-dom`.
- The application has no dark mode (`prefers-color-scheme` appears nowhere
  in `frontend/src`). `prefers-reduced-motion` is honored in
  `management.css` and five other stylesheets, so chart animation must
  respect it.

### Scope plane

This is not a new module: it extends the existing tenant-plane Tracking
module (`admin` + `operator`, one organization). No new nav entry, no new
route, no host-plane surface. The three "New module scope questions" in
`AGENTS.md` therefore do not gate this work; the existing
organization-scoped RLS on `management_indicator` and `indicator_progress`
already governs every row a chart can read.

## Decisions

### D1 — Library: visx

**Chosen:** visx 4.0.0 (`@visx/*`, MIT, Airbnb), used as low-level
primitives behind repository-owned components.

Packages, all pinned at `4.0.0` (verified against the npm registry; peer
range `react@^18.0.0 || ^19.0.0`, so React 19.2 is supported):

| Package | Used for |
|---|---|
| `@visx/scale` | linear/band/time scales |
| `@visx/shape` | `Bar`, `LinePath`, `AreaClosed`, `Arc` |
| `@visx/axis` | bottom/left axes on the detail charts |
| `@visx/group` | transform grouping |
| `@visx/curve` | monotone curve for trend lines |
| `@visx/responsive` | `ParentSize` for fluid card widths |

Why visx over the alternatives:

1. **It emits plain SVG and owns no styling.** The design system stays in
   our CSS; nothing ships an opinionated default look that has to be
   overridden back to the brand.
2. **It renders without the DOM.** visx components are ordinary React
   elements, so `renderToStaticMarkup` produces an SVG string that
   `pdfmake` can embed exactly like `buildGaugeSvg` does today. One chart
   definition serves screen and PDF. Recharts and Chart.js both need
   measurement or a canvas and cannot do this.
3. **Tree-shakeable per package.** Only the primitives actually imported
   reach the bundle.
4. **Accessibility is ours to control** — we place `role`, `aria-label`,
   `<title>`, and the table fallback, instead of working around a
   library's generated markup.

The cost is accepted: visx ships no defaults, so axes, empty states,
tooltips, and legends are repository code. That code is written once, in
`indicatorCharts/`, and reused by every chart.

**Bundle policy.** The chart bundle is loaded with `React.lazy` +
`Suspense` from the Tracking and Reports pages only. Neither the public
landing (`/`) nor the donation flows may import `@visx/*`, directly or
transitively — this protects the load-time baseline that
`docs/adr/ADR-005-seo-and-ai-discoverability.md` depends on. A test asserts
the boundary (see T7).

### D2 — Automatic chart selection, never a chart picker at creation

The create form (`ManagementIndicatorFormPage.jsx`) gains **no** chart
field. The visualization is derived from the indicator itself by a pure
function:

```js
recommendedChart(indicator, rows) → { form, options }
```

Rationale: the form is written for people with varied digital literacy and
follows "one primary action per step". "What type of chart do you want?" is
a technical question the data already answers, and a wrong answer produces
a misleading chart. Everything the heuristic needs (`metric_type`,
`aggregation_method`, `frequency`, presence of `target_value`, number of
non-draft rows) is captured at creation.

### D3 — Optional stored override, after the fact

`public.management_indicator` gains a nullable `preferred_chart` column.
`null` means automatic. It is edited from the indicator **detail drawer**
under the heading *"Cómo se ve este indicador" / "How this indicator is
displayed"*, with the first option being *"Automático (recomendado)"*, and
it is never presented during creation.

The override is offered only among forms that are valid for that
indicator's data — a `text` indicator cannot be forced into a gauge, and a
single-result indicator cannot be forced into a trend line. Invalid stored
values fall back to the automatic form at render time rather than throwing.

## Form heuristic

`recommendedChart` resolves in this order. The first matching row wins.

| # | Condition | Form (`form` value) | Notes |
|---|---|---|---|
| 1 | `metric_type = 'text'` | `timeline` | No chart. Chronological list of entries. |
| 2 | fewer than 1 non-draft row | `empty` | "Aún sin resultados registrados." |
| 3 | exactly 1 non-draft row | `stat` | Hero number + target reference. A single point is never drawn as a trend. |
| 4 | `metric_type = 'boolean'` | `status` | Achieved / not achieved pill with icon and label, plus the entry timeline. |
| 5 | `metric_type = 'percentage'` and a target exists | `gauge` | Radial meter + sparkline of history. |
| 6 | `metric_type in ('count','currency')`, target exists, method `sum` | `progress` | Achieved-vs-target meter (today's bar) + per-period columns. |
| 7 | `aggregation_method in ('latest','non_aggregable')` | `trend` | Line, last value emphasized; target as a reference line when present. |
| 8 | `aggregation_method = 'average'` | `trend` + `referenceLine: 'average'` | Line with the average drawn as the baseline. |
| 9 | `aggregation_method = 'unique_people'` | `columns` + `cumulativeLine: true` | Columns per period plus an accumulated line. |
| 10 | `metric_type = 'ratio'` | `trend` + `referenceLine: 'target'` | |
| 11 | no target, numeric | `columns` | Columns per reporting period. |
| 12 | anything else | `stat` | Safe fallback; never throws. |

Rules that bind every form:

- **The number stays visible.** A chart never carries a value alone; the
  consolidated figure and the target keep their current position in the
  card (`ManagementTrackingPage.jsx:317`).
- **Three points minimum for a trend.** With 2 non-draft rows, rows 7, 8
  and 10 degrade to `columns`. Two points drawn as a line read as a trend
  that the data does not support.
- **Draft rows are excluded** from every chart, matching
  `aggregateIndicator`, and the count of excluded drafts is stated in words
  under the chart when it is greater than zero.
- **No dual axis, ever.** Row 9's cumulative line is indexed to the same
  scale as the columns; if it cannot be, it becomes a second chart.
- **Periods on the x axis come from `reporting_period_end`,** falling back
  to `created_at`, and are formatted through the existing
  `formatDate(value, language)` helper.

## Palette

Charts use a dedicated, validated categorical palette derived from the
brand hues, because the raw brand tokens fail the required checks: the
`--purple #5b2e91` / `--orange #f28c28` / `--yellow #ffd166` trio fails the
lightness band (0.414 and 0.880 against a 0.43–0.77 band) and yellow sits
at 1.4:1 contrast on the paper surface.

The shipped palette (validated with the dataviz skill's
`validate_palette.js`, light mode, 3 slots):

| Slot | Hex | Role |
|---|---|---|
| 1 | `#8257c5` | primary series (achieved / current) |
| 2 | `#e07b1f` | secondary series (target / reference) |
| 3 | `#2f9e8f` | third series (accumulated / comparison) |

```
[PASS] Lightness band       all 3 inside L 0.43–0.77
[PASS] Chroma floor         all 3 >= 0.1
[PASS] CVD separation       worst adjacent #2f9e8f↔#e07b1f ΔE 12.7 (protan) · tritan 22.6
[PASS] Normal-vision floor  worst adjacent #2f9e8f↔#e07b1f ΔE 23.5 (normal)
[WARN] Contrast vs surface  below 3:1: #e07b1f (2.91) — relief required
```

The contrast WARN is discharged by the relief the plan already requires:
every series is directly labeled and every chart ships a data table
(A4 below). It is not dismissed.

Additional rules:

- **Three series is the ceiling in this module.** A fourth series folds into
  "Otros" or becomes a second chart. Hues are never generated.
- **Sequential is the default for magnitude** (per-period columns): one
  hue, `#8257c5`, at varying lightness — not one color per period.
- **Status colors stay reserved** for achievement state (row 4 and the
  gauge threshold) and always ship with an icon plus a word, never color
  alone.
- **Color follows the entity, not its rank.** Filtering the period list
  must not repaint the surviving series.
- **Tokens are literal hex in a `chartTheme` object**, not CSS custom
  properties. `pdfmake`'s SVG support does not resolve `var()`, and the
  same component must render identically in both targets.
- Dark mode is out of scope — the application has none. When one arrives,
  the dark steps get re-validated against the dark surface rather than
  flipped automatically.

## Database change

One new migration:
`supabase/migrations/<timestamp>_indicator_preferred_chart.sql`

```sql
alter table public.management_indicator
  add column if not exists preferred_chart text;

alter table public.management_indicator
  add constraint management_indicator_preferred_chart_check
  check (preferred_chart is null or preferred_chart in
    ('progress','gauge','trend','columns','stat','timeline','status'));
```

- Nullable, no default: `null` = automatic. Existing rows are untouched and
  keep behaving exactly as today.
- No RLS change. The column lives on an already-protected table and is
  covered by its existing organization-scoped policies and grants.
- No new index. The column is never filtered or joined on.
- Additive and immutable, per the safe database procedure in `CLAUDE.md`.

## Files

**New**

| Path | Contents |
|---|---|
| `frontend/src/features/management/indicatorCharts/recommendedChart.js` | The pure heuristic + the override resolver |
| `frontend/src/features/management/indicatorCharts/recommendedChart.test.js` | Heuristic tests (`node --test`) |
| `frontend/src/features/management/indicatorCharts/chartTheme.js` | Validated palette, mark specs, spacing constants |
| `frontend/src/features/management/indicatorCharts/chartSeries.js` | `indicator_progress` rows → chart series (period bucketing, draft exclusion, cumulative) |
| `frontend/src/features/management/indicatorCharts/chartSeries.test.js` | Series-building tests |
| `frontend/src/features/management/indicatorCharts/IndicatorChart.jsx` | Single public entry point; switches on `form`, lazy-loads the visx forms |
| `frontend/src/features/management/indicatorCharts/forms/*.jsx` | `ProgressMeter`, `Gauge`, `TrendLine`, `PeriodColumns`, `StatValue`, `EntryTimeline`, `StatusPill` |
| `frontend/src/features/management/indicatorCharts/ChartDataTable.jsx` | The table fallback rendered inside `<details>` |
| `frontend/src/features/management/indicatorCharts/indicator-charts.css` | Chart layout, reduced-motion rules |
| `frontend/src/features/management/indicatorCharts/indicatorChartSvg.js` | `renderToStaticMarkup` wrapper producing SVG strings for pdfmake |

**Modified**

| Path | Change |
|---|---|
| `ManagementTrackingPage.jsx` | Card renders `<IndicatorChart variant="card">`; detail drawer renders `variant="detail"` plus the "Cómo se ve este indicador" selector |
| `ManagementReportsUnifiedPage.jsx`, `ManagementReportCreatePage.jsx` | Reports embed the same component |
| `frontend/src/i18n/managementTranslations.js` | Chart form names, axis/legend labels, empty and draft-exclusion copy, override selector copy — ES + EN |
| `frontend/package.json` | The seven `@visx/*` dependencies at `4.0.0` |
| `docs/DATABASE.md` | `preferred_chart` column |
| `docs/DESIGN.md` | New "Indicator Visualization Standard" section |
| `docs/plans/INDEX.md` | This plan |

## Accessibility and bilingual requirements

- **A1** Every chart is `role="img"` with an `aria-label` that states the
  indicator name, the consolidated value, the target, and the completion
  percentage in the active language. A decorative `<svg>` with no label
  never ships.
- **A2** Every chart is followed by `<details>` → *"Ver datos" / "View
  data"* containing a real `<table>` with period, value, status, and
  responsible person. This is the contrast relief for slot 2 and the
  screen-reader path.
- **A3** No animation under `prefers-reduced-motion: reduce` — final state
  is rendered directly, matching the existing rules in `management.css`.
- **A4** Identity is never color-alone: series are directly labeled, and
  achievement states carry an icon plus a word.
- **A5** Tooltips are keyboard reachable (focusable marks, `Escape`
  dismisses) and never the only route to a value — A2 guarantees that.
- **A6** All chart text comes from `managementTranslations.js`. Numbers and
  dates keep going through the existing `formatNumber`, `formatDate` and
  `metricDisplay` helpers so `es-VE` / `en-US` formatting stays consistent.
- **A7** Verified at 320, 375, 414 and 768 CSS pixels plus a desktop width,
  per `AGENTS.md`. Below 375px the card form degrades to the meter plus the
  number; axes are dropped before labels are shrunk.

## Tests (red first)

| # | Test | File |
|---|---|---|
| T1 | Every `(metric_type × aggregation_method × target-present)` combination returns a known form and never throws | `recommendedChart.test.js` |
| T2 | 0 rows → `empty`; 1 row → `stat`; 2 rows → `columns` even when the rule says `trend` | `recommendedChart.test.js` |
| T3 | A valid `preferred_chart` wins over the automatic form; an invalid or incompatible one falls back to it | `recommendedChart.test.js` |
| T4 | `draft` rows are excluded from series and counted for the disclosure line | `chartSeries.test.js` |
| T5 | Series are ordered by `reporting_period_end`, falling back to `created_at`; `unique_people` cumulative totals are monotonic | `chartSeries.test.js` |
| T6 | Chart palette passes the six checks (lightness band, chroma, CVD ΔE, normal-vision floor, contrast, ordering) — the validator's thresholds asserted against `chartTheme.js` | `chartTheme.test.js` |
| T7 | No module under `features/platform`, `features/monetary`, or `features/in-kind` imports `@visx/*` | `indicatorCharts/bundleBoundary.test.js` |
| T8 | `indicatorChartSvg` emits an SVG string with literal `fill`/`stroke` attributes and no `var(` and no `foreignObject` (pdfmake constraint) | `indicatorChartSvg.test.js` |
| T9 | pgTAP: `preferred_chart` exists, is nullable, has the check constraint, and rejects an unknown value | `supabase/tests/` |

## Verification

```bash
pnpm test      # T1–T8
pnpm lint
pnpm build     # confirms the lazy chunk splits out
```

Database, local first per `CLAUDE.md`: `supabase start`, apply the
migration, run the pgTAP file (T9), insert and roll back a representative
`management_indicator` row with each allowed `preferred_chart` value, then
`supabase stop`. The live `edifydb` project
(`rrqyihsjftlloizsccvi`) is touched only after that passes, followed by the
security and performance advisors.

Browser verification with the `playwright-cli` skill: an indicator of each
`metric_type`, at the four required widths, in both languages, with
reduced motion forced on, plus the PDF export opened and the embedded
chart compared against the screen.

## Risks

| Risk | Mitigation |
|---|---|
| visx primitives pull more bundle than expected | `React.lazy` boundary + T7; measure the chunk in `pnpm build` before and after |
| `pdfmake` chokes on generated SVG (no CSS vars, no `foreignObject`, limited filters) | T8 asserts the constraint; `chartTheme` uses literal hex; the existing `buildGaugeSvg` output is the known-good reference |
| A chart implies a trend from too little data | Rows 2–3 of the heuristic plus T2 |
| Indicators with mixed reporting frequencies produce ragged axes | Series are bucketed by the indicator's declared `frequency`; gaps render as gaps, never as interpolated values |
| The override lets someone pick a misleading form | Only forms valid for that indicator's data are offered; invalid stored values fall back silently |

## Out of scope

- Dark mode chart steps (no dark mode exists yet).
- Cross-indicator or cross-unit comparison dashboards — a separate plan.
- Changing `aggregateIndicator` semantics. Charts read what it already
  computes.
- Any change to `indicator_progress` capture. Nothing new is collected.

## Delivery order

1. Migration + pgTAP (T9), applied locally.
2. `recommendedChart`, `chartSeries`, `chartTheme` with T1–T6 red, then green.
3. `IndicatorChart` + the `progress`, `gauge`, `stat`, `empty` forms; wire
   into the Tracking card.
4. `trend`, `columns`, `timeline`, `status` forms; wire into the detail
   drawer, plus the override selector.
5. `indicatorChartSvg` + PDF/report embedding (T8).
6. Docs: `DATABASE.md`, `DESIGN.md`, this plan's status, `INDEX.md`.

The product owner asked for the detail-drawer history charts first, since
they are the most visible change, so steps 3 and 4 of the original outline
are swapped: the drawer ships before the card meters.

## Implementation notes — step 1 (detail-drawer history charts)

Delivered: `recommendedChart`, `chartSeries`, `chartTheme`,
`indicatorFormat`, `IndicatorChart` and the `trend`, `columns`, `timeline`,
`stat`, `status` and `empty` forms, wired into the Tracking detail drawer
(`ManagementTrackingPage.jsx`) between the summary and the result history.
Tests T1–T7 are green (27 assertions).

Five deviations from the outline above, all discovered while implementing:

1. **Chart copy lives in `indicatorCharts/chartCopy.js`, not
   `managementTranslations.js`.** That file is a
   Spanish→English string-replacement dictionary driven by
   `GlobalLanguageController`, not a keyed catalog. `ManagementTrackingPage`
   keeps its own `{ es, en }` `copy` object, and the charts follow that same
   pattern.
2. **`formatNumber`, `formatDate` and `metricDisplay` moved out of
   `ManagementTrackingPage.jsx`** into `indicatorCharts/indicatorFormat.js`,
   so the page and the charts format identically. Behavior is unchanged; the
   page imports what it still uses.
3. **The lazy boundary sits at the page, not only inside
   `IndicatorChart`.** Importing the entry point eagerly added 3.4 kB gzip to
   the main chunk, which every public route loads. With the page-level
   `lazy()` the main chunk is 869.90 kB / 220.61 kB gzip against a 869.55 kB
   / 220.47 kB baseline — 0.14 kB gzip — and visx lands in its own 22.25 kB
   gzip chunk that only the drawer fetches.
4. **`@visx/tooltip` was dropped.** The tooltip is local component state
   positioned with the chart's own scale; the package added a dependency
   without carrying any of that work.
5. **`ParentSize` needs an explicit height.** Its wrapper defaults to
   `height: 100%; overflow: hidden`, which collapses to zero against an
   auto-height parent and clips the whole plot — the chart was in the DOM,
   correctly sized, and painted nothing. Both forms pass
   `parentSizeStyles={{ width: '100%', height: CHART_HEIGHT }}`. Anything
   that must render outside that box (the cumulative legend) is rendered
   outside `ParentSize`.

Browser verification ran against fixture indicators (one per metric type,
including the single-result, two-result and no-result cases) in Chromium at
320, 375, 768 and 1280 CSS pixels in both languages: no page errors, no
horizontal overflow, keyboard focus on a mark opens its tooltip and
`Escape` dismisses it, marks carry their own accessible name, the chart
region carries the summary label, and "Ver datos" opens the full data
table. Three defects were found and fixed this way: the reference-line
label clipped against the right edge, the cumulative legend was clipped by
`ParentSize`, and axis labels collided at 320px (ticks are now thinned by
available width rather than shrunk).

The Supabase round trip in **Verification** above has not run: this
container has no Docker daemon, so `supabase start` is unavailable. It is
owed before the `preferred_chart` migration in step 2, which is the first
step that touches the database.
