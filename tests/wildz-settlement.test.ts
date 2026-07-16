import assert from "node:assert/strict";
import { test } from "node:test";
import type { WildzListing, WildzTradePlan } from "../src/features/market/wildz-market";
import { initialPlayState } from "../src/features/play/game-state";
import { purchaseAdmittedWildzTrade } from "../src/lib/receiz/wildz-market-adapter";
import type { WildzMarketRepository } from "../src/lib/receiz/wildz-market-repository";
import { advanceWildzMarketState, emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";

test("a proven transfer retries ownership append with one stable idempotency key", async () => {
  const asset = initialPlayState.inventory[0]!;
  const sellerActorId = asset.manifest.ownerReceizId.replace(/^@+/, "").toLowerCase();
  const listing: WildzListing = {
    schema: "wildz.listing.v2",
    id: "listing:proof-test",
    asset,
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    sellerActorId,
    sellerReceizUserId: "usr_seller",
    priceCents: 500,
    currency: "USD",
    status: "active",
    idempotencyKey: "listing:proof-test",
    createdAt: "2026-07-15T12:00:00.000Z"
  };
  const trade: WildzTradePlan = {
    schema: "wildz.trade_plan.v2",
    id: "trade:proof-test",
    listingId: listing.id,
    assetId: asset.id,
    sellerActorId,
    buyerActorId: "buyer",
    priceCents: 500,
    currency: "USD",
    idempotencyKey: "trade:proof-test",
    createdAt: "2026-07-15T12:00:01.000Z"
  };
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: listing.createdAt });
  state = { ...state, appendAnchorId: "anchor:1" };
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: trade.createdAt });
  state = { ...state, appendAnchorId: "anchor:2" };
  let appendAttempts = 0;
  const repository: WildzMarketRepository = {
    load: async () => ({
      status: "ready",
      state,
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: state.revision,
        previousAppendAnchorId: "anchor:1",
        appendAnchorId: state.appendAnchorId,
        proofBundle: { schema: "receiz.append.proof.v1" }
      }
    }),
    compareAndAppend: async (input) => {
      appendAttempts += 1;
      if (appendAttempts === 1) return { status: "market_capability_unavailable" };
      const reduced = advanceWildzMarketState(input.current, input.event, { occurredAt: input.occurredAt });
      state = { ...reduced, appendAnchorId: "anchor:3" };
      return {
        status: "admitted",
        state,
        admissionProof: {
          schema: "receiz.wildz_market_admission.v1",
          admittedRevision: 3,
          previousAppendAnchorId: "anchor:2",
          appendAnchorId: "anchor:3",
          proofBundle: { schema: "receiz.append.proof.v1" }
        }
      };
    }
  };
  const transferKeys: string[] = [];
  const transferProof = {
    kind: "receiz.proof_bundle",
    payloadVersion: "v2",
    createdAtMs: 1781524800000,
    ts: "2026-07-15T12:00:00.000Z",
    code: "WILDZ-TRANSFER",
    slug: "wildz-transfer",
    verifyPath: "/v/wildz-transfer/WILDZ-TRANSFER/1",
    verifyUrl: "https://receiz.com/v/wildz-transfer/WILDZ-TRANSFER/1",
    kaiPulseEternal: "1",
    kaiKlok: "kai:1",
    receizClaimId: "a".repeat(32),
    sigilClaimSeed: "b".repeat(64)
  } as const;
  const receiz = {
    connectTransfer: async (_body: unknown, idempotencyKey?: string) => {
      transferKeys.push(idempotencyKey ?? "");
      return {
        ok: true,
        transferId: "tr_1",
        ledgerEventId: "ledger_1",
        proofBundle: transferProof
      };
    },
    walletLedger: async () => ({
      ok: true,
      cursor: null,
      since: null,
      nextCursor: null,
      events: [{
        id: "ledger_1",
        kind: "transfer",
        createdAt: "2026-07-15T12:00:02.000Z",
        amountUsdCents: "500",
        proofBundle: transferProof
      }]
    })
  };
  const input = { tradeId: trade.id, expectedRevision: 2, expectedAppendAnchorId: "anchor:2" };
  const actor = { actorId: "buyer", profileHandle: "@buyer", receizUserId: "usr_buyer", accessToken: "cookie" };

  const first = await purchaseAdmittedWildzTrade(repository, receiz as never, input, actor, { occurredAt: "2026-07-15T12:00:02.000Z" });
  const second = await purchaseAdmittedWildzTrade(repository, receiz as never, input, actor, { occurredAt: "2026-07-15T12:00:02.000Z" });
  const third = await purchaseAdmittedWildzTrade(repository, receiz as never, input, actor, { occurredAt: "2026-07-15T12:00:02.000Z" });

  assert.equal(first.status, "recovery_pending");
  if (first.status === "recovery_pending") {
    assert.deepEqual((first as typeof first & { head?: { revision: number; appendAnchorId: string | null } }).head, {
      revision: 2,
      appendAnchorId: "anchor:2"
    });
  }
  assert.equal(second.status, "settled");
  assert.equal(third.status, "settled");
  assert.deepEqual(transferKeys, [`wildz-transfer:${trade.id}`, `wildz-transfer:${trade.id}`]);
  assert.equal(asset.manifest.ownerReceizId, sellerActorId);
  assert.equal(state.ownership[asset.id]?.ownerReceizId, "buyer");
});

