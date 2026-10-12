import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { sealCollectedCard, verifyAnyWildsCard } from "../src/features/play/portable-card";
import { wildzMarketValueListingBindsCardV129 } from "../src/lib/receiz/wildz-market-value-listing-guard-v129";
import { parseWildzMarketPublicValueProjectionPayloadV129, wildzMarketValueProjectionSourceDigestV129 } from "../src/lib/receiz/wildz-market-public-value-source-v129";
import { validateWildzMarketSelectionV128 } from "../src/lib/receiz/wildz-market-source-journal-v128";

const publisher = "value.seller.receiz.id";
const origin = { formId: "mintcub-1", ownerReceizId: publisher, encounterId: "immutable-value-listing" };
const card = sealCollectedCard({ ...origin, capturedAt: "2026-07-15T12:00:00.000Z" });
const sameIdDifferentProof = sealCollectedCard({ ...origin, capturedAt: "2026-07-16T12:00:00.000Z" });
const projection = parseWildzMarketPublicValueProjectionPayloadV129({ schema: "wildz.creature-projection.v128",
  sourceArtifactSha256: "a".repeat(64), sourceHeadReference: "native:head", card });
const certificate = { card, sourceDigest: wildzMarketValueProjectionSourceDigestV129("b".repeat(64), projection) };
// Independently construct the existing native canonical preimage/hex digest.
const nativeDigest = createHash("sha256").update(JSON.stringify({ asset: { assetId: card.id, kind: "creature" },
  head: "native:head", original: "a".repeat(64), projection: "b".repeat(64), schema: "wildz.market.creature-selection.v128" })).digest("hex");
const listing = {
  sellerHandle: publisher, status: "active" as const,
  selection: { asset: { kind: "creature" as const, assetId: card.id },
    semanticIds: [`creature:native-creature:${"d".repeat(64)}`], sourceDigest: nativeDigest, summary: "Native listed creature", resourceUnits: 0, creatureCount: 1 }
};

test("first value issuance accepts the exact card proof in an active or reserved native listing", () => {
  assert.deepEqual(validateWildzMarketSelectionV128(listing.selection), listing.selection);
  assert.equal(wildzMarketValueListingBindsCardV129(listing, publisher, card, certificate), true);
  assert.equal(wildzMarketValueListingBindsCardV129({ ...listing, status: "reserved" }, publisher, card, certificate), true);
});

test("same asset ID with a different valid local proof cannot issue the first public value origin", () => {
  assert.equal(verifyAnyWildsCard(card).ok, true);
  assert.equal(verifyAnyWildsCard(sameIdDifferentProof).ok, true);
  assert.equal(sameIdDifferentProof.id, card.id);
  assert.notEqual(sameIdDifferentProof.proof.digest, card.proof.digest);
  assert.equal(wildzMarketValueListingBindsCardV129(listing, publisher, sameIdDifferentProof, certificate), false);
});

test("six-field native listing needs a separate matching certificate for first value issuance", () => {
  assert.equal(Object.keys(listing.selection).length, 6);
  assert.equal(wildzMarketValueListingBindsCardV129(listing, publisher, card), false);
  assert.equal(listing.status, "active");
});

test("foreign projection, Original or native head cannot satisfy the admitted selection digest", () => {
  for (const changed of [
    { projection: "c".repeat(64), payload: projection },
    { projection: "b".repeat(64), payload: { ...projection, sourceArtifactSha256: "c".repeat(64) } },
    { projection: "b".repeat(64), payload: { ...projection, sourceHeadReference: "native:other-head" } }
  ]) {
    const foreign = { card, sourceDigest: wildzMarketValueProjectionSourceDigestV129(changed.projection, changed.payload) };
    assert.equal(wildzMarketValueListingBindsCardV129(listing, publisher, card, foreign), false);
  }
});

test("foreign seller, foreign asset and closed native listing cannot issue a value origin", () => {
  assert.equal(wildzMarketValueListingBindsCardV129(listing, "stranger.receiz.id", card, certificate), false);
  assert.equal(wildzMarketValueListingBindsCardV129({ ...listing, selection: { ...listing.selection, asset: { kind: "creature", assetId: `wilds:${"f".repeat(24)}` } } }, publisher, card, certificate), false);
  assert.equal(wildzMarketValueListingBindsCardV129({ ...listing, status: "cancelled" }, publisher, card, certificate), false);
  assert.equal(wildzMarketValueListingBindsCardV129({ ...listing, status: "sold" }, publisher, card, certificate), false);
});
