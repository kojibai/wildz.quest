import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWildzTrade,
  type WildzListing,
  type WildzMarketEvent,
  type WildzOwnershipReceipt,
  type WildzTradePlan
} from "../src/features/market/wildz-market";
import { initialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { canonicalWildzActorId } from "../src/lib/receiz/wildz-identity-repository";
import {
  advanceWildzMarketState,
  currentWildzOwner,
  emptyWildzMarketState,
  restoreWildzMarketState
} from "../src/lib/receiz/wildz-market-state";
import * as wildzMarketState from "../src/lib/receiz/wildz-market-state";

const LISTED_AT = "2026-07-15T12:00:00.000Z";
const TRADED_AT = "2026-07-15T12:00:01.000Z";
const SETTLED_AT = "2026-07-15T12:00:02.000Z";

function fixtureListing(): WildzListing {
  const asset = initialPlayState.inventory[0]!;
  const sellerActorId = canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } });
  return {
    schema: "wildz.listing.v2",
    id: "listing:state-test",
    asset,
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    sellerActorId,
    sellerReceizUserId: "usr_seller",
    priceCents: 500,
    currency: "USD",
    status: "active",
    idempotencyKey: "listing:state-test",
    createdAt: LISTED_AT
  };
}

function fixtureTrade(listing: WildzListing): WildzTradePlan {
  return {
    schema: "wildz.trade_plan.v2",
    id: "trade:state-test",
    listingId: listing.id,
    assetId: listing.assetId,
    sellerActorId: listing.sellerActorId,
    buyerActorId: "buyer",
    priceCents: listing.priceCents,
    currency: listing.currency,
    idempotencyKey: "trade:state-test",
    createdAt: TRADED_AT
  };
}

test("market reduction uses admitted time and preserves the signed card byte-for-byte", () => {
  const listing = fixtureListing();
  const signedCard = JSON.stringify(listing.asset);

  const next = advanceWildzMarketState(
    emptyWildzMarketState(),
    { type: "listing-admitted", listing },
    { occurredAt: LISTED_AT }
  );

  assert.equal(next.revision, 1);
  assert.equal(next.updatedAt, LISTED_AT);
  assert.equal(JSON.stringify(next.listings[listing.id]?.asset), signedCard);
  assert.equal(currentWildzOwner(next, listing.asset), listing.sellerActorId);
  assert.throws(
    () => advanceWildzMarketState(next, { type: "listing-cancelled", listingId: listing.id, actorId: "buyer" }, { occurredAt: TRADED_AT }),
    /market_listing_seller_required/
  );
});

test("settlement records ownership separately without rewriting the immutable manifest owner", () => {
  const listing = fixtureListing();
  const trade = fixtureTrade(listing);
  const manifestOwner = listing.asset.manifest.ownerReceizId;
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: LISTED_AT });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: TRADED_AT });
  const ownership: WildzOwnershipReceipt = {
    schema: "receiz.wilds_ownership_receipt.v1",
    assetId: listing.assetId,
    proofDigest: listing.proofDigest,
    previousOwnerReceizId: listing.sellerActorId,
    ownerReceizId: trade.buyerActorId,
    transferId: "transfer:one",
    ledgerEventId: "ledger:one",
    proofBundle: { schema: "receiz.proof_bundle.v1" },
    transferredAt: SETTLED_AT
  };

  state = advanceWildzMarketState(
    state,
    { type: "settlement-admitted", tradeId: trade.id, receipt: ownership },
    { occurredAt: SETTLED_AT }
  );

  assert.equal(state.listings[listing.id]?.status, "sold");
  assert.equal(currentWildzOwner(state, listing.asset), trade.buyerActorId);
  assert.equal(state.ownership[listing.assetId]?.transferId, "transfer:one");
  assert.equal(listing.asset.manifest.ownerReceizId, manifestOwner);
  assert.equal(state.receipts.at(-1)?.ownershipTransferred, true);
});

test("market restoration fails closed for oversized or malformed authority", () => {
  assert.equal(restoreWildzMarketState({ ...emptyWildzMarketState(), revision: -1 }), null);
  assert.equal(restoreWildzMarketState({ ...emptyWildzMarketState(), updatedAt: "today" }), null);
  assert.throws(
    () => advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing: fixtureListing() }, { occurredAt: "today" }),
    /market_time_invalid/
  );
});

test("trade reservations receive one deterministic server-time expiry", () => {
  const listing = fixtureListing();
  const trade = createWildzTrade(listing, { idempotencyKey: "trade:ttl" }, {
    actorId: "buyer",
    profileHandle: "buyer.receiz.id",
    receizUserId: "usr_buyer",
    accessToken: "cookie"
  }, { occurredAt: TRADED_AT });

  assert.equal((trade as WildzTradePlan & { expiresAt?: string }).expiresAt, "2026-07-15T12:05:01.000Z");
});

