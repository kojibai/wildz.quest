import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizBearerTransferReceiptV1 } from "@receiz/sdk";
import { createWildsResourcePackage } from "../src/features/play/wilds-resource-package";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { advanceResourcePackageMarketState, emptyResourcePackageMarketState, publicResourcePackageListing, restoreResourcePackageMarketState, type ResourcePackageMarketState } from "../src/features/market/resource-package-market";
import { cancelResourcePackageMarketListing, listResourcePackageForMarket, purchaseResourcePackageMarketTrade, releaseResourcePackageMarketTrade, reserveResourcePackageMarketTrade, type ResourcePackageMarketCustody } from "../src/lib/receiz/resource-package-market";
import type { ResourcePackageMarketRepository } from "../src/lib/receiz/resource-package-market-repository";
import { openResourcePackageMarketOffer, sealResourcePackageMarketOffer } from "../src/lib/receiz/resource-package-market-seal";
import { parseResourcePackageMarketListing, resourcePackageMarketRouteError } from "../src/lib/receiz/resource-package-market-route";

const seller = { actorId: "sender", profileHandle: "sender.receiz.id", receizUserId: "usr_sender", accessToken: "cookie_sender" };
const buyer = { actorId: "buyer", profileHandle: "buyer.receiz.id", receizUserId: "usr_buyer", accessToken: "cookie_buyer" };
const secret = "test-resource-market-secret".repeat(2);
const NOW = "2026-10-07T12:00:00.000Z";
const proof = { kind: "receiz.proof_bundle", payloadVersion: "v2", createdAtMs: 1781524800000, ts: "2026-07-15T12:00:00.000Z", code: "PACK", slug: "package", verifyPath: "/v/package/PACK/1", verifyUrl: "https://receiz.com/v/package/PACK/1", kaiPulseEternal: "1", kaiKlok: "kai:1", receizClaimId: "a".repeat(32), sigilClaimSeed: "b".repeat(64) } as const;
async function fixture() {
  const source = projectWildsResourceRegion(0, 0).find(item => item.kind === "hay")!;
  const lot = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: seller.profileHandle, actorPosition: source.position, kaiUPulse: 100 }).lot;
  const packageProof = createWildsResourcePackage({ ownerReceizId: seller.profileHandle, createdKaiUPulse: 100, commandId: "market:test-pack", members: [{ kind: "material", id: lot.lotId, materialLot: lot }] });
  let state = emptyResourcePackageMarketState();
  let chargeCount = 0, claimCount = 0, nativeFailure = false, ledgerFailure = false;
  const paymentKeys: string[] = [];
  const repository: ResourcePackageMarketRepository = {
    load: async () => ({ status: "ready", state }),
    append: async input => {
      if (state.revision !== input.current.revision || state.appendAnchorId !== input.current.appendAnchorId) return { status: "market_revision_conflict", head: { revision: state.revision, appendAnchorId: state.appendAnchorId } };
      state = { ...advanceResourcePackageMarketState(state, input.event, input.occurredAt), appendAnchorId: `anchor:${state.revision + 1}` };
      return { status: "admitted", state };
    }
  };
  const receipt = { schema: "receiz.bearer.transfer_receipt.v1", receiptId: "native-receipt", transferId: "native-transfer", instrumentDigest: "a".repeat(64), subjectId: "subject:package", priorOwnerReceizId: seller.receizUserId, nextOwnerReceizId: buyer.receizUserId, nextSubjectHead: "b".repeat(64), nextOwnershipHead: "c".repeat(64) } as ReceizBearerTransferReceiptV1;
  const custody: ResourcePackageMarketCustody = {
    assertAvailable: async () => {},
    list: async () => ({ package: packageProof, subjectId: receipt.subjectId, offer: { privateInstrument: "must-stay-private" } }),
    reserve: async () => {}, startPayment: async () => {}, release: async () => {},
    claim: async () => { claimCount++; if (nativeFailure) throw Error("native unavailable"); return receipt; }
  };
  const rail = {
    connectTransfer: async (_body: unknown, nonce?: string) => { chargeCount++; paymentKeys.push(nonce ?? ""); return { ok: true, transferId: "payment-transfer", ledgerEventId: "payment-ledger", proofBundle: proof }; },
    walletLedger: async () => ({ ok: true, events: ledgerFailure ? [] : [{ id: "payment-ledger", kind: "transfer", amountUsdCents: "500", proofBundle: proof }] })
  };
  const listed = await listResourcePackageForMarket(repository, custody, { packageId: packageProof.packageId, priceCents: 500, expectedRevision: 0, expectedAppendAnchorId: null, idempotencyKey: "pack:list" }, seller, NOW, secret);
  assert.equal(listed.status, "admitted");
  const listing = Object.values(state.listings)[0]!;
  const reserved = await reserveResourcePackageMarketTrade(repository, custody, { listingId: listing.id, expectedRevision: state.revision, expectedAppendAnchorId: state.appendAnchorId, idempotencyKey: "pack:reserve" }, buyer, NOW);
  assert.equal(reserved.status, "admitted");
  const trade = Object.values(state.trades)[0]!;
  const input = { tradeId: trade.id, expectedRevision: state.revision, expectedAppendAnchorId: state.appendAnchorId };
  return { repository, custody, rail, input, listing, trade, packageProof, receipt, state: () => state, setState: (next: ResourcePackageMarketState) => { state = next; }, metrics: () => ({ chargeCount, claimCount, paymentKeys }), failNative: (fail: boolean) => { nativeFailure = fail; }, failLedger: (fail: boolean) => { ledgerFailure = fail; } };
}

