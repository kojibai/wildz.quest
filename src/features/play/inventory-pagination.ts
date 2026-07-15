export function inventoryPageSize(compact: boolean): 4 | 8 {
  return compact ? 4 : 8;
}

export function clampInventoryPage(page: number, itemCount: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(Math.max(0, itemCount) / safePageSize));
  return Math.min(pageCount - 1, Math.max(0, Math.floor(page)));
}
