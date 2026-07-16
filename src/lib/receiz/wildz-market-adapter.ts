import {
  isReceizProofBundle,
  type ConnectTransferResponse,
  type JsonObject
} from "@receiz/sdk";
import {
  createWildzListing,
  createWildzTrade,
  type AdmitWildzListingInput,
  type AdmitWildzTradeInput,
  type CancelWildzListingInput,
  type ReleaseWildzTradeInput,
  type WildzMarketReceipt,
  type WildzOwnershipReceipt
} from "../../features/market/wildz-market";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import type { ReceizCommerceAdapter } from "./adapter";
import type { WildzCookieActor } from "./wildz-cookie-actor";
import {
  type WildzMarketAdmission,
  type WildzMarketAdmissionProof,
  type WildzMarketRepository
} from "./wildz-market-repository";
import {
  currentWildzOwner,
  currentWildzReservation,
  isWildzListingAvailableAt,
  isWildzTradeExpiredAt
} from "./wildz-market-state";

function conflict(currentRevision: number, currentAppendAnchorId: string | null): WildzMarketAdmission {
  return { status: "market_revision_conflict", currentRevision, currentAppendAnchorId };
}

function headMatches(
  state: { revision: number; appendAnchorId: string | null },
  input: { expectedRevision: number; expectedAppendAnchorId: string | null }
) {
  return state.revision === input.expectedRevision
    && state.appendAnchorId === input.expectedAppendAnchorId;
}

export async function admitWildzListing(
  repository: WildzMarketRepository,
  input: AdmitWildzListingInput,
  actor: WildzCookieActor,
  context: { occurredAt: string }
) {
  const loaded = await repository.load();
  if (loaded.status !== "ready") return loaded;
  if (!headMatches(loaded.state, input)) return conflict(loaded.state.revision, loaded.state.appendAnchorId);
  const listing = createWildzListing(loaded.state, input, actor, context);
  return repository.compareAndAppend({
    current: loaded.state,
    expectedRevision: input.expectedRevision,
    expectedAppendAnchorId: input.expectedAppendAnchorId,
    idempotencyKey: input.idempotencyKey,
    occurredAt: context.occurredAt,
    event: { type: "listing-admitted", listing }
  });
}

export async function admitWildzTrade(
  repository: WildzMarketRepository,
  input: AdmitWildzTradeInput,
  actor: WildzCookieActor,
  context: { occurredAt: string }
) {
  const loaded = await repository.load();
  if (loaded.status !== "ready") return loaded;
  const priorTrades = Object.values(loaded.state.trades)
    .filter((candidate) => candidate.idempotencyKey === input.idempotencyKey);
  if (priorTrades.length > 1) throw new Error("market_trade_idempotency_ambiguous");
  const priorTrade = priorTrades[0];
  if (priorTrade) {
    if (priorTrade.listingId !== input.listingId || priorTrade.buyerActorId !== actor.actorId) {
      throw new Error("market_trade_idempotency_conflict");
    }
    return { status: "replayed" as const, state: loaded.state, admissionProof: loaded.admissionProof };
  }
  if (!headMatches(loaded.state, input)) return conflict(loaded.state.revision, loaded.state.appendAnchorId);
  const listing = loaded.state.listings[input.listingId];
  if (!listing) throw new Error("market_listing_not_found");
  if (!isWildzListingAvailableAt(loaded.state, listing, context.occurredAt)) {
    throw new Error("market_listing_not_active");
  }
  const trade = createWildzTrade(listing.status === "active" ? listing : {
    ...listing,
    status: "active"
  }, input, actor, context);
  return repository.compareAndAppend({
    current: loaded.state,
    expectedRevision: input.expectedRevision,
    expectedAppendAnchorId: input.expectedAppendAnchorId,
    idempotencyKey: input.idempotencyKey,
    occurredAt: context.occurredAt,
    event: { type: "trade-admitted", trade }
  });
}

export async function cancelWildzListing(
  repository: WildzMarketRepository,
  input: CancelWildzListingInput,
  actor: WildzCookieActor,
  context: { occurredAt: string }
) {
  const loaded = await repository.load();
  if (loaded.status !== "ready") return loaded;
  if (!headMatches(loaded.state, input)) return conflict(loaded.state.revision, loaded.state.appendAnchorId);
  const listing = loaded.state.listings[input.listingId];
  if (!listing) throw new Error("market_listing_not_found");
  if (listing.sellerActorId !== actor.actorId) throw new Error("market_listing_seller_required");
  return repository.compareAndAppend({
    current: loaded.state,
    expectedRevision: input.expectedRevision,
    expectedAppendAnchorId: input.expectedAppendAnchorId,
    idempotencyKey: input.idempotencyKey,
    occurredAt: context.occurredAt,
    event: { type: "listing-cancelled", listingId: listing.id, actorId: actor.actorId }
  });
}

