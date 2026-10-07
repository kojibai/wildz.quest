import type { JsonObject, ReceizBearerTransferReceiptV1 } from "@receiz/sdk";
import { sha256PortableBasis } from "../play/portable-card";
import { verifyWildsResourcePackage, type WildsResourcePackageV1 } from "../play/wilds-resource-package";

export const RESOURCE_PACKAGE_MARKET_RESERVATION_MS = 5 * 60 * 1_000;
export type ResourcePackageMarketHead = { revision: number; appendAnchorId: string | null };
export type ResourcePackageMarketListing = {
  schema: "wildz.resource-package-listing.v1";
  id: string;
  package: WildsResourcePackageV1;
  packageId: string;
  packageHead: string;
  subjectId: string;
  sellerActorId: string;
  sellerHandle: string;
  sellerReceizUserId: string;
  priceCents: number;
  currency: "USD";
  status: "active" | "reserved" | "sold" | "cancelled";
  /** Authenticated encryption; never expose the native claim instrument. */
  sealedOffer: string;
  idempotencyKey: string;
  createdAt: string;
};
export type ResourcePackageMarketPayment = {
  transferId: string;
  ledgerEventId: string;
  proofBundle: JsonObject;
};
export type ResourcePackageMarketTrade = {
  schema: "wildz.resource-package-trade.v1";
  id: string;
  listingId: string;
  packageId: string;
  buyerActorId: string;
  buyerHandle: string;
  buyerReceizUserId: string;
  status: "reserved" | "paying" | "paid" | "settled" | "released";
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string;
  payment?: ResourcePackageMarketPayment;
  custodyReceipt?: ReceizBearerTransferReceiptV1;
};
export type ResourcePackageMarketState = ResourcePackageMarketHead & {
  schema: "wildz.resource-package-market.v1";
  listings: Record<string, ResourcePackageMarketListing>;
  trades: Record<string, ResourcePackageMarketTrade>;
};
export type ResourcePackageMarketEvent =
  | { type: "listed"; listing: ResourcePackageMarketListing }
  | { type: "cancelled"; listingId: string; actorId: string }
  | { type: "reserved"; trade: ResourcePackageMarketTrade }
  | { type: "released"; tradeId: string; actorId: string }
  | { type: "payment-started"; tradeId: string; actorId: string }
  | { type: "paid"; tradeId: string; payment: ResourcePackageMarketPayment }
  | { type: "settled"; tradeId: string; receipt: ReceizBearerTransferReceiptV1 };

