# Plan: Improve printed/exported compliance report delivery

**Status:** Draft
**Reported by:** Product owner, 2026-07-26 (`docs/TODO.md`)
**Branch:** `feature/printed-reports-improvements`

## Outcome

The existing `INFORME DE CUMPLIMIENTO` (project compliance report) prints and
exports to PDF cleanly: consistent pagination, no clipped tables/cards across
page breaks, correct A4 margins, and a reliable one-click "export to PDF"
path that does not depend on the user knowing how to use their browser's
print dialog correctly.

## Current state (verified in `frontend/src`)

- The only report in the codebase is
  `frontend/src/features/dashboard/ProjectCompliancePanel.jsx`, styled by
  `frontend/src/features/dashboard/compliance.css`.
- Export today is `window.print()` with a `@media print` block: it hides
  `.no-print` controls, forces `print-color-adjust: exact`, and resizes
  `.print-summary` / `.final-report-card` toward A4 (`min-height: 238mm`).
- No PDF library is installed (no jsPDF/pdfmake/react-pdf/puppeteer). HTML →
  PDF today happens entirely through the browser's native "Print → Save as
  PDF", using the existing `@media print` CSS.
- Plain CSS (no Tailwind/CSS Modules), BEM-ish class names, shared CSS
  variables (`--ed-purple`, `--ed-paper`, `--ed-line`, `--ed-ink`, `--ed-muted`).

## Recommended approach: keep HTML + browser print-to-PDF, do not add a PDF library or backend rendering service

Rationale, since the product owner asked whether HTML→PDF is the right way
to go:

- The system **already is** HTML → PDF: every modern browser's "Save as PDF"
  in the print dialog is a real, vector, text-selectable PDF renderer driven
  by the page's own CSS. The gap is layout quality, not the pipeline.
- Client-side PDF libraries (jsPDF, react-pdf) re-implement layout in a
  separate model from the screen DOM, so the two views drift apart over
  time and bilingual (ES/EN) copy has to be laid out twice. `pdfmake` and
  React equivalents fight the exact `@media print` CSS already invested in.
- A server-side renderer (headless Chromium/Puppeteer) gives the most
  polished, pixel-identical PDF but requires a new serverless function,
  cold-start latency, and font-embedding maintenance for a report that has
  no volume problem today (project-by-project, on demand, no bulk batch
  export requirement in scope). This is disproportionate to the reported
  issue ("mejorar formato, maquetación y flujo").
- Recommendation: invest in the print CSS and add a **guided export action**
  (see below) that removes user confusion in the flow, rather than
  introducing a new rendering pipeline. Revisit a headless-Chromium export
  only if a future requirement needs pixel-perfect PDFs generated
  server-side (e.g. emailing a report, batch export, or a report a
  beneficiary/donor never opens the app to see).

## Added requirement (2026-07-27): professional repeating header with page count

Product owner also wants every printed page to carry a header with: the
project name as title, the print date, and a "page X of Y" counter.

**Why this changes the recommendation above.** A repeating header/footer
driven by real pagination (`counter(page)` / `counter(pages)` inside CSS
Paged Media `@page` margin boxes) is part of the CSS spec, but Chrome and
Firefox do not implement `@page` margin-box content — only dedicated paged
renderers (Prince, WeasyPrint) do. Chrome's print dialog has a built-in
"Headers and footers" toggle, but it is generic browser chrome (URL,
`document.title`, browser-formatted date) that we cannot restyle, cannot
guarantee is switched on by the user, and cannot make "the project name"
specifically (it reads `document.title`, shared with the tab).

