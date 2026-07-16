import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzListing, createWildzTrade } from "../src/features/market/wildz-market";
import { initialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import {
  admitWildzListing,
  admitWildzTrade,
  cancelWildzListing
} from "../src/lib/receiz/wildz-market-adapter";
import {
  wildzCookieActorFromReceizProfile,
  type WildzCookieActor
} from "../src/lib/receiz/wildz-cookie-actor";
import type { WildzMarketRepository } from "../src/lib/receiz/wildz-market-repository";
import { advanceWildzMarketState, emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";

const seller: WildzCookieActor = {
  actorId: "wilds.player.receiz.id",
  profileHandle: "@wilds.player.receiz.id",
  receizUserId: "usr_seller",
  accessToken: "cookie"
};
const buyer: WildzCookieActor = {
  actorId: "buyer.receiz.id",
  profileHandle: "@buyer.receiz.id",
  receizUserId: "usr_buyer",
  accessToken: "cookie"
};

test("cookie profile, Vault owner, and market owner share one Receiz player coordinate", () => {
  const actor = wildzCookieActorFromReceizProfile({
    id: "usr_vault_keeper",
    handle: "vault_keeper.receiz.id"
  }, "cookie-token");
  assert.deepEqual(actor, {
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    receizUserId: "usr_vault_keeper",
    accessToken: "cookie-token"
  });
  const asset = sealCollectedCard({
    formId: initialPlayState.inventory[0]!.manifest.formId,
    ownerReceizId: "vault_keeper.receiz.id",
    encounterId: "market-coordinate-regression",
    capturedAt: "2026-07-15T11:59:00.000Z"
  });
  const listing = createWildzListing(emptyWildzMarketState(), {
    asset,
    priceCents: 500,
    idempotencyKey: "list:coordinate"
  }, actor, { occurredAt: "2026-07-15T12:00:00.000Z" });
  assert.equal(listing.sellerActorId, "vault_keeper");
});

test("listing creation requires a verified full card owned by the cookie actor", () => {
  const asset = initialPlayState.inventory[0]!;
  assert.throws(() => createWildzListing(emptyWildzMarketState(), {
    asset,
    priceCents: 500,
    idempotencyKey: "list:one"
  }, { ...seller, actorId: "not-the-owner" }, {
    occurredAt: "2026-07-15T12:00:00.000Z"
  }), /market_ownership_required/);

  const listing = createWildzListing(emptyWildzMarketState(), {
    asset,
    priceCents: 500,
    idempotencyKey: "list:one"
  }, seller, {
    occurredAt: "2026-07-15T12:00:00.000Z"
  });
  assert.equal(listing.asset, asset);
  assert.equal(listing.sellerReceizUserId, seller.receizUserId);
  assert.equal(listing.asset.manifest.ownerReceizId, asset.manifest.ownerReceizId);
});

test("listing, trade, and cancellation coordinators preserve repository capability results", async () => {
  const state = emptyWildzMarketState();
  const unavailable: WildzMarketRepository = {
    load: async () => ({ status: "market_capability_unavailable" }),
    compareAndAppend: async () => ({ status: "market_capability_unavailable" })
  };
  const asset = initialPlayState.inventory[0]!;
  assert.deepEqual(await admitWildzListing(unavailable, {
    asset,
    priceCents: 500,
    expectedRevision: 0,
    expectedAppendAnchorId: null,
    idempotencyKey: "list:one"
  }, seller, { occurredAt: "2026-07-15T12:00:00.000Z" }), { status: "market_capability_unavailable" });

  const listing = createWildzListing(state, { asset, priceCents: 500, idempotencyKey: "list:one" }, seller, {
    occurredAt: "2026-07-15T12:00:00.000Z"
  });
  let admittedState = advanceWildzMarketState(state, { type: "listing-admitted", listing }, {
    occurredAt: listing.createdAt
  });
  admittedState = { ...admittedState, appendAnchorId: "anchor:1" };
  const admittedRepository: WildzMarketRepository = {
    load: async () => ({
      status: "ready",
      state: admittedState,
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: 1,
        previousAppendAnchorId: null,
        appendAnchorId: "anchor:1",
        proofBundle: { schema: "proof" }
      }
    }),
    compareAndAppend: async (input) => ({
      status: "admitted",
      state: advanceWildzMarketState(input.current, input.event, { occurredAt: input.occurredAt }),
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: 2,
        previousAppendAnchorId: "anchor:1",
        appendAnchorId: "anchor:2",
        proofBundle: { schema: "proof" }
      }
    })
  };
  const trade = await admitWildzTrade(admittedRepository, {
    listingId: listing.id,
    expectedRevision: 1,
    expectedAppendAnchorId: "anchor:1",
    idempotencyKey: "trade:one"
  }, buyer, { occurredAt: "2026-07-15T12:00:01.000Z" });
  assert.equal(trade.status, "admitted");
  if (trade.status === "admitted") {
    assert.equal(trade.state.trades[Object.keys(trade.state.trades)[0]!]?.priceCents, listing.priceCents);
    assert.equal(trade.state.trades[Object.keys(trade.state.trades)[0]!]?.buyerActorId, buyer.actorId);
  }

  await assert.rejects(() => cancelWildzListing(admittedRepository, {
    listingId: listing.id,
    expectedRevision: 1,
    expectedAppendAnchorId: "anchor:1",
    idempotencyKey: "cancel:one"
  }, buyer, { occurredAt: "2026-07-15T12:00:01.000Z" }), /market_listing_seller_required/);
});

