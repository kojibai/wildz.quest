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

test("Vault reopening and repeated Save use retained signed bytes without renderer, signer or sealing request", async () => {
  const { createWildzIdentityOwnedCardPreparer } = await import("../src/lib/receiz/wildz-identity-adapter");
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const { receizBase64UrlEncode } = await import("@receiz/sdk");
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "retained-card-test", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "retained-card-test", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z",
    playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const bytes = await createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, vaultBytes: embedPortableVaultInPng(png, [asset], player) });
  const session = { keyId: identity.keyFile.keyId, username: "keeper", actorId: "keeper", localAuthority: "verified" } as Parameters<ReturnType<typeof createWildzIdentityOwnedCardPreparer>>[0];
  const sha = "a".repeat(64);
  let reads = 0, renders = 0, signs = 0, networkSeals = 0;
  // This port represents already verified exact source custody. Inner owner/card
  // validation still uses the real signature above; no claimed metadata is trusted.
  const dependencies: Parameters<typeof createWildzIdentityOwnedCardPreparer>[0] = {
    database: createMemoryWildzContinuityDatabase(),
    sources: {
      locateAsset: async () => ({ artifactSha256s: [sha], nextCursor: null }),
      read: async () => { reads++; return { artifact: { schema: "receiz.sealed-artifact-bytes.v124", exactBytesB64u: receizBase64UrlEncode(bytes), filename: "keeper.png", mimeType: "image/png", artifactSha256: sha, payloadSha256: "b".repeat(64) }, predecessors: [] }; },
      retain: async () => { throw new Error("must not reseal retained artifact"); }
    },
    renderCard: async () => { renders++; throw new Error("must not redraw retained card"); },
    sign: async () => { signs++; throw new Error("must not sign retained card"); },
    seal: async () => { networkSeals++; throw new Error("must not post seal request"); },
    verifySeal: async () => { throw new Error("retained source already verified"); }
  };
  const prepare = createWildzIdentityOwnedCardPreparer(dependencies);
  const opening = prepare(session, asset, player, { allowPrompt: false });
  const clickingSave = prepare(session, asset, player);
  assert.deepEqual((await opening).bytes, bytes);
  assert.equal(await clickingSave, await opening);
  assert.deepEqual((await prepare(session, asset, player)).bytes, bytes);
  assert.equal(reads, 1);
  // A fresh page/controller has no in-memory preparation but reads the exact
  // persisted digest and returns the same bytes without signing or networking.
  const reopened = createWildzIdentityOwnedCardPreparer(dependencies);
  assert.deepEqual((await reopened(session, asset, player)).bytes, bytes);
  assert.equal(reads, 2);
  assert.deepEqual({ renders, signs, networkSeals }, { renders: 0, signs: 0, networkSeals: 0 });
});

test("local retention failure cannot turn a verified fresh export into a failed Save", async () => {
  const { createWildzIdentityOwnedCardPreparer } = await import("../src/lib/receiz/wildz-identity-adapter");
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "retention-failure-test", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "retention-failure-test", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z",
    playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const session = { keyId: identity.keyFile.keyId, username: "keeper", actorId: "keeper", localAuthority: "verified" } as Parameters<ReturnType<typeof createWildzIdentityOwnedCardPreparer>>[0];
  let seals = 0, verifies = 0, retentions = 0;
  const prepare = createWildzIdentityOwnedCardPreparer({
    database: createMemoryWildzContinuityDatabase(),
    sources: { locateAsset: async () => ({ artifactSha256s: [], nextCursor: null }), read: async () => null,
      retain: async () => { retentions++; throw new Error("storage quota exceeded"); } },
    renderCard: async () => new Blob([png], { type: "image/png" }),
    sign: async (_key, action) => action(identity.keyFile),
    seal: async payload => { seals++; return { bytes: new Uint8Array(await payload.arrayBuffer()), filename: "test.receizbundle", mimeType: "application/vnd.receiz.bundle+json" }; },
    // The verified-seal port is isolated here so the test exercises persistence
    // failure after admission; cryptographic matching is tested above.
    verifySeal: async () => { verifies++; }
  });
  const saved = await prepare(session, asset, player);
  assert.ok(saved.bytes.length > png.length);
  assert.equal(await prepare(session, asset, player), saved);
  assert.deepEqual({ seals, verifies, retentions }, { seals: 1, verifies: 1, retentions: 1 });
});
