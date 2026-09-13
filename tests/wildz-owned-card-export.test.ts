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
  const { cardArtifactFingerprint } = await import("../src/features/play/prepared-card-artifact");
  const cacheKey = JSON.stringify(["wildz.prepared-owned-card.v1", session.keyId, "keeper", asset.id, cardArtifactFingerprint(asset)]);
  await dependencies.database.transaction(["meta"], "readwrite", tx => tx.put("meta", sha, cacheKey));
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

for (const originalOwner of ["keeper", "previous_keeper"]) test(`fresh Save preserves ${originalOwner} provenance and never requests another seal`, async () => {
  const { createWildzIdentityOwnedCardPreparer } = await import("../src/lib/receiz/wildz-identity-adapter");
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "retention-failure-test", username: "keeper" } });
  const asset = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: originalOwner, encounterId: "retention-failure-test", capturedAt: "2026-07-15T21:00:00.000Z" }), "2026-07-15T21:00:00.000Z");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-07-15T21:01:00.000Z",
    playState: { ...initialPlayState, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const session = { keyId: identity.keyFile.keyId, username: "keeper", actorId: "keeper", localAuthority: "verified" } as Parameters<ReturnType<typeof createWildzIdentityOwnedCardPreparer>>[0];
  let seals = 0, verifies = 0, retentions = 0, renders = 0, signs = 0;
  const dependencies: Parameters<typeof createWildzIdentityOwnedCardPreparer>[0] = {
    database: createMemoryWildzContinuityDatabase(),
    sources: { locateAsset: async () => { throw new Error("Save must not scan source history"); }, read: async () => null,
      retain: async () => { retentions++; throw new Error("storage quota exceeded"); } },
    renderCard: async () => { renders++; return new Blob([png], { type: "image/png" }); },
    sign: async (_key, action) => { signs++; return action(identity.keyFile); },
    seal: async payload => { seals++; return { bytes: new Uint8Array(await payload.arrayBuffer()), filename: "test.receizbundle", mimeType: "application/vnd.receiz.bundle+json" }; },
    // Neither remote operation is part of local card saving.
    verifySeal: async () => { verifies++; }
  };
  const prepare = createWildzIdentityOwnedCardPreparer(dependencies);
  const { downloadRestoredWildzCard } = await import("../src/lib/receiz/wildz-upload-card-download");
  let downloaded: Blob | undefined;
  let downloads = 0;
  const outcome = { restoreStatus: "committed" as const, surface: "card-vault" as const,
    artifactKind: "card-vault" as const, session, playState: player.playState, character: null,
    playerContinuity: { settings: player.settings, personalEvents: player.personalEvents,
      canonicalCursor: player.canonicalCursor, receipts: player.receipts },
    verifiedAssetIds: [asset.id], commerceProjection: null };
  const saved = await downloadRestoredWildzCard(outcome, asset.id, { prepare,
    download: (blob, filename) => { downloads++; downloaded = blob; assert.ok(filename.endsWith(".png")); } });
  assert.equal(downloads, 1, "successful upload starts its download without another Save action");
  assert.deepEqual(new Uint8Array(await downloaded!.arrayBuffer()), saved.bytes);
  await assert.rejects(downloadRestoredWildzCard({ ...outcome, verifiedAssetIds: [] }, asset.id, {
    prepare, download: () => { downloads++; }
  }), /upload_card_missing/);
  assert.equal(downloads, 1, "unverified card never downloads");
  assert.ok(saved.bytes.length > png.length);
  assert.equal(asset.manifest.ownerReceizId, originalOwner);
  await assert.rejects(prepare(session, asset, { ...player, playerId: "someone_else" }), /owner_mismatch/);
  await assert.rejects(prepare(session, asset, { ...player, playState: { ...player.playState, inventory: [] } }), /owner_mismatch/);
  assert.equal(await prepare(session, asset, player), saved);
  assert.deepEqual({ seals, verifies, retentions }, { seals: 0, verifies: 0, retentions: 0 });
  assert.equal(saved.mimeType, "image/png");
  assert.equal(await matchesWildzOwnedCardExport(saved.bytes, { asset, keyId: session.keyId, ownerReceizId: "keeper" }), true);
  const { createWildzArtifactCodec } = await import("../src/lib/receiz/wildz-artifact-codec");
  const { createWildzIdentityRepository } = await import("../src/lib/receiz/wildz-identity-repository");
  const { inspectReceizCommerceVault } = await import("../src/lib/receiz/receiz-commerce-vault");
  const codec = createWildzArtifactCodec({ identityRepository: createWildzIdentityRepository({ database: createMemoryWildzContinuityDatabase() }),
    commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  const opened = await codec.inspect({ bytes: saved.bytes, mimeType: saved.mimeType, name: saved.filename });
  assert.equal(opened.kind, "card-vault");
  if (opened.kind === "card-vault") assert.deepEqual(opened.assets, [asset]);
  const reopened = createWildzIdentityOwnedCardPreparer(dependencies);
  assert.deepEqual((await reopened(session, asset, player)).bytes, saved.bytes);
  assert.deepEqual({ renders, signs, seals, verifies }, { renders: 1, signs: 1, seals: 0, verifies: 0 });
});

test("a freshly caught V1 card saves after deterministic living-card admission", async () => {
  const { applyWildsInput } = await import("../src/features/play/game-state");
  const identity = await createReceizIdentityKeyFile({ owner: { uid: "fresh-capture-save", username: "keeper" } });
  const state = applyWildsInput({ ...initialPlayState, player: { x: 1.6, z: -2.1 } }, {
    type: "capture", encounterId: "fresh-capture-save", capturedAt: "2026-09-13T18:00:00.000Z", ownerReceizId: "keeper"
  });
  const asset = state.inventory.at(-1)!;
  assert.equal(asset.manifest.schema, "receiz.wilds_card_manifest.v1");
  const player = createWildsPlayerVault({ playerId: "keeper", exportedAt: "2026-09-13T18:01:00.000Z",
    playState: { ...state, inventory: [asset] }, settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] });
  const bytes = await createWildzIdentityBoundPlayerVault({ keyFile: identity.keyFile, vaultBytes: embedPortableVaultInPng(png, [asset], player) });
  assert.equal(await matchesWildzOwnedCardExport(bytes, { asset, keyId: identity.keyFile.keyId, ownerReceizId: "keeper" }), true);
  const { createWildzIdentityOwnedCardPreparer } = await import("../src/lib/receiz/wildz-identity-adapter");
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const prepare = createWildzIdentityOwnedCardPreparer({
    database: createMemoryWildzContinuityDatabase(),
    sources: { read: async () => null, locateAsset: async () => { throw new Error("no remote discovery"); }, retain: async () => { throw new Error("no reseal"); } },
    renderCard: async () => new Blob([png], { type: "image/png" }),
    sign: async (_key, action) => action(identity.keyFile),
    seal: async () => { throw new Error("Save must not reseal"); },
    verifySeal: async () => { throw new Error("Save must not fetch"); }
  });
  const session = { keyId: identity.keyFile.keyId, username: "keeper", actorId: "keeper", localAuthority: "verified" } as Parameters<typeof prepare>[0];
  const saved = await prepare(session, asset, player);
  assert.equal(await prepare(session, asset, player), saved);
  const { createWildzArtifactCodec } = await import("../src/lib/receiz/wildz-artifact-codec");
  const { createWildzIdentityRepository } = await import("../src/lib/receiz/wildz-identity-repository");
  const { inspectReceizCommerceVault } = await import("../src/lib/receiz/receiz-commerce-vault");
  const { wildzVaultUploadDisposition } = await import("../src/features/identity/wildz-restore");
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  const opened = await codec.inspect({ bytes: saved.bytes, mimeType: saved.mimeType, name: saved.filename });
  assert.equal(opened.kind, "card-vault");
  assert.equal(wildzVaultUploadDisposition(opened, "keeper"), "merge-owned");
  if (opened.kind === "card-vault") assert.ok(opened.assets.some(card => card.id === asset.id));
  const { restoreWildzArtifactForSurface } = await import("../src/features/identity/wildz-restore");
  const { serializeReceizIdentityArtifact } = await import("@receiz/sdk");
  await repository.bootstrap();
  await restoreWildzArtifactForSurface({ surface: "genesis", bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(identity.keyFile)),
    mimeType: "application/json", name: "keeper.receiz-key.json", codec, repository, database, confirmCardOnly: true });
  const restored = await restoreWildzArtifactForSurface({ surface: "card-vault", preserveActiveIdentity: true, bytes: saved.bytes,
    mimeType: saved.mimeType, name: saved.filename, codec, repository, database, confirmCardOnly: true });
  assert.ok(restored.playState.inventory.some(card => card.id === asset.id), "upload adds the caught creature to the active Vault");
});
