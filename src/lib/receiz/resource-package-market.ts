import { isReceizProofBundle, type ReceizBearerTransferReceiptV1 } from "@receiz/sdk";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { verifyWildsResourcePackage, type WildsResourcePackageV1 } from "../../features/play/wilds-resource-package";
import {
  RESOURCE_PACKAGE_MARKET_RESERVATION_MS,
  resourcePackageListingId,
  resourcePackageTradeId,
  validPackageMarketPrice,
  resourcePackageListingAvailable,
  type ResourcePackageMarketHead,
  type ResourcePackageMarketListing,
  type ResourcePackageMarketTrade
} from "../../features/market/resource-package-market";
import type { ReceizCommerceAdapter } from "./adapter";
import type { WildzCookieActor } from "./wildz-cookie-actor";
import {
  packageMarketHeadMatches,
  resourcePackageMarketHead,
  type ResourcePackageMarketAdmission,
  type ResourcePackageMarketRepository
} from "./resource-package-market-repository";
import { openResourcePackageMarketOffer, sealResourcePackageMarketOffer } from "./resource-package-market-seal";

/** Mutations implement native subject custody and the canonical world's locks.
 * The encrypted market projection never grants ownership by itself. */
export interface ResourcePackageMarketCustody {
  /** A projection is insufficient: all mutations require conditional native resource locks. */
  assertAvailable(): Promise<void>;
  list(input: { packageId: string; listingId: string; actor: WildzCookieActor }): Promise<{ package: WildsResourcePackageV1; subjectId: string; offer: unknown }>;
  reserve(input: { listing: ResourcePackageMarketListing; trade: ResourcePackageMarketTrade; actor: WildzCookieActor }): Promise<void>;
  startPayment(input: { listing: ResourcePackageMarketListing; trade: ResourcePackageMarketTrade; actor: WildzCookieActor; offer: unknown }): Promise<void>;
  claim(input: { listing: ResourcePackageMarketListing; trade: ResourcePackageMarketTrade; actor: WildzCookieActor; offer: unknown }): Promise<ReceizBearerTransferReceiptV1>;
  release(input: { listing: ResourcePackageMarketListing; trade?: ResourcePackageMarketTrade; actor: WildzCookieActor; offer: unknown }): Promise<void>;
}
type MarketInput = { expectedRevision: number; expectedAppendAnchorId: string | null; idempotencyKey: string };
function expected(input: MarketInput): ResourcePackageMarketHead { return { revision: input.expectedRevision, appendAnchorId: input.expectedAppendAnchorId }; }
function actorRequired(actor: WildzCookieActor) {
  if (!actor.accessToken || !actor.receizUserId || actor.receizUserId.startsWith("proof:")) throw new Error("receiz_authority_required");
}
function conflict(state: Parameters<typeof resourcePackageMarketHead>[0]): ResourcePackageMarketAdmission { return { status: "market_revision_conflict", head: resourcePackageMarketHead(state) }; }
export type ResourcePackageMarketCleanupResult = ResourcePackageMarketAdmission
  | { status: "recovery_pending"; head: ResourcePackageMarketHead; ownershipTransferred: false };
