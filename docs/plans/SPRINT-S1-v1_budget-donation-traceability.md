# Sprint S1 Plan: Budget and Donation Traceability

**Code:** SPRINT-S1-v1  
**Status:** Draft — requires Product Owner review  
**Owner:** Isaac Delgado, Yang (yangetze)  
**Created:** 2026-07-19  
**Last Updated:** 2026-07-19

## Resumen ejecutivo (ES)

El presupuesto FORM 205 aprobado por USD 244,997.90 reconcilia correctamente. Su estructura introduce información que el modelo original de donaciones todavía no representa: presupuesto aprobado, líneas presupuestarias, fuentes de financiamiento comprometidas, compras o gastos reales, versiones de composición de kits y reportes institucionales bilingües.

La optimización propuesta conserva el flujo **Recibir → Transformar → Impactar** y agrega una capa previa de planificación y una capa de ejecución financiera:

`Proyecto → Presupuesto aprobado → Financiamiento → Donación recibida → Compra/Gasto → Transformación → Impacto → Reporte`

## Executive summary (EN)

The approved FORM 205 budget totals USD 244,997.90 and reconciles correctly. It introduces information that the original donation model does not yet represent: approved budgets, budget lines, committed funding sources, actual procurement or expenses, versioned kit compositions, and bilingual institutional reports.

The proposed optimization keeps the **Receive → Transform → Impact** flow and adds planning and financial execution layers:

`Project → Approved Budget → Funding → Donation Received → Procurement/Expense → Transformation → Impact → Report`

## Database changes — explicit notice

This plan proposes new database entities and changes to existing entities. No migration is included in this documentation PR.

### Proposed new tables

- `project`
- `project_budget`
- `budget_line`
- `funding_source`
- `budget_funding`
- `donation_allocation`
- `procurement_expense`
- `procurement_expense_attachment`
- `kit_definition`
- `kit_component`
- `report_snapshot`

### Proposed changes to existing tables

- `donation`: project and funding context
- `kit_transformation`: kit definition, budget line, and actual-cost context
- `impact_event`: project context
- `impact_detail`: retain transformation linkage

## Budget comparison findings

| ID | Finding | Required treatment |
|---|---|---|
| B-01 | Budget total = USD 244,997.90 | Store approved amount and immutable budget version |
| B-02 | Codes 2.3.1 and 2.3.2 were converted by Excel | Store every line code as `TEXT` |
| B-03 | Project duration is 3 months; Project Manager quantity is 4 | Block final load until approved |
| B-04 | Food basket coverage states 2 weeks and 1 month | Add `coverage_days`; require approval |
| B-05 | Organization contribution and BWAid request are blank | Funding-source reconciliation required |
| B-06 | Food components total USD 75.265; approved unit price is USD 75.27 | Store 3-decimal component costs and 2-decimal approved price |
| B-07 | BWAid administration equals 7% of USD 228,970 | Support `PERCENT_OF_BASE` calculation method |
| B-08 | PPE uses `LumpSum` in the quantity field | Quantity = 1; unit = lump sum |
| B-09 | M&E is grouped under Overhead | Require explicit budget classification |

## Scope boundaries

### Included in the proposed Sprint 1 schema

- Approved budget versions
- Normalized budget lines
- Funding-source commitments
- Actual donations received
- Budget-to-actual expenses by line
- Versioned kit definitions and components
- Actual kit transformations and deliveries
- Spanish and English report metadata

### Deferred until Product Owner approval

- Exact many-to-many matching between every donation and every expense
- Multi-currency revaluation
- OCR extraction from invoices
- Public live report links
- Donor-restricted fund accounting

## Implementation sequence after approval

1. Write SQL-level failing tests for constraints and reconciliation rules.
2. Add migration for planning and funding tables.
3. Add migration for procurement and kit-definition tables.
4. Alter donation, transformation, and impact tables.
5. Add RLS policies.
6. Add bilingual application contracts.
7. Implement budget import as a separate workflow from donation intake.
8. Add budget-versus-actual and funding reconciliation views.

## Deliverables in this documentation PR

- This plan
- Test specification
- ADR for budget/donation separation
- Updated database design
- Updated architecture flow
- Updated plans index

## Product decisions required

- [ ] Confirm Project Manager duration: 3 or 4 months
- [ ] Confirm food basket coverage: 14 or 30 days
- [ ] Confirm organization contribution amount
- [ ] Confirm BWAid request amount
- [ ] Confirm M&E classification
- [ ] Approve budget-level financial traceability for Sprint 1
- [ ] Approve proposed entities before migration work

## Definition of ready

Migration work may begin after the Product Owners approve the seven decisions above and the tests in the companion specification accurately describe the required behavior.
