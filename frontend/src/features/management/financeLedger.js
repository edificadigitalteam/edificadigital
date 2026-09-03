export const FINANCE_LEDGER_PAGE_SIZE = 10

export function filterFinanceMovements(movements, filters = {}) {
  return movements.filter((movement) => {
    if (filters.dateFrom && movement.occurred_on < filters.dateFrom) return false
    if (filters.dateTo && movement.occurred_on > filters.dateTo) return false
    if (filters.movementType && movement.movement_type !== filters.movementType) return false
    if (filters.unitId && movement.unit_id !== filters.unitId) return false
    if (filters.fundId && movement.fund_id !== filters.fundId) return false
    return true
  })
}

export function paginateFinanceMovements(movements, requestedPage, pageSize = FINANCE_LEDGER_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(movements.length / pageSize))
  const page = Math.min(Math.max(Number(requestedPage) || 1, 1), totalPages)
  const start = (page - 1) * pageSize
  return { items: movements.slice(start, start + pageSize), page, totalPages }
}