**Revised recommendation:** keep the on-screen report exactly as-is (HTML +
`ProjectCompliancePanel.jsx` + `compliance.css`), but generate the
*exported/printed* artifact with a small, purpose-built PDF layer using
[`pdfmake`](https://pdfmake.github.io/docs/) fed from the same report data
(not a DOM screenshot). `pdfmake` documents declare `header`/`footer` as
functions of `(currentPage, pageCount)`, so a repeating header with the
project name, the export date, and an accurate "Página X de Y" / "Page X
of Y" (bilingual, matching the active language) comes for free and is
correct across every printed page without relying on browser-specific paged
-media support. This is the smallest dependency that gets a real,
text-selectable, vector PDF with reliable running headers — `jsPDF`'s
`.html()` and `html2canvas` were considered and rejected because they
rasterize the DOM (no repeating header without manual page-splitting math,
and text stops being selectable/searchable).

- The existing "Imprimir informe" / `window.print()` path stays as a
  secondary option for a quick on-screen print without the new header
  treatment (or is superseded entirely by the new "Exportar PDF" button —
  to be decided during implementation based on how much duplicate
  maintenance the two paths cost).
- The `pdfmake` document definition reuses the exact same data already
  loaded by `ProjectCompliancePanel.jsx` (project data, financial
  reconciliation, physical execution, expenses) — no new data fetching.
- Header content per page: project name (title, larger/bold), export date
  (`Intl.DateTimeFormat` in the active locale), and page counter, right- or
  center-aligned per the existing report's visual language (serif heading
  font, `--ed-purple` accent).
- Bilingual: header labels ("Página X de Y" / "Page X of Y", date
  formatting) follow the report's current language, consistent with the
  rest of the bilingual UI requirement.

## Scope of this change

1. **New dependency:** add `pdfmake` to `frontend/package.json` and build a
   `buildComplianceReportPdf(project, reconciliation, ...)` document
   definition (mapping existing report data to a `pdfmake` structure) plus
   a `header`/`footer` callback rendering project name + date + page count.
   Wire it to a new "Exportar PDF" action in `ProjectCompliancePanel.jsx`.
2. **Layout/pagination fixes** in `compliance.css`'s `@media print` block
   (kept for the plain browser-print path, see above):
   - Add `break-inside: avoid` / `page-break-inside: avoid` on cards, table
     rows, and the media evidence gallery so content is not clipped mid-row
     across a page boundary.
   - Add explicit `@page { size: A4; margin: ... }` instead of relying on
     browser defaults, so margins are consistent across browsers/OSes.
   - Verify the financial reconciliation and physical execution tables
     repeat a header row (`thead` uses `display: table-header-group`) when
     they span multiple pages.
   - Confirm bilingual (ES/EN) label lengths do not overflow fixed-width
     print cells.
3. **Export flow clarity**:
   - Add the new "Exportar PDF" action alongside (or replacing) "Imprimir
     informe"; label both clearly if kept side by side so the user
     understands which gets the professional header/page-count treatment.
4. **Out of scope**: any new report type (international/aggregate impact
   report) — that remains an unbuilt module per `docs/ARCHITECTURE.md`.
   A dedicated server-side rendering service (headless Chromium) is still
   deferred — `pdfmake` runs entirely client-side, so this does not add
   backend infrastructure.

## Affected files

- `frontend/package.json` / lockfile (add `pdfmake`)
- `frontend/src/features/dashboard/complianceReportPdf.js` (new — document
  definition builder + header/footer callback)
- `frontend/src/features/dashboard/ProjectCompliancePanel.jsx` (new
  "Exportar PDF" action; markup adjustments only if print-CSS pagination
  fixes require restructuring wrapper elements)
- `frontend/src/features/dashboard/compliance.css` (print pagination/margins)
- `docs/TODO.md` (close out the item once verified)

## Database impact

None. This is a presentation-layer change only.

## Risks

- Print rendering differs across Chrome/Firefox/Safari/Edge; verification
  must include at least Chrome and Firefox "Save as PDF" output, not just
  visual screen review.
- Existing `@media print` rules are tuned to current card heights; changing
  card padding/margins on screen could regress print output if the two are
  not re-verified together.

## Verification plan