test("resource listings keep exact package proof and never expose the native instrument", async () => {
  const data = await fixture();
  const dto = publicResourcePackageListing(data.listing);
  assert.deepEqual(dto.contents, [{ kind: "hay", quantity: 1 }]);
  assert.equal(JSON.stringify(dto).includes("must-stay-private"), false);
  assert.equal("sealedOffer" in dto, false);
  assert.equal("sellerReceizUserId" in dto, false);
  assert.equal("package" in dto, false);
  assert.equal(restoreResourcePackageMarketState(data.state())?.listings[data.listing.id]?.package.head, data.packageProof.head);
  assert.equal(restoreResourcePackageMarketState({ ...data.state(), listings: { [data.listing.id]: { ...data.listing, packageHead: "sha256:" + "f".repeat(64) } } }), null);
});

test("encrypted instruments bind the listing and reject another listing or secret", () => {
  const encrypted = sealResourcePackageMarketOffer({ instrument: "secret" }, "listing:one", secret);
  assert.equal(encrypted.includes("secret"), false);
  assert.deepEqual(openResourcePackageMarketOffer(encrypted, "listing:one", secret), { instrument: "secret" });
  assert.throws(() => openResourcePackageMarketOffer(encrypted, "listing:two", secret), /instrument_invalid/);
  assert.throws(() => openResourcePackageMarketOffer(encrypted, "listing:one", secret + "other"), /instrument_invalid/);
});

test("package listing requests reject price and owner authority injected by a client", async () => {
  const data = await fixture();
  const body = { packageId: data.packageProof.packageId, priceCents: 500, expectedRevision: 0, expectedAppendAnchorId: null };
  assert.deepEqual(parseResourcePackageMarketListing(body), body);
  assert.throws(() => parseResourcePackageMarketListing({ ...body, sellerReceizUserId: "intruder" }), /fields_invalid/);
  assert.throws(() => parseResourcePackageMarketListing({ ...body, priceCents: 49 }), /listing_invalid/);
});

test("stale or expired package checkout performs no wallet transfer", async () => {
  const data = await fixture();
  const stale = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, { ...data.input, expectedRevision: 0 }, buyer, NOW, secret);
  assert.equal(stale.status, "market_revision_conflict");
  const expired = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, "2026-10-07T12:05:00.000Z", secret);
  assert.equal(expired.status, "reservation_expired");
  assert.equal(data.metrics().chargeCount, 0);
});

