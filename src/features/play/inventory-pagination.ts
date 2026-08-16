export function inventoryPageSize(compact: boolean): 4 | 8 {
  return compact ? 4 : 8;
}

export function inventoryPageForAsset(
  orderedAssetIds: readonly string[],
  assetId: string,
  pageSize: number
) {
  const index = orderedAssetIds.indexOf(assetId);
  if (index < 0) return 0;
  return clampInventoryPage(Math.floor(index / Math.max(1, Math.floor(pageSize))), orderedAssetIds.length, pageSize);
}

export function shouldCaptureInventorySwipe(
  start: Readonly<{ x: number; y: number }>,
  current: Readonly<{ x: number; y: number }>
) {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return Math.abs(dx) >= 48 && Math.abs(dx) >= Math.abs(dy);
}

export function inventorySwipePageDelta(
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>
): -1 | 0 | 1 {
  if (!shouldCaptureInventorySwipe(start, end)) return 0;
  return end.x < start.x ? 1 : -1;
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