export function validPackageMarketPrice(price: unknown): price is number {
  return Number.isInteger(price) && Number(price) >= 50 && Number(price) <= 100_000_000;
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, limit = 512): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= limit && value === value.trim();
}
function iso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function resourcePackageListingId(packageId: string, sellerActorId: string, idempotencyKey: string) {
  return `pack-listing:${sha256PortableBasis(`${packageId}|${sellerActorId}|${idempotencyKey}`).slice(7, 39)}`;
}
export function resourcePackageTradeId(listingId: string, buyerActorId: string, idempotencyKey: string) {
  return `pack-trade:${sha256PortableBasis(`${listingId}|${buyerActorId}|${idempotencyKey}`).slice(7, 39)}`;
}
export function emptyResourcePackageMarketState(): ResourcePackageMarketState {
  return { schema: "wildz.resource-package-market.v1", revision: 0, appendAnchorId: null, listings: {}, trades: {} };
}
function validListing(value: unknown): value is ResourcePackageMarketListing {
  return record(value) && value.schema === "wildz.resource-package-listing.v1"
    && text(value.id) && verifyWildsResourcePackage(value.package)
    && value.packageId === value.package.packageId && value.packageHead === value.package.head
    && text(value.subjectId) && text(value.sellerActorId) && text(value.sellerHandle) && text(value.sellerReceizUserId)
    && validPackageMarketPrice(value.priceCents) && value.currency === "USD"
    && ["active", "reserved", "sold", "cancelled"].includes(String(value.status))
    && text(value.sealedOffer, 2_000_000) && text(value.idempotencyKey, 160) && iso(value.createdAt);
}
function validPayment(value: unknown): value is ResourcePackageMarketPayment {
  return record(value) && text(value.transferId) && text(value.ledgerEventId) && record(value.proofBundle) && Object.keys(value.proofBundle).length > 0;
}
function validTrade(value: unknown): value is ResourcePackageMarketTrade {
  return record(value) && value.schema === "wildz.resource-package-trade.v1"
    && text(value.id) && text(value.listingId) && text(value.packageId)
    && text(value.buyerActorId) && text(value.buyerHandle) && text(value.buyerReceizUserId)
    && ["reserved", "paying", "paid", "settled", "released"].includes(String(value.status))
    && text(value.idempotencyKey, 160) && iso(value.createdAt) && iso(value.expiresAt)
    && value.expiresAt === new Date(Date.parse(value.createdAt) + RESOURCE_PACKAGE_MARKET_RESERVATION_MS).toISOString()
    && ((value.status === "paid" || value.status === "settled") ? validPayment(value.payment) : value.payment === undefined)
    && (value.status === "settled" ? record(value.custodyReceipt) : value.custodyReceipt === undefined);
}
function receiptMatches(listing: ResourcePackageMarketListing, trade: ResourcePackageMarketTrade, value: unknown): value is ReceizBearerTransferReceiptV1 {
  return record(value) && value.schema === "receiz.bearer.transfer_receipt.v1"
    && text(value.receiptId) && text(value.transferId) && value.subjectId === listing.subjectId
    && value.priorOwnerReceizId === listing.sellerReceizUserId && value.nextOwnerReceizId === trade.buyerReceizUserId
    && text(value.instrumentDigest) && text(value.nextSubjectHead) && text(value.nextOwnershipHead);
}
export function restoreResourcePackageMarketState(value: unknown): ResourcePackageMarketState | null {
  if (!record(value) || value.schema !== "wildz.resource-package-market.v1" || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0
    || (value.appendAnchorId !== null && !text(value.appendAnchorId)) || !record(value.listings) || !record(value.trades)
    || Object.keys(value.listings).length > 5_000 || Object.keys(value.trades).length > 5_000) return null;
  if (Object.entries(value.listings).some(([id, listing]) => !validListing(listing) || id !== listing.id)
    || Object.entries(value.trades).some(([id, trade]) => !validTrade(trade) || id !== trade.id)) return null;
  const state = value as ResourcePackageMarketState;
  for (const trade of Object.values(state.trades)) {
    const listing = state.listings[trade.listingId];
    if (!listing || listing.packageId !== trade.packageId || listing.sellerActorId === trade.buyerActorId || listing.sellerReceizUserId === trade.buyerReceizUserId
      || (trade.status === "settled" ? listing.status !== "sold" || !receiptMatches(listing, trade, trade.custodyReceipt) : trade.status !== "released" && listing.status !== "reserved")) return null;
  }
  const livePackageIds = new Set<string>();
  for (const listing of Object.values(state.listings)) {
    if (listing.status === "active" || listing.status === "reserved") {
      if (livePackageIds.has(listing.packageId)) return null;
      livePackageIds.add(listing.packageId);
    }
    const trades = Object.values(state.trades).filter((trade) => trade.listingId === listing.id && trade.status !== "released");
    if ((listing.status === "reserved" || listing.status === "sold") ? trades.length !== 1 : trades.length !== 0) return null;
  }
  return state;
}
export function packageMarketReservation(state: ResourcePackageMarketState, listingId: string) {
  return Object.values(state.trades).find((trade) => trade.listingId === listingId && trade.status !== "released") ?? null;
}
export function resourcePackageListingAvailable(state: ResourcePackageMarketState, listing: ResourcePackageMarketListing, observedAt: string) {
  if (!iso(observedAt)) throw new Error("package_market_time_invalid");
  const trade = packageMarketReservation(state, listing.id);
  return listing.status === "active" || (listing.status === "reserved" && trade?.status === "reserved" && Date.parse(trade.expiresAt) <= Date.parse(observedAt));
}
export function advanceResourcePackageMarketState(state: ResourcePackageMarketState, event: ResourcePackageMarketEvent, occurredAt: string): ResourcePackageMarketState {
  if (!restoreResourcePackageMarketState(state) || !iso(occurredAt)) throw new Error("package_market_state_invalid");
  const next: ResourcePackageMarketState = { ...state, revision: state.revision + 1, listings: { ...state.listings }, trades: { ...state.trades } };
  if (event.type === "listed") {
    const listing = event.listing;
    if (!validListing(listing) || listing.status !== "active" || listing.createdAt !== occurredAt) throw new Error("package_market_listing_invalid");
    if (state.listings[listing.id] || Object.values(state.listings).some((item) => item.packageId === listing.packageId && ["active", "reserved"].includes(item.status))) throw new Error("package_market_already_listed");
    if (Object.keys(state.listings).length >= 5_000) throw new Error("package_market_listing_limit");
    next.listings[listing.id] = listing;
  } else if (event.type === "cancelled") {
    const listing = state.listings[event.listingId];
    if (!listing || listing.sellerActorId !== event.actorId) throw new Error("package_market_seller_required");
    if (!resourcePackageListingAvailable(state, listing, occurredAt)) throw new Error("package_market_listing_busy");
    next.listings[listing.id] = { ...listing, status: "cancelled" };
    const prior = packageMarketReservation(state, listing.id);
    if (prior) delete next.trades[prior.id];
  } else if (event.type === "reserved") {
    const trade = event.trade;
    const listing = state.listings[trade.listingId];
    if (!validTrade(trade) || trade.status !== "reserved" || trade.createdAt !== occurredAt || !listing || listing.packageId !== trade.packageId) throw new Error("package_market_trade_invalid");
    if (listing.sellerActorId === trade.buyerActorId) throw new Error("package_market_self_trade_invalid");
    if (!resourcePackageListingAvailable(state, listing, occurredAt)) throw new Error("package_market_listing_busy");
    if (Object.values(state.trades).filter((item) => item.buyerActorId === trade.buyerActorId && item.status !== "settled" && item.status !== "released" && (item.status !== "reserved" || Date.parse(item.expiresAt) > Date.parse(occurredAt))).length >= 3) throw new Error("package_market_reservation_limit");
    const prior = packageMarketReservation(state, listing.id);
    if (prior) delete next.trades[prior.id];
    next.listings[listing.id] = { ...listing, status: "reserved" };
    next.trades[trade.id] = trade;
  } else {
    const trade = state.trades[event.tradeId];
    const listing = trade && state.listings[trade.listingId];
    if (!trade || !listing || listing.status !== "reserved") throw new Error("package_market_trade_not_reserved");
    if (event.type === "released") {
      if (trade.buyerActorId !== event.actorId || trade.status !== "reserved") throw new Error("package_market_release_invalid");
      // Keep exact authority for retrying source cleanup after this registry CAS.
      next.trades[trade.id] = { ...trade, status: "released" }; next.listings[listing.id] = { ...listing, status: "active" };
    } else if (event.type === "payment-started") {
      if (trade.buyerActorId !== event.actorId || trade.status !== "reserved" || Date.parse(trade.expiresAt) <= Date.parse(occurredAt)) throw new Error("package_market_reservation_expired");
      next.trades[trade.id] = { ...trade, status: "paying" };
    } else if (event.type === "paid") {
      if (trade.status !== "paying" || !validPayment(event.payment)) throw new Error("package_market_payment_invalid");
      next.trades[trade.id] = { ...trade, status: "paid", payment: event.payment };
    } else {
      if (trade.status !== "paid" || !receiptMatches(listing, trade, event.receipt)) throw new Error("package_market_custody_receipt_invalid");
      next.trades[trade.id] = { ...trade, status: "settled", custodyReceipt: event.receipt };
      next.listings[listing.id] = { ...listing, status: "sold" };
    }
  }
  if (!restoreResourcePackageMarketState(next)) throw new Error("package_market_successor_invalid");
  return next;
}
export function publicResourcePackageListing(listing: ResourcePackageMarketListing) {
  const counts = new Map<string, number>();
  for (const member of listing.package.members) {
    const label = member.kind === "material" ? member.materialLot.kind : member.kind === "resource" ? member.resourceLot.kind : member.foodItem.foodKind;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { schema: listing.schema, id: listing.id, packageId: listing.packageId, packageHead: listing.packageHead, sellerActorId: listing.sellerActorId, sellerHandle: listing.sellerHandle, priceCents: listing.priceCents, currency: listing.currency, status: listing.status, createdAt: listing.createdAt, contents: Array.from(counts, ([kind, quantity]) => ({ kind, quantity })) };
}
export type PublicResourcePackageListing = ReturnType<typeof publicResourcePackageListing>;