test("only a matched payment ledger permits native package claim", async () => {
  const data = await fixture(); data.failLedger(true);
  const pending = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  assert.equal(pending.status, "recovery_pending");
  assert.equal(data.metrics().claimCount, 0);
  assert.equal(data.state().trades[data.trade.id]?.status, "paying");
  assert.throws(() => advanceResourcePackageMarketState(data.state(), { type: "cancelled", listingId: data.listing.id, actorId: seller.actorId }, "2026-10-07T13:00:00.000Z"), /listing_busy/);
  assert.throws(() => advanceResourcePackageMarketState(data.state(), { type: "released", tradeId: data.trade.id, actorId: buyer.actorId }, NOW), /release_invalid/);
  data.failLedger(false);
  const settled = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, "2026-10-07T13:00:00.000Z", secret);
  assert.equal(settled.status, "settled");
  assert.deepEqual(data.metrics().paymentKeys, [`wildz-package-transfer:${data.trade.id}`, `wildz-package-transfer:${data.trade.id}`]);
});

test("a paid package retries custody without paying again and settled replay preserves provenance", async () => {
  const data = await fixture(); data.failNative(true);
  const first = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  assert.equal(first.status, "recovery_pending"); assert.equal(data.state().trades[data.trade.id]?.status, "paid");
  data.failNative(false);
  const settled = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, "2026-10-07T13:00:00.000Z", secret);
  const replay = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, "2026-10-07T13:01:00.000Z", secret);
  assert.equal(settled.status, "settled"); assert.equal(replay.status, "settled");
  assert.equal(data.metrics().chargeCount, 1); assert.equal(data.metrics().claimCount, 2);
  if (settled.status === "settled") { assert.deepEqual(settled.package, data.packageProof); assert.equal(settled.package.ownerReceizId, seller.profileHandle); assert.equal(settled.receipt.nextOwnerReceizId, buyer.receizUserId); }
  assert.equal(data.state().listings[data.listing.id]?.status, "sold");
});

test("native package settlement rejects a receipt for another buyer", async () => {
  const data = await fixture();
  data.custody.claim = async () => ({ ...data.receipt, nextOwnerReceizId: "usr_intruder" });
  await assert.rejects(purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret), /custody_receipt_invalid/);
  assert.equal(data.state().trades[data.trade.id]?.status, "paid");
  assert.equal(data.state().listings[data.listing.id]?.status, "reserved");
});

test("a successful native claim survives final market publication failure", async () => {
  const data = await fixture();
  const append = data.repository.append;
  let failSettlement = true;
  data.repository.append = async input => {
    if (input.event.type === "settled" && failSettlement) { failSettlement = false; return { status: "market_capability_unavailable" }; }
    return append(input);
  };
  const pending = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  assert.equal(pending.status, "recovery_pending");
  assert.equal(data.state().trades[data.trade.id]?.status, "paid");
  const settled = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  assert.equal(settled.status, "settled");
  assert.equal(data.metrics().chargeCount, 1);
  assert.equal(data.metrics().claimCount, 2);
});

test("a paying package cannot be reserved by a different buyer after its initial deadline", async () => {
  const data = await fixture(); data.failLedger(true);
  await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  const current = data.state();
  await assert.rejects(reserveResourcePackageMarketTrade(data.repository, data.custody, { listingId: data.listing.id, expectedRevision: current.revision, expectedAppendAnchorId: current.appendAnchorId, idempotencyKey: "pack:intruder" }, { ...buyer, actorId: "other", receizUserId: "usr_other" }, "2026-10-07T13:00:00.000Z"), /listing_busy/);
  assert.equal(data.metrics().chargeCount, 1);
  assert.equal(data.state().trades[data.trade.id]?.buyerReceizUserId, buyer.receizUserId);
});

