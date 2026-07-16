import assert from "node:assert/strict";
import { test } from "node:test";
import type { WildzListing, WildzOwnershipReceipt, WildzTradePlan } from "../src/features/market/wildz-market";
import { initialPlayState } from "../src/features/play/game-state";
import { canonicalWildzActorId } from "../src/lib/receiz/wildz-identity-repository";
import type { WildzMarketConditionalAppendRail } from "../src/lib/receiz/wildz-market-repository";
import { advanceWildzMarketState, emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";
import {
  loadVerifiedWildzPublicOwnershipAuthority,
  requireCurrentWildzPublicOwner
} from "../src/lib/receiz/wildz-public-ownership";

const LISTED_AT = "2026-07-15T12:00:00.000Z";
const TRADED_AT = "2026-07-15T12:00:01.000Z";
const SETTLED_AT = "2026-07-15T12:00:02.000Z";

function transferredFixture() {
  const asset = initialPlayState.inventory[0]!;
  const sellerActorId = canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } });
  const listing: WildzListing = {
    schema: "wildz.listing.v2",
    id: "listing:public-ownership-test",
    asset,
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    sellerActorId,
    sellerReceizUserId: "usr_seller",
    priceCents: 500,
    currency: "USD",
    status: "active",
    idempotencyKey: "listing:public-ownership-test",
    createdAt: LISTED_AT
  };
  const trade: WildzTradePlan = {
    schema: "wildz.trade_plan.v2",
    id: "trade:public-ownership-test",
    listingId: listing.id,
    assetId: listing.assetId,
    sellerActorId,
    buyerActorId: "buyer",
    priceCents: listing.priceCents,
    currency: listing.currency,
    idempotencyKey: "trade:public-ownership-test",
    createdAt: TRADED_AT
  };
  const receipt: WildzOwnershipReceipt = {
    schema: "receiz.wilds_ownership_receipt.v1",
    assetId: listing.assetId,
    proofDigest: listing.proofDigest,
    previousOwnerReceizId: sellerActorId,
    ownerReceizId: trade.buyerActorId,
    transferId: "transfer:public-ownership-test",
    ledgerEventId: "ledger:public-ownership-test",
    proofBundle: { schema: "receiz.proof_bundle.v1" },
    transferredAt: SETTLED_AT
  };
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: LISTED_AT });
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: TRADED_AT });
  state = advanceWildzMarketState(state, { type: "settlement-admitted", tradeId: trade.id, receipt }, { occurredAt: SETTLED_AT });
  return { asset, sellerActorId, state };
}

function railFor(state: ReturnType<typeof transferredFixture>["state"], verified: boolean): WildzMarketConditionalAppendRail {
  return {
    readLatest: async () => ({
      ok: true,
      state,
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: state.revision,
        previousAppendAnchorId: null,
        appendAnchorId: state.appendAnchorId,
        proofBundle: { schema: "receiz.append.proof.v1", signature: "remote" }
      }
    }),
    compareAndAppend: async () => ({ ok: false }),
    verifyAdmissionProof: async () => verified
  };
}

test("verified admitted ownership authorizes the current buyer and rejects the immutable-manifest seller", async () => {
  const { asset, sellerActorId, state } = transferredFixture();
  const authority = await loadVerifiedWildzPublicOwnershipAuthority({ wildzMarket: railFor(state, true) });

  assert.equal(requireCurrentWildzPublicOwner(authority, asset, "buyer", "wildz_public_card_owner_mismatch"), "buyer");
  assert.throws(
    () => requireCurrentWildzPublicOwner(authority, asset, sellerActorId, "wildz_public_card_owner_mismatch"),
    /wildz_public_card_owner_mismatch/
  );
});

test("a shaped ownership receipt without verified admission proof fails closed", async () => {
  const { state } = transferredFixture();

  await assert.rejects(
    loadVerifiedWildzPublicOwnershipAuthority({ wildzMarket: railFor(state, false) }),
    /market_capability_unavailable/
  );
});

test("without a conditional market rail, immutable manifest ownership remains the transfer-free baseline", async () => {
  const { asset, sellerActorId } = transferredFixture();
  const authority = await loadVerifiedWildzPublicOwnershipAuthority({});

  assert.equal(requireCurrentWildzPublicOwner(authority, asset, sellerActorId, "wildz_public_card_owner_mismatch"), sellerActorId);
});
