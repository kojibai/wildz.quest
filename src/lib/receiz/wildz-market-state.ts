import type { JsonObject } from "@receiz/sdk";
import {
  type WildzListing,
  type WildzMarketEvent,
  type WildzMarketReceipt,
  type WildzOwnershipReceipt,
  type WildzTradePlan
} from "../../features/market/wildz-market";
import { verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { canonicalWildzActorId } from "./wildz-identity-repository";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

const MAX_LISTINGS = 5_000;
const MAX_TRADES = 5_000;
const MAX_OWNERSHIP = 5_000;
const MAX_RECEIPTS = 2_048;
export const WILDZ_TRADE_RESERVATION_TTL_MS = 5 * 60 * 1_000;
export const WILDZ_MAX_LIVE_RESERVATIONS_PER_BUYER = 3;

export type WildzMarketState = {
  schema: "receiz.wildz_market_state.v1";
  revision: number;
  appendAnchorId: string | null;
  updatedAt: string;
  listings: Record<string, WildzListing>;
  trades: Record<string, WildzTradePlan>;
  ownership: Record<string, WildzOwnershipReceipt>;
  receipts: WildzMarketReceipt[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, limit = 512): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= limit && value.trim() === value;
}

function isIso(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function admittedIso(value: string) {
  if (!isIso(value)) throw new Error("market_time_invalid");
  return value;
}

export function wildzTradeExpiresAt(trade: { createdAt: string; expiresAt?: string }) {
  if (trade.expiresAt) return trade.expiresAt;
  if (!isIso(trade.createdAt)) throw new Error("market_trade_time_invalid");
  return new Date(Date.parse(trade.createdAt) + WILDZ_TRADE_RESERVATION_TTL_MS).toISOString();
}

export function isWildzTradeExpiredAt(trade: WildzTradePlan, observedAt: string) {
  return Date.parse(admittedIso(observedAt)) >= Date.parse(wildzTradeExpiresAt(trade));
}

export function currentWildzReservation(state: WildzMarketState, listingId: string) {
  const reservations = Object.values(state.trades).filter((trade) => trade.listingId === listingId);
  if (reservations.length > 1) throw new Error("market_listing_reservation_ambiguous");
  return reservations[0] ?? null;
}

export function isWildzListingAvailableAt(state: WildzMarketState, listing: WildzListing, observedAt: string) {
  if (listing.status === "active") return true;
  if (listing.status !== "reserved") return false;
  const reservation = currentWildzReservation(state, listing.id);
  return Boolean(reservation && isWildzTradeExpiredAt(reservation, observedAt));
}

function isProofBundle(value: unknown): value is JsonObject {
  return isRecord(value) && Object.keys(value).length > 0;
}

function isBearerClaimBundle(value: unknown) {
  return isRecord(value) && value.schema === "receiz.wilds_bearer_claim.v1";
}

function validListing(value: unknown): value is WildzListing {
  if (!isRecord(value) || value.schema !== "wildz.listing.v2") return false;
  if (!isRecord(value.asset)) return false;
  const asset = value.asset as PortableCardAsset;
  try {
    if (!verifyAnyWildsCard(asset).ok) return false;
  } catch {
    return false;
  }
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.assetId)
    && value.assetId === asset.id
    && isNonEmptyString(value.proofDigest)
    && value.proofDigest === asset.proof.digest
    && isNonEmptyString(value.sellerActorId)
    && isNonEmptyString(value.sellerReceizUserId)
    && Number.isInteger(value.priceCents)
    && Number(value.priceCents) >= 50
    && Number(value.priceCents) <= 100_000_000
    && value.currency === "USD"
    && ["active", "reserved", "sold", "cancelled"].includes(String(value.status))
    && isNonEmptyString(value.idempotencyKey, 160)
    && isIso(value.createdAt)
    && (value.seller === undefined || value.seller === value.sellerActorId)
    && (value.revision === undefined || (Number.isInteger(value.revision) && Number(value.revision) >= 1));
}

function validTrade(value: unknown): value is WildzTradePlan {
  if (!isRecord(value)) return false;
  const validBase = value.schema === "wildz.trade_plan.v2"
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.listingId)
    && isNonEmptyString(value.assetId)
    && isNonEmptyString(value.sellerActorId)
    && isNonEmptyString(value.buyerActorId)
    && value.sellerActorId !== value.buyerActorId
    && Number.isInteger(value.priceCents)
    && Number(value.priceCents) >= 50
    && Number(value.priceCents) <= 100_000_000
    && value.currency === "USD"
    && isNonEmptyString(value.idempotencyKey, 160)
    && isIso(value.createdAt);
  if (!validBase) return false;
  if (value.expiresAt === undefined) return true;
  return isIso(value.expiresAt)
    && value.expiresAt === new Date(Date.parse(value.createdAt as string) + WILDZ_TRADE_RESERVATION_TTL_MS).toISOString();
}

