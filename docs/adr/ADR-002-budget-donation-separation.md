# ADR-002: Separate Approved Budgets from Received Donations

**Status:** Proposed  
**Date:** 2026-07-19  
**Decision owners:** Isaac Delgado, Yang (yangetze)

## Resumen (ES)

El presupuesto aprobado y la donación recibida representan hechos distintos dentro de la trazabilidad. El presupuesto autoriza el uso planificado de recursos. La donación registra recursos que ya fueron recibidos. Las compras y gastos registran la ejecución real. Esta separación permite reportar montos aprobados, comprometidos, recibidos, ejecutados y disponibles.

## Summary (EN)

An approved budget and a received donation represent different traceability events. A budget authorizes planned use of resources. A donation records resources actually received. Procurement and expenses record actual execution. This separation supports approved, committed, received, spent, and available reporting.

## Context

The original MVP models actors, donations, kit transformations, and impact events. FORM 205 adds an approved project budget of USD 244,997.90 with budget lines, percentage-based administration, funding sources, kit compositions, and operational costs.

Loading FORM 205 into `donation` would treat planned funds as received funds and would overstate available resources.

## Proposed decision

Adopt separate planning, funding, receipt, execution, transformation, and impact records.

```text
project
  └─ project_budget
      ├─ budget_line
      └─ budget_funding ─ funding_source
           ↑
donation ─ donation_allocation
  └─ donation_detail

budget_line ─ procurement_expense
kit_definition ─ kit_component
kit_definition ─ kit_transformation ─ impact_detail ─ impact_event
project ─ report_snapshot
```

## Rules

1. Approved budgets create planning records.
2. Funds received create donation records.
3. Funding commitments and received donations reconcile separately.
4. Actual payments create procurement or expense records.
5. Budget amounts remain immutable after approval.
6. Amendments create a new budget version.
7. Line codes use text.
8. External names and reports support Spanish and English.
9. Database artifact names remain English and use snake_case.
10. Report snapshots preserve their cutoff and language.

## FORM 205 implications

- `approved_amount`: USD 244,997.90
- `calculation_method` for most lines: `UNIT_X_QTY`
- `calculation_method` for BWAid admin: `PERCENT_OF_BASE`
- `percentage_base_amount`: USD 228,970.00
- `percentage_rate`: 0.07
- `total_amount`: USD 16,027.90
- `line_code` values `2.3.1` and `2.3.2` remain text
- Food basket component cost: USD 75.265
- Food basket approved unit price: USD 75.27

## Consequences

### Benefits / Beneficios

- Accurate budget-versus-actual reporting
- Funding-source reconciliation
- Clear separation of planned and received resources
- Audit-ready expense evidence
- Versioned kit composition
- Bilingual institutional reports

### Cost / Costo

- Additional schema and tests
- Additional data-entry workflows
- RLS and permission rules for approval states
- Product decisions for unresolved FORM 205 fields

## Alternatives considered

### Store approved amounts as donations

Rejected because planned funds would appear as received funds.

### Store budget metadata inside donation attachments

Rejected because structured reconciliation and budget-versus-actual reporting would remain unavailable.

### Keep budget tracking outside the platform

Deferred as a fallback. It would limit institutional reporting and international cooperation use cases.

## Approval required

This ADR remains proposed until Isaac and Yang approve the database scope and the unresolved FORM 205 business fields.
