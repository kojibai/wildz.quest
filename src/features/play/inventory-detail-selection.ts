export function resolveInventoryDetailSelection(input: Readonly<{
  selectedId: string;
  focusedAssetId: string | null;
  previousFocusedAssetId: string | null;
  inventoryIds: readonly string[];
}>) {
  const inventory = new Set(input.inventoryIds);
  const focusChanged = input.focusedAssetId !== input.previousFocusedAssetId;
  if (focusChanged && input.focusedAssetId && inventory.has(input.focusedAssetId)) {
    return input.focusedAssetId;
  }
  if (inventory.has(input.selectedId)) return input.selectedId;
  if (input.focusedAssetId && inventory.has(input.focusedAssetId)) return input.focusedAssetId;
  return input.inventoryIds[0] ?? "";
}
