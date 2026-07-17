import type { WildzMarketState } from "../../lib/receiz/wildz-market-state";
import { currentWildzOwner } from "../../lib/receiz/wildz-market-state";
import { type PlayState } from "./game-state";
import { EMPTY_WILDS_SUPPORT_ASSET_IDS, type WildsSupportAssetIds } from "./wilds-v3-contracts";

function ownsAsset(state: WildzMarketState, ownerReceizId: string, asset: PlayState["inventory"][number]) {
  try {
    return currentWildzOwner(state, asset) === ownerReceizId;
  } catch {
    return false;
  }
}

function nextSupportIds(current: WildsSupportAssetIds, ownedIds: ReadonlySet<string>, selectedAssetId: string): WildsSupportAssetIds {
  const next = current.map((assetId) => (
    assetId && assetId !== selectedAssetId && ownedIds.has(assetId) ? assetId : null
  )) as unknown as WildsSupportAssetIds;
  return next.length === 2 ? next : EMPTY_WILDS_SUPPORT_ASSET_IDS;
}

export function reconcileWildzVaultOwnership(
  playState: PlayState,
  ownerReceizId: string,
  ownershipState: WildzMarketState
): PlayState {
  const inventory = playState.inventory.filter((asset) => ownsAsset(ownershipState, ownerReceizId, asset));
  if (inventory.length === playState.inventory.length) return playState;
  const ownedIds = new Set(inventory.map((asset) => asset.id));
  const selected = inventory.find((asset) => asset.id === playState.selectedAssetId) ?? inventory[0] ?? null;
  return {
    ...playState,
    inventory,
    discoveredCardIds: [...new Set(inventory.map((asset) => asset.manifest.familyId))],
    pendingSyncAssetIds: playState.pendingSyncAssetIds.filter((assetId) => ownedIds.has(assetId)),
    selectedAssetId: selected?.id ?? "",
    selectedCardId: selected?.manifest.familyId ?? playState.selectedCardId,
    supportAssetIds: nextSupportIds(playState.supportAssetIds, ownedIds, selected?.id ?? ""),
    lastEvent: selected
      ? "Vault reconciled with Receiz custody. Transferred cards left this active vault."
      : "Vault reconciled with Receiz custody. No active cards remain in this vault."
  };
}
