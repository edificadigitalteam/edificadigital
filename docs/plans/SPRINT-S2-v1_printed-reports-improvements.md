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

## Scope of this change

1. **Layout/pagination fixes** in `compliance.css`'s `@media print` block:
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
2. **Export flow clarity**:
   - Rename/relabel the current "Imprimir informe" action if user testing
     shows confusion between "print" and "save as PDF" (likely: keep one
     button, but confirm the browser print dialog opens with "Save as PDF"
     discoverable, and consider a short inline hint next to the button).
   - No new dependencies; this is markup/CSS/copy only.
3. **Out of scope**: any new report type (international/aggregate impact
   report) — that remains an unbuilt module per `docs/ARCHITECTURE.md`.
   A dedicated PDF-generation service is deferred per the recommendation
   above.

## Affected files

- `frontend/src/features/dashboard/compliance.css` (primary)
- `frontend/src/features/dashboard/ProjectCompliancePanel.jsx` (markup
  adjustments only if pagination fixes require restructuring wrapper
  elements; no data/logic changes expected)
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
  rows/cards, consistent margins, and correct page breaks.
- `pnpm lint` / `pnpm build` (no test suite currently covers print CSS;
  this is a visual/manual verification area per `AGENTS.md`).
- Screenshots of the generated PDF (multi-page) attached to the pull
  request, per the Git/release section of this guide.

## Next step

Confirm this recommendation (HTML + refined print CSS, no new PDF library)
with the product owner before implementation, since it declines the literal
"pasarlo a PDF" framing in favor of the pipeline already in place. If the
product owner instead wants a one-click "download PDF" button independent
of the browser dialog (e.g. for emailing or offline use without a print
dialog), that changes scope to a small client-side capture library and
should be called out explicitly before implementation starts.
