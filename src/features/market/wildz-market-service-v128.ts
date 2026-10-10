import type { WildsWalletAssetSendAsset, WildsWalletAssetSendSelection } from "../play/wallet/wilds-wallet-asset-send";
import type { WildsWalletTradeAgreement } from "../play/wallet/wilds-wallet-trade";

export type WildzMarketPurchasePhaseV128 = "review" | "awaiting-approvals" | "payment-pending" | "paid" | "awaiting-acceptance" | "received" | "completed" | "review-required" | "failed";
export type WildzMarketResultV128 = Readonly<{
  status: "listed" | "cancelled" | "awaiting-peer" | "awaiting-acceptance" | "review-required" | "pending" | "completed" | "failed";
  message: string; listingId?: string; purchaseId?: string; assetRecoveryRequired?: true;
}>;
export type WildzMarketListingViewV128 = Readonly<{
  listingId: string; title: string; kind: WildsWalletAssetSendAsset["kind"]; sellerHandle: string;
  asset: WildsWalletAssetSendAsset;
  priceUsdCents: string; status: "active" | "reserved" | "sold" | "cancelled"; canBuy: boolean; canCancel: boolean;
}>;
export type WildzMarketPurchaseReviewV128 = Readonly<{
  purchaseId: string; listingId: string; reservationId: string; title: string; kind: WildsWalletAssetSendAsset["kind"];
  buyerHandle: string; sellerHandle: string; priceUsdCents: string; amountPhiMicro: string;
  usdPerPhiMicrocents: string; expiresAtKai: number; phase: WildzMarketPurchasePhaseV128;
  agreement: WildsWalletTradeAgreement; canApprove: boolean; canResume: boolean; canAccept: boolean;
  assetRecoveryRequired?: true; canCancel?: boolean; message: string;
}>;
export type WildzMarketSellableV128 = Readonly<{
  id: string; title: string; kind: WildsWalletAssetSendAsset["kind"]; asset: WildsWalletAssetSendAsset;
  summary: string; disabledReason?: string;
}>;
export type WildzMarketSnapshotV128 = Readonly<{
  status: "ready" | "loading" | "unavailable"; message: string;
  listings: readonly WildzMarketListingViewV128[]; purchases: readonly WildzMarketPurchaseReviewV128[];
  sellables: readonly WildzMarketSellableV128[];
  /** Exact local continuation coordinates; these grant no listing/custody authority. */
  pendingListings?: readonly Readonly<{asset:WildsWalletAssetSendAsset;priceUsdCents:string;attemptId:string;listingId:string;title:string;summary:string}>[];
}>;

/** Display/action surface only. Every authoritative method re-admits its native source. */
export type WildzMarketServiceV128 = Readonly<{
  binding: Readonly<{ ownerHandle: string; keyId: string }>;
  snapshot(): WildzMarketSnapshotV128;
  subscribe(listener: (snapshot: WildzMarketSnapshotV128) => void): () => void;
  read(): Promise<WildzMarketSnapshotV128>;
  list(input: Readonly<{ asset: WildsWalletAssetSendAsset; priceUsdCents: string; attemptId: string }>): Promise<WildzMarketResultV128>;
  cancel(listingId: string): Promise<WildzMarketResultV128>;
  previewPurchase(listingId: string): Promise<WildzMarketPurchaseReviewV128>;
  approvePurchase(purchaseId: string): Promise<WildzMarketResultV128>;
  resume(purchaseId: string): Promise<WildzMarketResultV128>;
  accept(purchaseId: string): Promise<WildzMarketResultV128>;
  /** Only an exact agreement already saved/approved here may advance. Incoming JSON grants no approval. */
  receive(context: unknown, senderHandle: string): Promise<WildzMarketResultV128>;
}>;
export type WildzMarketReadSelectionsV128 = () => readonly WildsWalletAssetSendSelection[];
export { createWildzMarketControllerV128 as createWildzMarketServiceV128 } from "./wildz-market-controller-v128";
export type { WildzMarketServiceInputV128 } from "./wildz-market-controller-v128";