- Manual: open the compliance report for a project with (a) few donations/
  short tables and (b) many donations/expenses forcing multi-page output;
  print-preview and "Save as PDF" in Chrome and Firefox; confirm no clipped
  rows/cards, consistent margins, and correct page breaks (for the
  `window.print()` path).
- Manual: generate the `pdfmake` export for the same two projects; confirm
  every page carries the project name, correct export date, and accurate
  "Page X of Y" (including a project whose report spans 3+ pages so the
  counter is genuinely tested, not just "1 of 1"); confirm ES/EN header
  labels switch with the active language.
- `pnpm lint` / `pnpm build`. `pdfmake` document-definition mapping is a
  pure function of report data and can get a focused unit test (e.g.
  asserting the header callback returns the right page count/labels)
  even though visual print-CSS output stays manual per `AGENTS.md`.
- Screenshots/attached PDF of the generated multi-page export included in
  the pull request, per the Git/release section of this guide.

## Added requirement (2026-07-27, after first review): executive cover page + table of contents

Product owner reviewed the first `window.print()` export and liked the
rich visual output (colors, progress bars, evidence thumbnails), but asked
for a restructure:

1. **Page 1: a concise, highly visual executive summary** — project name,
   overall compliance score, and the key financial/beneficiary figures at
   a glance, not the current dense detail.
2. **Following pages: the existing detailed report**, organized into
   clearly labeled sections, with a table of contents on the cover linking
   into each section, and a "back to index" link on each section so a
   reader can jump around a long PDF.

**Implementation.** This is a print/HTML restructuring, not a change to
the `pdfmake` export (which stays as the separate compact export path).
Added to `ProjectCompliancePanel.jsx`/`compliance.css`:

- A new `#report-cover` section (`.print-cover`), hidden on screen, shown
  only in print (`@media print`) with `page-break-after: always` so it is
  guaranteed to be page 1 alone. Contains: project title/kicker, a CSS
  conic-gradient compliance gauge, the four key metric cards (approved,
  received, executed, beneficiaries), the objective text, and a table of
  contents (`<nav class="print-cover-index">`) built from
  `buildReportTableOfContents({ hasEvidence })` in `reportFormatting.js`
  (a pure, unit-tested function so the evidence-section entry only
  appears when there is evidence to show).
- `id`s on each existing detail section (`section-financial`,
  `section-physical`, `section-evidence`, `section-expenses`) so the TOC
  links and anchor-based navigation work.
- A `.print-back-to-index` link (hidden on screen, shown in print) at the
  top of every detail section pointing back to `#report-cover`. Browser
  "Save as PDF" preserves internal hash links as clickable links in the
  resulting PDF, so this works both on paper (as a visual cue) and in a
  digital PDF (as a real jump link) without any new dependency.
- The old on-screen `print-summary` metrics row is now hidden in print
  (`display: none`), since the new cover's metric cards replace it.

## Revised again (2026-07-27, second review): cover page moves into the pdfmake export; "Imprimir informe" removed

