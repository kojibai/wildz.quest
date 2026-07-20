import { restorePlayState, serializePlayState, type PlayState } from "../play/game-state";

/** Removes active custody only. Historical events and proof receipts remain auditable. */
export function removeWildzAssetsFromActiveVault(state: PlayState, assetIds: readonly string[]) {
  const removed = new Set(assetIds);
  if (!removed.size || !state.inventory.some((asset) => removed.has(asset.id))) return state;
  const next = restorePlayState(serializePlayState({
    ...state,
    inventory: state.inventory.filter((asset) => !removed.has(asset.id)),
    pendingSyncAssetIds: state.pendingSyncAssetIds.filter((id) => !removed.has(id)),
    selectedAssetId: removed.has(state.selectedAssetId) ? "" : state.selectedAssetId,
    selectedCardId: removed.has(state.selectedCardId) ? "" : state.selectedCardId,
    supportAssetIds: [
      state.supportAssetIds[0] && removed.has(state.supportAssetIds[0]) ? null : state.supportAssetIds[0],
      state.supportAssetIds[1] && removed.has(state.supportAssetIds[1]) ? null : state.supportAssetIds[1]
    ],
    hearttreeSquadAssetIds: state.hearttreeSquadAssetIds.filter((id) => !removed.has(id))
  }));
  return next;
}