test("an expired reservation is atomically replaced and the old trade binding is removed", () => {
  const listing = fixtureListing();
  const firstTrade = createWildzTrade(listing, { idempotencyKey: "trade:first" }, {
    actorId: "first-buyer",
    profileHandle: "first-buyer.receiz.id",
    receizUserId: "usr_first_buyer",
    accessToken: "cookie"
  }, { occurredAt: TRADED_AT });
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: LISTED_AT });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade: firstTrade }, { occurredAt: TRADED_AT });
  const secondTrade = createWildzTrade(listing, { idempotencyKey: "trade:second" }, {
    actorId: "second-buyer",
    profileHandle: "second-buyer.receiz.id",
    receizUserId: "usr_second_buyer",
    accessToken: "cookie"
  }, { occurredAt: "2026-07-15T12:05:01.000Z" });

  state = advanceWildzMarketState(state, { type: "trade-admitted", trade: secondTrade }, {
    occurredAt: secondTrade.createdAt
  });

  assert.equal(state.listings[listing.id]?.status, "reserved");
  assert.equal(state.trades[firstTrade.id], undefined);
  assert.equal(state.trades[secondTrade.id]?.buyerActorId, "second-buyer");
});

test("only the reserving buyer can release a live reservation", () => {
  const listing = fixtureListing();
  const trade = createWildzTrade(listing, { idempotencyKey: "trade:release" }, {
    actorId: "buyer",
    profileHandle: "buyer.receiz.id",
    receizUserId: "usr_buyer",
    accessToken: "cookie"
  }, { occurredAt: TRADED_AT });
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: LISTED_AT });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: TRADED_AT });
  const release = (actorId: string): WildzMarketEvent => ({
    type: "trade-released",
    tradeId: trade.id,
    actorId,
    reason: "buyer_cancelled"
  } as unknown as WildzMarketEvent);

  assert.throws(() => advanceWildzMarketState(state, release("attacker"), {
    occurredAt: "2026-07-15T12:00:02.000Z"
  }), /market_trade_buyer_required/);
  state = advanceWildzMarketState(state, release("buyer"), {
    occurredAt: "2026-07-15T12:00:02.000Z"
  });

  assert.equal(state.listings[listing.id]?.status, "active");
  assert.equal(state.trades[trade.id], undefined);
});

test("an expired reservation is discoverable without rewriting its admitted state", () => {
  const listing = fixtureListing();
  const trade = createWildzTrade(listing, { idempotencyKey: "trade:discoverable" }, {
    actorId: "buyer",
    profileHandle: "buyer.receiz.id",
    receizUserId: "usr_buyer",
    accessToken: "cookie"
  }, { occurredAt: TRADED_AT });
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: LISTED_AT });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: TRADED_AT });
  const available = (wildzMarketState as unknown as {
    isWildzListingAvailableAt?: (
      state: ReturnType<typeof emptyWildzMarketState>,
      listing: WildzListing,
      observedAt: string
    ) => boolean;
  }).isWildzListingAvailableAt;

  assert.equal(typeof available, "function");
  if (!available) return;
  assert.equal(available(state, state.listings[listing.id]!, "2026-07-15T12:05:00.999Z"), false);
  assert.equal(available(state, state.listings[listing.id]!, "2026-07-15T12:05:01.000Z"), true);
  assert.equal(state.listings[listing.id]?.status, "reserved");
});

test("one buyer can hold at most three live reservations and expired leases no longer count", () => {
  const baseAsset = initialPlayState.inventory[0]!;
  const assets = Array.from({ length: 4 }, (_, index) => sealCollectedCard({
    formId: baseAsset.manifest.formId,
    ownerReceizId: baseAsset.manifest.ownerReceizId,
    encounterId: `buyer-cap-${index}`,
    capturedAt: `2026-07-15T11:59:0${index}.000Z`
  }));
  const listings = assets.map((asset, index): WildzListing => ({
    schema: "wildz.listing.v2",
    id: `listing:buyer-cap:${index}`,
    asset,
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    sellerActorId: asset.manifest.ownerReceizId.replace(/^@+/, "").toLowerCase(),
    sellerReceizUserId: "usr_seller",
    priceCents: 500,
    currency: "USD",
    status: "active",
    idempotencyKey: `listing:buyer-cap:${index}`,
    createdAt: LISTED_AT
  }));
  assert.equal(listings.length, 4);
  let state = emptyWildzMarketState();
  for (const listing of listings) {
    state = advanceWildzMarketState(state, { type: "listing-admitted", listing }, { occurredAt: LISTED_AT });
  }
  const buyer = {
    actorId: "reservation-buyer",
    profileHandle: "reservation-buyer.receiz.id",
    receizUserId: "usr_reservation_buyer",
    accessToken: "cookie"
  };
  for (let index = 0; index < 3; index += 1) {
    const createdAt = `2026-07-15T12:00:0${index + 1}.000Z`;
    const trade = createWildzTrade(listings[index]!, { idempotencyKey: `trade:buyer-cap:${index}` }, buyer, {
      occurredAt: createdAt
    });
    state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: createdAt });
  }
  const fourth = createWildzTrade(listings[3]!, { idempotencyKey: "trade:buyer-cap:3" }, buyer, {
    occurredAt: "2026-07-15T12:00:04.000Z"
  });
  assert.throws(() => advanceWildzMarketState(state, { type: "trade-admitted", trade: fourth }, {
    occurredAt: fourth.createdAt
  }), /market_trade_reservation_limit/);

  const afterExpiry = createWildzTrade(listings[3]!, { idempotencyKey: "trade:buyer-cap:after-expiry" }, buyer, {
    occurredAt: "2026-07-15T12:05:01.000Z"
  });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade: afterExpiry }, {
    occurredAt: afterExpiry.createdAt
  });
  assert.equal(state.trades[afterExpiry.id]?.buyerActorId, buyer.actorId);
});
