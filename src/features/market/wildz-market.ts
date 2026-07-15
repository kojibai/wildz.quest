import { sha256PortableBasis } from "../play/portable-card";

export type WildzListing = {
  schema: "wildz.listing.v1"; id: string; assetId: string; proofDigest: string; seller: string;
  priceCents: number; currency: "USD"; revision: number; status: "active" | "reserved" | "sold" | "cancelled";
  idempotencyKey: string; createdAt: string;
};
export type WildzTradePlan = {
  schema: "wildz.trade_plan.v1"; id: string; listingId: string; assetId: string; seller: string; buyer: string;
  priceCents: number; currency: "USD"; expectedRevision: number; idempotencyKey: string; ownershipTransferred: false;
};
export type WildzMarketReceipt = {
  schema: "wildz.market_receipt.v1"; tradeId: string; status: "settled" | "payment_failed" | "capability_unavailable" | "pending_payment";
  settlementId: string | null; ownershipTransferred: boolean; nextOwner: string | null;
};

const required = (value: string, field: string) => { const clean = value.trim(); if (!clean) throw new Error(`market_${field}_required`); return clean; };

export function createWildzListing(input: { actor: string; owner: string; assetId: string; proofDigest: string; priceCents: number; currency: "USD"; expectedRevision: number; idempotencyKey: string; now?: string }): WildzListing {
  if (required(input.actor, "actor") !== required(input.owner, "owner")) throw new Error("market_ownership_required");
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error("market_revision_invalid");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 50 || input.priceCents > 100_000_000) throw new Error("market_price_invalid");
  const basis = `${input.assetId}|${input.proofDigest}|${input.owner}|${input.idempotencyKey}`;
  return { schema: "wildz.listing.v1", id: `listing:${sha256PortableBasis(basis).slice(7, 31)}`, assetId: required(input.assetId, "asset"), proofDigest: required(input.proofDigest, "proof"), seller: input.owner, priceCents: input.priceCents, currency: input.currency, revision: input.expectedRevision + 1, status: "active", idempotencyKey: required(input.idempotencyKey, "idempotency"), createdAt: input.now ?? new Date().toISOString() };
}

export function planWildzTrade(input: { listing: WildzListing; buyer: string; expectedRevision: number; idempotencyKey: string }): WildzTradePlan {
  if (input.listing.status !== "active" || input.expectedRevision !== input.listing.revision) throw new Error("market_stale_listing");
  const buyer = required(input.buyer, "buyer"); if (buyer === input.listing.seller) throw new Error("market_self_trade_invalid");
  const idempotencyKey = required(input.idempotencyKey, "idempotency");
  return { schema: "wildz.trade_plan.v1", id: `trade:${sha256PortableBasis(`${input.listing.id}|${buyer}|${idempotencyKey}`).slice(7, 31)}`, listingId: input.listing.id, assetId: input.listing.assetId, seller: input.listing.seller, buyer, priceCents: input.listing.priceCents, currency: input.listing.currency, expectedRevision: input.expectedRevision, idempotencyKey, ownershipTransferred: false };
}

export function settleWildzPurchase(plan: WildzTradePlan, settlement: { admitted: boolean; settlementId: string | null; capabilityUnavailable?: boolean }): WildzMarketReceipt {
  const admitted = settlement.admitted && Boolean(settlement.settlementId);
  return { schema: "wildz.market_receipt.v1", tradeId: plan.id, status: admitted ? "settled" : settlement.capabilityUnavailable ? "capability_unavailable" : "payment_failed", settlementId: admitted ? settlement.settlementId : null, ownershipTransferred: admitted, nextOwner: admitted ? plan.buyer : null };
}
