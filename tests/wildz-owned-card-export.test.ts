import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdentityKeyFile } from "@receiz/sdk";
import { matchesWildzOwnedCardExport } from "../src/lib/receiz/wildz-owned-card-export";
import { createWildzIdentityBoundPlayerVault } from "../src/lib/receiz/wildz-identity-vault-binding";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { initialPlayState } from "../src/features/play/game-state";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

test("retained signed card matches only its full current card, owner and signing identity", async () => {
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "saved-card-test", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "saved-card-test", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z", playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const bytes = await createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, vaultBytes: embedPortableVaultInPng(png, [asset], player) });
  const current = { asset, keyId: identity.keyFile.keyId, ownerReceizId: "keeper" };
  assert.equal(await matchesWildzOwnedCardExport(bytes, current), true);
  assert.equal(await matchesWildzOwnedCardExport(bytes, { ...current, ownerReceizId: "next_keeper" }), false);
  assert.equal(await matchesWildzOwnedCardExport(bytes, { ...current, keyId: "different-key" }), false);
  await assert.rejects(matchesWildzOwnedCardExport(bytes, { ...current, asset: { ...asset, manifest: { ...asset.manifest, name: "Changed card" } } }));
  const corrupt = bytes.slice(); corrupt[40] ^= 1;
  await assert.rejects(matchesWildzOwnedCardExport(corrupt, current));
});

// These ports exercise preparation/caching, not cryptographic verification.
// Canonical verification is tested separately with the real SDK.
async function preparationFixture() {
  const { createWildzIdentityOwnedCardPreparer } = await import("../src/lib/receiz/wildz-identity-adapter");
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "prepared-native-card", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "native-save", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z", playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const session = { keyId: identity.keyFile.keyId, username: "keeper", actorId: "keeper", localAuthority: "verified" } as Parameters<ReturnType<typeof createWildzIdentityOwnedCardPreparer>>[0];
  const counts = { render: 0, seal: 0, verify: 0, open: 0 };
  let payload = new Uint8Array();
  const exact = new TextEncoder().encode("opaque SDK artifact test double");
  let failSeal = false, failVerify = false;
  const dependencies: Parameters<typeof createWildzIdentityOwnedCardPreparer>[0] = {
    database: createMemoryWildzContinuityDatabase(),
    sources: { read: async () => null, locateAsset: async () => { throw new Error("no source scan"); }, retain: async () => { throw new Error("unused"); } },
    renderCard: async () => { counts.render++; return new Blob([png], { type: "image/png" }); },
    sign: async (_key, action) => action(identity.keyFile),
    seal: async blob => {
      counts.seal++;
      if (failSeal) throw new Error("test_seal_failed");
      payload = new Uint8Array(await blob.arrayBuffer());
      return { bytes: exact, filename: "card.receized.png", mimeType: "image/png" };
    },
    verifySeal: async (bytes, expected) => {
      counts.verify++;
      if (failVerify) throw new Error("test_verification_failed");
      assert.deepEqual(bytes, exact); assert.deepEqual(expected, payload);
    },
    openSeal: async input => {
      counts.open++; assert.deepEqual(input.bytes, exact);
      return { artifactBytes: exact, artifactSha256: "a".repeat(64), payloadBytes: payload,
        payloadSha256: "b".repeat(64), filename: "card.receized.png", mimeType: "image/png",
        ownerReceizId: "keeper.receiz.id", claimId: "test", verifyPath: "/v/test", recordId: "test",
        compatibility: "current-native" };
    }
  };
  return { dependencies, counts, asset, player, session, exact,
    prepare: createWildzIdentityOwnedCardPreparer(dependencies),
    reopen: () => createWildzIdentityOwnedCardPreparer(dependencies),
    failSeal: (value: boolean) => { failSeal = value; }, failVerify: (value: boolean) => { failVerify = value; } };
}

test("background preparation and Save share one seal and download only exact sealed bytes", async () => {
  const f = await preparationFixture();
  const [background, save] = await Promise.all([f.prepare(f.session, f.asset, f.player), f.prepare(f.session, f.asset, f.player)]);
  assert.equal(background, save);
  assert.deepEqual(save.bytes, f.exact);
  assert.deepEqual(f.counts, { render: 1, seal: 1, verify: 1, open: 1 });
  const reopened = await f.reopen()(f.session, f.asset, f.player);
  assert.deepEqual(reopened.bytes, f.exact);
  assert.equal(f.counts.seal, 1);
  assert.equal(f.counts.open, 2, "persisted artifact is independently reopened");
});

test("seal or verification failure cannot produce a downloadable card; a retry may succeed", async () => {
  const f = await preparationFixture();
  f.failSeal(true);
  await assert.rejects(f.prepare(f.session, f.asset, f.player), /test_seal_failed/);
  f.failSeal(false); f.failVerify(true);
  await assert.rejects(f.prepare(f.session, f.asset, f.player), /test_verification_failed/);
  f.failVerify(false);
  assert.deepEqual((await f.prepare(f.session, f.asset, f.player)).bytes, f.exact);
  assert.equal(f.counts.seal, 3);
});

test("old raw signed cache is not accepted as a prepared proof object", async () => {
  const f = await preparationFixture();
  const legacyKey = JSON.stringify(["wildz.prepared-local-card.v1", f.session.keyId, "keeper", f.asset.id]);
  await f.dependencies.database.transaction(["meta"], "readwrite", tx => tx.put("meta", { bytes: png, filename: "old.png", mimeType: "image/png" }, legacyKey));
  assert.deepEqual((await f.prepare(f.session, f.asset, f.player)).bytes, f.exact);
  assert.equal(f.counts.seal, 1);
  await assert.rejects(f.prepare(f.session, f.asset, { ...f.player, playerId: "someone_else" }), /owner_mismatch/);
});