test("an exact trade idempotency replay returns the admitted trade after the head advanced", async () => {
  const asset = initialPlayState.inventory[0]!;
  const listing = createWildzListing(emptyWildzMarketState(), {
    asset,
    priceCents: 500,
    idempotencyKey: "list:replay"
  }, seller, { occurredAt: "2026-07-15T12:00:00.000Z" });
  let state = advanceWildzMarketState(emptyWildzMarketState(), {
    type: "listing-admitted",
    listing
  }, { occurredAt: listing.createdAt });
  state = { ...state, appendAnchorId: "anchor:1" };
  const trade = createWildzTrade(listing, { idempotencyKey: "trade:replay" }, buyer, {
    occurredAt: "2026-07-15T12:00:01.000Z"
  });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, {
    occurredAt: trade.createdAt
  });
  state = { ...state, appendAnchorId: "anchor:2" };
  let appendCalls = 0;
  const repository: WildzMarketRepository = {
    load: async () => ({
      status: "ready",
      state,
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: 2,
        previousAppendAnchorId: "anchor:1",
        appendAnchorId: "anchor:2",
        proofBundle: { schema: "receiz.append.proof.v1" }
      }
    }),
    compareAndAppend: async () => {
      appendCalls += 1;
      return { status: "market_capability_unavailable" };
    }
  };

  const replay = await admitWildzTrade(repository, {
    listingId: listing.id,
    expectedRevision: 1,
    expectedAppendAnchorId: "anchor:1",
    idempotencyKey: trade.idempotencyKey
  }, buyer, { occurredAt: "2026-07-15T12:00:02.000Z" });

  assert.equal(replay.status, "replayed");
  if (replay.status === "replayed") {
    assert.equal(replay.state.trades[trade.id]?.id, trade.id);
    assert.equal(replay.state.revision, 2);
    assert.equal(replay.state.appendAnchorId, "anchor:2");
  }
  assert.equal(appendCalls, 0);
});

test("trade admission atomically replaces an expired server reservation", async () => {
  const asset = initialPlayState.inventory[0]!;
  const listing = createWildzListing(emptyWildzMarketState(), {
    asset,
    priceCents: 500,
    idempotencyKey: "list:expired-replace"
  }, seller, { occurredAt: "2026-07-15T12:00:00.000Z" });
  let state = advanceWildzMarketState(emptyWildzMarketState(), {
    type: "listing-admitted",
    listing
  }, { occurredAt: listing.createdAt });
  state = { ...state, appendAnchorId: "anchor:1" };
  const firstTrade = createWildzTrade(listing, { idempotencyKey: "trade:expired-first" }, buyer, {
    occurredAt: "2026-07-15T12:00:01.000Z"
  });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade: firstTrade }, {
    occurredAt: firstTrade.createdAt
  });
  state = { ...state, appendAnchorId: "anchor:2" };
  const secondBuyer: WildzCookieActor = {
    actorId: "second-buyer",
    profileHandle: "second-buyer.receiz.id",
    receizUserId: "usr_second_buyer",
    accessToken: "cookie"
  };
  const repository: WildzMarketRepository = {
    load: async () => ({
      status: "ready",
      state,
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: 2,
        previousAppendAnchorId: "anchor:1",
        appendAnchorId: "anchor:2",
        proofBundle: { schema: "proof" }
      }
    }),
    compareAndAppend: async (input) => ({
      status: "admitted",
      state: advanceWildzMarketState(input.current, input.event, { occurredAt: input.occurredAt }),
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: 3,
        previousAppendAnchorId: "anchor:2",
        appendAnchorId: "anchor:3",
        proofBundle: { schema: "proof" }
      }
    })
  };

  const admission = await admitWildzTrade(repository, {
    listingId: listing.id,
    expectedRevision: 2,
    expectedAppendAnchorId: "anchor:2",
    idempotencyKey: "trade:expired-second"
  }, secondBuyer, { occurredAt: "2026-07-15T12:05:01.000Z" });

  assert.equal(admission.status, "admitted");
  if (admission.status === "admitted") {
    assert.equal(admission.state.trades[firstTrade.id], undefined);
    assert.equal(Object.values(admission.state.trades)[0]?.buyerActorId, secondBuyer.actorId);
  }
});
