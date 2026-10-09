import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";

export type WildsWalletAssetSendAsset =
  | Readonly<{ kind: "creature"; assetId: string }>
  | Readonly<{ kind: "inventory"; foodItemIds: readonly string[]; materialLotIds: readonly string[]; resourceLotIds: readonly string[] }>
  | Readonly<{ kind: "package"; packageId: string }>;

export type WildsWalletAssetSendRequest = Readonly<{ attemptId: string; recipientHandle: string; asset: WildsWalletAssetSendAsset }>;
export type WildsWalletAssetSendResult = Readonly<{ status: "sent" | "pending" | "failed"; message: string; retryable?: boolean }>;
export type WildsWalletAssetSendSelection = Readonly<{ id: string; label: string; detail?: string; quantity: number; adjustableQuantity?: boolean; asset: WildsWalletAssetSendAsset }>;
export type WildsWalletAssetSend = (request: WildsWalletAssetSendRequest) => Promise<WildsWalletAssetSendResult>;

export function createWildsWalletAssetSendReview(selection: WildsWalletAssetSendSelection, recipient: string, quantity: number, attemptId: string, selfHandle?: string | null) {
  const coordinate = parseWildzPlayerCoordinate(recipient);
  if (!coordinate) throw Error("Enter a valid Receiz username.");
  if (selfHandle && sameWildzPlayerCoordinate(coordinate.profileHandle, selfHandle)) throw Error("Choose another user to receive this asset.");
  const maximum = selection.adjustableQuantity ? Math.min(selection.quantity, 64) : selection.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maximum || !selection.adjustableQuantity && quantity !== selection.quantity) throw Error("Choose an available whole quantity.");
  if (!attemptId) throw Error("A send attempt is required.");
  const asset = selection.asset.kind === "inventory" ? Object.freeze({
    ...selection.asset,
    foodItemIds: Object.freeze([...selection.asset.foodItemIds].slice(0, selection.adjustableQuantity ? quantity : undefined)),
    materialLotIds: Object.freeze([...selection.asset.materialLotIds]),
    resourceLotIds: Object.freeze([...selection.asset.resourceLotIds])
  }) : Object.freeze({ ...selection.asset });
  return Object.freeze({ label: selection.label, detail: selection.detail, quantity,
    request: Object.freeze({ attemptId, recipientHandle: coordinate.profileHandle, asset }) });
}
