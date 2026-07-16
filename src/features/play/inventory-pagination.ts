export function inventoryPageSize(compact: boolean): 4 | 8 {
  return compact ? 4 : 8;
}

export function clampInventoryPage(page: number, itemCount: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(Math.max(0, itemCount) / safePageSize));
  return Math.min(pageCount - 1, Math.max(0, Math.floor(page)));
}

export function rebaseInventoryPage(
  page: number,
  previousPageSize: number,
  nextPageSize: number,
  itemCount: number
) {
  const safePreviousPageSize = Math.max(1, Math.floor(previousPageSize));
  const safeNextPageSize = Math.max(1, Math.floor(nextPageSize));
  const previousPage = clampInventoryPage(page, itemCount, safePreviousPageSize);
  const firstVisibleIndex = previousPage * safePreviousPageSize;
  return clampInventoryPage(Math.floor(firstVisibleIndex / safeNextPageSize), itemCount, safeNextPageSize);
}
