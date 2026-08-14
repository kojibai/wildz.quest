import type { PlayState } from "./game-state";
import type { WildzCommittedArtifactRestore } from "../identity/wildz-restore";

export type WildzInventoryImportResult = {
  addedAssetIds: string[];
  updatedAssetIds: string[];
};

export function summarizeWildzInventoryImport(
  before: PlayState,
  outcome: WildzCommittedArtifactRestore
): WildzInventoryImportResult {
  const beforeById = new Map(before.inventory.map((asset) => [asset.id, asset.proof.digest]));
  const afterById = new Map(outcome.playState.inventory.map((asset) => [asset.id, asset.proof.digest]));
  const addedAssetIds: string[] = [];
  const updatedAssetIds: string[] = [];
  for (const assetId of new Set(outcome.verifiedAssetIds)) {
    const afterDigest = afterById.get(assetId);
    if (!afterDigest) continue;
    const beforeDigest = beforeById.get(assetId);
    if (!beforeDigest) addedAssetIds.push(assetId);
    else if (beforeDigest !== afterDigest) updatedAssetIds.push(assetId);
  }
  return {
    addedAssetIds,
    updatedAssetIds
  };
}