async function finishResourcePackageMarketCleanup(custody: ResourcePackageMarketCustody, input: Parameters<ResourcePackageMarketCustody["release"]>[0], admission: Extract<ResourcePackageMarketAdmission, { state: unknown }>): Promise<ResourcePackageMarketCleanupResult> {
  try { await custody.release(input); }
  catch { return { status: "recovery_pending", head: resourcePackageMarketHead(admission.state), ownershipTransferred: false }; }
  return admission;
}
export async function listResourcePackageForMarket(repository: ResourcePackageMarketRepository, custody: ResourcePackageMarketCustody, input: MarketInput & { packageId: string; priceCents: number }, actor: WildzCookieActor, occurredAt: string, secret?: string): Promise<ResourcePackageMarketAdmission> {
  actorRequired(actor);
  await custody.assertAvailable();
  if (!validPackageMarketPrice(input.priceCents)) throw new Error("package_market_price_invalid");
  const loaded = await repository.load(); if (loaded.status !== "ready") return loaded;
  const prior = Object.values(loaded.state.listings).find((listing) => listing.idempotencyKey === input.idempotencyKey);
  if (prior) {
    if (prior.packageId !== input.packageId || prior.priceCents !== input.priceCents || prior.sellerActorId !== actor.actorId) throw new Error("package_market_idempotency_conflict");
    return { status: "replayed", state: loaded.state };
  }
  if (!packageMarketHeadMatches(loaded.state, expected(input))) return conflict(loaded.state);
  const id = resourcePackageListingId(input.packageId, actor.actorId, input.idempotencyKey);
  const admitted = await custody.list({ packageId: input.packageId, listingId: id, actor });
  if (!verifyWildsResourcePackage(admitted.package) || admitted.package.packageId !== input.packageId) throw new Error("package_market_package_invalid");
  const listing: ResourcePackageMarketListing = { schema: "wildz.resource-package-listing.v1", id, package: admitted.package, packageId: input.packageId, packageHead: admitted.package.head, subjectId: admitted.subjectId, sellerActorId: actor.actorId, sellerHandle: actor.profileHandle, sellerReceizUserId: actor.receizUserId, priceCents: input.priceCents, currency: "USD", status: "active", sealedOffer: sealResourcePackageMarketOffer(admitted.offer, id, secret), idempotencyKey: input.idempotencyKey, createdAt: occurredAt };
  return repository.append({ current: loaded.state, event: { type: "listed", listing }, idempotencyKey: input.idempotencyKey, occurredAt });
}
export async function reserveResourcePackageMarketTrade(repository: ResourcePackageMarketRepository, custody: ResourcePackageMarketCustody, input: MarketInput & { listingId: string }, actor: WildzCookieActor, occurredAt: string): Promise<ResourcePackageMarketAdmission> {
  actorRequired(actor);
  await custody.assertAvailable();
  const loaded = await repository.load(); if (loaded.status !== "ready") return loaded;
  const prior = Object.values(loaded.state.trades).find((trade) => trade.idempotencyKey === input.idempotencyKey);
  if (prior) {
    if (prior.listingId !== input.listingId || prior.buyerActorId !== actor.actorId || prior.buyerReceizUserId !== actor.receizUserId) throw new Error("package_market_idempotency_conflict");
    return { status: "replayed", state: loaded.state };
  }
  if (!packageMarketHeadMatches(loaded.state, expected(input))) return conflict(loaded.state);
  const listing = loaded.state.listings[input.listingId];
  if (!listing || !resourcePackageListingAvailable(loaded.state, listing, occurredAt)) throw new Error("package_market_listing_busy");
  if (listing.sellerActorId === actor.actorId || listing.sellerReceizUserId === actor.receizUserId) throw new Error("package_market_self_trade_invalid");
  const trade: ResourcePackageMarketTrade = { schema: "wildz.resource-package-trade.v1", id: resourcePackageTradeId(listing.id, actor.actorId, input.idempotencyKey), listingId: listing.id, packageId: listing.packageId, buyerActorId: actor.actorId, buyerHandle: actor.profileHandle, buyerReceizUserId: actor.receizUserId, status: "reserved", idempotencyKey: input.idempotencyKey, createdAt: occurredAt, expiresAt: new Date(Date.parse(occurredAt) + RESOURCE_PACKAGE_MARKET_RESERVATION_MS).toISOString() };
  await custody.reserve({ listing, trade, actor });
  return repository.append({ current: loaded.state, event: { type: "reserved", trade }, idempotencyKey: input.idempotencyKey, occurredAt });
}
export async function cancelResourcePackageMarketListing(repository: ResourcePackageMarketRepository, custody: ResourcePackageMarketCustody, input: MarketInput & { listingId: string }, actor: WildzCookieActor, occurredAt: string, secret?: string): Promise<ResourcePackageMarketCleanupResult> {
  actorRequired(actor);
  await custody.assertAvailable();
  const loaded = await repository.load(); if (loaded.status !== "ready") return loaded;
  const listing = loaded.state.listings[input.listingId];
  if (!listing || listing.sellerActorId !== actor.actorId) throw new Error("package_market_seller_required");
  if (listing.status === "cancelled") {
    return finishResourcePackageMarketCleanup(custody, { listing, actor, offer: openResourcePackageMarketOffer(listing.sealedOffer, listing.id, secret) }, { status: "replayed", state: loaded.state });
  }
  if (!packageMarketHeadMatches(loaded.state, expected(input))) return conflict(loaded.state);
  if (!resourcePackageListingAvailable(loaded.state, listing, occurredAt)) throw new Error("package_market_listing_busy");
  const admission = await repository.append({ current: loaded.state, event: { type: "cancelled", listingId: listing.id, actorId: actor.actorId }, idempotencyKey: input.idempotencyKey, occurredAt });
  if (admission.status !== "admitted" && admission.status !== "replayed") return admission;
  const cancelled = admission.state.listings[listing.id]!;
  return finishResourcePackageMarketCleanup(custody, { listing: cancelled, actor, offer: openResourcePackageMarketOffer(cancelled.sealedOffer, cancelled.id, secret) }, admission);
}
export async function releaseResourcePackageMarketTrade(repository: ResourcePackageMarketRepository, custody: ResourcePackageMarketCustody, input: MarketInput & { tradeId: string }, actor: WildzCookieActor, occurredAt: string, secret?: string): Promise<ResourcePackageMarketCleanupResult> {
  actorRequired(actor);
  await custody.assertAvailable();
  const loaded = await repository.load(); if (loaded.status !== "ready") return loaded;
  const trade = loaded.state.trades[input.tradeId], listing = trade && loaded.state.listings[trade.listingId];
  if (!trade || !listing || trade.buyerActorId !== actor.actorId || trade.buyerReceizUserId !== actor.receizUserId || (trade.status !== "reserved" && trade.status !== "released")) throw new Error("package_market_release_invalid");
  if (trade.status === "released") {
    return finishResourcePackageMarketCleanup(custody, { listing, trade, actor, offer: openResourcePackageMarketOffer(listing.sealedOffer, listing.id, secret) }, { status: "replayed", state: loaded.state });
  }
  if (!packageMarketHeadMatches(loaded.state, expected(input))) return conflict(loaded.state);
  const admission = await repository.append({ current: loaded.state, event: { type: "released", tradeId: trade.id, actorId: actor.actorId }, idempotencyKey: input.idempotencyKey, occurredAt });
  if (admission.status !== "admitted" && admission.status !== "replayed") return admission;
  const released = admission.state.trades[trade.id]!, active = admission.state.listings[listing.id]!;
  return finishResourcePackageMarketCleanup(custody, { listing: active, trade: released, actor, offer: openResourcePackageMarketOffer(active.sealedOffer, active.id, secret) }, admission);
}
export type ResourcePackagePurchaseResult =
  | { status: "settled"; package: WildsResourcePackageV1; receipt: ReceizBearerTransferReceiptV1; payment: NonNullable<ResourcePackageMarketTrade["payment"]>; ownershipTransferred: true }
  | { status: "payment_failed" | "recovery_pending" | "reservation_expired" | "market_capability_unavailable" | "market_revision_conflict"; tradeId: string; ownershipTransferred: false; head?: ResourcePackageMarketHead };
