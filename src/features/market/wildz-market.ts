import type { JsonObject } from "@receiz/sdk";
import {
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "../play/portable-card";
import type { WildzCookieActor } from "../../lib/receiz/wildz-cookie-actor";
import {
  currentWildzOwner,
  wildzTradeExpiresAt,
  type WildzMarketState
} from "../../lib/receiz/wildz-market-state";

export type WildzListing = {
  schema: "wildz.listing.v2";
  id: string;
  asset: PortableCardAsset;
  assetId: string;
  proofDigest: string;
  sellerActorId: string;
  sellerReceizUserId: string;
  priceCents: number;
  currency: "USD";
  status: "active" | "reserved" | "sold" | "cancelled";
  idempotencyKey: string;
  createdAt: string;
  /** Temporary presentation alias; never accepted as seller authority. */
  seller?: string;
  /** Temporary presentation hint; repository heads remain the only revision authority. */
  revision?: number;
};

export type WildzTradePlan = {
  schema: "wildz.trade_plan.v2";
  id: string;
  listingId: string;
  assetId: string;
  sellerActorId: string;
  buyerActorId: string;
  priceCents: number;
  currency: "USD";
  idempotencyKey: string;
  createdAt: string;
  /** Server-derived reservation deadline. Legacy records derive this from createdAt. */
  expiresAt?: string;
};

export type WildzOwnershipReceipt = {
  schema: "receiz.wilds_ownership_receipt.v1";
  assetId: string;
  proofDigest: string;
  previousOwnerReceizId: string;
  ownerReceizId: string;
  transferId: string;
  ledgerEventId: string;
  proofBundle: JsonObject;
  transferredAt: string;
};

export type WildzMarketReceipt = {
  schema: "wildz.market_receipt.v2";
  tradeId: string;
  status:
    | "pending_payment"
    | "settled"
    | "payment_failed"
    | "market_capability_unavailable"
    | "recovery_pending";
  transferId: string | null;
  ledgerEventId: string | null;
  ownershipTransferred: boolean;
  nextOwnerReceizId: string | null;
};

export type WildzMarketEvent =
  | { type: "listing-admitted"; listing: WildzListing }
  | { type: "listing-cancelled"; listingId: string; actorId: string }
  | { type: "trade-admitted"; trade: WildzTradePlan }
  | { type: "trade-released"; tradeId: string; actorId: string; reason: "buyer_cancelled" | "reservation_expired" }
  | { type: "settlement-admitted"; tradeId: string; receipt: WildzOwnershipReceipt };

export type WildzMarketHead = {
  revision: number;
  appendAnchorId: string | null;
};

export type AdmitWildzListingInput = {
  asset: PortableCardAsset;
  priceCents: number;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
  idempotencyKey: string;
};

export type AdmitWildzTradeInput = {
  listingId: string;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
  idempotencyKey: string;
};

export type CancelWildzListingInput = {
  listingId: string;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
  idempotencyKey: string;
};

export type ReleaseWildzTradeInput = {
  tradeId: string;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
  idempotencyKey: string;
};

function required(value: string, field: string, limit = 512) {
  const clean = value.trim();
  if (!clean || clean.length > limit) throw new Error(`market_${field}_required`);
  return clean;
}

function admittedIso(value: string) {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error("market_time_invalid");
  }
  return value;
}

export function createWildzListing(
  state: WildzMarketState,
  input: Pick<AdmitWildzListingInput, "asset" | "priceCents" | "idempotencyKey">,
  actor: WildzCookieActor,
  context: { occurredAt: string }
): WildzListing {
  if (!verifyAnyWildsCard(input.asset).ok) throw new Error("market_card_verification_required");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 50 || input.priceCents > 100_000_000) {
    throw new Error("market_price_invalid");
  }
  const sellerActorId = required(actor.actorId, "actor");
  if (currentWildzOwner(state, input.asset) !== sellerActorId) throw new Error("market_ownership_required");
  const sellerReceizUserId = required(actor.receizUserId, "seller_user");
  const idempotencyKey = required(input.idempotencyKey, "idempotency", 160);
  const createdAt = admittedIso(context.occurredAt);
  const basis = `${input.asset.id}|${input.asset.proof.digest}|${sellerActorId}|${idempotencyKey}`;
  return {
    schema: "wildz.listing.v2",
    id: `listing:${sha256PortableBasis(basis).slice(7, 39)}`,
    asset: input.asset,
    assetId: input.asset.id,
    proofDigest: input.asset.proof.digest,
    sellerActorId,
    sellerReceizUserId,
    priceCents: input.priceCents,
    currency: "USD",
    status: "active",
    idempotencyKey,
    createdAt,
    seller: sellerActorId,
    revision: state.revision + 1
  };
}

export function createWildzTrade(
  listing: WildzListing,
  input: Pick<AdmitWildzTradeInput, "idempotencyKey">,
  actor: WildzCookieActor,
  context: { occurredAt: string }
): WildzTradePlan {
  if (listing.status !== "active") throw new Error("market_listing_not_active");
  const buyerActorId = required(actor.actorId, "actor");
  if (buyerActorId === listing.sellerActorId) throw new Error("market_self_trade_invalid");
  const idempotencyKey = required(input.idempotencyKey, "idempotency", 160);
  const createdAt = admittedIso(context.occurredAt);
  const expiresAt = wildzTradeExpiresAt({ createdAt });
  const basis = `${listing.id}|${buyerActorId}|${idempotencyKey}`;
  return {
    schema: "wildz.trade_plan.v2",
    id: `trade:${sha256PortableBasis(basis).slice(7, 39)}`,
    listingId: listing.id,
    assetId: listing.assetId,
    sellerActorId: listing.sellerActorId,
    buyerActorId,
    priceCents: listing.priceCents,
    currency: listing.currency,
    idempotencyKey,
    createdAt,
    expiresAt
  };
}