Product owner clarified after seeing the `window.print()` mockup that the
cover/table-of-contents should live in the **"Exportar PDF"** action itself
(the `pdfmake` document), not in the separate browser-print path, and asked
to either drop the "Imprimir informe" button or turn "Exportar PDF" into a
preview. Decision: both — the plain `window.print()` button is removed, and
`pdfMake.createPdf(docDefinition).open()` opens the generated PDF in a new
browser tab (the browser's native PDF viewer), which doubles as a preview
and gives print/save controls for free, with no separate viewer to build.

**What moved into `complianceReportPdf.js`:**
- The executive cover is now `pdfmake` content: project title, a compliance
  gauge rendered as inline SVG (`{ svg: '<svg>...</svg>' }`, since pdfmake
  0.2.x supports SVG content nodes), the four key metrics centered in a
  borderless 2×2 table, the objective, and a table of contents built from
  `buildReportTableOfContents()`.
- Real PDF-native navigation: cover metric/TOC entries and every section
  heading carry a pdfmake `id`, and links use `linkToDestination` —
  producing actual internal PDF links/bookmarks in any PDF viewer, not
  hash-anchor links that only work through a browser's print-to-PDF step.
  This is strictly better than the earlier CSS-anchor approach.
- `header()` returns `null` on page 1 (the cover already carries the
  title), and the normal repeating header (project name, export date,
  "Página X de Y") only appears from page 2 onward.
- Centering fix: the compliance gauge and the metrics grid are each wrapped
  in a `columns: [{width:'*'}, content, {width:'*'}]` pattern so they sit
  centered on the page rather than left-aligned next to other content —
  addresses the "alineación que no me gusta" feedback on the first gauge
  layout.

**What was removed** (now redundant, since the cover lives in the PDF):
the `print-cover`/`print-back-to-index` JSX and CSS added in the previous
iteration, the `.compliance-print`/"Imprimir informe" button, and the
section `id`s that only existed to support the CSS-anchor navigation. The
general print-hardening (repeated table headers, `break-inside: avoid`,
hiding sidebar/nav chrome) stays as a harmless fallback for a manual
browser `Ctrl+P`, since that is independent of our own buttons.

**Deferred:** embedding actual evidence images/thumbnails in the PDF
(currently a text summary of evidence counts per activity) — would need
client-side fetching of the signed Storage URLs and base64 conversion,
which is straightforward but out of scope for this pass.

## Refined again (2026-07-27, third review): colored metric cards, boxed index, and a persistent brand header

Two more requests after seeing the centered-but-plain cover:

1. **Visual weight on the cover.** The four key metrics should look like
   the colored, bordered cards from the very first `window.print()`
   mockup (not plain centered text), and the table of contents should sit
   inside its own colored/bordered box, not bare text.
2. **A persistent brand header on every page**, including the cover: the
   Edifica Digital mark + wordmark on the left, the donor/organization
   (tenant) name on the right — the header row that already carried the
   project name/date/page-count now sits *below* this brand row on pages
   2+; on the cover it's the only header content (the cover's own big
   title already covers the project name).

**Implementation in `complianceReportPdf.js`:**
- `metricCard(label, value, accentColor)` builds each metric as its own
  bordered `table` cell with a thin colored top bar (`canvas` rect) in the
  same four brand colors the on-screen cards already use (purple, orange,
  yellow, violet from `compliance.css`'s `.compliance-metrics
  article:nth-child(n)`), so the PDF cards read as the same visual family
  as the in-app dashboard.
- The table-of-contents block is wrapped in a table with a solid
  brand-purple border and a light-purple (`#faf7fd`) fill — same "paper"
  tint used elsewhere in the app (`.evidence-report-grid > article >
  header`, etc.) — instead of a borderless block of text.
- `brandBar(organizationName)` renders the actual `favicon.svg` mark
  (three skewed bars, inlined as SVG so no network fetch/build-time asset
  pipeline is needed) plus "Edifica Digital" on the left, and the tenant's
  organization name on the right. `headerBlock()` now always returns this
  row (cover included); the project-specific title/date/page-count stack
  is appended below it only from page 2 onward. `pageMargins` top grew
  from 90 to 105 to fit the extra row.
- `organizationName` is a new input to `buildComplianceReportDocDefinition`,
  sourced from `selectedProject.organization?.name` in
  `ProjectCompliancePanel.jsx` (already fetched by the existing project
  query's `organization:organization(name)` join — no new query needed).

Tests updated: the header test now asserts the brand mark/tenant name
appear on every page (including the cover, where the project-name/page-
count row must NOT appear), and still asserts the full stack from page 2.

## Next step

Awaiting manual confirmation from a real authenticated session (Vercel
preview) that "Exportar PDF" — brand header, cover cards/index styling,
gauge centering, TOC links, and the detail pages — matches expectations
before closing out the plan.