/** One fixed-price payment nonce and one native aggregate claim survive retries. */
export async function purchaseResourcePackageMarketTrade(repository: ResourcePackageMarketRepository, rail: Pick<ReceizCommerceAdapter, "connectTransfer" | "walletLedger">, custody: ResourcePackageMarketCustody, input: { tradeId: string; expectedRevision: number; expectedAppendAnchorId: string | null }, actor: WildzCookieActor, occurredAt: string, secret?: string): Promise<ResourcePackagePurchaseResult> {
  actorRequired(actor);
  await custody.assertAvailable();
  const pending = (status: Exclude<ResourcePackagePurchaseResult["status"], "settled">, head?: ResourcePackageMarketHead): ResourcePackagePurchaseResult => ({ status, tradeId: input.tradeId, ownershipTransferred: false, ...(head ? { head } : {}) });
  let loaded = await repository.load(); if (loaded.status !== "ready") return pending("market_capability_unavailable");
  let trade = loaded.state.trades[input.tradeId];
  let listing = trade && loaded.state.listings[trade.listingId];
  if (!trade || !listing) throw new Error("package_market_trade_not_found");
  if (trade.buyerActorId !== actor.actorId || trade.buyerReceizUserId !== actor.receizUserId) throw new Error("package_market_buyer_required");
  const settled = () => trade.status === "settled" && trade.custodyReceipt && trade.payment ? { status: "settled" as const, package: listing.package, receipt: trade.custodyReceipt, payment: trade.payment, ownershipTransferred: true as const } : null;
  const prior = settled(); if (prior) return prior;
  const offer = openResourcePackageMarketOffer(listing.sealedOffer, listing.id, secret);
  if (trade.status === "reserved") {
    if (!packageMarketHeadMatches(loaded.state, { revision: input.expectedRevision, appendAnchorId: input.expectedAppendAnchorId })) return pending("market_revision_conflict", resourcePackageMarketHead(loaded.state));
    if (Date.parse(trade.expiresAt) <= Date.parse(occurredAt)) return pending("reservation_expired");
    const admission = await repository.append({ current: loaded.state, event: { type: "payment-started", tradeId: trade.id, actorId: actor.actorId }, idempotencyKey: `package-paying:${trade.id}`, occurredAt });
    if (admission.status !== "admitted" && admission.status !== "replayed") return pending(admission.status, admission.status === "market_revision_conflict" ? admission.head : undefined);
    loaded = { status: "ready", state: admission.state }; trade = loaded.state.trades[trade.id]!; listing = loaded.state.listings[trade.listingId]!;
  }
  if (trade.status === "paying") {
    // Persist the retryable market stage before making the source lock permanent.
    // Repeating this exact custody command repairs a failed/lost source append,
    // including after the original reservation deadline, before any wallet call.
    try { await custody.startPayment({ listing, trade, actor, offer }); }
    catch { return pending("recovery_pending", resourcePackageMarketHead(loaded.state)); }
    let transfer;
    try {
      const nonce = `wildz-package-transfer:${trade.id}`;
      transfer = await rail.connectTransfer({ recipientUserId: listing.sellerReceizUserId, unit: "usd", amountUsd: (listing.priceCents / 100).toFixed(2), note: `Wildz resource package ${listing.packageId}`, clientNonce: nonce }, nonce);
    } catch { return pending("recovery_pending", resourcePackageMarketHead(loaded.state)); }
    if (!transfer.ok || !transfer.transferId || !transfer.ledgerEventId || !isReceizProofBundle(transfer.proofBundle)) return pending("payment_failed", resourcePackageMarketHead(loaded.state));
    let ledger;
    try { ledger = await rail.walletLedger({ limit: 100 }); } catch { return pending("recovery_pending", resourcePackageMarketHead(loaded.state)); }
    const event = ledger.events.find((candidate) => candidate.id === transfer.ledgerEventId && candidate.kind === "transfer" && candidate.amountUsdCents === String(listing.priceCents) && isReceizProofBundle(candidate.proofBundle) && canonicalPortableCardJson(candidate.proofBundle) === canonicalPortableCardJson(transfer.proofBundle));
    if (!event || !isReceizProofBundle(event.proofBundle)) return pending("recovery_pending", resourcePackageMarketHead(loaded.state));
    const admission = await repository.append({ current: loaded.state, event: { type: "paid", tradeId: trade.id, payment: { transferId: transfer.transferId, ledgerEventId: transfer.ledgerEventId, proofBundle: event.proofBundle } }, idempotencyKey: `package-paid:${trade.id}`, occurredAt });
    if (admission.status !== "admitted" && admission.status !== "replayed") return pending("recovery_pending", admission.status === "market_revision_conflict" ? admission.head : resourcePackageMarketHead(loaded.state));
    loaded = { status: "ready", state: admission.state }; trade = loaded.state.trades[trade.id]!; listing = loaded.state.listings[trade.listingId]!;
  }
  if (trade.status !== "paid") return pending("recovery_pending", resourcePackageMarketHead(loaded.state));
  let receipt;
  try { receipt = await custody.claim({ listing, trade, actor, offer }); } catch { return pending("recovery_pending", resourcePackageMarketHead(loaded.state)); }
  const admission = await repository.append({ current: loaded.state, event: { type: "settled", tradeId: trade.id, receipt }, idempotencyKey: `package-settled:${trade.id}`, occurredAt });
  if (admission.status !== "admitted" && admission.status !== "replayed") return pending("recovery_pending", admission.status === "market_revision_conflict" ? admission.head : resourcePackageMarketHead(loaded.state));
  trade = admission.state.trades[trade.id]!; listing = admission.state.listings[trade.listingId]!;
  return settled() ?? pending("recovery_pending", resourcePackageMarketHead(admission.state));
}