export async function releaseWildzTrade(
  repository: WildzMarketRepository,
  input: ReleaseWildzTradeInput,
  actor: WildzCookieActor,
  context: { occurredAt: string }
) {
  const loaded = await repository.load();
  if (loaded.status !== "ready") return loaded;
  if (!headMatches(loaded.state, input)) return conflict(loaded.state.revision, loaded.state.appendAnchorId);
  const trade = loaded.state.trades[input.tradeId];
  if (!trade) throw new Error("market_trade_not_found");
  if (trade.buyerActorId !== actor.actorId) throw new Error("market_trade_buyer_required");
  return repository.compareAndAppend({
    current: loaded.state,
    expectedRevision: input.expectedRevision,
    expectedAppendAnchorId: input.expectedAppendAnchorId,
    idempotencyKey: input.idempotencyKey,
    occurredAt: context.occurredAt,
    event: {
      type: "trade-released",
      tradeId: trade.id,
      actorId: actor.actorId,
      reason: isWildzTradeExpiredAt(trade, context.occurredAt) ? "reservation_expired" : "buyer_cancelled"
    }
  });
}

export function isAdmittedConnectTransfer(value: unknown): value is ConnectTransferResponse & {
  ok: true;
  transferId: string;
  ledgerEventId: string;
  proofBundle: JsonObject;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const transfer = value as ConnectTransferResponse;
  return transfer.ok === true
    && typeof transfer.transferId === "string"
    && transfer.transferId.length > 0
    && typeof transfer.ledgerEventId === "string"
    && transfer.ledgerEventId.length > 0
    && isReceizProofBundle(transfer.proofBundle);
}

export type PurchaseWildzTradeInput = {
  tradeId: string;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
};

export type WildzPurchaseResult =
  | {
    status: "settled";
    receipt: WildzMarketReceipt;
    ownership: WildzOwnershipReceipt;
    admissionProof: WildzMarketAdmissionProof;
  }
  | {
    status: "recovery_pending";
    tradeId: string;
    transferId: string;
    head: { revision: number; appendAnchorId: string | null };
    ownershipTransferred: false;
  }
  | { status: "payment_failed"; tradeId: string; ownershipTransferred: false }
  | { status: "reservation_expired"; tradeId: string; ownershipTransferred: false }
  | { status: "market_capability_unavailable"; ownershipTransferred: false }
  | {
    status: "market_revision_conflict";
    currentRevision: number;
    currentAppendAnchorId: string | null;
    ownershipTransferred: false;
  };

type WildzSettlementReceiz = Pick<ReceizCommerceAdapter, "connectTransfer" | "walletLedger">;

function recoveryPending(
  tradeId: string,
  transferId: string,
  loaded: Awaited<ReturnType<WildzMarketRepository["load"]>> & { status: "ready" }
): WildzPurchaseResult {
  return {
    status: "recovery_pending",
    tradeId,
    transferId,
    head: {
      revision: loaded.state.revision,
      appendAnchorId: loaded.state.appendAnchorId
    },
    ownershipTransferred: false
  };
}

function settledResult(
  state: Awaited<ReturnType<WildzMarketRepository["load"]>> & { status: "ready" },
  tradeId: string
): WildzPurchaseResult | null {
  const trade = state.state.trades[tradeId];
  if (!trade) return null;
  const ownership = state.state.ownership[trade.assetId];
  const receipt = state.state.receipts.find((candidate) => candidate.tradeId === tradeId && candidate.status === "settled");
  if (!ownership
    || !receipt
    || receipt.transferId !== ownership.transferId
    || receipt.ledgerEventId !== ownership.ledgerEventId
    || receipt.nextOwnerReceizId !== ownership.ownerReceizId) return null;
  return { status: "settled", receipt, ownership, admissionProof: state.admissionProof };
}

