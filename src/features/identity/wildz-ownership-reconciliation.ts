import { restorePlayState, serializePlayState, type PlayState } from "../play/game-state";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";

const LOCAL_TRANSFER_KEY = "receiz:wildz:ownership-transfers:v119";

type LocalOwnershipTransfers = Record<string, { ownerActorId: string; witnessedAt: string }>;

function readLocalTransfers(storage: Pick<Storage, "getItem">): LocalOwnershipTransfers {
  try {
    const value = JSON.parse(storage.getItem(LOCAL_TRANSFER_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([assetId, transfer]) => (
      /^wilds:[a-f0-9]{24}$/.test(assetId)
      && transfer && typeof transfer === "object" && !Array.isArray(transfer)
      && typeof (transfer as { ownerActorId?: unknown }).ownerActorId === "string"
      && typeof (transfer as { witnessedAt?: unknown }).witnessedAt === "string"
    ))) as LocalOwnershipTransfers;
  } catch {
    return {};
  }
}

export function recordLocalWildzOwnershipTransfer(
  storage: Pick<Storage, "getItem" | "setItem">,
  ownerActorId: string,
  assetIds: readonly string[],
  witnessedAt = new Date().toISOString()
) {
  const current = readLocalTransfers(storage);
  for (const assetId of assetIds) current[assetId] = { ownerActorId, witnessedAt };
  const bounded = Object.fromEntries(Object.entries(current)
    .sort((left, right) => right[1].witnessedAt.localeCompare(left[1].witnessedAt))
    .slice(0, 2_000));
  storage.setItem(LOCAL_TRANSFER_KEY, JSON.stringify(bounded));
}

export function locallyTransferredWildzAssetIds(
  storage: Pick<Storage, "getItem">,
  ownerActorId: string,
  assetIds: readonly string[]
) {
  const transfers = readLocalTransfers(storage);
  return assetIds.filter((assetId) => {
    const transfer = transfers[assetId];
    return Boolean(transfer && !sameWildzPlayerCoordinate(transfer.ownerActorId, ownerActorId));
  });
}

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
