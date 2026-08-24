import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { WildzListing } from "../src/features/market/wildz-market";
import { initialPlayState } from "../src/features/play/game-state";
import { canonicalWildzActorId } from "../src/lib/receiz/wildz-identity-repository";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail,
  type WildzMarketConditionalAppendRail
} from "../src/lib/receiz/wildz-market-repository";
import { emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";

function listingFixture(): WildzListing {
  const asset = initialPlayState.inventory[0]!;
  const sellerActorId = canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } });
  return {
    schema: "wildz.listing.v2",
    id: "listing:repository-test",
    asset,
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    sellerActorId,
    sellerReceizUserId: "usr_seller",
    priceCents: 500,
    currency: "USD",
    status: "active",
    idempotencyKey: "listing:repository-test",
    createdAt: "2026-07-15T12:00:00.000Z"
  };
}

test("market repository refuses reads and appends without remote conditional proof", async () => {
  const state = emptyWildzMarketState();
  const repository = createReceizWildzMarketRepository({ rail: null });

  assert.deepEqual(await repository.load(), { status: "market_capability_unavailable" });
  assert.deepEqual(await repository.compareAndAppend({
    current: state,
    expectedRevision: 0,
    expectedAppendAnchorId: null,
    idempotencyKey: "listing:one",
    occurredAt: "2026-07-15T12:00:00.000Z",
    event: { type: "listing-cancelled", listingId: "listing:one", actorId: "fern" }
  }), { status: "market_capability_unavailable" });
});

test("market composes the universal verified public-store projection without in-memory authority", () => {
  const source = readFileSync("src/lib/receiz/wildz-market-repository.ts", "utf8");

  assert.match(source, /restoreLatestPublicStore/);
  assert.match(source, /publishPublicStore/);
  assert.doesNotMatch(source, /WildzPublicProjectionRepository|new Map|Map</);
  assert.match(source, /market_capability_unavailable/);
  assert.match(source, /expectedAppendAnchorId/);
  assert.match(source, /admissionProof/);
  assert.match(source, /verifyAdmissionProof/);
});

test("a brand-new verified Receiz market begins at source genesis and publishes its first addition", async () => {
  const publications: Record<string, unknown>[] = [];
  const rail = resolveWildzMarketConditionalAppendRail({
    restoreLatestPublicStore: async () => ({ ok: true, state: null }),
    publishPublicStore: async (input: Record<string, unknown>) => { publications.push(input); return { ok: true, appendProof: { schema: "receiz.public_store.append.v1" } }; }
  });
  assert.ok(rail);
  const repository = createReceizWildzMarketRepository({ rail });
  const loaded = await repository.load();
  assert.equal(loaded.status, "ready");
  if (loaded.status !== "ready") return;
  const listing = listingFixture();
  const admitted = await repository.compareAndAppend({
    current: loaded.state,
    expectedRevision: 0,
    expectedAppendAnchorId: null,
    idempotencyKey: listing.idempotencyKey,
    occurredAt: listing.createdAt,
    event: { type: "listing-admitted", listing }
  });
  assert.equal(admitted.status, "admitted");
  assert.equal((publications[0]?.state as { revision?: number }).revision, 1);
  assert.equal(publications[0]?.tenantHost, "wildz.quest");
});

test("market repository rejects a shaped snapshot whose proof fails verification", async () => {
  const state = emptyWildzMarketState();
  const repository = createReceizWildzMarketRepository({
    rail: {
      readLatest: async () => ({
        ok: true,
        state,
        admissionProof: {
          schema: "receiz.wildz_market_admission.v1",
          admittedRevision: 0,
          previousAppendAnchorId: null,
          appendAnchorId: null,
          proofBundle: { schema: "receiz.append.genesis_proof.v1" }
        }
      }),
      compareAndAppend: async () => ({ ok: false }),
      verifyAdmissionProof: async () => false
    }
  });

  assert.deepEqual(await repository.load(), { status: "market_capability_unavailable" });
});

test("a verified conditional append admits exactly one remote revision and anchor", async () => {
  const genesis = emptyWildzMarketState();
  const genesisProof = {
    schema: "receiz.wildz_market_admission.v1" as const,
    admittedRevision: 0,
    previousAppendAnchorId: null,
    appendAnchorId: null,
    proofBundle: { schema: "receiz.append.genesis_proof.v1" }
  };
  let appendCalls = 0;
  const rail: WildzMarketConditionalAppendRail = {
    readLatest: async () => ({ ok: true, state: genesis, admissionProof: genesisProof }),
    compareAndAppend: async (input) => {
      appendCalls += 1;
      return {
        ok: true,
        status: "admitted",
        state: { ...input.nextState, appendAnchorId: "anchor:1" },
        admissionProof: {
          schema: "receiz.wildz_market_admission.v1",
          admittedRevision: 1,
          previousAppendAnchorId: null,
          appendAnchorId: "anchor:1",
          proofBundle: { schema: "receiz.append.proof.v1", signature: "remote" }
        }
      };
    },
    verifyAdmissionProof: async () => true
  };
  const repository = createReceizWildzMarketRepository({ rail });
  const loaded = await repository.load();
  assert.equal(loaded.status, "ready");

  const listing = listingFixture();
  const result = await repository.compareAndAppend({
    current: genesis,
    expectedRevision: 0,
    expectedAppendAnchorId: null,
    idempotencyKey: listing.idempotencyKey,
    occurredAt: listing.createdAt,
    event: { type: "listing-admitted", listing }
  });

  assert.equal(result.status, "admitted");
  if (result.status === "admitted") {
    assert.equal(result.state.revision, 1);
    assert.equal(result.state.appendAnchorId, "anchor:1");
    assert.equal(result.admissionProof.appendAnchorId, "anchor:1");
  }
  assert.equal(appendCalls, 1);
});
