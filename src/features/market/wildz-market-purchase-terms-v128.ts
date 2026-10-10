import { canonicalPortableCardJson, sha256PortableBasis } from "../play/portable-card";
import { createWildsWalletAssetSendReview, type WildsWalletAssetSendAsset } from "../play/wallet/wilds-wallet-asset-send";
import { createWildsWalletTradeAgreement, createWildsWalletTradeDraft, type WildsWalletTradeAgreement } from "../play/wallet/wilds-wallet-trade";
import { admitWildzMarketConnectQuoteV128, type WildzMarketConnectQuoteV128 } from "../../lib/receiz/wildz-market-quote-v128";
import { parseWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";

export type WildzMarketPurchaseTermsV128 = Readonly<{
  schema: "wildz.market.purchase-terms.v128"; purchaseId: string; listingId: string; listingHead: string;
  reservationId: string; reservationHead: string; buyerHandle: string; sellerHandle: string;
  sourceDigest: string; asset: WildsWalletAssetSendAsset; quote: WildzMarketConnectQuoteV128;
}>;
type Basis = Omit<WildzMarketPurchaseTermsV128, "purchaseId">;
const canonical = (value: unknown) => canonicalPortableCardJson(value);
const digest = (value: unknown) => sha256PortableBasis(canonical(value)).replace(/^sha256:/, "");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function basis(value: unknown): Basis {
  if (!object(value) || value.schema !== "wildz.market.purchase-terms.v128" || [value.listingId, value.reservationId].some(id => typeof id !== "string" || !/^[a-z0-9][a-z0-9:._-]{5,159}$/i.test(id))
    || [value.listingHead, value.reservationHead, value.sourceDigest].some(id => typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))
    || typeof value.buyerHandle !== "string" || parseWildzPlayerCoordinate(value.buyerHandle)?.profileHandle !== value.buyerHandle
    || typeof value.sellerHandle !== "string" || parseWildzPlayerCoordinate(value.sellerHandle)?.profileHandle !== value.sellerHandle || value.buyerHandle === value.sellerHandle) throw Error("The exact named marketplace reservation is required.");
  const quote = admitWildzMarketConnectQuoteV128(value.quote);
  if (quote.ownerHandle !== value.buyerHandle) throw Error("The actual buyer's marketplace quote is required.");
  const asset = createWildsWalletAssetSendReview({ id: "market", label: "Market source", quantity: 1, asset: value.asset as WildsWalletAssetSendAsset }, value.buyerHandle, 1, "market:terms", value.sellerHandle).request.asset;
  if (canonical(asset) !== canonical(value.asset)) throw Error("The exact market source selection is required.");
  return Object.freeze({ schema: "wildz.market.purchase-terms.v128", listingId: value.listingId as string, listingHead: value.listingHead as string,
    reservationId: value.reservationId as string, reservationHead: value.reservationHead as string, buyerHandle: value.buyerHandle, sellerHandle: value.sellerHandle, sourceDigest: value.sourceDigest as string, asset, quote });
}
export function admitWildzMarketPurchaseTermsV128(value: unknown): WildzMarketPurchaseTermsV128 {
  if (!object(value) || Object.keys(value).sort().join(",") !== "asset,buyerHandle,listingHead,listingId,purchaseId,quote,reservationHead,reservationId,schema,sellerHandle,sourceDigest") throw Error("The closed marketplace purchase terms are required.");
  const input = basis(value), purchaseId = `market:purchase:${digest(input)}`;
  if (value.purchaseId !== purchaseId) throw Error("The saved marketplace price or source changed. Review a new purchase.");
  return Object.freeze({ ...input, purchaseId });
}
export function createWildzMarketPurchaseAgreementV128(input: Basis): WildsWalletTradeAgreement {
  const terms = basis(input), purchaseId = `market:purchase:${digest(terms)}`;
  const market = Object.freeze({ ...terms, purchaseId });
  const buyer = createWildsWalletTradeDraft({ attemptId: `${purchaseId}:buyer`, selfHandle: market.buyerHandle, recipient: market.sellerHandle, phiMicro: market.quote.amountPhiMicro, requestedPhiMicro: "0", requestNote: "Marketplace purchase", selections: [] });
  const seller = createWildsWalletTradeDraft({ attemptId: `${purchaseId}:seller`, selfHandle: market.sellerHandle, recipient: market.buyerHandle, phiMicro: "0", requestedPhiMicro: market.quote.amountPhiMicro, requestNote: "Marketplace delivery", selections: [{ selection: { id: "market", label: "Market source", quantity: 1, asset: market.asset }, quantity: 1 }] });
  return createWildsWalletTradeAgreement({ senderHandle: market.buyerHandle, draft: buyer }, { senderHandle: market.sellerHandle, draft: seller }, "market", market);
}
