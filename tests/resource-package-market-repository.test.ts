import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsResourcePackage } from "../src/features/play/wilds-resource-package";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { emptyResourcePackageMarketState, type ResourcePackageMarketListing, type ResourcePackageMarketState } from "../src/features/market/resource-package-market";
import { createResourcePackageMarketRepository, RESOURCE_PACKAGE_MARKET_NAMESPACE, type ResourcePackageMarketConditionalRail } from "../src/lib/receiz/resource-package-market-repository";

function listing(): ResourcePackageMarketListing {
  const source = projectWildsResourceRegion(0, 0).find(item => item.kind === "hay")!;
  const lot = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: "sender.receiz.id", actorPosition: source.position, kaiUPulse: 100 }).lot;
  const packageProof = createWildsResourcePackage({ ownerReceizId: "sender.receiz.id", createdKaiUPulse: 100, commandId: "market:test-pack", members: [{ kind: "material", id: lot.lotId, materialLot: lot }] });
  return { schema: "wildz.resource-package-listing.v1", id: "pack-listing:test", package: packageProof, packageId: packageProof.packageId, packageHead: packageProof.head, subjectId: "subject:one", sellerActorId: "sender", sellerHandle: "sender.receiz.id", sellerReceizUserId: "usr_sender", priceCents: 500, currency: "USD", status: "active", sealedOffer: "encrypted-offer", idempotencyKey: "listing:test", createdAt: "2026-10-07T12:00:00.000Z" };
}
function atomicFixture() {
  let state: ResourcePackageMarketState | null = null, validProof = true;
  const submissions: Array<Parameters<ResourcePackageMarketConditionalRail["compareAndAppend"]>[0]> = [];
  const admissionProof = (value: ResourcePackageMarketState | null) => `proof:${RESOURCE_PACKAGE_MARKET_NAMESPACE}:${value?.revision ?? 0}:${value?.appendAnchorId ?? "genesis"}`;
  const response = (status = state ? "ready" : "not_found") => ({ status, state, admissionProof: admissionProof(state) });
  const rail: ResourcePackageMarketConditionalRail = {
    readLatest: async () => response(),
    compareAndAppend: async input => {
      submissions.push(input);
      if (input.expectedHead.revision !== (state?.revision ?? 0) || input.expectedHead.appendAnchorId !== (state?.appendAnchorId ?? null)) return response("conflict");
      state = input.state;
      return response("admitted");
    },
    verifyAdmissionProof: async input => validProof && input.namespace === RESOURCE_PACKAGE_MARKET_NAMESPACE && input.proof === admissionProof(input.state)
  };
  return { rail, submissions, state: () => state, invalidateProof: () => { validProof = false; } };
}

test("resource market admission requires an atomic append proof for the exact successor", async () => {
  const item = listing();
  const atomic = atomicFixture(), repository = createResourcePackageMarketRepository({ client: { wildzResourcePackageMarket: atomic.rail } });
  const result = await repository.append({ current: emptyResourcePackageMarketState(), event: { type: "listed", listing: item }, idempotencyKey: "listing:test", occurredAt: item.createdAt });
  assert.equal(result.status, "admitted");
  assert.equal(atomic.submissions[0]?.namespace, "wildz:resource-package-market:v1");
  assert.deepEqual(atomic.submissions[0]?.expectedHead, { revision: 0, appendAnchorId: null });
  if (result.status === "admitted") { assert.equal(result.state.revision, 1); assert.match(result.state.appendAnchorId ?? "", /^ps:[a-f0-9]{64}$/); }
  atomic.invalidateProof();
  assert.equal((await repository.load()).status, "market_capability_unavailable");
});
test("resource market loading fails closed on malformed remote records or transport failure", async () => {
  const atomic = atomicFixture();
  const malformed = createResourcePackageMarketRepository({ wildzResourcePackageMarket: { ...atomic.rail, readLatest: async () => ({ state: { ...emptyResourcePackageMarketState(), revision: -1 }, admissionProof: "invalid" }) } });
  assert.equal((await malformed.load()).status, "market_capability_unavailable");
  const unavailable = createResourcePackageMarketRepository({ wildzResourcePackageMarket: { ...atomic.rail, readLatest: async () => { throw Error("offline"); } } });
  assert.equal((await unavailable.load()).status, "market_capability_unavailable");
});

test("a public feed with exact acknowledgment cannot provide resource market custody or payment admission", async () => {
  let publicStoreCalls = 0;
  const weak = createResourcePackageMarketRepository({ restoreLatestPublicStore: async () => { publicStoreCalls++; return { status: "not_found" }; }, publishPublicStore: async (input: { state: unknown }) => { publicStoreCalls++; return { ok: true, accepted: 1, state: input.state }; } });
  assert.equal((await weak.load()).status, "market_capability_unavailable");
  const item = listing();
  assert.equal((await weak.append({ current: emptyResourcePackageMarketState(), event: { type: "listed", listing: item }, idempotencyKey: item.idempotencyKey, occurredAt: item.createdAt })).status, "market_capability_unavailable");
  assert.equal(publicStoreCalls, 0);
});

test("two concurrent market successors admit only one exact conditional append", async () => {
  const atomic = atomicFixture(), repository = createResourcePackageMarketRepository({ wildzResourcePackageMarket: atomic.rail });
  const left = listing(), right = { ...listing(), id: "pack-listing:other", idempotencyKey: "listing:other" };
  const results = await Promise.all([left, right].map(item => repository.append({ current: emptyResourcePackageMarketState(), event: { type: "listed", listing: item }, idempotencyKey: item.idempotencyKey, occurredAt: item.createdAt })));
  assert.deepEqual(results.map(result => result.status).sort(), ["admitted", "market_revision_conflict"]);
  assert.equal(atomic.submissions.length, 2);
  assert.equal(atomic.state()?.revision, 1);
  assert.equal(Object.keys(atomic.state()?.listings ?? {}).length, 1);
});