test("paying checkout recovery requires the atomic resource custody rail before another wallet attempt", async () => {
  const data = await fixture(); data.failLedger(true);
  await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  assert.equal(data.state().trades[data.trade.id]?.status, "paying");
  const before = data.metrics();
  data.custody.assertAvailable = async () => { throw Error("receiz_conditional_resource_custody_unavailable"); };
  await assert.rejects(purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret), /custody_unavailable/);
  assert.deepEqual(data.metrics(), before);
  assert.deepEqual(resourcePackageMarketRouteError(new Error("receiz_conditional_resource_custody_unavailable"), "fallback"), { status: 503, body: { error: "receiz_conditional_resource_custody_unavailable", status: "resource_custody_unavailable", ownershipTransferred: false } });
});

test("a failed atomic payment-started append never creates a permanent native payment lock", async () => {
  const data = await fixture(); let sourceStarts = 0;
  data.custody.startPayment = async () => { sourceStarts++; };
  const append = data.repository.append;
  data.repository.append = async input => input.event.type === "payment-started"
    ? { status: "market_revision_conflict", head: { revision: data.state().revision, appendAnchorId: data.state().appendAnchorId } }
    : append(input);
  const result = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  assert.equal(result.status, "market_revision_conflict");
  assert.equal(sourceStarts, 0); assert.equal(data.metrics().chargeCount, 0);
  assert.equal(data.state().trades[data.trade.id]?.status, "reserved");
});

test("a durable paying stage retries failed native custody after reservation expiry before charging", async () => {
  const data = await fixture(); let sourceStarts = 0;
  data.custody.startPayment = async () => {
    sourceStarts++;
    assert.equal(data.state().trades[data.trade.id]?.status, "paying");
    if (sourceStarts === 1) throw Error("native_source_append_unavailable");
  };
  const pending = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, NOW, secret);
  assert.equal(pending.status, "recovery_pending"); assert.equal(data.metrics().chargeCount, 0);
  assert.equal(data.state().trades[data.trade.id]?.status, "paying");
  const result = await purchaseResourcePackageMarketTrade(data.repository, data.rail as never, data.custody, data.input, buyer, "2026-10-07T13:00:00.000Z", secret);
  assert.equal(result.status, "settled"); assert.equal(sourceStarts, 2);
  assert.equal(data.metrics().chargeCount, 1); assert.equal(data.metrics().claimCount, 1);
});

test("seller cancellation never releases native custody before verified registry cancellation", async () => {
  for (const failure of ["conflict", "unavailable", "unknown"] as const) {
    const data = await fixture(); let releases = 0;
    data.custody.release = async () => { releases++; };
    data.repository.append = async () => {
      if (failure === "unknown") throw Error("append_outcome_unknown");
      return failure === "conflict" ? { status: "market_revision_conflict", head: { revision: data.state().revision, appendAnchorId: data.state().appendAnchorId } } : { status: "market_capability_unavailable" };
    };
    const cancel = () => cancelResourcePackageMarketListing(data.repository, data.custody, { listingId: data.listing.id, expectedRevision: data.state().revision, expectedAppendAnchorId: data.state().appendAnchorId, idempotencyKey: "pack:cancel" }, seller, "2026-10-07T13:00:00.000Z", secret);
    if (failure === "unknown") await assert.rejects(cancel(), /append_outcome_unknown/);
    else assert.equal((await cancel()).status, failure === "conflict" ? "market_revision_conflict" : "market_capability_unavailable");
    assert.equal(releases, 0); assert.equal(data.state().listings[data.listing.id]?.status, "reserved");
  }
});