function validOwnership(value: unknown): value is WildzOwnershipReceipt {
  return isRecord(value)
    && value.schema === "receiz.wilds_ownership_receipt.v1"
    && isNonEmptyString(value.assetId)
    && isNonEmptyString(value.proofDigest)
    && isNonEmptyString(value.previousOwnerReceizId)
    && isNonEmptyString(value.ownerReceizId)
    && value.previousOwnerReceizId !== value.ownerReceizId
    && isNonEmptyString(value.transferId)
    && isNonEmptyString(value.ledgerEventId)
    && isProofBundle(value.proofBundle)
    && isIso(value.transferredAt);
}

function validMarketReceipt(value: unknown): value is WildzMarketReceipt {
  if (!isRecord(value) || value.schema !== "wildz.market_receipt.v2" || !isNonEmptyString(value.tradeId)) return false;
  if (!["pending_payment", "settled", "payment_failed", "market_capability_unavailable", "recovery_pending"].includes(String(value.status))) return false;
  if (value.transferId !== null && !isNonEmptyString(value.transferId)) return false;
  if (value.ledgerEventId !== null && !isNonEmptyString(value.ledgerEventId)) return false;
  if (typeof value.ownershipTransferred !== "boolean") return false;
  if (value.nextOwnerReceizId !== null && !isNonEmptyString(value.nextOwnerReceizId)) return false;
  return value.status !== "settled"
    || (value.ownershipTransferred === true
      && isNonEmptyString(value.transferId)
      && isNonEmptyString(value.ledgerEventId)
      && isNonEmptyString(value.nextOwnerReceizId));
}

export function emptyWildzMarketState(): WildzMarketState {
  return {
    schema: "receiz.wildz_market_state.v1",
    revision: 0,
    appendAnchorId: null,
    updatedAt: "1970-01-01T00:00:00.000Z",
    listings: {},
    trades: {},
    ownership: {},
    receipts: []
  };
}

export function restoreWildzMarketState(value: unknown): WildzMarketState | null {
  if (!isRecord(value)
    || value.schema !== "receiz.wildz_market_state.v1"
    || !Number.isInteger(value.revision)
    || Number(value.revision) < 0
    || (value.appendAnchorId !== null && !isNonEmptyString(value.appendAnchorId))
    || !isIso(value.updatedAt)
    || !isRecord(value.listings)
    || !isRecord(value.trades)
    || !isRecord(value.ownership)
    || !Array.isArray(value.receipts)) return null;

  const listingEntries = Object.entries(value.listings);
  const tradeEntries = Object.entries(value.trades);
  const ownershipEntries = Object.entries(value.ownership);
  if (listingEntries.length > MAX_LISTINGS
    || tradeEntries.length > MAX_TRADES
    || ownershipEntries.length > MAX_OWNERSHIP
    || value.receipts.length > MAX_RECEIPTS) return null;
  if (listingEntries.some(([key, listing]) => key !== (listing as { id?: unknown })?.id || !validListing(listing))) return null;
  if (tradeEntries.some(([key, trade]) => key !== (trade as { id?: unknown })?.id || !validTrade(trade))) return null;
  if (ownershipEntries.some(([key, receipt]) => key !== (receipt as { assetId?: unknown })?.assetId || !validOwnership(receipt))) return null;
  if (value.receipts.some((receipt) => !validMarketReceipt(receipt))) return null;

  const listings = Object.fromEntries(listingEntries) as Record<string, WildzListing>;
  const trades = Object.fromEntries(tradeEntries) as Record<string, WildzTradePlan>;
  const ownership = Object.fromEntries(ownershipEntries) as Record<string, WildzOwnershipReceipt>;
  for (const trade of Object.values(trades)) {
    const listing = listings[trade.listingId];
    if (!listing
      || trade.assetId !== listing.assetId
      || trade.sellerActorId !== listing.sellerActorId
      || trade.priceCents !== listing.priceCents
      || trade.currency !== listing.currency) return null;
  }
  for (const listing of Object.values(listings)) {
    const reservations = Object.values(trades).filter((trade) => trade.listingId === listing.id);
    if ((listing.status === "reserved" || listing.status === "sold") && reservations.length !== 1) return null;
    if ((listing.status === "active" || listing.status === "cancelled") && reservations.length !== 0) return null;
  }
  for (const receipt of Object.values(ownership)) {
    const listing = Object.values(listings).find((candidate) => candidate.assetId === receipt.assetId);
    if (listing) {
      if (listing.proofDigest !== receipt.proofDigest) return null;
    } else if (!isBearerClaimBundle(receipt.proofBundle)) {
      return null;
    }
  }

  return {
    schema: "receiz.wildz_market_state.v1",
    revision: Number(value.revision),
    appendAnchorId: value.appendAnchorId as string | null,
    updatedAt: value.updatedAt,
    listings,
    trades,
    ownership,
    receipts: [...value.receipts] as WildzMarketReceipt[]
  };
}