export async function purchaseAdmittedWildzTrade(
  repository: WildzMarketRepository,
  receiz: WildzSettlementReceiz,
  input: PurchaseWildzTradeInput,
  actor: WildzCookieActor,
  context: { occurredAt: string }
): Promise<WildzPurchaseResult> {
  const loaded = await repository.load();
  if (loaded.status !== "ready") {
    return { status: "market_capability_unavailable", ownershipTransferred: false };
  }
  const trade = loaded.state.trades[input.tradeId];
  if (!trade) throw new Error("market_trade_not_found");
  if (trade.buyerActorId !== actor.actorId) throw new Error("market_trade_buyer_required");
  const alreadySettled = settledResult(loaded, input.tradeId);
  if (alreadySettled) return alreadySettled;
  const listing = loaded.state.listings[trade.listingId];
  const reservation = listing ? currentWildzReservation(loaded.state, listing.id) : null;
  if (!listing || listing.status !== "reserved" || reservation?.id !== trade.id) throw new Error("market_listing_not_reserved");
  if (isWildzTradeExpiredAt(trade, context.occurredAt)) {
    return { status: "reservation_expired", tradeId: trade.id, ownershipTransferred: false };
  }
  if (listing.assetId !== trade.assetId
    || listing.sellerActorId !== trade.sellerActorId
    || listing.priceCents !== trade.priceCents
    || listing.currency !== trade.currency) throw new Error("market_trade_listing_mismatch");

  const transferIdempotencyKey = `wildz-transfer:${trade.id}`;
  let transfer: ConnectTransferResponse;
  try {
    transfer = await receiz.connectTransfer({
      recipientUserId: listing.sellerReceizUserId,
      unit: "usd",
      amountUsd: (listing.priceCents / 100).toFixed(2),
      note: `Wildz card ${listing.assetId}`,
      clientNonce: transferIdempotencyKey
    }, transferIdempotencyKey);
  } catch {
    return { status: "payment_failed", tradeId: trade.id, ownershipTransferred: false };
  }
  if (!isAdmittedConnectTransfer(transfer)) {
    return { status: "payment_failed", tradeId: trade.id, ownershipTransferred: false };
  }

  let ledger;
  try {
    ledger = await receiz.walletLedger({ limit: 100 });
  } catch {
    return recoveryPending(trade.id, transfer.transferId, loaded);
  }
  const ledgerEvent = ledger.events.find((event) => event.id === transfer.ledgerEventId
    && event.kind === "transfer"
    && event.amountUsdCents === String(listing.priceCents)
    && isReceizProofBundle(event.proofBundle)
    && canonicalPortableCardJson(event.proofBundle) === canonicalPortableCardJson(transfer.proofBundle));
  if (!ledgerEvent || !isReceizProofBundle(ledgerEvent.proofBundle)) {
    return recoveryPending(trade.id, transfer.transferId, loaded);
  }

  let settlementHead = loaded;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const settled = settledResult(settlementHead, trade.id);
    if (settled) return settled;
    const currentTrade = settlementHead.state.trades[trade.id];
    const currentListing = currentTrade ? settlementHead.state.listings[currentTrade.listingId] : null;
    const currentReservation = currentListing
      ? currentWildzReservation(settlementHead.state, currentListing.id)
      : null;
    if (!currentTrade
      || currentTrade.buyerActorId !== actor.actorId
      || !currentListing
      || currentListing.status !== "reserved"
      || currentReservation?.id !== currentTrade.id
      || isWildzTradeExpiredAt(currentTrade, context.occurredAt)
      || currentListing.assetId !== trade.assetId
      || currentListing.sellerActorId !== trade.sellerActorId
      || currentListing.priceCents !== trade.priceCents
      || currentListing.currency !== trade.currency) {
      return recoveryPending(trade.id, transfer.transferId, settlementHead);
    }
    const ownership: WildzOwnershipReceipt = {
      schema: "receiz.wilds_ownership_receipt.v1",
      assetId: currentListing.assetId,
      proofDigest: currentListing.proofDigest,
      previousOwnerReceizId: currentWildzOwner(settlementHead.state, currentListing.asset),
      ownerReceizId: actor.actorId,
      transferId: transfer.transferId,
      ledgerEventId: transfer.ledgerEventId,
      proofBundle: ledgerEvent.proofBundle,
      transferredAt: context.occurredAt
    };
    const admission = await repository.compareAndAppend({
      current: settlementHead.state,
      expectedRevision: settlementHead.state.revision,
      expectedAppendAnchorId: settlementHead.state.appendAnchorId,
      idempotencyKey: transferIdempotencyKey,
      occurredAt: context.occurredAt,
      event: { type: "settlement-admitted", tradeId: trade.id, receipt: ownership }
    });
    if (admission.status === "admitted" || admission.status === "replayed") {
      const receipt = admission.state.receipts.find((candidate) => candidate.tradeId === trade.id && candidate.status === "settled");
      const admittedOwnership = admission.state.ownership[currentListing.assetId];
      if (!receipt || !admittedOwnership) throw new Error("market_settlement_admission_missing");
      return { status: "settled", receipt, ownership: admittedOwnership, admissionProof: admission.admissionProof };
    }
    if (admission.status !== "market_revision_conflict") break;
    const refreshed = await repository.load();
    if (refreshed.status !== "ready") break;
    settlementHead = refreshed;
  }
  return recoveryPending(trade.id, transfer.transferId, settlementHead);
}