test("cancelled listing replay repairs interrupted native cancellation using its original instrument", async () => {
  const data = await fixture(); let releases = 0;
  data.custody.release = async input => {
    releases++;
    assert.equal(data.state().listings[data.listing.id]?.status, "cancelled");
    assert.equal(input.listing.status, "cancelled");
    assert.deepEqual(input.offer, { privateInstrument: "must-stay-private" });
    assert.equal(input.listing.packageHead, data.packageProof.head);
    if (releases === 1) throw Error("native_cancel_outcome_unknown");
  };
  const input = { listingId: data.listing.id, expectedRevision: data.state().revision, expectedAppendAnchorId: data.state().appendAnchorId, idempotencyKey: "pack:cancel" };
  const pending = await cancelResourcePackageMarketListing(data.repository, data.custody, input, seller, "2026-10-07T13:00:00.000Z", secret);
  assert.equal(pending.status, "recovery_pending");
  assert.equal(data.state().listings[data.listing.id]?.status, "cancelled");
  const replay = await cancelResourcePackageMarketListing(data.repository, data.custody, input, seller, "2026-10-07T13:01:00.000Z", secret);
  assert.equal(replay.status, "replayed"); assert.equal(releases, 2);
  assert.equal(data.metrics().chargeCount, 0);
});

test("buyer release never clears a source reservation before verified registry release", async () => {
  for (const failure of ["conflict", "unavailable", "unknown"] as const) {
    const data = await fixture(); let releases = 0;
    data.custody.release = async () => { releases++; };
    data.repository.append = async () => {
      if (failure === "unknown") throw Error("append_outcome_unknown");
      return failure === "conflict" ? { status: "market_revision_conflict", head: { revision: data.state().revision, appendAnchorId: data.state().appendAnchorId } } : { status: "market_capability_unavailable" };
    };
    const release = () => releaseResourcePackageMarketTrade(data.repository, data.custody, { ...data.input, idempotencyKey: "pack:release" }, buyer, NOW, secret);
    if (failure === "unknown") await assert.rejects(release(), /append_outcome_unknown/);
    else assert.equal((await release()).status, failure === "conflict" ? "market_revision_conflict" : "market_capability_unavailable");
    assert.equal(releases, 0); assert.equal(data.state().trades[data.trade.id]?.status, "reserved");
  }
});

test("released trade tombstones repair interrupted cleanup after another buyer reserves the listing", async () => {
  const data = await fixture(); let releases = 0;
  data.custody.release = async input => {
    releases++;
    assert.equal(data.state().trades[data.trade.id]?.status, "released");
    assert.equal(input.trade?.id, data.trade.id); assert.equal(input.trade?.status, "released");
    assert.equal(input.trade?.buyerReceizUserId, buyer.receizUserId);
    assert.deepEqual(input.offer, { privateInstrument: "must-stay-private" });
    if (releases === 1) throw Error("source_release_outcome_unknown");
  };
  const input = { ...data.input, idempotencyKey: "pack:release" };
  const pending = await releaseResourcePackageMarketTrade(data.repository, data.custody, input, buyer, NOW, secret);
  assert.equal(pending.status, "recovery_pending");
  assert.equal(data.state().listings[data.listing.id]?.status, "active");
  const other = { ...buyer, actorId: "other", receizUserId: "usr_other", profileHandle: "other.receiz.id" };
  const reserved = await reserveResourcePackageMarketTrade(data.repository, data.custody, { listingId: data.listing.id, expectedRevision: data.state().revision, expectedAppendAnchorId: data.state().appendAnchorId, idempotencyKey: "pack:replacement" }, other, NOW);
  assert.equal(reserved.status, "admitted");
  assert.notEqual(restoreResourcePackageMarketState(data.state()), null);
  const replay = await releaseResourcePackageMarketTrade(data.repository, data.custody, input, buyer, NOW, secret);
  assert.equal(replay.status, "replayed"); assert.equal(releases, 2);
  assert.equal(data.state().trades[data.trade.id]?.status, "released");
  assert.equal(Object.values(data.state().trades).find(trade => trade.status === "reserved")?.buyerActorId, other.actorId);
  assert.equal(data.state().listings[data.listing.id]?.status, "reserved");
  await assert.rejects(releaseResourcePackageMarketTrade(data.repository, data.custody, input, { ...buyer, receizUserId: "usr_intruder" }, NOW, secret), /release_invalid/);
  assert.equal(data.metrics().chargeCount, 0);
});