export function currentWildzOwner(state: WildzMarketState, asset: PortableCardAsset) {
  const receipt = state.ownership[asset.id];
  if (receipt) {
    if (receipt.proofDigest !== asset.proof.digest) throw new Error("market_ownership_proof_mismatch");
    return receipt.ownerReceizId;
  }
  const coordinate = parseWildzPlayerCoordinate(asset.manifest.ownerReceizId);
  if (coordinate) return coordinate.actorId;
  return canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } });
}

function nextBase(state: WildzMarketState, occurredAt: string) {
  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: admittedIso(occurredAt)
  };
}

export function advanceWildzMarketState(
  state: WildzMarketState,
  event: WildzMarketEvent,
  context: { occurredAt: string }
): WildzMarketState {
  if (state.schema !== "receiz.wildz_market_state.v1" || !Number.isInteger(state.revision) || state.revision < 0) {
    throw new Error("market_state_invalid");
  }
  const occurredAt = admittedIso(context.occurredAt);

  if (event.type === "listing-admitted") {
    const { listing } = event;
    if (!validListing(listing)) throw new Error("market_listing_invalid");
    if (listing.createdAt !== occurredAt) throw new Error("market_listing_time_mismatch");
    if (state.listings[listing.id]) throw new Error("market_listing_exists");
    if (Object.keys(state.listings).length >= MAX_LISTINGS) throw new Error("market_listing_limit");
    if (Object.values(state.listings).some((candidate) => candidate.assetId === listing.assetId && ["active", "reserved"].includes(candidate.status))) {
      throw new Error("market_asset_already_listed");
    }
    if (currentWildzOwner(state, listing.asset) !== listing.sellerActorId) throw new Error("market_ownership_required");
    return {
      ...nextBase(state, occurredAt),
      listings: { ...state.listings, [listing.id]: listing }
    };
  }

  if (event.type === "listing-cancelled") {
    const listing = state.listings[event.listingId];
    if (!listing) throw new Error("market_listing_not_active");
    if (listing.sellerActorId !== event.actorId) throw new Error("market_listing_seller_required");
    const reservation = currentWildzReservation(state, listing.id);
    if (listing.status !== "active"
      && !(listing.status === "reserved" && reservation && isWildzTradeExpiredAt(reservation, occurredAt))) {
      throw new Error("market_listing_not_active");
    }
    const trades = Object.fromEntries(
      Object.entries(state.trades).filter(([, trade]) => trade.listingId !== listing.id)
    );
    return {
      ...nextBase(state, occurredAt),
      listings: { ...state.listings, [listing.id]: { ...listing, status: "cancelled" } },
      trades
    };
  }

  if (event.type === "trade-admitted") {
    const { trade } = event;
    if (!validTrade(trade)) throw new Error("market_trade_invalid");
    if (trade.createdAt !== occurredAt) throw new Error("market_trade_time_mismatch");
    if (state.trades[trade.id]) throw new Error("market_trade_exists");
    const listing = state.listings[trade.listingId];
    if (!listing) throw new Error("market_listing_not_active");
    const reservation = currentWildzReservation(state, listing.id);
    if (listing.status !== "active"
      && !(listing.status === "reserved" && reservation && isWildzTradeExpiredAt(reservation, occurredAt))) {
      throw new Error("market_listing_not_active");
    }
    if (trade.assetId !== listing.assetId
      || trade.sellerActorId !== listing.sellerActorId
      || trade.priceCents !== listing.priceCents
      || trade.currency !== listing.currency) throw new Error("market_trade_listing_mismatch");
    const buyerLiveReservations = Object.values(state.trades).filter((candidate) => (
      candidate.buyerActorId === trade.buyerActorId
      && !isWildzTradeExpiredAt(candidate, occurredAt)
    ));
    if (buyerLiveReservations.length >= WILDZ_MAX_LIVE_RESERVATIONS_PER_BUYER) {
      throw new Error("market_trade_reservation_limit");
    }
    const retainedTrades = Object.fromEntries(
      Object.entries(state.trades).filter(([, candidate]) => candidate.listingId !== listing.id)
    );
    if (Object.keys(retainedTrades).length >= MAX_TRADES) throw new Error("market_trade_limit");
    return {
      ...nextBase(state, occurredAt),
      listings: { ...state.listings, [listing.id]: { ...listing, status: "reserved" } },
      trades: { ...retainedTrades, [trade.id]: trade }
    };
  }

  if (event.type === "trade-released") {
    const trade = state.trades[event.tradeId];
    if (!trade) throw new Error("market_trade_not_found");
    if (trade.buyerActorId !== event.actorId) throw new Error("market_trade_buyer_required");
    const listing = state.listings[trade.listingId];
    const reservation = listing ? currentWildzReservation(state, listing.id) : null;
    if (!listing || listing.status !== "reserved" || reservation?.id !== trade.id) {
      throw new Error("market_trade_not_reserved");
    }
    if (event.reason === "reservation_expired" && !isWildzTradeExpiredAt(trade, occurredAt)) {
      throw new Error("market_trade_not_expired");
    }
    const trades = { ...state.trades };
    delete trades[trade.id];
    return {
      ...nextBase(state, occurredAt),
      listings: { ...state.listings, [listing.id]: { ...listing, status: "active" } },
      trades
    };
  }

  if (event.type === "bearer-claim-admitted") {
    const { asset, receipt } = event;
    if (!isRecord(asset) || !verifyAnyWildsCard(asset as PortableCardAsset).ok) throw new Error("market_bearer_claim_card_invalid");
    if (!validOwnership(receipt)) throw new Error("market_ownership_receipt_invalid");
    if (!isBearerClaimBundle(receipt.proofBundle)) throw new Error("market_bearer_claim_proof_invalid");
    if (receipt.transferredAt !== occurredAt) throw new Error("market_bearer_claim_time_mismatch");
    if (receipt.assetId !== asset.id || receipt.proofDigest !== asset.proof.digest) throw new Error("market_bearer_claim_asset_mismatch");
    if (receipt.previousOwnerReceizId !== currentWildzOwner(state, asset)) throw new Error("market_bearer_claim_previous_owner_mismatch");
    if (!state.ownership[receipt.assetId] && Object.keys(state.ownership).length >= MAX_OWNERSHIP) throw new Error("market_ownership_limit");
    return {
      ...nextBase(state, occurredAt),
      ownership: { ...state.ownership, [receipt.assetId]: receipt }
    };
  }

  const trade = state.trades[event.tradeId];
  if (!trade) throw new Error("market_trade_not_found");
  const listing = state.listings[trade.listingId];
  const reservation = listing ? currentWildzReservation(state, listing.id) : null;
  if (!listing || listing.status !== "reserved" || reservation?.id !== trade.id) throw new Error("market_listing_not_reserved");
  if (isWildzTradeExpiredAt(trade, occurredAt)) throw new Error("market_trade_reservation_expired");
  const { receipt } = event;
  if (!validOwnership(receipt)) throw new Error("market_ownership_receipt_invalid");
  if (receipt.transferredAt !== occurredAt) throw new Error("market_settlement_time_mismatch");
  if (receipt.assetId !== listing.assetId || receipt.proofDigest !== listing.proofDigest) throw new Error("market_settlement_asset_mismatch");
  if (receipt.previousOwnerReceizId !== currentWildzOwner(state, listing.asset)) throw new Error("market_settlement_previous_owner_mismatch");
  if (receipt.ownerReceizId !== trade.buyerActorId) throw new Error("market_settlement_buyer_mismatch");
  if (!state.ownership[receipt.assetId] && Object.keys(state.ownership).length >= MAX_OWNERSHIP) throw new Error("market_ownership_limit");
  const publicReceipt: WildzMarketReceipt = {
    schema: "wildz.market_receipt.v2",
    tradeId: trade.id,
    status: "settled",
    transferId: receipt.transferId,
    ledgerEventId: receipt.ledgerEventId,
    ownershipTransferred: true,
    nextOwnerReceizId: receipt.ownerReceizId
  };
  return {
    ...nextBase(state, occurredAt),
    listings: { ...state.listings, [listing.id]: { ...listing, status: "sold" } },
    ownership: { ...state.ownership, [receipt.assetId]: receipt },
    receipts: [...state.receipts, publicReceipt].slice(-MAX_RECEIPTS)
  };
}