test("a proven paid settlement rebases onto a verified competing head in the same request", async () => {
  const asset = initialPlayState.inventory[0]!;
  const sellerActorId = asset.manifest.ownerReceizId.replace(/^@+/, "").toLowerCase();
  const listing: WildzListing = {
    schema: "wildz.listing.v2",
    id: "listing:cas-recovery",
    asset,
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    sellerActorId,
    sellerReceizUserId: "usr_seller",
    priceCents: 500,
    currency: "USD",
    status: "active",
    idempotencyKey: "listing:cas-recovery",
    createdAt: "2026-07-15T12:00:00.000Z"
  };
  const trade: WildzTradePlan = {
    schema: "wildz.trade_plan.v2",
    id: "trade:cas-recovery",
    listingId: listing.id,
    assetId: asset.id,
    sellerActorId,
    buyerActorId: "buyer",
    priceCents: 500,
    currency: "USD",
    idempotencyKey: "trade:cas-recovery",
    createdAt: "2026-07-15T12:00:01.000Z"
  };
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: listing.createdAt });
  state = { ...state, appendAnchorId: "anchor:1" };
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: trade.createdAt });
  state = { ...state, appendAnchorId: "anchor:2" };

  const appendHeads: Array<[number, string | null]> = [];
  const repository: WildzMarketRepository = {
    load: async () => ({
      status: "ready",
      state,
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: state.revision,
        previousAppendAnchorId: state.revision === 2 ? "anchor:1" : "anchor:2",
        appendAnchorId: state.appendAnchorId,
        proofBundle: { schema: "receiz.append.proof.v1" }
      }
    }),
    compareAndAppend: async (input) => {
      appendHeads.push([input.expectedRevision, input.expectedAppendAnchorId]);
      if (appendHeads.length === 1) {
        state = {
          ...state,
          revision: state.revision + 1,
          appendAnchorId: "anchor:3",
          updatedAt: "2026-07-15T12:00:02.500Z"
        };
        return {
          status: "market_revision_conflict",
          currentRevision: state.revision,
          currentAppendAnchorId: state.appendAnchorId
        };
      }
      const reduced = advanceWildzMarketState(input.current, input.event, { occurredAt: input.occurredAt });
      state = { ...reduced, appendAnchorId: "anchor:4" };
      return {
        status: "admitted",
        state,
        admissionProof: {
          schema: "receiz.wildz_market_admission.v1",
          admittedRevision: state.revision,
          previousAppendAnchorId: input.expectedAppendAnchorId,
          appendAnchorId: state.appendAnchorId,
          proofBundle: { schema: "receiz.append.proof.v1" }
        }
      };
    }
  };
  const transferProof = {
    kind: "receiz.proof_bundle",
    payloadVersion: "v2",
    createdAtMs: 1781524800000,
    ts: "2026-07-15T12:00:02.000Z",
    code: "WILDZ-TRANSFER-CAS",
    slug: "wildz-transfer-cas",
    verifyPath: "/v/wildz-transfer-cas/WILDZ-TRANSFER-CAS/1",
    verifyUrl: "https://receiz.com/v/wildz-transfer-cas/WILDZ-TRANSFER-CAS/1",
    kaiPulseEternal: "1",
    kaiKlok: "kai:1",
    receizClaimId: "c".repeat(32),
    sigilClaimSeed: "d".repeat(64)
  } as const;
  let transferCalls = 0;
  const receiz = {
    connectTransfer: async () => {
      transferCalls += 1;
      return { ok: true, transferId: "tr_cas", ledgerEventId: "ledger_cas", proofBundle: transferProof };
    },
    walletLedger: async () => ({
      ok: true,
      cursor: null,
      since: null,
      nextCursor: null,
      events: [{
        id: "ledger_cas",
        kind: "transfer",
        createdAt: "2026-07-15T12:00:02.000Z",
        amountUsdCents: "500",
        proofBundle: transferProof
      }]
    })
  };

  const result = await purchaseAdmittedWildzTrade(repository, receiz as never, {
    tradeId: trade.id,
    expectedRevision: 2,
    expectedAppendAnchorId: "anchor:2"
  }, {
    actorId: "buyer",
    profileHandle: "@buyer",
    receizUserId: "usr_buyer",
    accessToken: "cookie"
  }, { occurredAt: "2026-07-15T12:00:03.000Z" });

  assert.equal(result.status, "settled");
  assert.equal(transferCalls, 1);
  assert.deepEqual(appendHeads, [[2, "anchor:2"], [3, "anchor:3"]]);
});
